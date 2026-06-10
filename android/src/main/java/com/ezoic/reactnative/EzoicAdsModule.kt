package com.ezoic.reactnative

import android.app.Application
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.ezoic.ads.sdk.core.EzoicAds
import com.ezoic.ads.sdk.core.EzoicConfiguration

class EzoicAdsModule(reactContext: ReactApplicationContext) :
  NativeEzoicAdsSpec(reactContext) {

  override fun getName() = NAME

  override fun initialize(config: ReadableMap, promise: Promise) {
    val domain = if (config.hasKey("domain")) config.getString("domain") else null
    if (domain.isNullOrEmpty()) {
      promise.reject("EzoicAds", "initialize requires a non-empty `domain`.")
      return
    }
    val app = reactApplicationContext.applicationContext as? Application
    if (app == null) {
      promise.reject("EzoicAds", "No Application context available.")
      return
    }
    val configuration = EzoicConfiguration(
      domain = domain,
      autoReadConsent = config.optBool("autoReadConsent", true),
      subjectToCOPPA = config.optBool("subjectToCOPPA", false),
      requestATTBeforeAds = config.optBool("requestATTBeforeAds", true),
      debugEnabled = config.optBool("debugEnabled", false),
      testMode = config.optBool("testMode", false)
    )
    EzoicAds.instance.initialize(app, configuration) { result ->
      result.onSuccess { promise.resolve(null) }
        .onFailure { e -> promise.reject("EzoicAds", e.message, e) }
    }
  }

  override fun setGDPRConsent(applies: Boolean, consentString: String?) {
    EzoicAds.instance.setGDPRConsent(applies, consentString)
  }

  override fun setGPPConsent(gppString: String?, sectionIds: String?) {
    EzoicAds.instance.setGPPConsent(gppString, sectionIds)
  }

  override fun setSubjectToCOPPA(value: Boolean) {
    EzoicAds.instance.setSubjectToCOPPA(value)
  }

  override fun trackPageview(promise: Promise) {
    EzoicAds.instance.trackPageview { success -> promise.resolve(success) }
  }

  private fun ReadableMap.optBool(key: String, default: Boolean): Boolean =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else default

  companion object {
    const val NAME = NativeEzoicAdsSpec.NAME
  }
}
