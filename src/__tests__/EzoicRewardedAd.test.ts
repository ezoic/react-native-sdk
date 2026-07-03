import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock the native TurboModule so no real bridge is required.
jest.mock('../NativeEzoicAds', () => ({
  __esModule: true,
  default: {
    loadRewardedAd: jest.fn(() => Promise.resolve()),
    showRewardedAd: jest.fn(() =>
      Promise.resolve({ earned: false, type: '', amount: 0 })
    ),
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
import { EzoicRewardedAd } from '../EzoicRewardedAd';

const emit = (RN as unknown as { __emit: (e: string, p: unknown) => void })
  .__emit;
const handlerCount = (RN as unknown as { __handlerCount: () => number })
  .__handlerCount;

const loadMock = NativeEzoicAds.loadRewardedAd as jest.Mock;
const showMock = NativeEzoicAds.showRewardedAd as jest.Mock;

const REWARDED_EVENT = 'EzoicRewardedAdEvent';

beforeEach(() => {
  loadMock.mockReset();
  showMock.mockReset();
  loadMock.mockImplementation(() => Promise.resolve());
  showMock.mockImplementation(() =>
    Promise.resolve({ earned: false, type: '', amount: 0 })
  );
});

describe('EzoicRewardedAd.load', () => {
  it('calls the native load and resolves an instance', async () => {
    const ad = await EzoicRewardedAd.load('123');
    expect(loadMock).toHaveBeenCalledWith('123');
    expect(ad.adUnitIdentifier).toBe('123');
    ad.destroy();
  });

  it('destroys the subscription and rethrows when the native load fails', async () => {
    const before = handlerCount();
    loadMock.mockImplementationOnce(() => Promise.reject(new Error('no fill')));
    await expect(EzoicRewardedAd.load('123')).rejects.toThrow('no fill');
    expect(handlerCount()).toBe(before);
  });
});

describe('EzoicRewardedAd.show', () => {
  it('maps an earned reward result', async () => {
    showMock.mockImplementationOnce(() =>
      Promise.resolve({ earned: true, type: 'coins', amount: 5 })
    );
    const ad = await EzoicRewardedAd.load('123');
    await expect(ad.show()).resolves.toEqual({ type: 'coins', amount: 5 });
    expect(showMock).toHaveBeenCalledWith('123');
    ad.destroy();
  });

  it('resolves null when the ad was dismissed unearned', async () => {
    const ad = await EzoicRewardedAd.load('123');
    await expect(ad.show()).resolves.toBeNull();
    ad.destroy();
  });

  it('rejects when the native show rejects', async () => {
    const ad = await EzoicRewardedAd.load('123');
    showMock.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    await expect(ad.show()).rejects.toThrow('boom');
    ad.destroy();
  });
});

describe('EzoicRewardedAd event routing', () => {
  it('routes each lifecycle event to the matching instance callback', async () => {
    const ad = await EzoicRewardedAd.load('123');

    let shown = false;
    let impression = false;
    let clicked = false;
    let reward: { type: string; amount: number } | null = null;
    let failed: { message: string; code?: number } | null = null;

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
      onUserEarnedReward: (r) => {
        reward = r;
      },
      onFailedToShow: (error) => {
        failed = error;
      },
    });

    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'shown' });
    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'impression' });
    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'clicked' });
    emit(REWARDED_EVENT, {
      adUnitIdentifier: '123',
      type: 'reward',
      rewardType: 'gems',
      rewardAmount: 3,
    });

    expect(shown).toBe(true);
    expect(impression).toBe(true);
    expect(clicked).toBe(true);
    expect(reward).toEqual({ type: 'gems', amount: 3 });
    expect(failed).toBeNull();

    ad.destroy();
  });

  it('ignores events addressed to a different ad unit', async () => {
    const ad = await EzoicRewardedAd.load('123');
    let shown = false;
    ad.setListeners({
      onShown: () => {
        shown = true;
      },
    });

    emit(REWARDED_EVENT, { adUnitIdentifier: '999', type: 'shown' });
    expect(shown).toBe(false);

    ad.destroy();
  });

  it('surfaces the error code and auto-destroys on failedToShow', async () => {
    const ad = await EzoicRewardedAd.load('123');
    const before = handlerCount();

    let failed: { message: string; code?: number } | null = null;
    let shownAfterFail = false;
    ad.setListeners({
      onFailedToShow: (error) => {
        failed = error;
      },
      onShown: () => {
        shownAfterFail = true;
      },
    });

    emit(REWARDED_EVENT, {
      adUnitIdentifier: '123',
      type: 'failedToShow',
      message: 'boom',
      code: 7,
    });
    expect(failed).toEqual({ message: 'boom', code: 7 });
    // Auto-destroy on failedToShow removes the subscription.
    expect(handlerCount()).toBe(before - 1);

    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'shown' });
    expect(shownAfterFail).toBe(false);
  });

  it('auto-destroys on dismissed and drops later events', async () => {
    const ad = await EzoicRewardedAd.load('123');
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

    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'dismissed' });
    expect(dismissed).toBe(true);
    expect(handlerCount()).toBe(before - 1);

    emit(REWARDED_EVENT, { adUnitIdentifier: '123', type: 'shown' });
    expect(shownAfterDismiss).toBe(false);
  });
});

describe('EzoicRewardedAd double-load / double-show guards', () => {
  it('rejects a second load for an id already loaded/loading', async () => {
    const loaded = new Set<string>();
    loadMock.mockImplementation((...args: unknown[]) => {
      const id = args[0] as string;
      if (loaded.has(id)) {
        return Promise.reject(
          new Error(`An ad is already loaded/loading for ad unit ${id}`)
        );
      }
      loaded.add(id);
      return Promise.resolve();
    });

    const ad = await EzoicRewardedAd.load('123');
    await expect(EzoicRewardedAd.load('123')).rejects.toThrow(
      'already loaded/loading'
    );
    ad.destroy();
  });

  it('rejects a second show while the first is in flight; first settles', async () => {
    const ad = await EzoicRewardedAd.load('123');

    let firstInFlight = false;
    let releaseFirst: (() => void) | undefined;
    showMock.mockImplementation(() => {
      if (firstInFlight) {
        return Promise.reject(
          new Error('A show is already in progress for ad unit 123')
        );
      }
      firstInFlight = true;
      return new Promise((resolve) => {
        releaseFirst = () => resolve({ earned: false, type: '', amount: 0 });
      });
    });

    const first = ad.show();
    await expect(ad.show()).rejects.toThrow('already in progress');

    releaseFirst?.();
    await expect(first).resolves.toBeNull();
    ad.destroy();
  });
});
