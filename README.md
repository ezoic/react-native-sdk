# @ezoic/react-native-sdk

Ezoic Ads SDK for React Native (Prebid + Google Ad Manager banner, native, interstitial, rewarded, outstream and instream video ads).

A thin React Native (New Architecture) wrapper over the native Ezoic Ads SDKs
for iOS (`EzoicAdsSDK`, via CocoaPods) and Android
(`com.ezoic.sdk:ezoic-ads-sdk`, via Maven Central). It exposes an imperative
`EzoicAds` TurboModule plus `EzoicBannerView`, `EzoicNativeAdView` and
`EzoicOutstreamAdView` Fabric components, and the `EzoicInstreamAd` controller.

## Requirements

- React Native 0.76+ with the New Architecture enabled.
- iOS 15.0+ and Xcode 26+ (required by the native `EzoicAdsSDK` 1.13), Android `minSdk` 24+.

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

// Initialize once, early in app startup. In GDPR regions the built-in consent
// dialog is presented automatically once this resolves (see "Privacy & consent").
await EzoicAds.initialize({ domain: 'example.com' });

// Optional privacy signals.
EzoicAds.setGPPConsent('<GPP string>', '7');
EzoicAds.setSubjectToCOPPA(false);

// Label the current screen in reporting (see "Pageview labelling").
const tracked = await EzoicAds.trackPageview('Home');

// Render a banner. A hard-coded height is optional: on no-fill the view
// collapses to height 0 (default), and `onSizeChange` reports the creative
// size (or `{ width: 0, height: 0 }` when collapsed).
<EzoicBannerView
  adUnitIdentifier="123456"
  size="300x250"
  style={{ width: 300 }}
  collapseOnNoFill
  onSizeChange={({ width, height }) => console.log('size', width, height)}
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
`collapseOnNoFill` (default `true`) collapses the view to height 0 when a load
fails and nothing is displayed. `onSizeChange` receives `{ width, height }` in
dp/pt after a fill, or `{ width: 0, height: 0 }` on collapse.

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
component loads the ad, unmounting destroys it. Same `collapseOnNoFill`
(default `true`) and `onSizeChange` props as the banner.

```tsx
import { EzoicAds, EzoicOutstreamAdView } from '@ezoic/react-native-sdk';

<EzoicOutstreamAdView
  adUnitIdentifier="123456"
  style={{ width: '100%', height: 250 }}
  collapseOnNoFill
  onSizeChange={({ width, height }) => console.log('size', width, height)}
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

## Configuration

`EzoicAds.initialize(config)` accepts:

| Field | Default | |
|---|---|---|
| `domain` | (required) | Your Ezoic domain. |
| `autoReadConsent` | `true` | Read `IABTCF_*` / `IABGPP_*` consent keys written by a CMP. |
| `subjectToCOPPA` | `false` | Treat the user as subject to COPPA. |
| `requestATTBeforeAds` | `true` | iOS only: request App Tracking Transparency before the first ad. |
| `debugEnabled` | `false` | Verbose native logging. |
| `testMode` | `false` | Ezoic $0.00 test ads on debug builds / simulators. Disable before release. |
| `autoTrackPageviews` | `true` | Record a pageview automatically on native screen changes. See [Pageview labelling](#pageview-labelling). |
| `cmpEnabled` | `true` | Enable the built-in TCF CMP. Set `false` if you run your own CMP. |
| `autoPresentConsent` | `true` | Present the consent dialog (if required) right after `initialize` resolves. |

## Privacy & consent

### Built-in CMP (GDPR / TCF 2.4)

The native SDK includes an IAB TCF 2.4 consent management platform (CMP ID
299). It is on by default (`cmpEnabled: true`) and only does anything for users
in GDPR regions; elsewhere nothing is shown and ads load as before.

> **If your app already runs another CMP (UMP, OneTrust, …) you _must_ set
> `cmpEnabled: false`.** See [Using your own CMP](#using-your-own-cmp).

**The dialog is presented for you.** Once `initialize` resolves, the wrapper
calls `presentConsentIfRequired()` once on your behalf (`autoPresentConsent:
true`). Outside GDPR regions, with `cmpEnabled: false`, when another CMP is
present, or when you called `setGDPRConsent` before `initialize`, the native SDK
returns `notRequired` and nothing is shown.

In GDPR regions, ad loads wait while the consent dialog is loading or on screen
(at most 5 minutes in total per dialog), and up to 10 seconds while no dialog is
in progress, the dialog is covered, or the app is in the background, then fail
with error code `5001` ([`EzoicErrorCode.consentRequired`](#error-code-5001)).
If the dialog can't be shown at all (e.g. network error), ads proceed without a
TC string (limited ads).

To control the timing or read the outcome, turn auto-presentation off and call
`presentConsentIfRequired()` yourself, e.g. from your first screen:

```tsx
import { EzoicAds } from '@ezoic/react-native-sdk';

await EzoicAds.initialize({ domain: 'example.com', autoPresentConsent: false });

const outcome = await EzoicAds.presentConsentIfRequired();
switch (outcome.type) {
  case 'decided':
    console.log('User chose', outcome.decision); // 'acceptAll' | 'rejectAll' | 'custom'
    break;
  case 'failed':
    console.log('Consent UI failed', outcome.code, outcome.message);
    break;
  default:
    break; // 'notRequired' | 'alreadyDecided' | 'dismissed' | 'alreadyPresenting'
}
```

`presentConsentIfRequired()` can be called at any time, and repeat calls are
harmless: you get `alreadyPresenting` while a dialog is in flight and
`alreadyDecided` once a valid decision is stored. Re-present whenever
`isConsentRequired()` is `true` and no decision has been made (e.g. after
`dismissed` or `failed`). Called before initialization finishes, it waits for
the init response. On Android, if `initialize` resolves before any Activity is
in the foreground (a very early cold start), the automatic presentation is
skipped; call `presentConsentIfRequired()` from your first screen.

The promise always resolves (never rejects) with an `EzoicConsentOutcome`:

| `type` | When |
|---|---|
| `notRequired` | GDPR doesn't apply, the built-in CMP is disabled, another CMP owns consent, or consent is managed by the app (`setGDPRConsent`) |
| `alreadyDecided` | A still-valid decision is stored; no dialog shown |
| `decided` | The user chose `decision` (`acceptAll`, `rejectAll` or `custom`); the choice is saved |
| `dismissed` | The dialog closed without a choice; ads stay gated for this session |
| `alreadyPresenting` | A consent dialog is already on screen or being prepared |
| `failed` | The dialog couldn't be shown. `code`/`message` come from the native error; `code: -1` means there was no foreground Activity / view controller to present from |

- **`isConsentRequired()`** resolves `true` whenever GDPR applies and the
  built-in CMP is in charge (including after the user has decided), `false`
  otherwise, and `null` until the init request completes.
- **`resetConsent()`** deletes the stored decision so the dialog shows again
  (ads re-gate until the user decides).

### Privacy settings button (required)

TCF policy requires users to be able to reopen the dialog and change or
withdraw consent at any time. Wire `presentConsentSettings()` to a menu item or
button that is always reachable:

```tsx
<Button
  title="Privacy settings"
  onPress={() => EzoicAds.presentConsentSettings()}
/>
```

It reopens the dialog with the user's stored choices in GDPR regions and
resolves `notRequired` elsewhere, with `cmpEnabled: false`, or when another CMP
is present.

### Using your own CMP

Set `cmpEnabled: false`. The SDK then reads your CMP's `IABTCF_*` (TCF) and
`IABGPP_*` (GPP) keys exactly as before. The built-in CMP also stays out of the
way automatically if it finds `IABTCF_CmpSdkID` set to another CMP's ID.

```tsx
await EzoicAds.initialize({ domain: 'example.com', cmpEnabled: false });
```

### Manual consent

`setGDPRConsent` and the built-in CMP are mutually exclusive. The override
lasts for the current process only, so **call `setGDPRConsent` before
`initialize` on every launch** (or set `cmpEnabled: false`). Otherwise each cold
start begins with the built-in CMP in charge until your call lands: it can gate
ad loads, show its dialog and write `IABTCF_*` keys. The SDK doesn't write your
consent string to `IABTCF_*` keys for other SDKs, so your own CMP must do that.

```tsx
EzoicAds.setGDPRConsent(true, '<IAB TCF consent string>');
await EzoicAds.initialize({ domain: 'example.com', cmpEnabled: false });
```

### Error code 5001

When GDPR applies and the user hasn't decided, ad loads fail after the wait
described above with code `5001`, exported as `EzoicErrorCode.consentRequired`.
Consent is checked when an ad loads, so the code arrives as:

- `code` on the ad views' `onError` (banner, native, outstream);
- `error.userInfo.code` on rejected rewarded, interstitial and instream
  `load()` promises. The rejection's own `code` stays the string `'EzoicAds'`
  and its `message` is the native one ("User consent is required to load
  ads.").

```tsx
import {
  EzoicAds,
  EzoicBannerView,
  EzoicErrorCode,
  EzoicRewardedAd,
} from '@ezoic/react-native-sdk';

<EzoicBannerView
  adUnitIdentifier="123456"
  onError={(e) => {
    if (e.code === EzoicErrorCode.consentRequired) {
      // The user hasn't decided yet; e.g. offer EzoicAds.presentConsentIfRequired().
    }
  }}
/>;

try {
  const ad = await EzoicRewardedAd.load('123456');
  await ad.show();
} catch (e: any) {
  if (e?.userInfo?.code === EzoicErrorCode.consentRequired) {
    await EzoicAds.presentConsentIfRequired();
  }
}
```

## Pageview labelling

Ezoic reports app traffic per *screen*, the way it reports a site per URL. Apps
have no URLs, so the SDK builds one from a label:
`https://<your domain>/<bundle id>/<screen label>`.

The native SDK tracks pageviews automatically, but it only sees native screens:
in a React Native app that is the single host Activity / view controller, so
every JS screen lands in one bucket. Call `trackPageview(screen)` when the user
reaches a screen to give it a name. With React Navigation, do it from the
container's `onStateChange`:

```tsx
import { useRef } from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { EzoicAds } from '@ezoic/react-native-sdk';

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const lastRouteName = useRef<string | undefined>(undefined);
  const trackCurrentRoute = () => {
    const name = navigationRef.getCurrentRoute()?.name;
    if (name && name !== lastRouteName.current) {
      lastRouteName.current = name;
      EzoicAds.trackPageview(name);
    }
  };
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={trackCurrentRoute}
      onStateChange={trackCurrentRoute}
    >
      {/* ... */}
    </NavigationContainer>
  );
}
```

Labels are free text: use `/` for hierarchy (`members/profile`), spaces become
`-`, punctuation is dropped, case is kept. The label is also attached to every
ad request on that screen until the next pageview. A labelled pageview takes
precedence over the automatic one for the same navigation, so there is no
double counting. If you label every screen, set `autoTrackPageviews: false` so
pageviews come only from your calls. `trackPageview()` without a label records
an unlabelled pageview.

## API

- `EzoicAds.initialize(config)` → `Promise<void>` (see [Configuration](#configuration))
- `EzoicAds.setGDPRConsent(applies, consentString?)` → `void` (call before `initialize`)
- `EzoicAds.setGPPConsent(gppString?, sectionIds?)` → `void`
- `EzoicAds.setSubjectToCOPPA(value)` → `void`
- `EzoicAds.trackPageview(screen?)` → `Promise<boolean>`
- `EzoicAds.presentConsentIfRequired()` → `Promise<EzoicConsentOutcome>`
- `EzoicAds.presentConsentSettings()` → `Promise<EzoicConsentOutcome>`
- `EzoicAds.isConsentRequired()` → `Promise<boolean | null>`
- `EzoicAds.resetConsent()` → `void`
- `EzoicErrorCode.consentRequired` = `5001`
- `<EzoicBannerView adUnitIdentifier size collapseOnNoFill onSizeChange onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicNativeAdView adUnitIdentifier onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicOutstreamAdView adUnitIdentifier collapseOnNoFill onSizeChange onLoad onError onImpression onClick onOpen onClose />`
- `new EzoicInstreamAd(adUnitIdentifier)`
  - `.load({ contentUrl? })` → `Promise<string>` (GAM VAST ad-tag URL)
  - `.getNextAdTagUrl()` → `Promise<string | null>`
  - `.reportImpression({ revenueUsd? })` → `Promise<void>`
  - `.destroy()` → `Promise<void>`

## License

SEE LICENSE IN LICENSE — Copyright (c) 2026 Ezoic Inc. All rights reserved.
