import type { StyleProp, ViewStyle } from 'react-native';
import NativeEzoicAds, { type EzoicConfig } from './NativeEzoicAds';
import EzoicBannerNative from './EzoicBannerViewNativeComponent';
import { coerceAdUnitId, normalizeConfig, normalizeSize } from './helpers';

export type { EzoicConfig };
export {
  EzoicRewardedAd,
  type EzoicReward,
  type EzoicRewardedAdListeners,
} from './EzoicRewardedAd';

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
