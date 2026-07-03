package com.ezoic.reactnative

import android.app.Application
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
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
import java.util.concurrent.ConcurrentHashMap

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
        promise.reject("EzoicAds", e.message ?: "Rewarded ad failed to load", e)
      }
    }
  }

  override fun showRewardedAd(adUnitIdentifier: String, promise: Promise) {
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
      ad.show(activity) { reward -> show.reward = reward }
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
        promise.reject("EzoicAds", e.message ?: "Interstitial ad failed to load", e)
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

  private fun ReadableMap.optBool(key: String, default: Boolean): Boolean =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else default

  companion object {
    const val NAME = NativeEzoicAdsSpec.NAME
    private const val REWARDED_EVENT = "EzoicRewardedAdEvent"
    private const val INTERSTITIAL_EVENT = "EzoicInterstitialAdEvent"
  }
}
