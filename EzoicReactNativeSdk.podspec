require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk = package["ezoic"]["iosSdk"]
ios_sdk_framework = "ios/Frameworks/EzoicAdsSDKBinary.xcframework"

unless File.exist?(File.join(__dir__, ios_sdk_framework, "Info.plist"))
  raise Pod::Informative, "EzoicReactNativeSdk: #{ios_sdk_framework} is missing. " \
    "It ships in the npm package; in a git checkout run `npm install` or " \
    "`node scripts/fetch-ios-sdk.js` in #{__dir__} to download EzoicAdsSDK #{ios_sdk["version"]}"
end

Pod::Spec.new do |s|
  s.name         = "EzoicReactNativeSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/ezoic/react-native-sdk.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  # exclude_files also filters vendored_frameworks, so exclude only the
  # contents of the xcframework, not the bundle itself.
  s.exclude_files = "ios/Frameworks/*.xcframework/**/*"

  install_modules_dependencies(s)

  # Native Ezoic Ads SDK (vends the `EzoicAdsSDKBinary` module), bundled in the
  # npm package by scripts/fetch-ios-sdk.js instead of the EzoicAdsSDK pod.
  # This is the `-cocoapods` build: a static framework that links the host's
  # PrebidMobile / GoogleMobileAds / DTBiOSSDK rather than embedding them.
  s.vendored_frameworks = ios_sdk_framework

  # Pins from package.json `ezoic.iosSdk.podDependencies`; they must match what
  # the bundled binary was built against (PrebidMobile's Swift ABI is exact).
  ios_sdk["podDependencies"].each do |name, requirement|
    s.dependency name, requirement
  end
  s.swift_version = "5.9"
end
