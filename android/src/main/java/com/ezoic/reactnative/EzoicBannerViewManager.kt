package com.ezoic.reactnative

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
  SimpleViewManager<FrameLayout>() {

  override fun getName() = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout {
    val container = FrameLayout(reactContext)
    container.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
    )
    container.tag = BannerState()
    return container
  }

  @ReactProp(name = "adUnitIdentifier")
  fun setAdUnitIdentifier(view: FrameLayout, value: String?) {
    (view.tag as BannerState).adUnitId = value?.toIntOrNull() ?: 0
    maybeLoad(view)
  }

  @ReactProp(name = "size")
  fun setSize(view: FrameLayout, value: String?) {
    (view.tag as BannerState).size = value ?: ""
    maybeLoad(view)
  }

  private fun maybeLoad(view: FrameLayout) {
    val state = view.tag as BannerState
    if (state.loaded || state.adUnitId <= 0) return
    state.loaded = true
    val banner = EzoicBannerView(view.context, state.adUnitId)
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
    }
    view.removeAllViews()
    view.addView(banner)
    val sizes = state.size.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    if (sizes.isEmpty()) banner.loadAd() else banner.loadAd(sizes)
  }

  private fun emit(view: FrameLayout, event: String, payload: WritableMap) {
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

  private class BannerState {
    var adUnitId: Int = 0
    var size: String = ""
    var loaded: Boolean = false
  }

  companion object {
    const val NAME = "EzoicBannerView"
  }
}
