require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "EzoicReactNativeSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/ezoic/react-native-sdk.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  install_modules_dependencies(s)

  # Native Ezoic Ads SDK (vends the `EzoicAdsSDKBinary` module). Brings in
  # PrebidMobile + Google-Mobile-Ads-SDK transitively.
  s.dependency "EzoicAdsSDK", "~> 1.4"
  # The native-ad host imports GoogleMobileAds directly (NativeAdView,
  # MediaView, NativeAd). Pin GMA 12 so the module is on the compile path.
  s.dependency "Google-Mobile-Ads-SDK", "~> 12.0"
  s.swift_version = "5.9"
end
