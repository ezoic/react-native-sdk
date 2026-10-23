import UIKit
import EzoicAdsSDKBinary

@objc public protocol EzoicNativeAdHostViewDelegate: AnyObject {
  func nativeAdDidLoad()
  func nativeAdDidFail(_ message: String, code: Int)
  func nativeAdDidRecordImpression()
  func nativeAdDidRecordClick()
  func nativeAdWillPresentScreen()
  func nativeAdDidDismissScreen()
}

@objc public class EzoicNativeAdHostView: UIView, EzoicNativeAdDelegate {

  @objc public weak var hostDelegate: EzoicNativeAdHostViewDelegate?

  private var adUnitId: Int = 0
  private var ezoicNativeAd: EzoicNativeAd?
  private var templateView: EzoicNativeAdTemplateView?
  private var adStyle = EzoicNativeAdStyle()
  private var loadStarted = false

  /// Stores the ad unit id. The load is NOT started here — the Fabric
  /// component view calls `startLoad()` from `finalizeUpdates`, after the
  /// event emitter is attached, so a synchronous SDK failure (uninitialized)
  /// can deliver `onError` instead of being dropped.
  @objc public func configure(adUnitIdentifier: String) {
    self.adUnitId = Int(adUnitIdentifier) ?? 0
  }

  /// Sets the template style from the JS `adStyle` prop (JSON, colors as ARGB
  /// numbers). Re-renders an ad that is already showing.
  @objc public func setAdStyleJson(_ json: String) {
    let data = Data(json.utf8)
    let map = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    adStyle = EzoicNativeAdStyle(dictionary: map)
    templateView?.style = adStyle
  }

  /// Starts the native-ad load once. A second call is a no-op; the guard
  /// survives repeated `finalizeUpdates` calls.
  @objc public func startLoad() {
    if loadStarted { return }
    loadStarted = true
    EzoicNativeAd.load(adUnitIdentifier: adUnitId) { [weak self] result in
      guard let self = self else { return }
      switch result {
      case .success(let ad):
        guard ad.nativeAd != nil else {
          // Empty-content ad: destroy it and do not retain it instead of
          // keeping an unrenderable, errored ad alive.
          ad.destroy()
          self.hostDelegate?.nativeAdDidFail("Native ad loaded without content", code: 0)
          return
        }
        self.ezoicNativeAd = ad
        // Attach the delegate before rendering so the impression, which fires
        // as soon as the NativeAdView is displayed, is delivered.
        ad.delegate = self
        self.render(ad)
        self.hostDelegate?.nativeAdDidLoad()
      case .failure(let error):
        self.hostDelegate?.nativeAdDidFail(error.localizedDescription, code: error.code)
      }
    }
  }

  /// Shows the ad in the SDK template, which also registers it for viewability.
  private func render(_ ad: EzoicNativeAd) {
    templateView?.removeFromSuperview()
    let view = EzoicNativeAdTemplateView()
    view.translatesAutoresizingMaskIntoConstraints = false
    view.style = adStyle
    addSubview(view)
    NSLayoutConstraint.activate([
      view.topAnchor.constraint(equalTo: topAnchor),
      view.leadingAnchor.constraint(equalTo: leadingAnchor),
      view.trailingAnchor.constraint(equalTo: trailingAnchor),
      view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    view.nativeAd = ad
    templateView = view
  }

  // MARK: - EzoicNativeAdDelegate
  public func nativeAdDidRecordImpression(_ nativeAd: EzoicNativeAd) {
    hostDelegate?.nativeAdDidRecordImpression()
  }
  public func nativeAdDidRecordClick(_ nativeAd: EzoicNativeAd) {
    hostDelegate?.nativeAdDidRecordClick()
  }
  public func nativeAdWillPresentScreen(_ nativeAd: EzoicNativeAd) {
    hostDelegate?.nativeAdWillPresentScreen()
  }
  public func nativeAdDidDismissScreen(_ nativeAd: EzoicNativeAd) {
    hostDelegate?.nativeAdDidDismissScreen()
  }

  deinit {
    ezoicNativeAd?.destroy()
  }
}
