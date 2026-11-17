require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk = package["ezoic"]["iosSdk"]

core_framework = "ios/Frameworks/EzoicConsentCoreBinary.xcframework"
ads_framework = "ios/Frameworks/EzoicAdsSDKBinary.xcframework"
cmp_framework = "ios/Frameworks/EzoicCmpSDKBinary.xcframework"
# The pod of @ezoic/react-native-cmp-sdk, which vendors EzoicConsentCoreBinary
# and EzoicCmpSDKBinary itself.
cmp_pod = "EzoicReactNativeCmpSdk"

# The app's package.json (the first one above the Podfile's directory), or nil.
# RN evaluates podspecs while the Podfile is still loading, so this is where the
# app's settings are.
app_package = lambda do
  return nil unless defined?(Pod::Config)
  dir = Pod::Config.instance.installation_root.to_s
  until File.exist?(File.join(dir, "package.json"))
    parent = File.dirname(dir)
    return nil if parent == dir
    dir = parent
  end
  app = JSON.parse(File.read(File.join(dir, "package.json")))
  app.is_a?(Hash) ? app : nil
rescue JSON::ParserError
  nil
end.call || {}

# EzoicAdsSDKBinary links against EzoicConsentCoreBinary, so the app needs
# exactly one copy of it (and of the CMP, when included). CocoaPods rejects two
# pods vendoring the same framework, and React Native autolinks only the app's
# own dependencies, so this package can't require the CMP package. When the app
# depends on the CMP package too, its pod (autolinked the same way) provides
# both frameworks and this pod depends on it; otherwise this pod vendors them.
# Same dependency keys as RN's autolinking.
uses_cmp_pod = %w[dependencies peerDependencies devDependencies].any? do |key|
  deps = app_package[key]
  deps.is_a?(Hash) && deps.key?("@ezoic/react-native-cmp-sdk")
end

# `"ezoic": { "includeCmp": false }` in the app's package.json leaves the
# built-in CMP out: no EzoicCmpSDKBinary, no reference to it. Absent or true
# includes it. The CMP package always contains the CMP, so with it the flag has
# no effect.
ezoic_settings = app_package["ezoic"].is_a?(Hash) ? app_package["ezoic"] : {}
include_cmp = ezoic_settings["includeCmp"] != false
if !include_cmp && uses_cmp_pod
  Pod::UI.warn "EzoicReactNativeSdk: \"ezoic\": { \"includeCmp\": false } has no effect " \
    "while the app depends on @ezoic/react-native-cmp-sdk, which contains the CMP."
  include_cmp = true
end

vendored = if uses_cmp_pod
  [ads_framework]
elsif include_cmp
  [core_framework, ads_framework, cmp_framework]
else
  [core_framework, ads_framework]
end

missing = vendored.reject do |framework|
  File.exist?(File.join(__dir__, framework, "Info.plist"))
end
unless missing.empty?
  raise Pod::Informative, "EzoicReactNativeSdk: #{missing.join(", ")} missing. " \
    "They ship in the npm package; in a git checkout run `npm install` or " \
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
  # contents of the xcframeworks, not the bundles themselves.
  s.exclude_files = "ios/Frameworks/*.xcframework/**/*"

  # The ads binary finds the built-in CMP at runtime by its Objective-C class
  # name and never references it, so a static link would leave the CMP out.
  # ios/EzoicCmpLink.swift references it, compiled only with this condition
  # (set before install_modules_dependencies, which merges into this hash).
  if include_cmp
    s.pod_target_xcconfig = {
      "SWIFT_ACTIVE_COMPILATION_CONDITIONS" => "$(inherited) EZOIC_INCLUDE_CMP"
    }
  end

  install_modules_dependencies(s)

  # Native Ezoic Ads SDK (vends the `EzoicAdsSDKBinary` module, which re-exports
  # `EzoicConsentCoreBinary`) and, unless excluded, the built-in CMP
  # (`EzoicCmpSDKBinary`), bundled in the npm package by scripts/fetch-ios-sdk.js
  # instead of the EzoicAdsSDK pod. These are the `-cocoapods` builds: static
  # frameworks that link the host's PrebidMobile / GoogleMobileAds / DTBiOSSDK
  # rather than embedding them.
  s.vendored_frameworks = vendored
  if uses_cmp_pod
    # Same native SDK version on both sides: the ads binary is built against
    # this exact core binary.
    s.dependency cmp_pod, package["version"]
  end

  # Pins from package.json `ezoic.iosSdk.podDependencies`; they must match what
  # the bundled binary was built against (PrebidMobile's Swift ABI is exact).
  ios_sdk["podDependencies"].each do |name, requirement|
    s.dependency name, requirement
  end
  s.swift_version = "5.9"
end
