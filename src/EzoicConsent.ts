/** Which button the user closed the consent dialog with. */
export type EzoicConsentDecision = 'acceptAll' | 'rejectAll' | 'custom';

/**
 * Result of `EzoicAds.presentConsentIfRequired` / `presentConsentSettings`.
 *
 * - `notRequired`: GDPR doesn't apply, the built-in CMP is disabled, another
 *   CMP owns consent, or consent is managed by the app (`setGDPRConsent`, or
 *   `autoReadConsent: false`).
 * - `alreadyDecided`: a still-valid decision is stored; no dialog was shown.
 * - `decided`: the user made a choice, which has been saved.
 * - `dismissed`: the dialog closed without a choice; ads stay gated for this
 *   session.
 * - `alreadyPresenting`: a consent dialog is already on screen or being
 *   prepared.
 * - `failed`: the dialog could not be shown. `code` is the native
 *   `EzoicError` code, or `-1` (`'No foreground Activity'`) when the wrapper
 *   had no foreground Activity / view controller: native was not called, ads
 *   stay gated, and you should call again once a screen is showing.
 */
export type EzoicConsentOutcome =
  | { type: 'notRequired' }
  | { type: 'alreadyDecided' }
  | { type: 'dismissed' }
  | { type: 'alreadyPresenting' }
  | { type: 'decided'; decision: EzoicConsentDecision }
  | { type: 'failed'; code: number; message: string };

const SIMPLE_TYPES = [
  'notRequired',
  'alreadyDecided',
  'dismissed',
  'alreadyPresenting',
] as const;

const DECISIONS: readonly string[] = ['acceptAll', 'rejectAll', 'custom'];

export function consentFailure(
  code: number,
  message: string
): EzoicConsentOutcome {
  return { type: 'failed', code, message };
}

/**
 * Maps the native glue's outcome map to `EzoicConsentOutcome`. Anything that
 * doesn't match the wire format becomes `failed(-1, 'Unrecognized outcome')`.
 */
export function parseConsentOutcome(raw: unknown): EzoicConsentOutcome {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const { type, decision, code, message } = raw as Record<string, unknown>;
    const simple = SIMPLE_TYPES.find((t) => t === type);
    if (simple) return { type: simple };
    if (
      type === 'decided' &&
      typeof decision === 'string' &&
      DECISIONS.includes(decision)
    ) {
      return { type: 'decided', decision: decision as EzoicConsentDecision };
    }
    if (type === 'failed') {
      return consentFailure(
        typeof code === 'number' ? code : -1,
        typeof message === 'string' ? message : ''
      );
    }
  }
  return consentFailure(-1, 'Unrecognized outcome');
}
