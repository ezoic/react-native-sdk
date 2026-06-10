import Foundation
import EzoicAdsSDKBinary

@objc public class EzoicAdsImpl: NSObject {

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
}
