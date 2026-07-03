import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock the native TurboModule so no real bridge is required.
jest.mock('../NativeEzoicAds', () => ({
  __esModule: true,
  default: {
    loadInterstitialAd: jest.fn(() => Promise.resolve()),
    showInterstitialAd: jest.fn(() => Promise.resolve()),
  },
}));

// Mock react-native's NativeEventEmitter with a controllable registry so tests
// can push lifecycle events and inspect how many subscriptions are live.
jest.mock('react-native', () => {
  const handlers: Array<{ event: string; cb: (e: unknown) => void }> = [];
  return {
    __emit: (event: string, payload: unknown) => {
      handlers.filter((h) => h.event === event).forEach((h) => h.cb(payload));
    },
    __handlerCount: () => handlers.length,
    NativeEventEmitter: class {
      addListener(event: string, cb: (e: unknown) => void) {
        const entry = { event, cb };
        handlers.push(entry);
        return {
          remove: () => {
            const i = handlers.indexOf(entry);
            if (i >= 0) handlers.splice(i, 1);
          },
        };
      }
    },
  };
});

import * as RN from 'react-native';
import NativeEzoicAds from '../NativeEzoicAds';
import { EzoicInterstitialAd } from '../EzoicInterstitialAd';

const emit = (RN as unknown as { __emit: (e: string, p: unknown) => void })
  .__emit;
const handlerCount = (RN as unknown as { __handlerCount: () => number })
  .__handlerCount;

const loadMock = NativeEzoicAds.loadInterstitialAd as jest.Mock;
const showMock = NativeEzoicAds.showInterstitialAd as jest.Mock;

const INTERSTITIAL_EVENT = 'EzoicInterstitialAdEvent';

beforeEach(() => {
  loadMock.mockReset();
  showMock.mockReset();
  loadMock.mockImplementation(() => Promise.resolve());
  showMock.mockImplementation(() => Promise.resolve());
});

describe('EzoicInterstitialAd.load', () => {
  it('calls the native load and resolves an instance', async () => {
    const ad = await EzoicInterstitialAd.load('123');
    expect(loadMock).toHaveBeenCalledWith('123');
    expect(ad.adUnitIdentifier).toBe('123');
    ad.destroy();
  });

  it('destroys the subscription and rethrows when the native load fails', async () => {
    const before = handlerCount();
    loadMock.mockImplementationOnce(() => Promise.reject(new Error('no fill')));
    await expect(EzoicInterstitialAd.load('123')).rejects.toThrow('no fill');
    // Failed load must not leak a subscription.
    expect(handlerCount()).toBe(before);
  });
});

describe('EzoicInterstitialAd.show', () => {
  it('calls the native show and resolves void', async () => {
    const ad = await EzoicInterstitialAd.load('123');
    await expect(ad.show()).resolves.toBeUndefined();
    expect(showMock).toHaveBeenCalledWith('123');
    ad.destroy();
  });

  it('rejects when the native show rejects', async () => {
    const ad = await EzoicInterstitialAd.load('123');
    showMock.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(ad.show()).rejects.toThrow('boom');
    ad.destroy();
  });
});

describe('EzoicInterstitialAd event routing', () => {
  it('routes each lifecycle event to the matching instance callback', async () => {
    const ad = await EzoicInterstitialAd.load('123');

    let shown = false;
    let impression = false;
    let clicked = false;
    let failedMessage: string | null = null;

    ad.setListeners({
      onShown: () => {
        shown = true;
      },
      onImpression: () => {
        impression = true;
      },
      onClicked: () => {
        clicked = true;
      },
      onFailedToShow: (error) => {
        failedMessage = error.message;
      },
    });

    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '123', type: 'shown' });
    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '123', type: 'impression' });
    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '123', type: 'clicked' });
    emit(INTERSTITIAL_EVENT, {
      adUnitIdentifier: '123',
      type: 'failedToShow',
      message: 'bad',
    });

    expect(shown).toBe(true);
    expect(impression).toBe(true);
    expect(clicked).toBe(true);
    expect(failedMessage).toBe('bad');

    ad.destroy();
  });

  it('ignores events addressed to a different ad unit', async () => {
    const ad = await EzoicInterstitialAd.load('123');
    let shown = false;
    ad.setListeners({
      onShown: () => {
        shown = true;
      },
    });

    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '999', type: 'shown' });
    expect(shown).toBe(false);

    ad.destroy();
  });

  it('auto-destroys on dismissed and drops later events', async () => {
    const ad = await EzoicInterstitialAd.load('123');
    const before = handlerCount();

    let dismissed = false;
    let shownAfterDismiss = false;
    ad.setListeners({
      onDismissed: () => {
        dismissed = true;
      },
      onShown: () => {
        shownAfterDismiss = true;
      },
    });

    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '123', type: 'dismissed' });
    expect(dismissed).toBe(true);
    // Auto-destroy removes the subscription.
    expect(handlerCount()).toBe(before - 1);

    emit(INTERSTITIAL_EVENT, { adUnitIdentifier: '123', type: 'shown' });
    expect(shownAfterDismiss).toBe(false);
  });
});
