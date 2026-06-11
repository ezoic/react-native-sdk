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

  @objc public func initialize(_ config: NSDictionary,
                               resolve: @escaping (Any?) -> Void,
                               reject: @escaping (String, String, NSError?) -> Void) {
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

  @objc public func setGDPRConsent(_ applies: Bool, consentString: String?) {
    EzoicAds.shared.setGDPRConsent(applies: applies, consentString: consentString)
  }

  @objc public func setGPPConsent(_ gppString: String?, sectionIds: String?) {
    EzoicAds.shared.setGPPConsent(gppString: gppString, sectionIds: sectionIds)
  }

  @objc public func setSubjectToCOPPA(_ value: Bool) {
    EzoicAds.shared.setSubjectToCOPPA(value)
  }

  @objc public func trackPageview(_ resolve: @escaping (Any?) -> Void) {
    EzoicAds.shared.trackPageview { success in
      resolve(NSNumber(value: success))
    }
  }

  @objc public func loadRewardedAd(_ adUnitIdentifier: String,
                                   resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String, String, NSError?) -> Void) {
    guard let id = Int(adUnitIdentifier) else {
      reject("EzoicAds", "Invalid adUnitIdentifier: \(adUnitIdentifier)", nil)
      return
    }
    EzoicRewardedAd.load(adUnitIdentifier: id) { [weak self] result in
      guard let self = self else { return }
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

  @objc public func showRewardedAd(_ adUnitIdentifier: String,
                                   resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String, String, NSError?) -> Void) {
    guard let id = Int(adUnitIdentifier), let ad = rewardedAds[id] else {
      reject("EzoicAds", "Rewarded ad not loaded for \(adUnitIdentifier)", nil)
      return
    }
    pendingShows[id] = PendingRewardShow(resolve: resolve, reject: reject)
    // Presenting from nil lets GMA use the application's top view controller.
    ad.show(from: nil) { [weak self] reward in
      self?.pendingShows[id]?.reward = reward
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
}

// MARK: - EzoicRewardedAdDelegate

extension EzoicAdsImpl: EzoicRewardedAdDelegate {

  public func rewardedAdDidPresent(_ rewardedAd: EzoicRewardedAd) {
    emit(rewardedAd, "shown")
  }

  public func rewardedAd(_ rewardedAd: EzoicRewardedAd, didFailToPresentWithError error: EzoicError) {
    emit(rewardedAd, "failedToShow", ["message": error.localizedDescription])
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
