import UIKit
import EzoicAdsSDKBinary
import GoogleMobileAds

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
  private var adView: NativeAdView?
  private var loadStarted = false

  /// Stores the ad unit id. The load is NOT started here — the Fabric
  /// component view calls `startLoad()` from `finalizeUpdates`, after the
  /// event emitter is attached, so a synchronous SDK failure (uninitialized)
  /// can deliver `onError` instead of being dropped.
  @objc public func configure(adUnitIdentifier: String) {
    self.adUnitId = Int(adUnitIdentifier) ?? 0
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
        guard let gmaAd = ad.nativeAd else {
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
        self.render(gmaAd)
        self.hostDelegate?.nativeAdDidLoad()
      case .failure(let error):
        self.hostDelegate?.nativeAdDidFail(error.localizedDescription, code: error.code)
      }
    }
  }

  /// Builds a template `NativeAdView` in code (mirrors the Android template):
  /// a header row (icon + headline/advertiser), a `MediaView`, the body text
  /// and a call-to-action button. Optional text/image assets are created and
  /// registered only when present, but the `MediaView` is always built: on
  /// GMA 12 `NativeAd.mediaContent` is non-optional and the media view is a
  /// required asset. `adView.nativeAd` is assigned last.
  private func render(_ gmaAd: GoogleMobileAds.NativeAd) {
    let adView = NativeAdView()
    adView.translatesAutoresizingMaskIntoConstraints = false

    let mainStack = UIStackView()
    mainStack.axis = .vertical
    mainStack.spacing = 8
    mainStack.translatesAutoresizingMaskIntoConstraints = false

    let headerRow = UIStackView()
    headerRow.axis = .horizontal
    headerRow.spacing = 8
    headerRow.alignment = .center

    if let image = gmaAd.icon?.image {
      let iconView = UIImageView(image: image)
      iconView.translatesAutoresizingMaskIntoConstraints = false
      NSLayoutConstraint.activate([
        iconView.widthAnchor.constraint(equalToConstant: 40),
        iconView.heightAnchor.constraint(equalToConstant: 40),
      ])
      headerRow.addArrangedSubview(iconView)
      adView.iconView = iconView
    }

    let textColumn = UIStackView()
    textColumn.axis = .vertical

    if let headline = gmaAd.headline {
      let label = UILabel()
      label.text = headline
      label.font = .boldSystemFont(ofSize: 16)
      label.numberOfLines = 0
      textColumn.addArrangedSubview(label)
      adView.headlineView = label
    }

    if let advertiser = gmaAd.advertiser {
      let label = UILabel()
      label.text = advertiser
      label.font = .systemFont(ofSize: 12)
      textColumn.addArrangedSubview(label)
      adView.advertiserView = label
    }

    headerRow.addArrangedSubview(textColumn)
    mainStack.addArrangedSubview(headerRow)

    let mediaView = MediaView()
    mediaView.mediaContent = gmaAd.mediaContent
    mediaView.translatesAutoresizingMaskIntoConstraints = false
    // Priority 999 so a caller-supplied style shorter than the template's
    // natural height breaks this constraint instead of spamming
    // unsatisfiable-constraint logs.
    let mediaHeight = mediaView.heightAnchor.constraint(equalToConstant: 175)
    mediaHeight.priority = UILayoutPriority(999)
    mediaHeight.isActive = true
    mainStack.addArrangedSubview(mediaView)
    adView.mediaView = mediaView

    if let body = gmaAd.body {
      let label = UILabel()
      label.text = body
      label.font = .systemFont(ofSize: 14)
      label.numberOfLines = 0
      mainStack.addArrangedSubview(label)
      adView.bodyView = label
    }

    if let cta = gmaAd.callToAction {
      let button = UIButton(type: .system)
      button.setTitle(cta, for: .normal)
      // The NativeAdView handles the tap; the button must not intercept it.
      button.isUserInteractionEnabled = false
      mainStack.addArrangedSubview(button)
      adView.callToActionView = button
    }

    adView.addSubview(mainStack)
    NSLayoutConstraint.activate([
      mainStack.topAnchor.constraint(equalTo: adView.topAnchor, constant: 8),
      mainStack.leadingAnchor.constraint(equalTo: adView.leadingAnchor, constant: 8),
      mainStack.trailingAnchor.constraint(equalTo: adView.trailingAnchor, constant: -8),
      mainStack.bottomAnchor.constraint(equalTo: adView.bottomAnchor, constant: -8),
    ])

    self.adView?.removeFromSuperview()
    addSubview(adView)
    NSLayoutConstraint.activate([
      adView.topAnchor.constraint(equalTo: topAnchor),
      adView.leadingAnchor.constraint(equalTo: leadingAnchor),
      adView.trailingAnchor.constraint(equalTo: trailingAnchor),
      adView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    adView.nativeAd = gmaAd
    self.adView = adView
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
