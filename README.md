# @ezoic/react-native-sdk

Ezoic Ads SDK for React Native (Prebid + Google Ad Manager banner ads).

A thin React Native (New Architecture) wrapper over the native Ezoic Ads SDKs
for iOS (`EzoicAdsSDK`, via CocoaPods) and Android
(`com.ezoic.sdk:ezoic-ads-sdk`, via Maven Central). It exposes an imperative
`EzoicAds` TurboModule and an `EzoicBannerView` Fabric component.

## Requirements

- React Native 0.76+ with the New Architecture enabled.
- iOS 14.0+, Android `minSdk` 24+.

## Installation

```sh
npm install @ezoic/react-native-sdk
```

Then install pods for iOS:

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

## API

- `EzoicAds.initialize(config)` → `Promise<void>`
- `EzoicAds.setGDPRConsent(applies, consentString?)` → `void`
- `EzoicAds.setGPPConsent(gppString?, sectionIds?)` → `void`
- `EzoicAds.setSubjectToCOPPA(value)` → `void`
- `EzoicAds.trackPageview()` → `Promise<boolean>`
- `<EzoicBannerView adUnitIdentifier size onLoad onError onImpression onClick onOpen onClose />`

## License

SEE LICENSE IN LICENSE — Copyright (c) 2026 Ezoic Inc. All rights reserved.
