package com.ezoic.reactnative.cmp

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.ezoic.ads.sdk.privacy.cmp.CmpError
import com.ezoic.ads.sdk.privacy.cmp.ConsentDecisionType
import com.ezoic.ads.sdk.privacy.cmp.ConsentOutcome
import com.ezoic.ads.sdk.privacy.cmp.EzoicCmp
import com.ezoic.ads.sdk.privacy.cmp.EzoicCmpConfiguration

class EzoicCmpModule(reactContext: ReactApplicationContext) :
  NativeEzoicCmpSpec(reactContext) {

  override fun getName() = NAME

  override fun initialize(domain: String, config: ReadableMap) {
    val configuration = EzoicCmpConfiguration(
      cmpEnabled = config.optBool("cmpEnabled", true),
      autoReadConsent = config.optBool("autoReadConsent", true),
      debugEnabled = config.optBool("debugEnabled", false)
    )
    EzoicCmp.initialize(reactApplicationContext.applicationContext, domain, configuration)
  }

  override fun presentConsentIfRequired(promise: Promise) {
    presentConsent(promise) { activity, callback ->
      EzoicCmp.presentConsentIfRequired(activity, callback)
    }
  }

  override fun presentConsentSettings(promise: Promise) {
    presentConsent(promise) { activity, callback ->
      EzoicCmp.presentConsentSettings(activity, callback)
    }
  }

  override fun isConsentRequired(promise: Promise) {
    UiThreadUtil.runOnUiThread { promise.resolve(EzoicCmp.isConsentRequired) }
  }

  override fun isPrivacyOptionsRequired(promise: Promise) {
    UiThreadUtil.runOnUiThread { promise.resolve(EzoicCmp.isPrivacyOptionsRequired) }
  }

  override fun resetConsent() {
    UiThreadUtil.runOnUiThread { EzoicCmp.resetConsent() }
  }

  /**
   * Presents from the foreground Activity on the UI thread and always resolves
   * with an outcome map; with no Activity it resolves `failed(-1)`.
   */
  private fun presentConsent(
    promise: Promise,
    present: (Activity, (ConsentOutcome) -> Unit) -> Unit
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(consentFailureMap(NO_ACTIVITY_CODE, NO_ACTIVITY_MESSAGE))
      return
    }
    activity.runOnUiThread {
      present(activity) { outcome -> promise.resolve(outcome.toWritableMap()) }
    }
  }

  private fun consentFailureMap(code: Int, message: String): WritableMap =
    Arguments.createMap().apply {
      putString("type", "failed")
      putInt("code", code)
      putString("message", message)
    }

  private fun ConsentOutcome.toWritableMap(): WritableMap = when (this) {
    ConsentOutcome.NotRequired -> consentTypeMap("notRequired")
    ConsentOutcome.AlreadyDecided -> consentTypeMap("alreadyDecided")
    ConsentOutcome.Dismissed -> consentTypeMap("dismissed")
    ConsentOutcome.AlreadyPresenting -> consentTypeMap("alreadyPresenting")
    is ConsentOutcome.Decided -> consentTypeMap("decided").apply {
      putString(
        "decision",
        when (decision) {
          ConsentDecisionType.ACCEPT_ALL -> "acceptAll"
          ConsentDecisionType.REJECT_ALL -> "rejectAll"
          ConsentDecisionType.CUSTOM -> "custom"
        }
      )
    }
    is ConsentOutcome.Failed -> consentFailureMap(error.consentErrorCode(), error.message ?: UNKNOWN_ERROR_MESSAGE)
  }

  /** `Failed.error` from `EzoicCmp` is a `CmpError`. */
  private fun Exception.consentErrorCode(): Int =
    (this as? CmpError)?.code ?: UNKNOWN_ERROR_CODE

  private fun consentTypeMap(type: String): WritableMap =
    Arguments.createMap().apply { putString("type", type) }

  private fun ReadableMap.optBool(key: String, default: Boolean): Boolean =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else default

  companion object {
    const val NAME = NativeEzoicCmpSpec.NAME
    private const val NO_ACTIVITY_CODE = -1
    private const val NO_ACTIVITY_MESSAGE = "No foreground Activity"
    private const val UNKNOWN_ERROR_CODE = -1
    private const val UNKNOWN_ERROR_MESSAGE = "Unknown error"
  }
}
