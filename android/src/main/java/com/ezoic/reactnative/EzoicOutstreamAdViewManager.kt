package com.ezoic.reactnative

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.ezoic.ads.sdk.adunits.EzoicOutstreamAdView
import com.ezoic.ads.sdk.adunits.EzoicOutstreamAdViewListener
import com.ezoic.ads.sdk.core.EzoicError

/**
 * Fabric view manager for the outstream video component. Mirrors
 * [EzoicNativeAdViewManager] exactly (deferred load, load guards, teardown,
 * manual measure/layout fix, bubbling-event registry) and differs only in the
 * body of [maybeLoad]: the native [EzoicOutstreamAdView] is itself the rendered
 * view (a `FrameLayout` that attaches its own GAM `AdManagerAdView`), so this
 * manager adds that native view as the container's child and lets it render —
 * there is no template to build as the native-ad manager does.
 */
@ReactModule(name = EzoicOutstreamAdViewManager.NAME)
class EzoicOutstreamAdViewManager(private val ctx: ReactApplicationContext) :
  SimpleViewManager<EzoicOutstreamAdViewManager.OutstreamAdContainer>() {

  override fun getName() = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): OutstreamAdContainer {
    val container = OutstreamAdContainer(reactContext)
    container.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
    )
    return container
  }

  @ReactProp(name = "adUnitIdentifier")
  fun setAdUnitIdentifier(view: OutstreamAdContainer, value: String?) {
    val newAdUnitId = value?.toIntOrNull() ?: 0
    // Ad unit changed after a load already started: tear down the loaded/loading
    // ad and clear the started flag so onAfterUpdateTransaction's maybeLoad
    // starts a fresh load for the new id.
    if (newAdUnitId != view.adUnitId && view.loadStarted) {
      view.ezoicOutstreamAd?.destroy()
      view.ezoicOutstreamAd = null
      view.removeAllViews()
      view.loadStarted = false
      view.loadGeneration++
    }
    view.adUnitId = newAdUnitId
    view.rawAdUnitId = value ?: ""
  }

  // Fabric sets every prop for the mount transaction before this runs, so the
  // ad unit id is final here. `view.post` escapes the mount transaction so the
  // synchronous native-SDK failure path (uninitialized) can't reenter the
  // mounting layer; the started flag survives repeated transactions.
  override fun onAfterUpdateTransaction(view: OutstreamAdContainer) {
    super.onAfterUpdateTransaction(view)
    view.post { maybeLoad(view) }
  }

  private fun maybeLoad(view: OutstreamAdContainer) {
    if (view.loadStarted || view.disposed) return
    if (view.adUnitId <= 0) {
      // Non-numeric or missing id coerces to 0 in setAdUnitIdentifier. Only
      // emit an error when a prop was actually supplied (non-empty raw
      // string); an unset prop should stay silent.
      if (view.rawAdUnitId.isNotEmpty()) {
        view.loadStarted = true
        emit(view, "topError", errorMap("Invalid ad unit identifier", 0))
      }
      return
    }
    view.loadStarted = true
    val generation = view.loadGeneration
    // The native outstream view renders itself. Attach the listener BEFORE
    // loadAd() so no early lifecycle callback is missed, add it to the
    // container, then load.
    val outstreamAd = EzoicOutstreamAdView(view.context, view.adUnitId)
    outstreamAd.listener = object : EzoicOutstreamAdViewListener {
      override fun onOutstreamLoaded(adView: EzoicOutstreamAdView) {
        // dispose() and this callback both arrive on the main thread, so the
        // check is race-free. A generation mismatch means the ad unit changed
        // mid-load (mirrors the SDK's isCurrentLoad token pattern): emit nothing.
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topLoad", Arguments.createMap())
      }

      override fun onOutstreamLoadFailed(adView: EzoicOutstreamAdView, error: EzoicError) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topError", errorMap(error.message, error.code))
      }

      override fun onOutstreamImpression(adView: EzoicOutstreamAdView) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topImpression", Arguments.createMap())
      }

      override fun onOutstreamClicked(adView: EzoicOutstreamAdView) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topAdClick", Arguments.createMap())
      }

      override fun onOutstreamOpened(adView: EzoicOutstreamAdView) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topOpen", Arguments.createMap())
      }

      override fun onOutstreamClosed(adView: EzoicOutstreamAdView) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topClose", Arguments.createMap())
      }
    }
    view.ezoicOutstreamAd = outstreamAd
    view.removeAllViews()
    view.addView(outstreamAd)
    outstreamAd.loadAd()
  }

  override fun onDropViewInstance(view: OutstreamAdContainer) {
    super.onDropViewInstance(view)
    view.disposed = true
    view.loadGeneration++
    view.ezoicOutstreamAd?.destroy()
    view.ezoicOutstreamAd = null
    view.removeAllViews()
  }

  private fun emit(view: OutstreamAdContainer, event: String, payload: WritableMap) {
    if (view.disposed) return
    ctx.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, event, payload)
  }

  private fun errorMap(message: String?, code: Int): WritableMap {
    val map = Arguments.createMap()
    map.putString("message", message ?: "")
    map.putInt("code", code)
    return map
  }

  override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> {
    fun reg(on: String) = mapOf("phasedRegistrationNames" to mapOf("bubbled" to on))
    return mapOf(
      "topLoad" to reg("onLoad"),
      "topError" to reg("onError"),
      "topImpression" to reg("onImpression"),
      "topAdClick" to reg("onAdClick"),
      "topOpen" to reg("onOpen"),
      "topClose" to reg("onClose")
    )
  }

  /**
   * Container for the native outstream view. RN lays out only Yoga-managed
   * views; the native [EzoicOutstreamAdView] is added from native code and stays
   * unmeasured (blank) unless we force a measure/layout pass. Overriding
   * [requestLayout] to post a manual measure(EXACTLY)+layout of the current
   * bounds is the proven fix (identical to [EzoicNativeAdViewManager]).
   */
  class OutstreamAdContainer(context: Context) : FrameLayout(context) {
    var adUnitId: Int = 0
    var rawAdUnitId: String = ""
    var loadStarted: Boolean = false
    var disposed: Boolean = false
    var loadGeneration: Int = 0
    var ezoicOutstreamAd: EzoicOutstreamAdView? = null

    private val measureAndLayout = Runnable {
      measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
      )
      layout(left, top, right, bottom)
    }

    override fun requestLayout() {
      super.requestLayout()
      post(measureAndLayout)
    }
  }

  companion object {
    const val NAME = "EzoicOutstreamAdView"
  }
}
