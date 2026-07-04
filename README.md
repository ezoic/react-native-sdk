# @ezoic/react-native-sdk

Ezoic Ads SDK for React Native (Prebid + Google Ad Manager banner, native, interstitial, rewarded, outstream and instream video ads).

A thin React Native (New Architecture) wrapper over the native Ezoic Ads SDKs
for iOS (`EzoicAdsSDK`, via CocoaPods) and Android
(`com.ezoic.sdk:ezoic-ads-sdk`, via Maven Central). It exposes an imperative
`EzoicAds` TurboModule plus `EzoicBannerView`, `EzoicNativeAdView` and
`EzoicOutstreamAdView` Fabric components, and the `EzoicInstreamAd` controller.

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

### Outstream video

`EzoicOutstreamAdView` loads and renders a self-contained outstream video ad.
Like the native ad it has no `size` prop — size it with `style` and the native
view lays the player out inside those bounds. It is view-managed: mounting the
component loads the ad, unmounting destroys it.

```tsx
import { EzoicAds, EzoicOutstreamAdView } from '@ezoic/react-native-sdk';

<EzoicOutstreamAdView
  adUnitIdentifier="123456"
  style={{ width: '100%', height: 250 }}
  onLoad={() => console.log('loaded')}
  onError={(e) => console.log('error', e.message, e.code)}
  onImpression={() => console.log('impression')}
  onClick={() => console.log('click')}
  onOpen={() => console.log('open')}
  onClose={() => console.log('close')}
/>;
```

### Instream video

`EzoicInstreamAd` is a view-less controller for instream (pre/mid/post-roll)
video. **The host owns the video player and the Google IMA SDK** — the SDK
renders nothing; its sole deliverable is a GAM VAST ad-tag URL string you feed
to your own IMA `AdsRequest`. A controller is multi-use and prefetchable: it is
not auto-destroyed, so you `load()` it repeatedly and `destroy()` it yourself.

```tsx
import { EzoicInstreamAd } from '@ezoic/react-native-sdk';

const instream = new EzoicInstreamAd('123456');

// Resolve the VAST ad-tag URL and hand it to your IMA player.
const adTagUrl = await instream.load({ contentUrl: playingVideoUrl });
adsLoader.requestAds({ adTagUrl });

// On an IMA ad error, walk down the floor waterfall to the next tag.
const next = await instream.getNextAdTagUrl(); // null once exhausted
if (next) adsLoader.requestAds({ adTagUrl: next });

// On the IMA STARTED event, fire the Ezoic impression pixel.
await instream.reportImpression({ revenueUsd: 0.012 });

// Release the native controller when done.
await instream.destroy();
```

`load()` rejects on no fill, an uninitialized SDK, or an overlapping load
already in flight for this id; it is safe to call again after a previous load
resolves. `contentUrl` and `revenueUsd` are optional.

## API

- `EzoicAds.initialize(config)` → `Promise<void>`
- `EzoicAds.setGDPRConsent(applies, consentString?)` → `void`
- `EzoicAds.setGPPConsent(gppString?, sectionIds?)` → `void`
- `EzoicAds.setSubjectToCOPPA(value)` → `void`
- `EzoicAds.trackPageview()` → `Promise<boolean>`
- `<EzoicBannerView adUnitIdentifier size onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicNativeAdView adUnitIdentifier onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicOutstreamAdView adUnitIdentifier onLoad onError onImpression onClick onOpen onClose />`
- `new EzoicInstreamAd(adUnitIdentifier)`
  - `.load({ contentUrl? })` → `Promise<string>` (GAM VAST ad-tag URL)
  - `.getNextAdTagUrl()` → `Promise<string | null>`
  - `.reportImpression({ revenueUsd? })` → `Promise<void>`
  - `.destroy()` → `Promise<void>`

## License

SEE LICENSE IN LICENSE — Copyright (c) 2026 Ezoic Inc. All rights reserved.
