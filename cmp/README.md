# @ezoic/react-native-cmp-sdk

Ezoic's consent management platform for React Native apps of **Ezoic
publishers** that don't use the Ezoic ads SDK:

- an IAB TCF 2.4 consent dialog (CMP ID 299) for users in GDPR regions;
- for users in the US states with consumer privacy laws, a non-blocking notice
  and a "Do Not Sell My Information" choice, written as IAB GPP keys
  (`IABGPP_*`) for other SDKs to read.

What applies to a user, and whether the CMP runs at all, comes from your Ezoic
settings for your domain. The CMP only works for domains of Ezoic publishers:
for any other domain it stays off and writes nothing.

> **Using `@ezoic/react-native-sdk` (Ezoic ads)? Don't install this package.**
> The ads SDK already includes this CMP, with the same methods on `EzoicAds`.
> Use one, not both. If both are installed and initialized, `EzoicAds` takes
> over and the stored decision carries over.

## Requirements

- React Native 0.76+ with the New Architecture enabled.
- iOS 15.0+ and Xcode 26.2+, Android `minSdk` 24+ and Kotlin 2.2+ (see
  [`@ezoic/react-native-sdk`](https://github.com/ezoic/react-native-sdk#android) for pinning the Kotlin
  Gradle plugin on React Native 0.86 and earlier).

## Installation

```sh
npm install @ezoic/react-native-cmp-sdk
cd ios && pod install
```

- **iOS:** the native `EzoicCmpSDK` framework (a static XCFramework with no
  dependencies) is bundled in this npm package. No `Podfile` changes are needed.
- **Android:** the package depends on `com.ezoic.sdk:ezoic-cmp-sdk` from Maven
  Central.

Both are version 1.22.0 for `@ezoic/react-native-cmp-sdk` 1.22.0.

If your app also installs `@ezoic/react-native-sdk` (not recommended, see
above), **keep both packages at the same version.** On iOS the ads pod then uses this
package's framework instead of its own copy, and on Android Gradle resolves one
`ezoic-cmp-sdk`.

## Usage

```tsx
import { EzoicCmp } from '@ezoic/react-native-cmp-sdk';

// Once, early in app startup. Returns at once; your Ezoic settings load in
// the background.
EzoicCmp.initialize('example.com');
```

After `initialize`, the CMP presents the consent dialog on its own when this
user must decide (`autoPresentConsent: true`, the default), once your settings
have loaded. To control the timing or read the outcome, turn that off and call
`presentConsentIfRequired()` yourself, e.g. from your first screen:

```tsx
EzoicCmp.initialize('example.com', { autoPresentConsent: false });

// Waits for the settings, then shows the TCF dialog if this user must decide.
const outcome = await EzoicCmp.presentConsentIfRequired();
```

If no screen is showing yet when `initialize` runs (a very early cold start),
the automatic presentation is skipped; call `presentConsentIfRequired()` from
your first screen.

In covered US states the CMP shows its notice by itself; there is nothing to
call. `presentConsentIfRequired()` resolves `notRequired` there.

### Privacy choices button

TCF requires a persistent way to reopen the dialog, and US users must be able to
change their "Do Not Sell" choice. Show an entry point unless
`isPrivacyOptionsRequired()` is `false` (`null` means not known yet, so keep it):

```tsx
const [showPrivacy, setShowPrivacy] = useState(true);
useEffect(() => {
  EzoicCmp.isPrivacyOptionsRequired().then((v) => setShowPrivacy(v !== false));
}, []);

{showPrivacy && (
  <Button
    title="Privacy choices"
    onPress={() => EzoicCmp.presentConsentSettings()}
  />
)}
```

`presentConsentSettings()` reopens the TCF dialog in GDPR regions and opens the
US privacy settings in covered US states.

### Outcomes

`presentConsentIfRequired()` and `presentConsentSettings()` always resolve
(never reject) with an `EzoicConsentOutcome`, the same type as
`@ezoic/react-native-sdk`:

| `type` | When |
|---|---|
| `notRequired` | GDPR doesn't apply (always, for `presentConsentIfRequired` in US states), the CMP is off, another CMP owns consent, or `autoReadConsent: false` |
| `alreadyDecided` | A still-valid decision is stored; nothing shown |
| `decided` | Saved. `decision` is `acceptAll`, `rejectAll` or `custom`. From the US settings: `acceptAll` = not opted out, `rejectAll` = opted out |
| `dismissed` | Closed without a choice (US settings: closed without saving) |
| `alreadyPresenting` | A consent screen is already up or being prepared |
| `failed` | Couldn't show. `code` `1001`: not initialized, or the domain isn't an Ezoic publisher's; `2001` network; `4001` render; `5002` invalid consent. `code: -1` with `message: 'No foreground Activity'`: there was no screen to present from; call again once one is showing |

## Options

`EzoicCmp.initialize(domain, options?)`:

| Option | Default | |
|---|---|---|
| `cmpEnabled` | `true` | Run the CMP. Set `false` if you run your own CMP. |
| `autoReadConsent` | `true` | `false` means the app manages consent itself: the CMP never presents or writes `IABTCF_*` / `IABGPP_*` keys. |
| `debugEnabled` | `false` | Debug and info lines in the native log (Android logcat tag `EzoicCmp`, iOS subsystem `com.ezoic.cmp.sdk`). |
| `autoPresentConsent` | `true` | Present the consent dialog (if required) right after `initialize`, as `@ezoic/react-native-sdk` does. |

## API

- `EzoicCmp.initialize(domain, options?)` → `void`. Throws without a domain. Later native calls are ignored; each call still presents if required unless `autoPresentConsent: false`.
- `EzoicCmp.presentConsentIfRequired()` → `Promise<EzoicConsentOutcome>`
- `EzoicCmp.presentConsentSettings()` → `Promise<EzoicConsentOutcome>`
- `EzoicCmp.isConsentRequired()` → `Promise<boolean | null>`: `true` when GDPR applies and the CMP handles consent (also after the user decided), `false` otherwise, `null` until your settings have loaded or when none could be (refused domain, offline with no cache).
- `EzoicCmp.isPrivacyOptionsRequired()` → `Promise<boolean | null>`: `true` in a GDPR region or a covered US state while the CMP handles consent, `false` otherwise, `null` while unknown. Hide your entry point only on `false`.
- `EzoicCmp.resetConsent()` → `void`: deletes the stored decision so the dialog shows again; the US choice is forgotten too and the US notice returns at next launch.

## License

See [LICENSE](LICENSE).
