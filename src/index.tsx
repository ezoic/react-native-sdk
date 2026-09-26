import { useState } from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';
import NativeEzoicAds, { type EzoicConfig } from './NativeEzoicAds';
import EzoicBannerNative from './EzoicBannerViewNativeComponent';
import EzoicNativeAdNative from './EzoicNativeAdViewNativeComponent';
import EzoicOutstreamNative from './EzoicOutstreamAdViewNativeComponent';
import { coerceAdUnitId, normalizeConfig, normalizeSize } from './helpers';

export type { EzoicConfig };
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

export const EzoicAds = {
  initialize(config: EzoicConfig): Promise<void> {
    return NativeEzoicAds.initialize(normalizeConfig(config));
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
  onLoad?: () => void;
  onError?: (error: EzoicNativeAdError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Renders a native ad in an SDK-built template `NativeAdView`. The component
 * fills the bounds it is given by its RN style, so size it with `style` (e.g.
 * `{ width: '100%', height: 300 }`); the template lays out its assets inside.
 */
export function EzoicNativeAdView(props: EzoicNativeAdViewProps) {
  const {
    adUnitIdentifier,
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
