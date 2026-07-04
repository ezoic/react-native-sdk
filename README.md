# @ezoic/react-native-sdk

Ezoic Ads SDK for React Native (Prebid + Google Ad Manager banner, native, interstitial and rewarded ads).

A thin React Native (New Architecture) wrapper over the native Ezoic Ads SDKs
for iOS (`EzoicAdsSDK`, via CocoaPods) and Android
(`com.ezoic.sdk:ezoic-ads-sdk`, via Maven Central). It exposes an imperative
`EzoicAds` TurboModule plus `EzoicBannerView` and `EzoicNativeAdView` Fabric
components.

## Requirements

- React Native 0.76+ with the New Architecture enabled.
- iOS 14.0+, Android `minSdk` 24+.

## Installation

```sh
npm install @ezoic/react-native-sdk
```

### iOS

The native `EzoicAdsSDK` ships as a binary Swift framework that depends on
`PrebidMobile` (a Swift source pod). Consuming a binary Swift framework with
Swift dependencies requires framework-based linkage, so your app's `Podfile`
must enable static frameworks:

```ruby
use_frameworks! :linkage => :static
```

Then install pods:

```sh
cd ios && RCT_NEW_ARCH_ENABLED=1 pod install
```

## Usage

```tsx
import { EzoicAds, EzoicBannerView } from '@ezoic/react-native-sdk';

// Initialize once, early in app startup.
await EzoicAds.initialize({ domain: 'example.com' });

// Optional consent / privacy signals.
EzoicAds.setGDPRConsent(true, '<IAB TCF consent string>');
EzoicAds.setGPPConsent('<GPP string>', '7');
EzoicAds.setSubjectToCOPPA(false);

// Track a pageview.
const tracked = await EzoicAds.trackPageview();

// Render a banner.
<EzoicBannerView
  adUnitIdentifier="123456"
  size="300x250"
  style={{ width: 300, height: 250 }}
  onLoad={() => console.log('loaded')}
  onError={(e) => console.log('error', e.message, e.code)}
  onImpression={() => console.log('impression')}
  onClick={() => console.log('click')}
  onOpen={() => console.log('open')}
  onClose={() => console.log('close')}
/>;
```

`adUnitIdentifier` is a string coerced to a native integer. `size` is a `"WxH"`
string or comma-separated list (e.g. `"300x250"`, `"300x250,320x50"`).

### Native ads

`EzoicNativeAdView` loads a native ad and renders it in an SDK-built template
`NativeAdView` (headline, icon, media, body and a call-to-action). Unlike the
banner it has no `size` prop — size it with `style` and the template lays its
assets out inside those bounds.

```tsx
import { EzoicAds, EzoicNativeAdView } from '@ezoic/react-native-sdk';

<EzoicNativeAdView
  adUnitIdentifier="123456"
  style={{ width: '100%', height: 300 }}
  onLoad={() => console.log('loaded')}
  onError={(e) => console.log('error', e.message, e.code)}
  onImpression={() => console.log('impression')}
  onClick={() => console.log('click')}
  onOpen={() => console.log('open')}
  onClose={() => console.log('close')}
/>;
```

## API

- `EzoicAds.initialize(config)` → `Promise<void>`
- `EzoicAds.setGDPRConsent(applies, consentString?)` → `void`
- `EzoicAds.setGPPConsent(gppString?, sectionIds?)` → `void`
- `EzoicAds.setSubjectToCOPPA(value)` → `void`
- `EzoicAds.trackPageview()` → `Promise<boolean>`
- `<EzoicBannerView adUnitIdentifier size onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicNativeAdView adUnitIdentifier onLoad onError onImpression onClick onOpen onClose />`

## License

SEE LICENSE IN LICENSE — Copyright (c) 2026 Ezoic Inc. All rights reserved.
