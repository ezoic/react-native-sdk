import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface EzoicCmpConfig {
  cmpEnabled?: boolean;
  autoReadConsent?: boolean;
  debugEnabled?: boolean;
}

/**
 * Wire format of a consent outcome from the native glue (see
 * `parseConsentOutcome`), the same as `@ezoic/react-native-sdk`'s.
 */
export interface EzoicConsentOutcomeRaw {
  type: string;
  decision?: string;
  code?: number;
  message?: string;
}

export interface Spec extends TurboModule {
  // Native returns at once and loads the publisher's settings in the
  // background; presents meanwhile wait for them.
  initialize(domain: string, config: EzoicCmpConfig): void;
  // The present* promises always resolve (never reject); a missing host
  // Activity / view controller resolves as failed(-1).
  presentConsentIfRequired(): Promise<EzoicConsentOutcomeRaw>;
  presentConsentSettings(): Promise<EzoicConsentOutcomeRaw>;
  isConsentRequired(): Promise<boolean | null>;
  isPrivacyOptionsRequired(): Promise<boolean | null>;
  resetConsent(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EzoicReactNativeCmpSdk');
