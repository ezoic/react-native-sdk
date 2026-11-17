require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk = package["ezoic"]["iosSdk"]
frameworks = %w[EzoicConsentCoreBinary EzoicCmpSDKBinary].map { |name| "ios/Frameworks/#{name}.xcframework" }

missing = frameworks.reject { |framework| File.exist?(File.join(__dir__, framework, "Info.plist")) }
unless missing.empty?
  raise Pod::Informative, "EzoicReactNativeCmpSdk: #{missing.join(", ")} missing. " \
    "They ship in the npm package; in a git checkout run " \
    "`node ../scripts/fetch-ios-sdk.js --package .` in #{__dir__} to download EzoicCmpSDK #{ios_sdk["version"]}"
end

Pod::Spec.new do |s|
  s.name         = "EzoicReactNativeCmpSdk"
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

  # Native Ezoic CMP (vends the `EzoicCmpSDKBinary` module, which re-exports
  # the `EzoicConsentCoreBinary` it imports), bundled in the npm package by
  # scripts/fetch-ios-sdk.js. Static frameworks with no pod dependencies. When
  # the app also has @ezoic/react-native-sdk, that pod depends on this one for
  # both frameworks instead of vendoring its own copies.
  s.vendored_frameworks = frameworks
  s.swift_version = "5.9"
end
