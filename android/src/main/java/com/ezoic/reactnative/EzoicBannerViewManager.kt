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
import com.ezoic.ads.sdk.adunits.EzoicBannerView
import com.ezoic.ads.sdk.adunits.EzoicBannerViewListener
import com.ezoic.ads.sdk.core.EzoicError

@ReactModule(name = EzoicBannerViewManager.NAME)
class EzoicBannerViewManager(private val ctx: ReactApplicationContext) :
  SimpleViewManager<EzoicBannerViewManager.BannerContainer>() {

  override fun getName() = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): BannerContainer {
    val container = BannerContainer(reactContext)
    container.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
    )
    return container
  }

  @ReactProp(name = "adUnitIdentifier")
  fun setAdUnitIdentifier(view: BannerContainer, value: String?) {
    view.adUnitId = value?.toIntOrNull() ?: 0
    maybeLoad(view)
  }

  @ReactProp(name = "size")
  fun setSize(view: BannerContainer, value: String?) {
    view.size = value ?: ""
    maybeLoad(view)
  }

  // Forwarded to the native view's `collapseOnNoFill` property. Applied to an
  // already-created banner too, so a prop change after load takes effect on
  // the next load outcome.
  @ReactProp(name = "collapseOnNoFill", defaultBoolean = true)
  fun setCollapseOnNoFill(view: BannerContainer, value: Boolean) {
    view.collapseOnNoFill = value
    view.banner?.collapseOnNoFill = value
  }

  private fun maybeLoad(view: BannerContainer) {
    if (view.loaded || view.adUnitId <= 0) return
    view.loaded = true
    val banner = EzoicBannerView(view.context, view.adUnitId)
    banner.collapseOnNoFill = view.collapseOnNoFill
    banner.listener = object : EzoicBannerViewListener {
      override fun onBannerLoaded(b: EzoicBannerView) = emit(view, "topLoad", Arguments.createMap())
      override fun onBannerLoadFailed(b: EzoicBannerView, error: EzoicError) {
        val map = Arguments.createMap()
        map.putString("message", error.message)
        map.putInt("code", error.code)
        emit(view, "topError", map)
      }
      override fun onBannerImpression(b: EzoicBannerView) = emit(view, "topImpression", Arguments.createMap())
      override fun onBannerClicked(b: EzoicBannerView) = emit(view, "topAdClick", Arguments.createMap())
      override fun onBannerOpened(b: EzoicBannerView) = emit(view, "topOpen", Arguments.createMap())
      override fun onBannerClosed(b: EzoicBannerView) = emit(view, "topClose", Arguments.createMap())
      // The native view collapses itself (GONE) or resizes to the loaded
      // creative, but this container is MATCH_PARENT inside the Yoga box, so
      // the JS component applies the height from this event.
      override fun onBannerSizeChanged(bannerView: EzoicBannerView, widthDp: Int, heightDp: Int) {
        val map = Arguments.createMap()
        map.putDouble("width", widthDp.toDouble())
        map.putDouble("height", heightDp.toDouble())
        emit(view, "topSizeChange", map)
      }
    }
    view.banner = banner
    view.removeAllViews()
    view.addView(banner)
    val sizes = view.size.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    if (sizes.isEmpty()) banner.loadAd() else banner.loadAd(sizes)
  }

  private fun emit(view: BannerContainer, event: String, payload: WritableMap) {
    ctx.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, event, payload)
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

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
    return mapOf(
      "topSizeChange" to mapOf("registrationName" to "onSizeChange")
    )
  }

  /**
   * Container for the native banner. RN lays out only Yoga-managed views; the
   * native [EzoicBannerView] is added from native code, so when JS changes the
   * Yoga box height (collapse to 0 / restore after a fill) the child must be
   * re-measured against the new bounds. Overriding [requestLayout] to post a
   * manual measure(EXACTLY)+layout of the current bounds is the same fix used
   * by [EzoicOutstreamAdViewManager] and [EzoicNativeAdViewManager].
   */
  class BannerContainer(context: Context) : FrameLayout(context) {
    var adUnitId: Int = 0
    var size: String = ""
    var loaded: Boolean = false
    var collapseOnNoFill: Boolean = true
    var banner: EzoicBannerView? = null

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
    const val NAME = "EzoicBannerView"
  }
}
