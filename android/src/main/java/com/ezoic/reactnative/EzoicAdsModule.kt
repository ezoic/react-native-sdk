package com.ezoic.reactnative

import android.app.Activity
import android.app.Application
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ezoic.ads.sdk.adunits.EzoicInstreamAd
import com.ezoic.ads.sdk.adunits.EzoicInstreamAdListener
import com.ezoic.ads.sdk.adunits.EzoicInterstitialAd
import com.ezoic.ads.sdk.adunits.EzoicInterstitialAdListener
import com.ezoic.ads.sdk.adunits.EzoicInterstitialAdListenerAdapter
import com.ezoic.ads.sdk.adunits.EzoicReward
import com.ezoic.ads.sdk.adunits.EzoicRewardedAd
import com.ezoic.ads.sdk.adunits.EzoicRewardedAdListener
import com.ezoic.ads.sdk.adunits.EzoicRewardedAdListenerAdapter
import com.ezoic.ads.sdk.core.EzoicAds
import com.ezoic.ads.sdk.core.EzoicConfiguration
import com.ezoic.ads.sdk.core.EzoicError
import com.ezoic.ads.sdk.privacy.cmp.ConsentDecisionType
import com.ezoic.ads.sdk.privacy.cmp.ConsentOutcome
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class EzoicAdsModule(reactContext: ReactApplicationContext) :
  NativeEzoicAdsSpec(reactContext) {

  override fun getName() = NAME

  /** Loaded rewarded ads awaiting `show`, keyed by ad unit id. */
  private val rewardedAds = ConcurrentHashMap<Int, EzoicRewardedAd>()

  /** In-flight `show` calls, keyed by ad unit id. */
  private val pendingShows = ConcurrentHashMap<Int, RewardShow>()

  private class RewardShow(val promise: Promise) {
    @Volatile var settled = false
    @Volatile var reward: EzoicReward? = null
  }

  /** Loaded interstitial ads awaiting `show`, keyed by ad unit id. */
  private val interstitialAds = ConcurrentHashMap<Int, EzoicInterstitialAd>()

  /** In-flight interstitial `show` calls, keyed by ad unit id. */
  private val pendingInterstitialShows = ConcurrentHashMap<Int, InterstitialShow>()

  private class InterstitialShow(val promise: Promise) {
    @Volatile var settled = false
  }

  /** Ad unit ids with an in-flight rewarded `load`. */
  private val loadingRewarded = ConcurrentHashMap.newKeySet<Int>()

  /** Ad unit ids with an in-flight interstitial `load`. */
  private val loadingInterstitial = ConcurrentHashMap.newKeySet<Int>()

  /**
   * Instream controllers, keyed by ad unit id. Instream is multi-use and
   * prefetchable, so a controller is created-or-reused per id and NOT
   * auto-destroyed — it lives until [destroyInstreamAd] or module teardown.
   */
  private val instreamAds = ConcurrentHashMap<Int, EzoicInstreamAd>()

  /**
   * In-flight instream `load` calls, keyed by ad unit id. Doubles as the
   * duplicate-load guard: the native `load` is a SILENT no-op while already
   * loading, so an overlapping load must be rejected here or its promise hangs
   * forever.
   */
  private val loadingInstream = ConcurrentHashMap<Int, InstreamLoad>()

  private class InstreamLoad(val promise: Promise) {
    // destroy/invalidate run on the JS thread while listener callbacks run on
    // main, so settling must be an atomic claim (compareAndSet) rather than a
    // check-then-set, or both sides can settle the same promise.
    val settled = AtomicBoolean(false)
  }

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
      testMode = config.optBool("testMode", false),
      autoTrackPageviews = config.optBool("autoTrackPageviews", true),
      cmpEnabled = config.optBool("cmpEnabled", true)
    )
    val autoPresentConsent = config.optBool("autoPresentConsent", true)
    EzoicAds.instance.initialize(app, configuration) { result ->
      result.onSuccess {
        promise.resolve(null)
        if (autoPresentConsent) autoPresentConsent(configuration.debugEnabled)
      }.onFailure { e -> promise.reject("EzoicAds", e.message, e) }
    }
  }

  /**
   * Presents the consent dialog once after a successful `initialize`. Native
   * returns `NotRequired` outside GDPR / with `cmpEnabled = false` / with
   * another CMP or manual consent, so this is a no-op there. The outcome is
   * only logged; publishers wanting it call `presentConsentIfRequired`.
   */
  private fun autoPresentConsent(debug: Boolean) {
    val activity = currentActivity
    if (activity == null) {
      if (debug) Log.d(NAME, "autoPresentConsent skipped: no foreground Activity")
      return
    }
    activity.runOnUiThread {
      EzoicAds.instance.presentConsentIfRequired(activity) { outcome ->
        if (debug) Log.d(NAME, "autoPresentConsent outcome: $outcome")
      }
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

  override fun trackPageview(screen: String?, promise: Promise) {
    if (screen.isNullOrEmpty()) {
      EzoicAds.instance.trackPageview { success -> promise.resolve(success) }
    } else {
      EzoicAds.instance.trackPageview(screen) { success -> promise.resolve(success) }
    }
  }

  override fun presentConsentIfRequired(promise: Promise) {
    presentConsent(promise) { activity, callback ->
      EzoicAds.instance.presentConsentIfRequired(activity, callback)
    }
  }

  override fun presentConsentSettings(promise: Promise) {
    presentConsent(promise) { activity, callback ->
      EzoicAds.instance.presentConsentSettings(activity, callback)
    }
  }

  override fun isConsentRequired(promise: Promise) {
    promise.resolve(EzoicAds.instance.isConsentRequired)
  }

  override fun resetConsent() {
    UiThreadUtil.runOnUiThread { EzoicAds.instance.resetConsent() }
  }

  /**
   * Presents from the foreground Activity on the UI thread and always resolves
   * with an outcome map; with no Activity it resolves `failed(-1)`.
   */
  private fun presentConsent(
    promise: Promise,
    present: (Activity, (ConsentOutcome) -> Unit) -> Unit
  ) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(consentFailureMap(NO_ACTIVITY_CODE, NO_ACTIVITY_MESSAGE))
      return
    }
    activity.runOnUiThread {
      present(activity) { outcome -> promise.resolve(outcome.toWritableMap()) }
    }
  }

  override fun loadRewardedAd(adUnitIdentifier: String, promise: Promise) {
    val id = adUnitIdentifier.toIntOrNull()
    if (id == null) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    if (rewardedAds.containsKey(id) || !loadingRewarded.add(id)) {
      promise.reject("EzoicAds", "An ad is already loaded/loading for ad unit $adUnitIdentifier")
      return
    }
    EzoicRewardedAd.load(reactApplicationContext, id) { result ->
      loadingRewarded.remove(id)
      result.onSuccess { ad ->
        ad.listener = makeListener(adUnitIdentifier)
        rewardedAds[id] = ad
        promise.resolve(null)
      }.onFailure { e ->
        promise.rejectLoad(e, "Rewarded ad failed to load")
      }
    }
  }

  override fun showRewardedAd(
    adUnitIdentifier: String,
    rewardName: String?,
    promise: Promise
  ) {
    val id = adUnitIdentifier.toIntOrNull()
    val ad = if (id != null) rewardedAds[id] else null
    if (id == null || ad == null) {
      promise.reject("EzoicAds", "Rewarded ad not loaded for $adUnitIdentifier")
      return
    }
    if (pendingShows.containsKey(id)) {
      promise.reject("EzoicAds", "A show is already in progress for ad unit $adUnitIdentifier")
      return
    }
    val activity = currentActivity
    if (activity == null) {
      promise.reject("EzoicAds", "No current Activity to present the rewarded ad")
      return
    }

    val show = RewardShow(promise)
    pendingShows[id] = show

    // Replace the load-time listener with one that also settles the promise on
    // terminal events (dismiss = resolve, failed-to-show = reject).
    ad.listener = makeListener(
      adUnitIdentifier,
      onDismiss = {
        rewardedAds.remove(id)
        val pending = pendingShows.remove(id)
        if (pending != null && !pending.settled) {
          pending.settled = true
          val reward = pending.reward
          val map = Arguments.createMap()
          map.putBoolean("earned", reward != null)
          map.putString("type", reward?.type ?: "")
          map.putDouble("amount", (reward?.amount ?: 0).toDouble())
          pending.promise.resolve(map)
        }
      },
      onFailedToShow = { message ->
        rewardedAds.remove(id)
        val pending = pendingShows.remove(id)
        if (pending != null && !pending.settled) {
          pending.settled = true
          pending.promise.reject("EzoicAds", message)
        }
      }
    )

    activity.runOnUiThread {
      if (rewardName.isNullOrEmpty()) {
        ad.show(activity) { reward -> show.reward = reward }
      } else {
        ad.show(activity, rewardName) { reward -> show.reward = reward }
      }
    }
  }

  override fun loadInterstitialAd(adUnitIdentifier: String, promise: Promise) {
    val id = adUnitIdentifier.toIntOrNull()
    if (id == null) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    if (interstitialAds.containsKey(id) || !loadingInterstitial.add(id)) {
      promise.reject("EzoicAds", "An ad is already loaded/loading for ad unit $adUnitIdentifier")
      return
    }
    EzoicInterstitialAd.load(reactApplicationContext, id) { result ->
      loadingInterstitial.remove(id)
      result.onSuccess { ad ->
        ad.listener = makeInterstitialListener(adUnitIdentifier)
        interstitialAds[id] = ad
        promise.resolve(null)
      }.onFailure { e ->
        promise.rejectLoad(e, "Interstitial ad failed to load")
      }
    }
  }

  override fun showInterstitialAd(adUnitIdentifier: String, promise: Promise) {
    val id = adUnitIdentifier.toIntOrNull()
    val ad = if (id != null) interstitialAds[id] else null
    if (id == null || ad == null) {
      promise.reject("EzoicAds", "Interstitial ad not loaded for $adUnitIdentifier")
      return
    }
    if (pendingInterstitialShows.containsKey(id)) {
      promise.reject("EzoicAds", "A show is already in progress for ad unit $adUnitIdentifier")
      return
    }
    val activity = currentActivity
    if (activity == null) {
      promise.reject("EzoicAds", "No current Activity to present the interstitial ad")
      return
    }

    pendingInterstitialShows[id] = InterstitialShow(promise)

    // Native show(activity) has no completion lambda, so replace the load-time
    // listener with one that settles the promise on terminal events
    // (dismiss = resolve, failed-to-show = reject).
    ad.listener = makeInterstitialListener(
      adUnitIdentifier,
      onDismiss = {
        interstitialAds.remove(id)
        val pending = pendingInterstitialShows.remove(id)
        if (pending != null && !pending.settled) {
          pending.settled = true
          pending.promise.resolve(null)
        }
      },
      onFailedToShow = { message ->
        interstitialAds.remove(id)
        val pending = pendingInterstitialShows.remove(id)
        if (pending != null && !pending.settled) {
          pending.settled = true
          pending.promise.reject("EzoicAds", message)
        }
      }
    )

    activity.runOnUiThread {
      ad.show(activity)
    }
  }

  override fun loadInstreamAd(adUnitIdentifier: Double, contentUrl: String?, promise: Promise) {
    val id = adUnitIdentifier.toInt()
    if (id <= 0) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    // Reject overlapping loads for this id: the native load silently no-ops
    // while loading (a second load on the reused controller, or a load from a
    // fresh JS instance sharing the id), which would hang the promise.
    if (loadingInstream.containsKey(id)) {
      promise.reject("EzoicAds", "An instream ad is already loading for ad unit $id")
      return
    }

    // Create-or-reuse: instream is multi-use, so a repeat load on the same id
    // reuses the existing native controller (preserving its tag/waterfall state).
    val ad = instreamAds.getOrPut(id) { EzoicInstreamAd(id) }

    val holder = InstreamLoad(promise)
    loadingInstream[id] = holder
    // The native load uses the context only for parity (it is not retained);
    // pass the same reactApplicationContext the rewarded/interstitial loads use.
    // The native SDK already posts these callbacks to main, so settle directly
    // here — no need to re-post via a Handler.
    ad.load(reactApplicationContext, contentUrl, object : EzoicInstreamAdListener {
      override fun onAdTagReady(adTagUrl: String) {
        // CAS guard: after a destroy->reload a stale callback must not evict
        // the newer load's holder (only the winning settle removes it).
        if (holder.settled.compareAndSet(false, true)) {
          loadingInstream.remove(id)
          promise.resolve(adTagUrl)
        }
      }

      override fun onAdFailedToLoad(error: EzoicError) {
        if (holder.settled.compareAndSet(false, true)) {
          loadingInstream.remove(id)
          promise.rejectLoad(error, "Instream ad failed to load")
        }
      }
    })
  }

  override fun getInstreamNextAdTagUrl(adUnitIdentifier: Double, promise: Promise) {
    val id = adUnitIdentifier.toInt()
    if (id <= 0) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    // Synchronous native call; resolves the next waterfall tag or null when
    // exhausted / before a successful load / after destroy.
    promise.resolve(instreamAds[id]?.getNextAdTagUrl())
  }

  override fun reportInstreamImpression(
    adUnitIdentifier: Double,
    revenueUsd: Double?,
    promise: Promise
  ) {
    val id = adUnitIdentifier.toInt()
    if (id <= 0) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    // No-op natively when no tag has been delivered or after destroy.
    instreamAds[id]?.reportImpression(revenueUsd)
    promise.resolve(null)
  }

  override fun destroyInstreamAd(adUnitIdentifier: Double, promise: Promise) {
    val id = adUnitIdentifier.toInt()
    if (id <= 0) {
      promise.reject("EzoicAds", "Invalid adUnitIdentifier: $adUnitIdentifier")
      return
    }
    // The native SDK suppresses load callbacks once destroyed (load tokens), so
    // settle any pending load's promise HERE first or it hangs forever. The CAS
    // claim also disarms a listener callback racing in on main concurrently.
    val pending = loadingInstream.remove(id)
    if (pending != null && pending.settled.compareAndSet(false, true)) {
      pending.promise.reject("EzoicAds", "Instream ad was destroyed while loading")
    }
    instreamAds.remove(id)?.destroy()
    promise.resolve(null)
  }

  override fun invalidate() {
    // Module teardown: settle every pending instream load with an error and
    // destroy every controller so no promise hangs and no native resource leaks.
    for ((_, holder) in loadingInstream) {
      if (holder.settled.compareAndSet(false, true)) {
        holder.promise.reject("EzoicAds", "Module was destroyed while loading")
      }
    }
    loadingInstream.clear()
    for ((_, ad) in instreamAds) {
      ad.destroy()
    }
    instreamAds.clear()
    super.invalidate()
  }

  override fun addListener(eventName: String) {
    // No-op: required by the React Native NativeEventEmitter contract.
  }

  override fun removeListeners(count: Double) {
    // No-op: required by the React Native NativeEventEmitter contract.
  }

  private fun makeListener(
    adUnitIdentifier: String,
    onDismiss: (() -> Unit)? = null,
    onFailedToShow: ((String) -> Unit)? = null
  ): EzoicRewardedAdListener = object : EzoicRewardedAdListenerAdapter() {
    override fun onRewardedAdShown(rewardedAd: EzoicRewardedAd) {
      emitRewardedEvent(adUnitIdentifier, "shown")
    }

    override fun onRewardedAdFailedToShow(rewardedAd: EzoicRewardedAd, error: EzoicError) {
      emitRewardedEvent(adUnitIdentifier, "failedToShow") {
        putString("message", error.message)
        putInt("code", error.code)
      }
      onFailedToShow?.invoke(error.message)
    }

    override fun onRewardedAdImpression(rewardedAd: EzoicRewardedAd) {
      emitRewardedEvent(adUnitIdentifier, "impression")
    }

    override fun onRewardedAdClicked(rewardedAd: EzoicRewardedAd) {
      emitRewardedEvent(adUnitIdentifier, "clicked")
    }

    override fun onUserEarnedReward(rewardedAd: EzoicRewardedAd, reward: EzoicReward) {
      emitRewardedEvent(adUnitIdentifier, "reward") {
        putString("rewardType", reward.type)
        putDouble("rewardAmount", reward.amount.toDouble())
      }
    }

    override fun onRewardedAdDismissed(rewardedAd: EzoicRewardedAd) {
      emitRewardedEvent(adUnitIdentifier, "dismissed")
      onDismiss?.invoke()
    }
  }

  private fun emitRewardedEvent(
    adUnitIdentifier: String,
    type: String,
    extra: (WritableMap.() -> Unit)? = null
  ) {
    val map = Arguments.createMap()
    map.putString("adUnitIdentifier", adUnitIdentifier)
    map.putString("type", type)
    extra?.invoke(map)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(REWARDED_EVENT, map)
  }

  private fun makeInterstitialListener(
    adUnitIdentifier: String,
    onDismiss: (() -> Unit)? = null,
    onFailedToShow: ((String) -> Unit)? = null
  ): EzoicInterstitialAdListener = object : EzoicInterstitialAdListenerAdapter() {
    override fun onInterstitialAdShown(interstitialAd: EzoicInterstitialAd) {
      emitInterstitialEvent(adUnitIdentifier, "shown")
    }

    override fun onInterstitialAdFailedToShow(interstitialAd: EzoicInterstitialAd, error: EzoicError) {
      emitInterstitialEvent(adUnitIdentifier, "failedToShow") {
        putString("message", error.message)
        putInt("code", error.code)
      }
      onFailedToShow?.invoke(error.message)
    }

    override fun onInterstitialAdImpression(interstitialAd: EzoicInterstitialAd) {
      emitInterstitialEvent(adUnitIdentifier, "impression")
    }

    override fun onInterstitialAdClicked(interstitialAd: EzoicInterstitialAd) {
      emitInterstitialEvent(adUnitIdentifier, "clicked")
    }

    override fun onInterstitialAdDismissed(interstitialAd: EzoicInterstitialAd) {
      emitInterstitialEvent(adUnitIdentifier, "dismissed")
      onDismiss?.invoke()
    }
  }

  private fun emitInterstitialEvent(
    adUnitIdentifier: String,
    type: String,
    extra: (WritableMap.() -> Unit)? = null
  ) {
    val map = Arguments.createMap()
    map.putString("adUnitIdentifier", adUnitIdentifier)
    map.putString("type", type)
    extra?.invoke(map)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(INTERSTITIAL_EVENT, map)
  }

  /**
   * Rejects a load with the string code "EzoicAds" and, for native errors, the
   * numeric `EzoicError.code` in `userInfo` (JS: `error.userInfo.code`).
   */
  private fun Promise.rejectLoad(e: Throwable, fallbackMessage: String) {
    val userInfo = (e as? EzoicError)?.let { error ->
      Arguments.createMap().apply { putInt("code", error.code) }
    }
    reject("EzoicAds", e.message ?: fallbackMessage, e, userInfo)
  }

  private fun consentFailureMap(code: Int, message: String): WritableMap =
    Arguments.createMap().apply {
      putString("type", "failed")
      putInt("code", code)
      putString("message", message)
    }

  private fun ConsentOutcome.toWritableMap(): WritableMap {
    if (this is ConsentOutcome.Failed) return consentFailureMap(error.code, error.message)
    val map = Arguments.createMap()
    map.putString(
      "type",
      when (this) {
        ConsentOutcome.NotRequired -> "notRequired"
        ConsentOutcome.AlreadyDecided -> "alreadyDecided"
        ConsentOutcome.Dismissed -> "dismissed"
        ConsentOutcome.AlreadyPresenting -> "alreadyPresenting"
        is ConsentOutcome.Decided -> "decided"
        is ConsentOutcome.Failed -> "failed"
      }
    )
    if (this is ConsentOutcome.Decided) {
      map.putString(
        "decision",
        when (decision) {
          ConsentDecisionType.ACCEPT_ALL -> "acceptAll"
          ConsentDecisionType.REJECT_ALL -> "rejectAll"
          ConsentDecisionType.CUSTOM -> "custom"
        }
      )
    }
    return map
  }

  private fun ReadableMap.optBool(key: String, default: Boolean): Boolean =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else default

  companion object {
    const val NAME = NativeEzoicAdsSpec.NAME
    private const val NO_ACTIVITY_CODE = -1
    private const val NO_ACTIVITY_MESSAGE = "No foreground Activity"
    private const val REWARDED_EVENT = "EzoicRewardedAdEvent"
    private const val INTERSTITIAL_EVENT = "EzoicInterstitialAdEvent"
  }
}
