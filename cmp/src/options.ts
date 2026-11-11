import type { EzoicCmpConfig } from './NativeEzoicCmp';

/** Options for `EzoicCmp.initialize`. */
export interface EzoicCmpOptions {
  /** Run the built-in CMP. Default `true`; set `false` if you run your own CMP. */
  cmpEnabled?: boolean;
  /**
   * Default `true`. `false` means the app manages consent itself: the CMP
   * never presents, gates or writes `IABTCF_*` / `IABGPP_*` keys.
   */
  autoReadConsent?: boolean;
  /** Also log debug and info lines natively. Default `false`. */
  debugEnabled?: boolean;
  /**
   * Present the consent dialog (if required) right after `initialize`.
   * Default `true`. Not sent to native: the wrapper does the presenting.
   */
  autoPresentConsent?: boolean;
}

/** Forwards only the options that are set, so native defaults apply to the rest. */
export function normalizeCmpOptions(options?: EzoicCmpOptions): EzoicCmpConfig {
  const out: EzoicCmpConfig = {};
  if (options?.cmpEnabled !== undefined) out.cmpEnabled = options.cmpEnabled;
  if (options?.autoReadConsent !== undefined)
    out.autoReadConsent = options.autoReadConsent;
  if (options?.debugEnabled !== undefined)
    out.debugEnabled = options.debugEnabled;
  return out;
}
