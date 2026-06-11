import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeEzoicAds from './NativeEzoicAds';
import { coerceAdUnitId, mapRewardResult } from './helpers';

/** A reward earned by the user for completing a rewarded ad. */
export interface EzoicReward {
  type: string;
  amount: number;
}

/** Lifecycle callbacks for a rewarded ad. All are optional. */
export interface EzoicRewardedAdListeners {
  onShown?: () => void;
  onFailedToShow?: (error: { message: string }) => void;
  onImpression?: () => void;
  onClicked?: () => void;
  onDismissed?: () => void;
  onUserEarnedReward?: (reward: EzoicReward) => void;
}

/** The single native event name carrying every rewarded lifecycle signal. */
const REWARDED_EVENT = 'EzoicRewardedAdEvent';

interface RewardedNativeEvent {
  adUnitIdentifier: string;
  type:
    | 'shown'
    | 'failedToShow'
    | 'impression'
    | 'clicked'
    | 'dismissed'
    | 'reward';
  message?: string;
  rewardType?: string;
  rewardAmount?: number;
}

// A single shared emitter is sufficient — events are routed to the right
// instance by adUnitIdentifier below.
const emitter = new NativeEventEmitter(NativeEzoicAds as never);

/**
 * A rewarded ad. Use the static `load` to fetch an ad ahead of time, then call
 * `show()` to present it and grant the reward when the user finishes watching.
 *
 * ```ts
 * const ad = await EzoicRewardedAd.load('12345');
 * ad.setListeners({ onDismissed: () => console.log('closed') });
 * const reward = await ad.show();
 * if (reward) grantReward(reward.amount);
 * ```
 *
 * Mirrors the native `EzoicRewardedAd` load/show lifecycle on both platforms.
 * Rewarded ads are single-use — load a new one for the next opportunity.
 */
export class EzoicRewardedAd {
  /** The Ezoic ad unit identifier this ad was loaded for. */
  readonly adUnitIdentifier: string;

  private listeners: EzoicRewardedAdListeners = {};
  private subscription: EmitterSubscription | null = null;

  private constructor(adUnitIdentifier: string) {
    this.adUnitIdentifier = adUnitIdentifier;
    this.subscription = emitter.addListener(REWARDED_EVENT, (raw: unknown) => {
      const event = raw as RewardedNativeEvent;
      if (event.adUnitIdentifier !== this.adUnitIdentifier) return;
      this.handleEvent(event);
    });
  }

  /**
   * Loads a rewarded ad for the given Ezoic ad unit identifier. Resolves with
   * a ready-to-show `EzoicRewardedAd`, or rejects if no ad could be loaded.
   */
  static async load(adUnitIdentifier: string): Promise<EzoicRewardedAd> {
    const id = coerceAdUnitId(adUnitIdentifier);
    const ad = new EzoicRewardedAd(id);
    try {
      await NativeEzoicAds.loadRewardedAd(id);
      return ad;
    } catch (error) {
      ad.destroy();
      throw error;
    }
  }

  /** Registers lifecycle callbacks. Replaces any previously set listeners. */
  setListeners(listeners: EzoicRewardedAdListeners): void {
    this.listeners = listeners;
  }

  /**
   * Presents the rewarded ad full-screen. Resolves with the earned reward, or
   * `null` if the ad was dismissed before the reward was earned. Rejects if the
   * ad was not ready (load first) or failed to present.
   */
  async show(): Promise<EzoicReward | null> {
    const result = await NativeEzoicAds.showRewardedAd(this.adUnitIdentifier);
    return mapRewardResult(result);
  }

  /** Releases the event subscription. Safe to call multiple times. */
  destroy(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.listeners = {};
  }

  private handleEvent(event: RewardedNativeEvent): void {
    switch (event.type) {
      case 'shown':
        this.listeners.onShown?.();
        break;
      case 'failedToShow':
        this.listeners.onFailedToShow?.({ message: event.message ?? '' });
        break;
      case 'impression':
        this.listeners.onImpression?.();
        break;
      case 'clicked':
        this.listeners.onClicked?.();
        break;
      case 'reward':
        this.listeners.onUserEarnedReward?.({
          type: event.rewardType ?? '',
          amount: event.rewardAmount ?? 0,
        });
        break;
      case 'dismissed':
        this.listeners.onDismissed?.();
        // Dismissal is terminal — the native ad is single-use.
        this.destroy();
        break;
    }
  }
}
