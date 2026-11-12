import Foundation
import UIKit
import EzoicCmpSDKBinary

@objc public class EzoicCmpImpl: NSObject {

  /// Set by the Obj-C module to resolve the view controller consent dialogs
  /// are presented from (`RCTPresentedViewController()`). Called on main.
  @objc public var hostViewControllerProvider: (() -> UIViewController?)?

  private func onMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  @objc public func initialize(_ domain: String, config: NSDictionary) {
    let configuration = EzoicCmpConfiguration(
      cmpEnabled: (config["cmpEnabled"] as? Bool) ?? true,
      autoReadConsent: (config["autoReadConsent"] as? Bool) ?? true,
      debugEnabled: (config["debugEnabled"] as? Bool) ?? false
    )
    onMain {
      EzoicCmp.initialize(domain: domain, configuration: configuration)
    }
  }

  @objc public func presentConsentIfRequired(_ resolve: @escaping (Any?) -> Void) {
    presentConsent(resolve) { host, completion in
      EzoicCmp.presentConsentIfRequired(from: host, completion: completion)
    }
  }

  @objc public func presentConsentSettings(_ resolve: @escaping (Any?) -> Void) {
    presentConsent(resolve) { host, completion in
      EzoicCmp.presentConsentSettings(from: host, completion: completion)
    }
  }

  @objc public func isConsentRequired(_ resolve: @escaping (Any?) -> Void) {
    onMain {
      resolve(EzoicCmp.isConsentRequired.map { NSNumber(value: $0) })
    }
  }

  @objc public func isPrivacyOptionsRequired(_ resolve: @escaping (Any?) -> Void) {
    onMain {
      resolve(EzoicCmp.isPrivacyOptionsRequired.map { NSNumber(value: $0) })
    }
  }

  @objc public func resetConsent() {
    onMain {
      EzoicCmp.resetConsent()
    }
  }

  /// Presents from the top-most view controller on main and always resolves
  /// with an outcome dictionary; with no view controller it resolves `failed(-1)`.
  private func presentConsent(
    _ resolve: @escaping (Any?) -> Void,
    _ present: @escaping (UIViewController, @escaping (ConsentOutcome) -> Void) -> Void
  ) {
    onMain { [weak self] in
      guard let host = self?.hostViewControllerProvider?() else {
        resolve(Self.consentFailure(code: Self.noHostCode, message: Self.noHostMessage))
        return
      }
      present(host) { outcome in resolve(Self.consentOutcomeMap(outcome)) }
    }
  }

  private static let noHostCode = -1
  private static let noHostMessage = "No foreground Activity"
  private static let unknownErrorCode = -1

  private static func consentFailure(code: Int, message: String) -> [String: Any] {
    return ["type": "failed", "code": code, "message": message]
  }

  private static func consentOutcomeMap(_ outcome: ConsentOutcome) -> [String: Any] {
    switch outcome {
    case .notRequired:
      return ["type": "notRequired"]
    case .alreadyDecided:
      return ["type": "alreadyDecided"]
    case .dismissed:
      return ["type": "dismissed"]
    case .alreadyPresenting:
      return ["type": "alreadyPresenting"]
    case .decided(let decision):
      let name: String
      switch decision {
      case .acceptAll: name = "acceptAll"
      case .rejectAll: name = "rejectAll"
      case .custom: name = "custom"
      @unknown default: return consentFailure(code: unknownErrorCode, message: "Unrecognized outcome")
      }
      return ["type": "decided", "decision": name]
    case .failed(let error):
      // `CmpError` from `EzoicCmp`.
      return consentFailure(code: (error as? EzoicErrorCode)?.code ?? unknownErrorCode, message: error.localizedDescription)
    @unknown default:
      return consentFailure(code: unknownErrorCode, message: "Unrecognized outcome")
    }
  }
}
