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
