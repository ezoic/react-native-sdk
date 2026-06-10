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

export interface Spec extends TurboModule {
  initialize(config: EzoicConfig): Promise<void>;
  setGDPRConsent(applies: boolean, consentString?: string): void;
  setGPPConsent(gppString?: string, sectionIds?: string): void;
  setSubjectToCOPPA(value: boolean): void;
  trackPageview(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EzoicReactNativeSdk');
