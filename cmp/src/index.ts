import NativeEzoicCmp from './NativeEzoicCmp';
import {
  consentFailure,
  parseConsentOutcome,
  type EzoicConsentOutcome,
} from './EzoicConsent';
import { normalizeCmpOptions, type EzoicCmpOptions } from './options';

export type { EzoicCmpOptions };
export type { EzoicConsentDecision, EzoicConsentOutcome } from './EzoicConsent';

function presentConsent(
  call: () => Promise<unknown>
): Promise<EzoicConsentOutcome> {
  return call().then(parseConsentOutcome, (e: unknown) =>
    consentFailure(-1, e instanceof Error ? e.message : String(e))
  );
}

/**
 * Ezoic's built-in consent management (the IAB TCF dialog in GDPR regions, the
 * notice and "Do Not Sell" choice in covered US states) for apps of Ezoic
 * publishers that don't use `@ezoic/react-native-sdk`. That package already
 * includes this CMP with the same methods on `EzoicAds`: use one, not both.
 * If both are initialized, `EzoicAds` takes over.
 */
export const EzoicCmp = {
  /**
   * Starts the CMP for your Ezoic domain. Returns at once; the publisher
   * settings load in the background, and `presentConsentIfRequired()` waits
   * for them. Later calls are ignored. A domain that isn't an Ezoic
   * publisher's leaves the CMP off: presents resolve `failed` with code 1001
   * and nothing is written.
   */
  initialize(domain: string, options?: EzoicCmpOptions): void {
    if (!domain) {
      throw new Error('EzoicCmp.initialize requires a non-empty `domain`.');
    }
    NativeEzoicCmp.initialize(domain, normalizeCmpOptions(options));
  },
  /**
   * Shows the consent dialog if this user must decide (GDPR applies, no valid
   * stored decision). Call it from your first screen after `initialize`;
   * repeat calls are harmless. Resolves `notRequired` in US states, where the
   * CMP shows its notice by itself. Always resolves.
   */
  presentConsentIfRequired(): Promise<EzoicConsentOutcome> {
    return presentConsent(() => NativeEzoicCmp.presentConsentIfRequired());
  },
  /**
   * The "Privacy settings" entry point. In a GDPR region it re-opens the
   * consent dialog with the user's stored choices; in a covered US state it
   * opens the US privacy settings (`decided` with `acceptAll` = not opted out,
   * `rejectAll` = opted out; `dismissed` = closed without saving). Resolves
   * `notRequired` elsewhere. Always resolves.
   */
  presentConsentSettings(): Promise<EzoicConsentOutcome> {
    return presentConsent(() => NativeEzoicCmp.presentConsentSettings());
  },
  /**
   * `true` when GDPR applies and the CMP handles consent (also after the user
   * decided), `false` otherwise, `null` until the settings have loaded or
   * when none could be (refused domain, offline with no cache).
   */
  isConsentRequired(): Promise<boolean | null> {
    return NativeEzoicCmp.isConsentRequired().then((v) => v ?? null);
  },
  /**
   * `true` in a GDPR region or a covered US state while the CMP handles
   * consent: show a "Privacy choices" entry point that calls
   * `presentConsentSettings()`. `false` otherwise, `null` while unknown.
   */
  isPrivacyOptionsRequired(): Promise<boolean | null> {
    return NativeEzoicCmp.isPrivacyOptionsRequired().then((v) => v ?? null);
  },
  /**
   * Deletes the stored decision so the dialog shows again. The US-state
   * choice is forgotten too; the US notice shows at next launch.
   */
  resetConsent(): void {
    NativeEzoicCmp.resetConsent();
  },
};
