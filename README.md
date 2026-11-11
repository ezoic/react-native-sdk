# @ezoic/react-native-sdk

Ezoic Ads SDK for React Native (Prebid + Google Ad Manager banner, native, interstitial, rewarded, outstream and instream video ads).

A thin React Native (New Architecture) wrapper over the native Ezoic Ads SDKs
for iOS (`EzoicAdsSDK` and its built-in CMP `EzoicCmpSDK`, bundled in this
package) and Android (`com.ezoic.sdk:ezoic-ads-sdk`, via Maven Central). It exposes an imperative
`EzoicAds` TurboModule plus `EzoicBannerView`, `EzoicNativeAdView` and
`EzoicOutstreamAdView` Fabric components, and the `EzoicInstreamAd` controller.

## Requirements

- React Native 0.76+ with the New Architecture enabled.
- iOS 15.0+ and Xcode 26.2+ (required by the native `EzoicAdsSDK` 1.18), Android `minSdk` 24+ and Kotlin 2.2+ (see [Android](#android)).

## Installation

```sh
npm install @ezoic/react-native-sdk
```

### iOS

The native `EzoicAdsSDK` binary framework and the consent framework it links,
`EzoicCmpSDK`, are bundled inside this npm package (`@ezoic/react-native-sdk`
1.22.0 bundles both at 1.22.0), so CocoaPods does not download an `EzoicAdsSDK`
pod and the CocoaPods trunk going read-only
does not affect React Native apps. `pod install` still pulls its dependencies
`PrebidMobile`, `Google-Mobile-Ads-SDK` and `AmazonPublisherServicesSDK` from
CocoaPods as before; no `Podfile` changes are needed when upgrading. If
`pod install` reports that it could not find compatible versions for
`AmazonPublisherServicesSDK` (your `Podfile.lock` still pins the previous
version), run `pod update AmazonPublisherServicesSDK` once.

The framework depends on `PrebidMobile` (a Swift source pod). Consuming a
binary Swift framework with Swift dependencies requires framework-based
linkage, so your app's `Podfile` must enable static frameworks:

```ruby
use_frameworks! :linkage => :static
```

Then install pods:

```sh
cd ios && RCT_NEW_ARCH_ENABLED=1 pod install
```

If your app also depends on [`@ezoic/react-native-cmp-sdk`](cmp/README.md)
(not needed: this package already includes the CMP), **keep both packages at
the same version.** This package's pod then takes `EzoicCmpSDK` from that package's pod
instead of its own copy, so the app links one.

Add your Google Ad Manager application ID, `NSUserTrackingUsageDescription`
and the SKAdNetwork IDs to `ios/<YourApp>/Info.plist`; see
[iOS Setup](https://docs.ezoic.com/docs/mobileapps/react-native/#ios-setup).
`SKAdNetworkItems` needs every ID in Ezoic's combined list,
[docs.ezoic.com/skadnetworkids.xml](https://docs.ezoic.com/skadnetworkids.xml),
not just Google's: Apple reads these only from the app's `Info.plist`, and
buyers whose ID is missing (Amazon, InMobi, Magnite, PubMatic and other
non-Google buyers) can't use SKAdNetwork attribution. With `debugEnabled: true`,
`initialize` logs a warning when `Info.plist` has no `SKAdNetworkItems`, is
missing Google's `cstr6suwn9.skadnetwork` or InMobi's `wzmmz9fp6w.skadnetwork`,
or lists an identifier with uppercase letters (Apple ignores those).

### Android

The package depends on `com.ezoic.sdk:ezoic-ads-sdk` 1.22.0 from Maven Central,
which brings in the Ezoic CMP (`com.ezoic.sdk:ezoic-cmp-sdk`), Google Mobile Ads (`play-services-ads`) 25.5.0 and Google's
InMobi mediation adapter (InMobi bids in Google Ad Manager auctions; nothing to
configure). The wrapper's Kotlin compiles against Google Mobile Ads 25.5.0, so
the app's Kotlin Gradle plugin must be 2.2 or newer. React Native 0.87+
templates already use Kotlin 2.2. On React Native 0.86 and earlier (Kotlin
2.1.20) the build fails with "Module was compiled with an incompatible version
of Kotlin. The binary version of its metadata is 2.3.0, expected version is
2.1.0"; pin the Kotlin Gradle plugin in `android/build.gradle` (setting
`kotlinVersion` alone is not enough, because React Native's Gradle plugin
supplies Kotlin 2.1.20 otherwise):

```groovy
buildscript {
    ext {
        kotlinVersion = "2.2.21"
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.21")
    }
}
```

## Usage

```tsx
import { EzoicAds, EzoicBannerView } from '@ezoic/react-native-sdk';

// Initialize once, early in app startup. In GDPR regions the built-in consent
// dialog is presented automatically once this resolves (see "Privacy & consent").
await EzoicAds.initialize({ domain: 'example.com' });

// Optional privacy signals. The GPP section depends on the user's US state
// ('8' is California); see "Manual consent".
EzoicAds.setGPPConsent('DBABBg~BVoAAACA.QA', '8');
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

The banner loads once the component mounts with all its props applied. Changing
`adUnitIdentifier` or `size` after that destroys the current banner and loads a
new one for the new values; `collapseOnNoFill` applies to the next load outcome
without a reload. Keep the `size` string stable across renders (the component
normalizes whitespace) so re-renders don't trigger reloads.

Banners refresh automatically every 30 seconds, or at the interval Ezoic sets
for the ad unit; you do not set a refresh timer in the app
(`refreshIntervalSeconds` and `refreshMaxCount` are deprecated and ignored). The
countdown only runs while at least half of the banner is on screen and the app
is in the foreground.

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

#### Styling native ads

Pass `adStyle` to restyle the template to match your app. Every key is
optional; leave one out to keep the default (colors left out follow the system
light/dark theme). Colors accept any React Native color string (`'#1E1E2E'`,
`'white'`, `'rgba(0,0,0,0.5)'`); `PlatformColor` values are ignored. Sizes are in
dp/pt. Changing `adStyle` re-renders the ad in place without reloading it.

```tsx
<EzoicNativeAdView
  adUnitIdentifier="123456"
  style={{ width: '100%', height: 360 }}
  adStyle={{
    backgroundColor: '#1E1E2E',
    cornerRadius: 16,
    headlineTextColor: '#FFFFFF',
    bodyTextColor: '#CDD6F4',
    callToActionBackgroundColor: '#89B4FA',
    callToActionTextColor: '#1E1E2E',
    callToActionCornerRadius: 22,
    adLabelText: 'Sponsored',
  }}
/>
```

| Key | Default | Notes |
| --- | --- | --- |
| `backgroundColor` | transparent | Card background |
| `cornerRadius` | `0` | Card corners; content is clipped to them |
| `padding` | `8` | Inner padding |
| `headlineTextColor` / `headlineTextSize` | theme / `16` | Headline is bold |
| `advertiserTextColor` / `advertiserTextSize` | theme / `12` | |
| `bodyTextColor` / `bodyTextSize` | theme / `14` | |
| `callToActionBackgroundColor` / `callToActionTextColor` | platform button | |
| `callToActionTextSize` / `callToActionCornerRadius` | `14` / `4` | Radius applies when a background color is set |
| `mediaHeight` | `175` | Minimum `120`, as Google requires for native media |
| `adLabelText` | `"Ad"` | The ad attribution badge; cannot be blank |
| `adLabelTextColor` / `adLabelBackgroundColor` | `#202124` / `#FBBC04` | |

Give the view enough height for the template; with the defaults about 330
plus any extra padding or larger text.

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
| `cmpEnabled` | `true` | Enable the built-in CMP (the TCF dialog in GDPR regions, the notice and "Do Not Sell" choice in covered US states). Set `false` if you run your own CMP. |
| `autoPresentConsent` | `true` | Present the consent dialog (if required) right after `initialize` resolves. |
| `appPaid` | unset | Whether your app is a paid app, sent to bidders as OpenRTB `app.paid`. Unset sends nothing. |

### App content

`EzoicAds.setAppContent({ language, genre })` describes your app's content to
bidders (OpenRTB `app.content`) on every later auction, replacing any previous
value. `language` is an ISO-639-1 two-letter code (`'en'`, `'de'`); other values
are dropped with a native warning. `genre` is free text. Call it with no
argument to clear it. It can be called before `initialize`.

```tsx
EzoicAds.setAppContent({ language: 'en', genre: 'News' });
```

## Privacy & consent

### Built-in CMP (GDPR / TCF 2.4 and US states)

The native SDK includes an IAB TCF 2.4 consent management platform (CMP ID
299). It is on by default (`cmpEnabled: true`) and only does anything for users
in GDPR regions and, from 1.22.0, in the US states with consumer privacy laws;
elsewhere nothing is shown and ads load as before.

**US states (1.22.0).** For users in a covered US state the SDK shows a
non-blocking notice card by itself, once per launch until the user chooses,
with a "Do Not Sell My Information" choice. It writes the IAB GPP keys
(`IABGPP_*`) other SDKs read. US privacy is opt-out, so ads never wait on it,
and `presentConsentIfRequired()` resolves `notRequired` there. There is nothing
to call; the [privacy settings button](#privacy-settings-button-required)
reopens the US settings.

**Not using Ezoic ads?** Ezoic publishers can use the same CMP on its own
through [`@ezoic/react-native-cmp-sdk`](cmp/README.md). Use one package, not
both: this one already includes it.

> **If your app already runs another CMP (UMP, OneTrust, …) you _must_ set
> `cmpEnabled: false`.** See [Using your own CMP](#using-your-own-cmp).
>
> **Upgrading from 1.11.x:** `cmpEnabled` and `autoPresentConsent` default to
> `true`, so GDPR-region users now see the built-in dialog after `initialize`
> and ad loads wait for their decision. If you pass consent yourself, move
> `setGDPRConsent` **before** `initialize` (earlier versions of this README
> showed it after) and set `cmpEnabled: false`; see
> [Manual consent](#manual-consent).

**The dialog is presented for you.** Once `initialize` resolves, the wrapper
calls `presentConsentIfRequired()` once on your behalf (`autoPresentConsent:
true`). Outside GDPR regions, with `cmpEnabled: false`, when another CMP is
present, when you called `setGDPRConsent` before `initialize`, or with
`autoReadConsent: false`, the native SDK returns `notRequired` and nothing is
shown.

In GDPR regions, ad loads wait while the consent dialog is loading or on screen
(at most 5 minutes in total per dialog), and up to 10 seconds while no dialog is
in progress, the dialog is covered, or the app is in the background, then fail
with error code `5001` ([`EzoicErrorCode.consentRequired`](#error-code-5001)).
If native can't show the dialog at all (e.g. network error), it returns
`failed` with the native error code and ads proceed without a TC string
(limited ads). A `failed` outcome with `code: -1` is different: the wrapper had
no foreground screen to present from, native was never called, and ads stay
gated (they wait up to 10 seconds, then fail with `5001`).

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
the init response. If `initialize` resolves before any screen is showing (no
foreground Activity on Android, no presented view controller on iOS, e.g. a very
early cold start), the automatic presentation is skipped; call
`presentConsentIfRequired()` from your first screen.

The promise always resolves (never rejects) with an `EzoicConsentOutcome`:

| `type` | When |
|---|---|
| `notRequired` | GDPR doesn't apply, the built-in CMP is disabled, another CMP owns consent, or consent is managed by the app (`setGDPRConsent`, or `autoReadConsent: false`) |
| `alreadyDecided` | A still-valid decision is stored; no dialog shown |
| `decided` | The user chose `decision` (`acceptAll`, `rejectAll` or `custom`); the choice is saved |
| `dismissed` | The dialog closed without a choice; ads stay gated for this session |
| `alreadyPresenting` | A consent dialog is already on screen or being prepared |
| `failed` | The dialog couldn't be shown. `code`/`message` come from the native error (`1001` not initialized, `2001` network, `4001` render, `5002` invalid consent). `code: -1` with `message: 'No foreground Activity'` (on both platforms) is wrapper-side: there was no foreground Activity / view controller, native was not called and ads stay gated, so call `presentConsentIfRequired()` again once a screen is showing. Any other `code: -1` means the native error carried no code |

- **`isConsentRequired()`** resolves `true` whenever GDPR applies and the
  built-in CMP is in charge (including after the user has decided), `false`
  otherwise, and `null` until the init request completes or when the server
  sent no consent information.
- **`isPrivacyOptionsRequired()`** (1.22.0) resolves `true` in a GDPR region
  or a covered US state while the built-in CMP handles consent, `false`
  otherwise, and `null` until the init request and the US-state settings have
  loaded. Hide the privacy settings entry point only when it is `false`:
  `null` means not known yet.
- **`resetConsent()`** deletes the stored decision so the dialog shows again
  (ads re-gate until the user decides). The US choice is forgotten too, and
  the US notice shows again at the next launch.

### Privacy settings button (required)

TCF policy requires users to be able to reopen the dialog and change or
withdraw consent at any time, and US users must be able to change their "Do Not
Sell" choice. Wire `presentConsentSettings()` to a menu item or button that is
reachable unless `isPrivacyOptionsRequired()` is `false` (`null` means not
known yet, so keep the button):

```tsx
const [showPrivacy, setShowPrivacy] = useState(true);
useEffect(() => {
  EzoicAds.isPrivacyOptionsRequired().then((v) => setShowPrivacy(v !== false));
}, []);

{showPrivacy && (
  <Button
    title="Privacy settings"
    onPress={() => EzoicAds.presentConsentSettings()}
  />
)}
```

`presentConsentSettings()` is region-aware (1.22.0):

- In a GDPR region it reopens the TCF dialog with the user's stored choices.
- In a covered US state it opens the US privacy settings and resolves
  `decided` with `acceptAll` (not opted out) or `rejectAll` (opted out), or
  `dismissed` when closed without saving.
- Elsewhere, with `cmpEnabled: false`, or when another CMP is present it
  resolves `notRequired`.

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
ad loads, show its dialog and write `IABTCF_*` keys.

`setGDPRConsent` writes `IABTCF_gdprApplies` and `IABTCF_TCString` for other
SDKs to read, and `setGPPConsent` writes `IABGPP_HDR_GppString` and
`IABGPP_GppSID`. The other `IABTCF_*` / `IABGPP_*` keys (purpose and vendor
consents, per-section keys) are still your CMP's job.

```tsx
EzoicAds.setGDPRConsent(true, '<IAB TCF consent string>');
await EzoicAds.initialize({ domain: 'example.com', cmpEnabled: false });
```

For a US user, pass the GPP string and its section ID. The section depends on
the user's state (`'8'` California, `'9'` Virginia, `'10'` Colorado, …);
`setGPPConsent` with a GPP string from your own CMP also keeps the built-in CMP
from writing GPP keys:

```tsx
EzoicAds.setGPPConsent('DBABBg~BVoAAACA.QA', '8');
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

- `EzoicAds.initialize(config)` → `Promise<void>` (see [Configuration](#configuration)). Safe to call again, including after a JS reload (Metro, CodePush, Expo) while the native SDK is still initialized: repeat calls share the first call's result, and a failed call is retried by the next one.
- `EzoicAds.setGDPRConsent(applies, consentString?)` → `void` (call before `initialize`)
- `EzoicAds.setGPPConsent(gppString?, sectionIds?)` → `void`
- `EzoicAds.setSubjectToCOPPA(value)` → `void`
- `EzoicAds.trackPageview(screen?)` → `Promise<boolean>`
- `EzoicAds.presentConsentIfRequired()` → `Promise<EzoicConsentOutcome>`
- `EzoicAds.presentConsentSettings()` → `Promise<EzoicConsentOutcome>`
- `EzoicAds.isConsentRequired()` → `Promise<boolean | null>`
- `EzoicAds.isPrivacyOptionsRequired()` → `Promise<boolean | null>` (1.22.0)
- `EzoicAds.resetConsent()` → `void`
- `EzoicAds.setAppContent({ language?, genre? }?)` → `void` (1.22.0)
- `EzoicErrorCode.consentRequired` = `5001`
- `<EzoicBannerView adUnitIdentifier size collapseOnNoFill onSizeChange onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicNativeAdView adUnitIdentifier onLoad onError onImpression onClick onOpen onClose />`
- `<EzoicOutstreamAdView adUnitIdentifier collapseOnNoFill onSizeChange onLoad onError onImpression onClick onOpen onClose />`
- `new EzoicInstreamAd(adUnitIdentifier)`
  - `.load({ contentUrl? })` → `Promise<string>` (GAM VAST ad-tag URL)
  - `.getNextAdTagUrl()` → `Promise<string | null>`
  - `.reportImpression({ revenueUsd? })` → `Promise<void>`
  - `.destroy()` → `Promise<void>`

## Changes in 1.22.0 (unreleased)

- Native SDK 1.22.0. iOS bundles two frameworks, `EzoicAdsSDK` and the CMP
  `EzoicCmpSDK`; no Podfile changes are needed.
- US-state privacy: the built-in CMP shows a notice and a "Do Not Sell" choice
  in covered US states and writes the IAB GPP keys. Ads never wait on it.
- `presentConsentSettings()` opens the US privacy settings in covered US states.
- New `isPrivacyOptionsRequired()`, `setAppContent({ language, genre })` and the
  `appPaid` configuration field.
- New package [`@ezoic/react-native-cmp-sdk`](cmp/README.md): the same CMP for
  Ezoic publishers whose app doesn't use Ezoic ads.
- No breaking changes for React Native apps. (Native apps reading
  `ConsentOutcome.Failed`'s error code need a cast from 1.22.0; this package
  does that and keeps `failed`'s `code` / `message`.)

## License

SEE LICENSE IN LICENSE — Copyright (c) 2026 Ezoic Inc. All rights reserved.
