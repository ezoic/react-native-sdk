import type { StyleProp, ViewStyle } from 'react-native';
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
  trackPageview(): Promise<boolean> {
    return NativeEzoicAds.trackPageview();
  },
};

export interface EzoicBannerError {
  message: string;
  code: number;
}

export interface EzoicBannerViewProps {
  adUnitIdentifier: string;
  size?: string;
  style?: StyleProp<ViewStyle>;
  onLoad?: () => void;
  onError?: (error: EzoicBannerError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function EzoicBannerView(props: EzoicBannerViewProps) {
  const {
    adUnitIdentifier,
    size,
    onLoad,
    onError,
    onImpression,
    onClick,
    onOpen,
    onClose,
    ...rest
  } = props;
  return (
    <EzoicBannerNative
      {...rest}
      adUnitIdentifier={coerceAdUnitId(adUnitIdentifier)}
      size={normalizeSize(size)}
      onLoad={onLoad ? () => onLoad() : undefined}
      onError={onError ? (e) => onError(e.nativeEvent) : undefined}
      onImpression={onImpression ? () => onImpression() : undefined}
      onAdClick={onClick ? () => onClick() : undefined}
      onOpen={onOpen ? () => onOpen() : undefined}
      onClose={onClose ? () => onClose() : undefined}
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
  onLoad?: () => void;
  onError?: (error: EzoicOutstreamAdError) => void;
  onImpression?: () => void;
  onClick?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Renders an outstream video ad in an SDK-built player. Outstream video runs on
 * its own (not inside host video content), so the SDK owns the player and this
 * component only needs a size. Fills the bounds it is given by its RN style, so
 * size it with `style` (e.g. `{ width: '100%', height: 200 }`).
 */
export function EzoicOutstreamAdView(props: EzoicOutstreamAdViewProps) {
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
    <EzoicOutstreamNative
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
