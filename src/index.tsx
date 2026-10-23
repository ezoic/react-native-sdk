import { useState } from 'react';
import { processColor } from 'react-native';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import NativeEzoicAds, { type EzoicConfig } from './NativeEzoicAds';
import EzoicBannerNative from './EzoicBannerViewNativeComponent';
import EzoicNativeAdNative from './EzoicNativeAdViewNativeComponent';
import EzoicOutstreamNative from './EzoicOutstreamAdViewNativeComponent';
import {
  coerceAdUnitId,
  normalizeConfig,
  normalizeRefreshOverride,
  normalizeSize,
} from './helpers';
import {
  consentFailure,
  parseConsentOutcome,
  type EzoicConsentOutcome,
} from './EzoicConsent';
import {
  serializeNativeAdStyle,
  type EzoicNativeAdStyle,
} from './EzoicNativeAdStyle';

export type { EzoicConfig };
export type { EzoicNativeAdStyle };
export type { EzoicConsentDecision, EzoicConsentOutcome } from './EzoicConsent';
export {
  EzoicRewardedAd,
  type EzoicReward,
  type EzoicRewardedAdListeners,
} from './EzoicRewardedAd';
export {
  EzoicInterstitialAd,
  type EzoicInterstitialAdListeners,
} from './EzoicInterstitialAd';
export {
  EzoicInstreamAd,
  type EzoicInstreamLoadOptions,
  type EzoicInstreamImpressionOptions,
} from './EzoicInstreamAd';

/**
 * Numeric native error codes: `code` on ad-view `onError` events, and
 * `error.userInfo.code` on rejected rewarded / interstitial / instream
 * `load()` promises (whose own `code` is the string `'EzoicAds'`).
 */
export const EzoicErrorCode = {
  /**
   * GDPR applies and the user hasn't decided: the ad load waited for the
   * consent dialog and timed out. Call `EzoicAds.presentConsentIfRequired()`.
   */
  consentRequired: 5001,
} as const;

function presentConsent(
  call: () => Promise<unknown>
): Promise<EzoicConsentOutcome> {
  return call().then(parseConsentOutcome, (e: unknown) =>
    consentFailure(-1, e instanceof Error ? e.message : String(e))
  );
}

/** Native `EzoicError.alreadyInitialized`, delivered in `error.userInfo.code`. */
const ALREADY_INITIALIZED = 1002;

let initialization: Promise<void> | null = null;

async function initializeNative(config: EzoicConfig): Promise<void> {
  try {
    await NativeEzoicAds.initialize(config);
  } catch (e) {
    const code = (e as { userInfo?: { code?: unknown } } | null)?.userInfo
      ?.code;
    if (code !== ALREADY_INITIALIZED) throw e;
    // The native SDK outlives JS reloads (Metro, CodePush, Expo), so it is
    // already up; only the consent prompt the native success path runs is owed.
    if (config.autoPresentConsent !== false) {
      NativeEzoicAds.presentConsentIfRequired().catch(() => {});
    }
  }
}

export const EzoicAds = {
  /**
   * Initializes the native SDK. Safe to call more than once: concurrent and
   * later calls share the first call's result (the first `config` wins), a JS
   * reload resolves even though the native SDK is already initialized, and a
   * failed call is retried by the next one.
   */
  initialize(config: EzoicConfig): Promise<void> {
    const normalized = normalizeConfig(config);
    if (initialization) return initialization;
    const pending = initializeNative(normalized);
    initialization = pending;
    pending.catch(() => {
      if (initialization === pending) initialization = null;
    });
    return pending;
  },
  setGDPRConsent(applies: boolean, consentString?: string): void {
    NativeEzoicAds.setGDPRConsent(applies, consentString);
  },
  setGPPConsent(gppString?: string, sectionIds?: string): void {
    NativeEzoicAds.setGPPConsent(gppString, sectionIds);
  },
  setSubjectToCOPPA(value: boolean): void {
    NativeEzoicAds.setSubjectToCOPPA(value);
  },
  /**
   * Records a pageview. Pass a `screen` label (e.g. `'Home'`,
   * `'members/profile'`) to name the screen in Ezoic reporting; without one
   * the pageview lands on a single app-wide bucket.
   */
  trackPageview(screen?: string): Promise<boolean> {
    return NativeEzoicAds.trackPageview(screen ?? null);
  },
  /**
   * Shows the built-in consent dialog if this user must decide (GDPR applies,
   * no valid stored decision). Runs automatically after `initialize` unless
   * `autoPresentConsent: false`; repeat calls are harmless. Always resolves.
   */
  presentConsentIfRequired(): Promise<EzoicConsentOutcome> {
    return presentConsent(() => NativeEzoicAds.presentConsentIfRequired());
  },
  /**
   * Re-opens the consent dialog with the user's stored choices. TCF requires
   * a persistent "Privacy settings" entry point that calls this. Always
   * resolves.
   */
  presentConsentSettings(): Promise<EzoicConsentOutcome> {
    return presentConsent(() => NativeEzoicAds.presentConsentSettings());
  },
  /**
   * `true` when GDPR applies and the built-in CMP handles consent, `false`
   * otherwise, `null` until the init request completes or when the server
   * sent no consent information.
   */
  isConsentRequired(): Promise<boolean | null> {
    return NativeEzoicAds.isConsentRequired().then((v) => v ?? null);
  },
  /** Deletes the decision stored by the built-in CMP so the dialog shows again. */
  resetConsent(): void {
    NativeEzoicAds.resetConsent();
  },
};

export interface EzoicBannerError {
  message: string;
  code: number;
}

/**
 * Displayed ad size in dp (Android) / points (iOS). `{ width: 0, height: 0 }`
 * means the native view collapsed after a terminal no-fill.
 */
export interface EzoicAdSize {
  width: number;
  height: number;
}

/**
 * Tracks the collapsed state of an ad view from the native `onSizeChange`
 * event (height 0 ⇒ collapsed) and returns the style to render with plus the
 * handler to attach to the native component. While collapsed and
 * `collapseOnNoFill` is on, the host style is overridden with `height: 0` so
 * the Yoga box shrinks along with the native view; a non-zero size restores
 * the host style. The user's `onSizeChange` always receives the plain
 * `{ width, height }` payload.
 */
function useCollapsibleAdStyle(
  style: StyleProp<ViewStyle>,
  collapseOnNoFill: boolean,
  onSizeChange?: (size: EzoicAdSize) => void
) {
  const [collapsed, setCollapsed] = useState(false);
  const handleSizeChange = (e: NativeSyntheticEvent<EzoicAdSize>) => {
    const { width, height } = e.nativeEvent;
    setCollapsed(height === 0);
    onSizeChange?.({ width, height });
  };
  const resolvedStyle: StyleProp<ViewStyle> =
    collapseOnNoFill !== false && collapsed ? [style, { height: 0 }] : style;
  return { style: resolvedStyle, onSizeChange: handleSizeChange };
}

export interface EzoicBannerViewProps {
  adUnitIdentifier: string;
  size?: string;
  style?: StyleProp<ViewStyle>;
  /** Collapse the view (height 0) when a load fails and no ad is displayed. Default `true`. */
  collapseOnNoFill?: boolean;
  /**
   * Seconds between automatic refreshes. Omit (or `null`) to follow the Ezoic
   * server setting; `0` turns refresh off; values below 30 are raised to 30.
   * Read when the banner loads.
   */
  refreshIntervalSeconds?: number | null;
  /**
   * Maximum automatic refreshes per load. Omit (or `null`) to follow the Ezoic
   * server setting; `0` means no limit; values above 100 are capped at 100.
   * Read when the banner loads.
   */
  refreshMaxCount?: number | null;
  onLoad?: () => void;
  onError?: (error: EzoicBannerError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Displayed ad size changed: the creative size after a load, or 0x0 on collapse. */
  onSizeChange?: (size: EzoicAdSize) => void;
}

export function EzoicBannerView(props: EzoicBannerViewProps) {
  const {
    adUnitIdentifier,
    size,
    style,
    collapseOnNoFill = true,
    refreshIntervalSeconds,
    refreshMaxCount,
    onLoad,
    onError,
    onImpression,
    onClick,
    onOpen,
    onClose,
    onSizeChange,
    ...rest
  } = props;
  const collapsible = useCollapsibleAdStyle(
    style,
    collapseOnNoFill,
    onSizeChange
  );
  return (
    <EzoicBannerNative
      {...rest}
      style={collapsible.style}
      adUnitIdentifier={coerceAdUnitId(adUnitIdentifier)}
      size={normalizeSize(size)}
      collapseOnNoFill={collapseOnNoFill}
      refreshIntervalSeconds={normalizeRefreshOverride(refreshIntervalSeconds)}
      refreshMaxCount={normalizeRefreshOverride(refreshMaxCount)}
      onLoad={onLoad ? () => onLoad() : undefined}
      onError={onError ? (e) => onError(e.nativeEvent) : undefined}
      onImpression={onImpression ? () => onImpression() : undefined}
      onAdClick={onClick ? () => onClick() : undefined}
      onOpen={onOpen ? () => onOpen() : undefined}
      onClose={onClose ? () => onClose() : undefined}
      onSizeChange={collapsible.onSizeChange}
    />
  );
}

export interface EzoicNativeAdError {
  message: string;
  code: number;
}

export interface EzoicNativeAdViewProps {
  adUnitIdentifier: string | number;
  style?: StyleProp<ViewStyle>;
  /** Colors, text sizes, corner radius and more for the ad template. */
  adStyle?: EzoicNativeAdStyle;
  onLoad?: () => void;
  onError?: (error: EzoicNativeAdError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Renders a native ad in the native SDK's template (an "Ad" label, icon,
 * headline, advertiser, media, body and call-to-action button). The component
 * fills the bounds it is given by its RN style, so size it with `style` (e.g.
 * `{ width: '100%', height: 300 }`); style the template itself with `adStyle`.
 */
export function EzoicNativeAdView(props: EzoicNativeAdViewProps) {
  const {
    adUnitIdentifier,
    adStyle,
    onLoad,
    onError,
    onImpression,
    onClick,
    onOpen,
    onClose,
    ...rest
  } = props;
  return (
    <EzoicNativeAdNative
      {...rest}
      adUnitIdentifier={coerceAdUnitId(adUnitIdentifier)}
      adStyleJson={serializeNativeAdStyle(adStyle, processColor)}
      onLoad={onLoad ? () => onLoad() : undefined}
      onError={onError ? (e) => onError(e.nativeEvent) : undefined}
      onImpression={onImpression ? () => onImpression() : undefined}
      onAdClick={onClick ? () => onClick() : undefined}
      onOpen={onOpen ? () => onOpen() : undefined}
      onClose={onClose ? () => onClose() : undefined}
    />
  );
}

export interface EzoicOutstreamAdError {
  message: string;
  code: number;
}

export interface EzoicOutstreamAdViewProps {
  adUnitIdentifier: string | number;
  style?: StyleProp<ViewStyle>;
  /** Collapse the view (height 0) when a load fails and no ad is displayed. Default `true`. */
  collapseOnNoFill?: boolean;
  onLoad?: () => void;
  onError?: (error: EzoicOutstreamAdError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Displayed ad size changed: the creative size after a load, or 0x0 on collapse. */
  onSizeChange?: (size: EzoicAdSize) => void;
}

/**
 * Renders an outstream video ad in an SDK-built player. Outstream video runs on
 * its own (not inside host video content), so the SDK owns the player and this
 * component only needs a size. Fills the bounds it is given by its RN style, so
 * size it with `style` (e.g. `{ width: '100%', height: 200 }`). While collapsed
 * after a no-fill (see `collapseOnNoFill`) the height is forced to 0.
 */
export function EzoicOutstreamAdView(props: EzoicOutstreamAdViewProps) {
  const {
    adUnitIdentifier,
    style,
    collapseOnNoFill = true,
    onLoad,
    onError,
    onImpression,
    onClick,
    onOpen,
    onClose,
    onSizeChange,
    ...rest
  } = props;
  const collapsible = useCollapsibleAdStyle(
    style,
    collapseOnNoFill,
    onSizeChange
  );
  return (
    <EzoicOutstreamNative
      {...rest}
      style={collapsible.style}
      adUnitIdentifier={coerceAdUnitId(adUnitIdentifier)}
      collapseOnNoFill={collapseOnNoFill}
      onLoad={onLoad ? () => onLoad() : undefined}
      onError={onError ? (e) => onError(e.nativeEvent) : undefined}
      onImpression={onImpression ? () => onImpression() : undefined}
      onAdClick={onClick ? () => onClick() : undefined}
      onOpen={onOpen ? () => onOpen() : undefined}
      onClose={onClose ? () => onClose() : undefined}
      onSizeChange={collapsible.onSizeChange}
    />
  );
}
