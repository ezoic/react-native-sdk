package com.ezoic.reactnative

import android.content.Context
import android.graphics.Typeface
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.ezoic.ads.sdk.adunits.EzoicNativeAd
import com.ezoic.ads.sdk.adunits.EzoicNativeAdListener
import com.ezoic.ads.sdk.adunits.EzoicNativeAdLoadListener
import com.ezoic.ads.sdk.core.EzoicError
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView

@ReactModule(name = EzoicNativeAdViewManager.NAME)
class EzoicNativeAdViewManager(private val ctx: ReactApplicationContext) :
  SimpleViewManager<EzoicNativeAdViewManager.NativeAdContainer>() {

  override fun getName() = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): NativeAdContainer {
    val container = NativeAdContainer(reactContext)
    container.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
    )
    return container
  }

  @ReactProp(name = "adUnitIdentifier")
  fun setAdUnitIdentifier(view: NativeAdContainer, value: String?) {
    val newAdUnitId = value?.toIntOrNull() ?: 0
    // Ad unit changed after a load already started: tear down the loaded/loading
    // ad and clear the started flag so onAfterUpdateTransaction's maybeLoad
    // starts a fresh load for the new id.
    if (newAdUnitId != view.adUnitId && view.loadStarted) {
      view.ezoicNativeAd?.destroy()
      view.ezoicNativeAd = null
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
  override fun onAfterUpdateTransaction(view: NativeAdContainer) {
    super.onAfterUpdateTransaction(view)
    view.post { maybeLoad(view) }
  }

  private fun maybeLoad(view: NativeAdContainer) {
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
    EzoicNativeAd.load(view.context, view.adUnitId, object : EzoicNativeAdLoadListener {
      override fun onNativeAdLoaded(nativeAd: EzoicNativeAd) {
        // dispose() and this callback both arrive on the main thread, so the
        // check is race-free. A late-arriving ad is destroyed, not rendered.
        // A generation mismatch means the ad unit changed mid-load (mirrors
        // the SDK's isCurrentLoad token pattern): destroy and emit nothing.
        if (view.disposed || view.loadGeneration != generation) {
          nativeAd.destroy()
          return
        }
        val gmaAd = nativeAd.nativeAd ?: run {
          // Empty-content ad: destroy it instead of keeping an unrenderable,
          // errored ad alive on the view.
          nativeAd.destroy()
          emit(view, "topError", errorMap("Native ad loaded without content", 0))
          return
        }
        view.ezoicNativeAd = nativeAd
        // Attach the lifecycle listener before the rendered NativeAdView
        // registers — the impression fires as soon as the view is displayed.
        nativeAd.listener = object : EzoicNativeAdListener {
          override fun onNativeAdImpression(nativeAd: EzoicNativeAd) =
            emit(view, "topImpression", Arguments.createMap())
          override fun onNativeAdClicked(nativeAd: EzoicNativeAd) =
            emit(view, "topAdClick", Arguments.createMap())
          override fun onNativeAdOpened(nativeAd: EzoicNativeAd) =
            emit(view, "topOpen", Arguments.createMap())
          override fun onNativeAdClosed(nativeAd: EzoicNativeAd) =
            emit(view, "topClose", Arguments.createMap())
        }
        val adView = buildTemplate(view.context, gmaAd)
        view.removeAllViews()
        view.addView(adView)
        emit(view, "topLoad", Arguments.createMap())
      }

      override fun onNativeAdFailedToLoad(error: EzoicError) {
        if (view.disposed || view.loadGeneration != generation) return
        emit(view, "topError", errorMap(error.message, error.code))
      }
    })
  }

  /**
   * Builds a template [NativeAdView] entirely in code (the module ships no
   * `res/` layouts). Layout: a vertical column of a header row (icon +
   * headline/advertiser), a [MediaView], the body text and a call-to-action
   * button. Only the asset views actually present on [gmaAd] are created and
   * registered; [NativeAdView.setNativeAd] is called last, as GMA requires.
   */
  private fun buildTemplate(context: Context, gmaAd: NativeAd): NativeAdView {
    val adView = NativeAdView(context)

    val root = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      )
      val pad = dp(context, 8)
      setPadding(pad, pad, pad, pad)
    }

    val headerRow = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    }

    var iconView: ImageView? = null
    gmaAd.icon?.drawable?.let { drawable ->
      val iv = ImageView(context).apply {
        layoutParams = LinearLayout.LayoutParams(dp(context, 40), dp(context, 40))
        setImageDrawable(drawable)
      }
      headerRow.addView(iv)
      iconView = iv
    }

    val textColumn = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.WRAP_CONTENT,
        1f,
      ).apply { leftMargin = dp(context, 8) }
    }

    var headlineView: TextView? = null
    gmaAd.headline?.let { text ->
      val tv = TextView(context).apply {
        this.text = text
        setTypeface(typeface, Typeface.BOLD)
        textSize = 16f
      }
      textColumn.addView(tv)
      headlineView = tv
    }

    var advertiserView: TextView? = null
    gmaAd.advertiser?.let { text ->
      val tv = TextView(context).apply {
        this.text = text
        textSize = 12f
      }
      textColumn.addView(tv)
      advertiserView = tv
    }

    headerRow.addView(textColumn)
    root.addView(headerRow)

    var mediaView: MediaView? = null
    gmaAd.mediaContent?.let { content ->
      val mv = MediaView(context).apply {
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          dp(context, 175),
        ).apply { topMargin = dp(context, 8) }
        mediaContent = content
      }
      root.addView(mv)
      mediaView = mv
    }

    var bodyView: TextView? = null
    gmaAd.body?.let { text ->
      val tv = TextView(context).apply {
        this.text = text
        textSize = 14f
        setPadding(0, dp(context, 8), 0, 0)
      }
      root.addView(tv)
      bodyView = tv
    }

    var callToActionView: Button? = null
    gmaAd.callToAction?.let { text ->
      val btn = Button(context).apply {
        this.text = text
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = dp(context, 8) }
      }
      root.addView(btn)
      callToActionView = btn
    }

    adView.addView(root)
    // Register only the asset views that were populated; a null assignment
    // leaves that asset unregistered.
    adView.headlineView = headlineView
    adView.bodyView = bodyView
    adView.iconView = iconView
    adView.advertiserView = advertiserView
    adView.callToActionView = callToActionView
    adView.mediaView = mediaView
    adView.setNativeAd(gmaAd)
    return adView
  }

  override fun onDropViewInstance(view: NativeAdContainer) {
    super.onDropViewInstance(view)
    view.disposed = true
    view.loadGeneration++
    view.ezoicNativeAd?.destroy()
    view.ezoicNativeAd = null
    view.removeAllViews()
  }

  private fun emit(view: NativeAdContainer, event: String, payload: WritableMap) {
    if (view.disposed) return
    ctx.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, event, payload)
  }

  private fun errorMap(message: String?, code: Int): WritableMap {
    val map = Arguments.createMap()
    map.putString("message", message ?: "")
    map.putInt("code", code)
    return map
  }

  private fun dp(context: Context, value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()

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
   * Container for the template ad view. RN lays out only Yoga-managed views;
   * the template [NativeAdView] is added from native code and stays unmeasured
   * (blank) unless we force a measure/layout pass. Overriding [requestLayout]
   * to post a manual measure(EXACTLY)+layout of the current bounds is the
   * proven fix (react-native-google-mobile-ads uses the same approach).
   */
  class NativeAdContainer(context: Context) : FrameLayout(context) {
    var adUnitId: Int = 0
    var rawAdUnitId: String = ""
    var loadStarted: Boolean = false
    var disposed: Boolean = false
    var loadGeneration: Int = 0
    var ezoicNativeAd: EzoicNativeAd? = null

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
    const val NAME = "EzoicNativeAdView"
  }
}
