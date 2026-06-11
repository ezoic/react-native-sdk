import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface EzoicConfig {
  domain: string;
  autoReadConsent?: boolean;
  subjectToCOPPA?: boolean;
  requestATTBeforeAds?: boolean;
  debugEnabled?: boolean;
  testMode?: boolean;
}

/**
 * Result of `showRewardedAd`. `earned` is true when the user completed the ad
 * and earned the reward; `type`/`amount` describe the granted reward (empty/0
 * when the ad was dismissed without earning). The public `EzoicRewardedAd.show`
 * maps this to `EzoicReward | null`.
 */
export interface EzoicRewardResult {
  earned: boolean;
  type: string;
  amount: number;
}

export interface Spec extends TurboModule {
  initialize(config: EzoicConfig): Promise<void>;
  setGDPRConsent(applies: boolean, consentString?: string): void;
  setGPPConsent(gppString?: string, sectionIds?: string): void;
  setSubjectToCOPPA(value: boolean): void;
  trackPageview(): Promise<boolean>;
  loadRewardedAd(adUnitIdentifier: string): Promise<void>;
  showRewardedAd(adUnitIdentifier: string): Promise<EzoicRewardResult>;
  // Required by NativeEventEmitter for the rewarded ad lifecycle events.
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EzoicReactNativeSdk');
