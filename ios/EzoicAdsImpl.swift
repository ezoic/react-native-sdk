import Foundation
import EzoicAdsSDKBinary

@objc public class EzoicAdsImpl: NSObject {

  /// Set by the Obj-C module to forward rewarded lifecycle events to JS.
  @objc public var eventEmitter: ((String, [String: Any]) -> Void)?

  /// Loaded rewarded ads awaiting `show`, keyed by ad unit id.
  private var rewardedAds: [Int: EzoicRewardedAd] = [:]

  /// In-flight `show` calls, keyed by ad unit id.
  private var pendingShows: [Int: PendingRewardShow] = [:]

  private final class PendingRewardShow {
    let resolve: (Any?) -> Void
    let reject: (String, String, NSError?) -> Void
    var reward: EzoicReward?
    init(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
      self.resolve = resolve
      self.reject = reject
    }
  }

  /// Loaded interstitial ads awaiting `show`, keyed by ad unit id.
  private var interstitialAds: [Int: EzoicInterstitialAd] = [:]

  /// In-flight interstitial `show` calls, keyed by ad unit id.
  private var pendingInterstitialShows: [Int: PendingInterstitialShow] = [:]

  private final class PendingInterstitialShow {
    let resolve: (Any?) -> Void
    let reject: (String, String, NSError?) -> Void
    init(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, NSError?) -> Void) {
      self.resolve = resolve
      self.reject = reject
    }
  }

  /// Ad unit ids with an in-flight rewarded `load`.
  private var loadingRewarded: Set<Int> = []

  /// Ad unit ids with an in-flight interstitial `load`.
  private var loadingInterstitial: Set<Int> = []

  /// Runs `work` on the main thread. The ad/pending/loading dictionaries and
  /// every native load/show call touch UIKit and this shared state, so they must
  /// only run on main. Delegate callbacks already arrive on main.
  private func onMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  @objc public func initialize(_ config: NSDictionary,
                               resolve: @escaping (Any?) -> Void,
                               reject: @escaping (String, String, NSError?) -> Void) {
    onMain {
      guard let domain = config["domain"] as? String, !domain.isEmpty else {
        reject("EzoicAds", "initialize requires a non-empty `domain`.", nil)
        return
      }
      let configuration = EzoicConfiguration(
        domain: domain,
        autoReadConsent: (config["autoReadConsent"] as? Bool) ?? true,
        subjectToCOPPA: (config["subjectToCOPPA"] as? Bool) ?? false,
        requestATTBeforeAds: (config["requestATTBeforeAds"] as? Bool) ?? true,
        debugEnabled: (config["debugEnabled"] as? Bool) ?? false,
        testMode: (config["testMode"] as? Bool) ?? false
      )
      EzoicAds.shared.initialize(with: configuration) { result in
        switch result {
        case .success:
          resolve(nil)
        case .failure(let error):
          reject("EzoicAds", error.localizedDescription, error as NSError)
        }
      }
    }
  }

  @objc public func setGDPRConsent(_ applies: Bool, consentString: String?) {
    onMain {
      EzoicAds.shared.setGDPRConsent(applies: applies, consentString: consentString)
    }
  }

  @objc public func setGPPConsent(_ gppString: String?, sectionIds: String?) {
    onMain {
      EzoicAds.shared.setGPPConsent(gppString: gppString, sectionIds: sectionIds)
    }
  }

  @objc public func setSubjectToCOPPA(_ value: Bool) {
    onMain {
      EzoicAds.shared.setSubjectToCOPPA(value)
    }
  }

  @objc public func trackPageview(_ resolve: @escaping (Any?) -> Void) {
    onMain {
      EzoicAds.shared.trackPageview { success in
        resolve(NSNumber(value: success))
      }
    }
  }

  @objc public func loadRewardedAd(_ adUnitIdentifier: String,
                                   resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String, String, NSError?) -> Void) {
    onMain { [weak self] in
      guard let self = self else { return }
      guard let id = Int(adUnitIdentifier) else {
        reject("EzoicAds", "Invalid adUnitIdentifier: \(adUnitIdentifier)", nil)
        return
      }
      if self.rewardedAds[id] != nil || self.loadingRewarded.contains(id) {
        reject("EzoicAds", "An ad is already loaded/loading for ad unit \(adUnitIdentifier)", nil)
        return
      }
      self.loadingRewarded.insert(id)
      EzoicRewardedAd.load(adUnitIdentifier: id) { [weak self] result in
        guard let self = self else { return }
        self.onMain {
          self.loadingRewarded.remove(id)
          switch result {
          case .success(let ad):
            ad.delegate = self
            self.rewardedAds[id] = ad
            resolve(nil)
          case .failure(let error):
            reject("EzoicAds", error.localizedDescription, error as NSError)
          }
        }
      }
    }
  }

  @objc public func showRewardedAd(_ adUnitIdentifier: String,
                                   resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String, String, NSError?) -> Void) {
    onMain { [weak self] in
      guard let self = self else { return }
      guard let id = Int(adUnitIdentifier), let ad = self.rewardedAds[id] else {
        reject("EzoicAds", "Rewarded ad not loaded for \(adUnitIdentifier)", nil)
        return
      }
      if self.pendingShows[id] != nil {
        reject("EzoicAds", "A show is already in progress for ad unit \(adUnitIdentifier)", nil)
        return
      }
      self.pendingShows[id] = PendingRewardShow(resolve: resolve, reject: reject)
      // Presenting from nil lets GMA use the application's top view controller.
      ad.show(from: nil) { [weak self] reward in
        self?.onMain { self?.pendingShows[id]?.reward = reward }
      }
    }
  }

  private func emit(_ ad: EzoicRewardedAd, _ type: String, _ extra: [String: Any] = [:]) {
    var body: [String: Any] = [
      "adUnitIdentifier": String(ad.adUnitIdentifier),
      "type": type
    ]
    for (key, value) in extra { body[key] = value }
    eventEmitter?("EzoicRewardedAdEvent", body)
  }

  @objc public func loadInterstitialAd(_ adUnitIdentifier: String,
                                       resolve: @escaping (Any?) -> Void,
                                       reject: @escaping (String, String, NSError?) -> Void) {
    onMain { [weak self] in
      guard let self = self else { return }
      guard let id = Int(adUnitIdentifier) else {
        reject("EzoicAds", "Invalid adUnitIdentifier: \(adUnitIdentifier)", nil)
        return
      }
      if self.interstitialAds[id] != nil || self.loadingInterstitial.contains(id) {
        reject("EzoicAds", "An ad is already loaded/loading for ad unit \(adUnitIdentifier)", nil)
        return
      }
      self.loadingInterstitial.insert(id)
      EzoicInterstitialAd.load(adUnitIdentifier: id) { [weak self] result in
        guard let self = self else { return }
        self.onMain {
          self.loadingInterstitial.remove(id)
          switch result {
          case .success(let ad):
            ad.delegate = self
            self.interstitialAds[id] = ad
            resolve(nil)
          case .failure(let error):
            reject("EzoicAds", error.localizedDescription, error as NSError)
          }
        }
      }
    }
  }

  @objc public func showInterstitialAd(_ adUnitIdentifier: String,
                                       resolve: @escaping (Any?) -> Void,
                                       reject: @escaping (String, String, NSError?) -> Void) {
    onMain { [weak self] in
      guard let self = self else { return }
      guard let id = Int(adUnitIdentifier), let ad = self.interstitialAds[id] else {
        reject("EzoicAds", "Interstitial ad not loaded for \(adUnitIdentifier)", nil)
        return
      }
      if self.pendingInterstitialShows[id] != nil {
        reject("EzoicAds", "A show is already in progress for ad unit \(adUnitIdentifier)", nil)
        return
      }
      self.pendingInterstitialShows[id] = PendingInterstitialShow(resolve: resolve, reject: reject)
      // Native show(from:) has no completion handler, so the show promise is
      // settled from the delegate (dismiss = resolve, failed-to-present = reject).
      // Presenting from nil lets GMA use the application's top view controller.
      ad.show(from: nil)
    }
  }

  private func emitInterstitial(_ ad: EzoicInterstitialAd, _ type: String, _ extra: [String: Any] = [:]) {
    var body: [String: Any] = [
      "adUnitIdentifier": String(ad.adUnitIdentifier),
      "type": type
    ]
    for (key, value) in extra { body[key] = value }
    eventEmitter?("EzoicInterstitialAdEvent", body)
  }
}

// MARK: - EzoicRewardedAdDelegate

extension EzoicAdsImpl: EzoicRewardedAdDelegate {

  public func rewardedAdDidPresent(_ rewardedAd: EzoicRewardedAd) {
    emit(rewardedAd, "shown")
  }

  public func rewardedAd(_ rewardedAd: EzoicRewardedAd, didFailToPresentWithError error: EzoicError) {
    emit(rewardedAd, "failedToShow", ["message": error.localizedDescription, "code": error.code])
    let id = rewardedAd.adUnitIdentifier
    rewardedAds.removeValue(forKey: id)
    if let pending = pendingShows.removeValue(forKey: id) {
      pending.reject("EzoicAds", error.localizedDescription, error as NSError)
    }
  }

  public func rewardedAdDidRecordImpression(_ rewardedAd: EzoicRewardedAd) {
    emit(rewardedAd, "impression")
  }

  public func rewardedAdDidRecordClick(_ rewardedAd: EzoicRewardedAd) {
    emit(rewardedAd, "clicked")
  }

  public func rewardedAd(_ rewardedAd: EzoicRewardedAd, userDidEarn reward: EzoicReward) {
    emit(rewardedAd, "reward", ["rewardType": reward.type, "rewardAmount": reward.amount])
    pendingShows[rewardedAd.adUnitIdentifier]?.reward = reward
  }

  public func rewardedAdDidDismiss(_ rewardedAd: EzoicRewardedAd) {
    emit(rewardedAd, "dismissed")
    let id = rewardedAd.adUnitIdentifier
    rewardedAds.removeValue(forKey: id)
    if let pending = pendingShows.removeValue(forKey: id) {
      let reward = pending.reward
      let result: [String: Any] = [
        "earned": reward != nil,
        "type": reward?.type ?? "",
        "amount": reward?.amount ?? 0
      ]
      pending.resolve(result)
    }
  }
}

// MARK: - EzoicInterstitialAdDelegate

extension EzoicAdsImpl: EzoicInterstitialAdDelegate {

  public func interstitialAdDidPresent(_ interstitialAd: EzoicInterstitialAd) {
    emitInterstitial(interstitialAd, "shown")
  }

  public func interstitialAd(_ interstitialAd: EzoicInterstitialAd, didFailToPresentWithError error: EzoicError) {
    emitInterstitial(interstitialAd, "failedToShow", ["message": error.localizedDescription, "code": error.code])
    let id = interstitialAd.adUnitIdentifier
    interstitialAds.removeValue(forKey: id)
    if let pending = pendingInterstitialShows.removeValue(forKey: id) {
      pending.reject("EzoicAds", error.localizedDescription, error as NSError)
    }
  }

  public func interstitialAdDidRecordImpression(_ interstitialAd: EzoicInterstitialAd) {
    emitInterstitial(interstitialAd, "impression")
  }

  public func interstitialAdDidRecordClick(_ interstitialAd: EzoicInterstitialAd) {
    emitInterstitial(interstitialAd, "clicked")
  }

  public func interstitialAdDidDismiss(_ interstitialAd: EzoicInterstitialAd) {
    emitInterstitial(interstitialAd, "dismissed")
    let id = interstitialAd.adUnitIdentifier
    interstitialAds.removeValue(forKey: id)
    if let pending = pendingInterstitialShows.removeValue(forKey: id) {
      pending.resolve(nil)
    }
  }
}
