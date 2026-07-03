import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeEzoicAds from './NativeEzoicAds';
import { coerceAdUnitId } from './helpers';

/** Lifecycle callbacks for an interstitial ad. All are optional. */
export interface EzoicInterstitialAdListeners {
  onShown?: () => void;
  onFailedToShow?: (error: { message: string }) => void;
  onImpression?: () => void;
  onClicked?: () => void;
  onDismissed?: () => void;
}

/** The single native event name carrying every interstitial lifecycle signal. */
const INTERSTITIAL_EVENT = 'EzoicInterstitialAdEvent';

interface InterstitialNativeEvent {
  adUnitIdentifier: string;
  type: 'shown' | 'failedToShow' | 'impression' | 'clicked' | 'dismissed';
  message?: string;
}

// A single shared emitter is sufficient — events are routed to the right
// instance by adUnitIdentifier below.
const emitter = new NativeEventEmitter(NativeEzoicAds as never);

/**
 * An interstitial ad. Use the static `load` to fetch an ad ahead of time, then
 * call `show()` to present it full-screen at a natural transition point.
 * Interstitials carry no reward.
 *
 * ```ts
 * const ad = await EzoicInterstitialAd.load('12345');
 * ad.setListeners({ onDismissed: () => console.log('closed') });
 * await ad.show();
 * ```
 *
 * Mirrors the native `EzoicInterstitialAd` load/show lifecycle on both
 * platforms. Interstitial ads are single-use — load a new one for the next
 * opportunity.
 */
export class EzoicInterstitialAd {
  /** The Ezoic ad unit identifier this ad was loaded for. */
  readonly adUnitIdentifier: string;

  private listeners: EzoicInterstitialAdListeners = {};
  private subscription: EmitterSubscription | null = null;

  private constructor(adUnitIdentifier: string) {
    this.adUnitIdentifier = adUnitIdentifier;
    this.subscription = emitter.addListener(
      INTERSTITIAL_EVENT,
      (raw: unknown) => {
        const event = raw as InterstitialNativeEvent;
        if (event.adUnitIdentifier !== this.adUnitIdentifier) return;
        this.handleEvent(event);
      }
    );
  }

  /**
   * Loads an interstitial ad for the given Ezoic ad unit identifier. Resolves
   * with a ready-to-show `EzoicInterstitialAd`, or rejects if no ad could be
   * loaded.
   */
  static async load(adUnitIdentifier: string): Promise<EzoicInterstitialAd> {
    const id = coerceAdUnitId(adUnitIdentifier);
    const ad = new EzoicInterstitialAd(id);
    try {
      await NativeEzoicAds.loadInterstitialAd(id);
      return ad;
    } catch (error) {
      ad.destroy();
      throw error;
    }
  }

  /** Registers lifecycle callbacks. Replaces any previously set listeners. */
  setListeners(listeners: EzoicInterstitialAdListeners): void {
    this.listeners = listeners;
  }

  /**
   * Presents the interstitial ad full-screen. Resolves when the ad is
   * dismissed. Rejects if the ad was not ready (load first) or failed to
   * present.
   */
  async show(): Promise<void> {
    await NativeEzoicAds.showInterstitialAd(this.adUnitIdentifier);
  }

  /** Releases the event subscription. Safe to call multiple times. */
  destroy(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.listeners = {};
  }

  private handleEvent(event: InterstitialNativeEvent): void {
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
      case 'dismissed':
        this.listeners.onDismissed?.();
        // Dismissal is terminal — the native ad is single-use.
        this.destroy();
        break;
    }
  }
}
