import UIKit
import EzoicAdsSDKBinary

/// Bridge protocol the Fabric component view implements to receive outstream
/// events. Mirrors `EzoicNativeAdHostViewDelegate` — the ObjC++ component view
/// forwards these onto the Fabric `_eventEmitter`.
@objc public protocol EzoicOutstreamAdHostViewDelegate: AnyObject {
  func outstreamAdDidLoad()
  func outstreamAdDidFail(_ message: String, code: Int)
  func outstreamAdDidRecordImpression()
  func outstreamAdDidRecordClick()
  func outstreamAdWillPresentScreen()
  func outstreamAdDidDismissScreen()
}

/// Host `UIView` wrapping the native `EzoicOutstreamAdView`. Unlike the native
/// ad (which returns a `NativeAd` we build a template around), the native
/// outstream view renders itself (it attaches its own `AdManagerBannerView`),
/// so this host just embeds it edge-to-edge, wires the delegate before
/// `loadAd()`, and tears it down on `deinit`.
///
/// Load is deferred to `startLoad()` (called from the component view's
/// `finalizeUpdates`) so the Fabric event emitter is attached before the native
/// SDK can fail synchronously (uninitialized) and emit `onError`.
@objc public class EzoicOutstreamAdHostView: UIView, EzoicOutstreamAdViewDelegate {

  @objc public weak var hostDelegate: EzoicOutstreamAdHostViewDelegate?

  private var adUnitId: Int = 0
  private var outstreamView: EzoicOutstreamAdView?
  private var loadStarted = false

  /// Stores the ad unit id. The load is NOT started here — the Fabric
  /// component view calls `startLoad()` from `finalizeUpdates`.
  @objc public func configure(adUnitIdentifier: String) {
    self.adUnitId = Int(adUnitIdentifier) ?? 0
  }

  /// Builds the native outstream view, wires its delegate BEFORE `loadAd()`,
  /// embeds it edge-to-edge, and loads once. A second call is a no-op; the
  /// guard survives repeated `finalizeUpdates` calls.
  @objc public func startLoad() {
    if loadStarted { return }
    loadStarted = true

    let view = EzoicOutstreamAdView(adUnitIdentifier: adUnitId)
    // Delegate before loadAd so no early lifecycle callback is missed.
    view.delegate = self
    view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(view)
    NSLayoutConstraint.activate([
      view.topAnchor.constraint(equalTo: topAnchor),
      view.leadingAnchor.constraint(equalTo: leadingAnchor),
      view.trailingAnchor.constraint(equalTo: trailingAnchor),
      view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    self.outstreamView = view
    view.loadAd()
  }

  // MARK: - EzoicOutstreamAdViewDelegate
  public func outstreamViewDidLoad(_ outstreamView: EzoicOutstreamAdView) {
    hostDelegate?.outstreamAdDidLoad()
  }
  public func outstreamView(_ outstreamView: EzoicOutstreamAdView, didFailToLoadWithError error: EzoicError) {
    hostDelegate?.outstreamAdDidFail(error.localizedDescription, code: error.code)
  }
  public func outstreamViewDidRecordImpression(_ outstreamView: EzoicOutstreamAdView) {
    hostDelegate?.outstreamAdDidRecordImpression()
  }
  public func outstreamViewDidRecordClick(_ outstreamView: EzoicOutstreamAdView) {
    hostDelegate?.outstreamAdDidRecordClick()
  }
  public func outstreamViewWillPresentScreen(_ outstreamView: EzoicOutstreamAdView) {
    hostDelegate?.outstreamAdWillPresentScreen()
  }
  public func outstreamViewDidDismissScreen(_ outstreamView: EzoicOutstreamAdView) {
    hostDelegate?.outstreamAdDidDismissScreen()
  }

  deinit {
    // The native view also destroys itself on removeFromSuperview, but call it
    // explicitly for a deterministic teardown. Safe to call multiple times.
    outstreamView?.destroy()
  }
}
