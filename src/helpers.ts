import type { EzoicConfig } from './NativeEzoicAds';

export function normalizeConfig(config: EzoicConfig): EzoicConfig {
  if (!config || !config.domain) {
    throw new Error('EzoicAds.initialize requires a non-empty `domain`.');
  }
  const out: EzoicConfig = { domain: config.domain };
  if (config.autoReadConsent !== undefined)
    out.autoReadConsent = config.autoReadConsent;
  if (config.subjectToCOPPA !== undefined)
    out.subjectToCOPPA = config.subjectToCOPPA;
  if (config.requestATTBeforeAds !== undefined)
    out.requestATTBeforeAds = config.requestATTBeforeAds;
  if (config.debugEnabled !== undefined) out.debugEnabled = config.debugEnabled;
  if (config.testMode !== undefined) out.testMode = config.testMode;
  if (config.autoTrackPageviews !== undefined)
    out.autoTrackPageviews = config.autoTrackPageviews;
  if (config.cmpEnabled !== undefined) out.cmpEnabled = config.cmpEnabled;
  if (config.autoPresentConsent !== undefined)
    out.autoPresentConsent = config.autoPresentConsent;
  return out;
}

export function normalizeSize(size: string | undefined): string {
  if (!size) return '';
  return size
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(',');
}

/** Native-prop value meaning "no app override; follow the Ezoic server". */
export const REFRESH_UNSET = -1;

/**
 * Maps an optional refresh override to the native prop: a whole number of 0 or
 * more passes through (fractions are truncated), anything else (absent, null,
 * negative, NaN, Infinity) becomes {@link REFRESH_UNSET}.
 */
export function normalizeRefreshOverride(
  value: number | null | undefined
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return REFRESH_UNSET;
  }
  return Math.min(Math.trunc(value), 2147483647);
}

export function coerceAdUnitId(adUnitIdentifier: string | number): string {
  return String(adUnitIdentifier);
}

export interface RewardResultLike {
  earned: boolean;
  type: string;
  amount: number;
}

/**
 * Maps the native `showRewardedAd` result to the public reward shape: the
 * `{ type, amount }` reward when earned, otherwise `null` (dismissed unearned).
 */
export function mapRewardResult(
  result: RewardResultLike | null | undefined
): { type: string; amount: number } | null {
  if (result && result.earned) {
    return { type: result.type, amount: result.amount };
  }
  return null;
}
