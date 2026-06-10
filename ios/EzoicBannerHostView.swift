import UIKit
import EzoicAdsSDKBinary

@objc public protocol EzoicBannerHostViewDelegate: AnyObject {
  func bannerDidLoad()
  func bannerDidFail(_ message: String, code: Int)
  func bannerDidRecordImpression()
  func bannerDidRecordClick()
  func bannerWillPresentScreen()
  func bannerDidDismissScreen()
}

@objc public class EzoicBannerHostView: UIView, EzoicBannerViewDelegate {

  @objc public weak var hostDelegate: EzoicBannerHostViewDelegate?
  private var banner: EzoicBannerView?
  private var adUnitId: Int = 0
  private var sizes: [String] = []

  @objc public func configure(adUnitIdentifier: String, size: String) {
    self.adUnitId = Int(adUnitIdentifier) ?? 0
    self.sizes = size.split(separator: ",").map { String($0) }
    rebuildAndLoad()
  }

  private func rebuildAndLoad() {
    banner?.removeFromSuperview()
    let view = EzoicBannerView(adUnitIdentifier: adUnitId)
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

  // MARK: - EzoicBannerViewDelegate
  public func bannerViewDidLoad(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidLoad() }
  public func bannerView(_ bannerView: EzoicBannerView, didFailToLoadWithError error: EzoicError) {
    hostDelegate?.bannerDidFail(error.localizedDescription, code: error.code)
  }
  public func bannerViewDidRecordImpression(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidRecordImpression() }
  public func bannerViewDidRecordClick(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidRecordClick() }
  public func bannerViewWillPresentScreen(_ bannerView: EzoicBannerView) { hostDelegate?.bannerWillPresentScreen() }
  public func bannerViewDidDismissScreen(_ bannerView: EzoicBannerView) { hostDelegate?.bannerDidDismissScreen() }
}
