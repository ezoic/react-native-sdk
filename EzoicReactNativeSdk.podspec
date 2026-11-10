require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk = package["ezoic"]["iosSdk"]

ads_framework = "ios/Frameworks/EzoicAdsSDKBinary.xcframework"
cmp_framework = "ios/Frameworks/EzoicCmpSDKBinary.xcframework"
# The pod of @ezoic/react-native-cmp-sdk, which vendors EzoicCmpSDKBinary itself.
cmp_pod = "EzoicReactNativeCmpSdk"

missing = [ads_framework, cmp_framework].reject do |framework|
  File.exist?(File.join(__dir__, framework, "Info.plist"))
end
unless missing.empty?
  raise Pod::Informative, "EzoicReactNativeSdk: #{missing.join(", ")} missing. " \
    "They ship in the npm package; in a git checkout run `npm install` or " \
    "`node scripts/fetch-ios-sdk.js` in #{__dir__} to download EzoicAdsSDK #{ios_sdk["version"]}"
end

# EzoicAdsSDKBinary links against EzoicCmpSDKBinary, so the app needs exactly one
# copy of it. CocoaPods rejects two pods vendoring the same framework, and React
# Native autolinks only the app's direct dependencies, so this package can't
# require the CMP package: when the app's Podfile has the CMP pod too, depend on
# it for the CMP framework; otherwise vendor it here.
podfile = defined?(Pod::Config) ? Pod::Config.instance.podfile : nil
uses_cmp_pod = !podfile.nil? && podfile.dependencies.any? { |dep| dep.root_name == cmp_pod }

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
  # contents of the xcframeworks, not the bundles themselves.
  s.exclude_files = "ios/Frameworks/*.xcframework/**/*"

  install_modules_dependencies(s)

  # Native Ezoic Ads SDK (vends the `EzoicAdsSDKBinary` module, which re-exports
  # `EzoicCmpSDKBinary`), bundled in the npm package by scripts/fetch-ios-sdk.js
  # instead of the EzoicAdsSDK pod. These are the `-cocoapods` builds: static
  # frameworks that link the host's PrebidMobile / GoogleMobileAds / DTBiOSSDK
  # rather than embedding them.
  if uses_cmp_pod
    s.vendored_frameworks = ads_framework
    # Same native SDK version on both sides: the ads binary is built against
    # this exact CMP binary.
    s.dependency cmp_pod, package["version"]
  else
    s.vendored_frameworks = [ads_framework, cmp_framework]
  end

  # Pins from package.json `ezoic.iosSdk.podDependencies`; they must match what
  # the bundled binary was built against (PrebidMobile's Swift ABI is exact).
  ios_sdk["podDependencies"].each do |name, requirement|
    s.dependency name, requirement
  end
  s.swift_version = "5.9"
end
