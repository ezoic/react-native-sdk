import UIKit
import EzoicAdsSDKBinary

@objc public protocol EzoicBannerHostViewDelegate: AnyObject {
  func bannerDidLoad()
  func bannerDidFail(_ message: String, code: Int)
  func bannerDidChangeSize(_ width: Double, height: Double)
  func bannerDidRecordImpression()
  func bannerDidRecordClick()
  func bannerWillPresentScreen()
  func bannerDidDismissScreen()
}

/// Hosts one native `EzoicBannerView` for the Fabric component view. The host
/// loads exactly once: a prop change or a recycled component view gets a fresh
/// host (see `EzoicBannerViewComponentView.mm`), the same lifecycle as
/// `EzoicOutstreamAdHostView`.
@objc public class EzoicBannerHostView: UIView, EzoicBannerViewDelegate {

  @objc public weak var hostDelegate: EzoicBannerHostViewDelegate?
  @objc public var collapseOnNoFill: Bool = true {
    didSet { banner?.collapseOnNoFill = collapseOnNoFill }
  }
  /// Refresh overrides from JS. A negative value (the codegen default -1)
  /// means not set, passed to the native banner as nil = follow the server.
  /// Read at `loadAd()`, so a change after load applies on the next load.
  @objc public var refreshIntervalSeconds: Int = -1 {
    didSet { banner?.refreshIntervalSeconds = Self.refreshOverride(refreshIntervalSeconds) }
  }
  @objc public var refreshMaxCount: Int = -1 {
    didSet { banner?.refreshMaxCount = Self.refreshOverride(refreshMaxCount) }
  }
  private var banner: EzoicBannerView?
  private var adUnitId: Int = 0
  private var sizes: [String] = []
  private var loadStarted = false

  /// Stores the ad unit id and requested sizes. The load is NOT started here —
  /// the Fabric component view calls `startLoad()` from `finalizeUpdates`, once
  /// the event emitter is attached, so a synchronous failure (SDK not yet
  /// initialized on a cold start) still reaches JS as `onError`.
  @objc public func configure(adUnitIdentifier: String, size: String) {
    self.adUnitId = Int(adUnitIdentifier) ?? 0
    self.sizes = size.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
  }

  /// Builds the native banner, wires its delegate BEFORE `loadAd`, and loads
  /// once. A second call is a no-op; the guard survives repeated
  /// `finalizeUpdates` calls.
  @objc public func startLoad() {
    if loadStarted { return }
    loadStarted = true

    let view = EzoicBannerView(adUnitIdentifier: adUnitId)
    view.collapseOnNoFill = collapseOnNoFill
    view.refreshIntervalSeconds = Self.refreshOverride(refreshIntervalSeconds)
    view.refreshMaxCount = Self.refreshOverride(refreshMaxCount)
    view.delegate = self
    view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(view)
    NSLayoutConstraint.activate([
      view.centerXAnchor.constraint(equalTo: centerXAnchor),
      view.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])
    banner = view
    if sizes.isEmpty { view.loadAd() } else { view.loadAd(sizes: sizes) }
  }

  static func refreshOverride(_ value: Int) -> Int? { value < 0 ? nil : value }

  // MARK: - EzoicBannerViewDelegate
  public func bannerViewDidLoad(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidLoad() }
  public func bannerView(_ bannerView: EzoicBannerView, didFailToLoadWithError error: EzoicError) {
    hostDelegate?.bannerDidFail(error.localizedDescription, code: error.code)
  }
  public func bannerView(_ bannerView: EzoicBannerView, didChangeSize size: CGSize) {
    hostDelegate?.bannerDidChangeSize(Double(size.width), height: Double(size.height))
  }
  public func bannerViewDidRecordImpression(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidRecordImpression() }
  public func bannerViewDidRecordClick(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidRecordClick() }
  public func bannerViewWillPresentScreen(_ bannerView: EzoicBannerView) { hostDelegate?.bannerWillPresentScreen() }
  public func bannerViewDidDismissScreen(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidDismissScreen() }

  /// Tears down the native banner. Called by the component view when it
  /// discards this host (prop change, recycle) and again on `deinit`; safe to
  /// call multiple times.
  @objc public func destroy() {
    hostDelegate = nil
    banner?.destroy()
    banner = nil
  }

  deinit {
    destroy()
  }
}
