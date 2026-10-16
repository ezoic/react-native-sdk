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

/**
 * Fabric view manager for the banner component. Follows the same lifecycle as
 * [EzoicNativeAdViewManager] / [EzoicOutstreamAdViewManager]: props are only
 * recorded by their setters, the load starts from [onAfterUpdateTransaction]
 * once every prop of the mount transaction is applied, and the container is
 * torn down in [onDropViewInstance].
 *
 * Loading from a prop setter (the pre-1.13.3 behaviour) raced the prop order:
 * `adUnitIdentifier` was applied before `size`, so the banner loaded with no
 * sizes and the SDK's adaptive default (320x50 on phones) ignored the
 * requested size.
 */
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
    val newAdUnitId = value?.toIntOrNull() ?: 0
    // Ad unit changed after a load already started: tear down the current
    // banner so onAfterUpdateTransaction's maybeLoad starts a fresh load.
    if (newAdUnitId != view.adUnitId && view.loadStarted) {
      resetForReload(view)
    }
    view.adUnitId = newAdUnitId
    view.rawAdUnitId = value ?: ""
  }

  @ReactProp(name = "size")
  fun setSize(view: BannerContainer, value: String?) {
    val newSize = value ?: ""
    // Size changed after a load already started: the native SDK takes the
    // sizes at loadAd(), so reload with the new request.
    if (newSize != view.size && view.loadStarted) {
      resetForReload(view)
    }
    view.size = newSize
  }

  // Forwarded to the native view's `collapseOnNoFill` property. Applied to an
  // already-created banner too, so a prop change after load takes effect on
  // the next load outcome.
  @ReactProp(name = "collapseOnNoFill", defaultBoolean = true)
  fun setCollapseOnNoFill(view: BannerContainer, value: Boolean) {
    view.collapseOnNoFill = value
    view.banner?.collapseOnNoFill = value
  }

  // Refresh overrides: -1 (the codegen default) means "not set", which the
  // native banner reads as null = follow the server. Read at loadAd(), so a
  // change after the banner loaded takes effect on its next load.
  @ReactProp(name = "refreshIntervalSeconds", defaultInt = REFRESH_UNSET)
  fun setRefreshIntervalSeconds(view: BannerContainer, value: Int) {
    view.refreshIntervalSeconds = refreshOverride(value)
    view.banner?.refreshIntervalSeconds = view.refreshIntervalSeconds
  }

  @ReactProp(name = "refreshMaxCount", defaultInt = REFRESH_UNSET)
  fun setRefreshMaxCount(view: BannerContainer, value: Int) {
    view.refreshMaxCount = refreshOverride(value)
    view.banner?.refreshMaxCount = view.refreshMaxCount
  }

  // Fabric sets every prop for the mount transaction before this runs, so the
  // ad unit id and size are final here. `view.post` escapes the mount
  // transaction so the synchronous native-SDK failure path (uninitialized)
  // can't reenter the mounting layer; the started flag survives repeated
  // transactions.
  override fun onAfterUpdateTransaction(view: BannerContainer) {
    super.onAfterUpdateTransaction(view)
    view.post { maybeLoad(view) }
  }

  private fun maybeLoad(view: BannerContainer) {
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
    val banner = EzoicBannerView(view.context, view.adUnitId)
    banner.collapseOnNoFill = view.collapseOnNoFill
    banner.refreshIntervalSeconds = view.refreshIntervalSeconds
    banner.refreshMaxCount = view.refreshMaxCount
    // Callbacks are guarded by banner identity: a banner replaced by a prop
    // change (resetForReload) must not emit for the container's new banner.
    banner.listener = object : EzoicBannerViewListener {
      override fun onBannerLoaded(b: EzoicBannerView) = emitFor(view, banner, "topLoad", Arguments.createMap())
      override fun onBannerLoadFailed(b: EzoicBannerView, error: EzoicError) =
        emitFor(view, banner, "topError", errorMap(error.message, error.code))
      override fun onBannerImpression(b: EzoicBannerView) = emitFor(view, banner, "topImpression", Arguments.createMap())
      override fun onBannerClicked(b: EzoicBannerView) = emitFor(view, banner, "topAdClick", Arguments.createMap())
      override fun onBannerOpened(b: EzoicBannerView) = emitFor(view, banner, "topOpen", Arguments.createMap())
      override fun onBannerClosed(b: EzoicBannerView) = emitFor(view, banner, "topClose", Arguments.createMap())
      // The native view collapses itself (GONE) or resizes to the loaded
      // creative, but this container is MATCH_PARENT inside the Yoga box, so
      // the JS component applies the height from this event.
      override fun onBannerSizeChanged(bannerView: EzoicBannerView, widthDp: Int, heightDp: Int) {
        val map = Arguments.createMap()
        map.putDouble("width", widthDp.toDouble())
        map.putDouble("height", heightDp.toDouble())
        emitFor(view, banner, "topSizeChange", map)
      }
    }
    view.banner = banner
    view.removeAllViews()
    view.addView(banner)
    val sizes = view.size.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    if (sizes.isEmpty()) banner.loadAd() else banner.loadAd(sizes)
  }

  /** Destroys the current banner and clears the load guard so the next transaction reloads. */
  private fun resetForReload(view: BannerContainer) {
    view.banner?.destroy()
    view.banner = null
    view.removeAllViews()
    view.loadStarted = false
  }

  override fun onDropViewInstance(view: BannerContainer) {
    super.onDropViewInstance(view)
    view.disposed = true
    view.banner?.destroy()
    view.banner = null
    view.removeAllViews()
  }

  private fun emitFor(view: BannerContainer, banner: EzoicBannerView, event: String, payload: WritableMap) {
    if (view.banner !== banner) return
    emit(view, event, payload)
  }

  private fun emit(view: BannerContainer, event: String, payload: WritableMap) {
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
    var rawAdUnitId: String = ""
    var size: String = ""
    var loadStarted: Boolean = false
    var disposed: Boolean = false
    var collapseOnNoFill: Boolean = true
    var refreshIntervalSeconds: Int? = null
    var refreshMaxCount: Int? = null
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
    const val REFRESH_UNSET = -1

    fun refreshOverride(value: Int): Int? = if (value < 0) null else value
  }
}
