import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock the native TurboModule so no real bridge is required. Instream settles
// its promises directly from the native listener, so there is no event emitter
// to stub (unlike the interstitial/rewarded suites).
jest.mock('../NativeEzoicAds', () => ({
  __esModule: true,
  default: {
    loadInstreamAd: jest.fn(() => Promise.resolve('')),
    getInstreamNextAdTagUrl: jest.fn(() => Promise.resolve(null)),
    reportInstreamImpression: jest.fn(() => Promise.resolve()),
    destroyInstreamAd: jest.fn(() => Promise.resolve()),
  },
}));

import NativeEzoicAds from '../NativeEzoicAds';
import { EzoicInstreamAd } from '../EzoicInstreamAd';

const loadMock = NativeEzoicAds.loadInstreamAd as jest.Mock;
const nextMock = NativeEzoicAds.getInstreamNextAdTagUrl as jest.Mock;
const impressionMock = NativeEzoicAds.reportInstreamImpression as jest.Mock;
const destroyMock = NativeEzoicAds.destroyInstreamAd as jest.Mock;

const TAG = 'https://pubads.g.doubleclick.net/gampad/ads?iu=/1234/preroll';

beforeEach(() => {
  loadMock.mockReset();
  nextMock.mockReset();
  impressionMock.mockReset();
  destroyMock.mockReset();
  loadMock.mockImplementation(() => Promise.resolve(TAG));
  nextMock.mockImplementation(() => Promise.resolve(null));
  impressionMock.mockImplementation(() => Promise.resolve());
  destroyMock.mockImplementation(() => Promise.resolve());
});

describe('EzoicInstreamAd constructor', () => {
  it('coerces a string id to a number', () => {
    const ad = new EzoicInstreamAd('12345');
    expect(ad.adUnitIdentifier).toBe(12345);
  });

  it('passes a numeric id through unchanged', () => {
    const ad = new EzoicInstreamAd(678);
    expect(ad.adUnitIdentifier).toBe(678);
  });
});

describe('EzoicInstreamAd.load', () => {
  it('resolves the GAM VAST ad-tag URL', async () => {
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.load()).resolves.toBe(TAG);
  });

  it('passes contentUrl through to the native load', async () => {
    const ad = new EzoicInstreamAd('12345');
    await ad.load({ contentUrl: 'https://host.example/video.mp4' });
    expect(loadMock).toHaveBeenCalledWith(
      12345,
      'https://host.example/video.mp4'
    );
  });

  it('passes null contentUrl when omitted', async () => {
    const ad = new EzoicInstreamAd('12345');
    await ad.load();
    expect(loadMock).toHaveBeenCalledWith(12345, null);
  });

  it('rejects with the native error (no fill)', async () => {
    loadMock.mockImplementationOnce(() => Promise.reject(new Error('no fill')));
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.load()).rejects.toThrow('no fill');
  });

  it('propagates the duplicate-load rejection', async () => {
    loadMock.mockImplementationOnce(() =>
      Promise.reject(
        new Error('An instream ad is already loading for ad unit 12345')
      )
    );
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.load()).rejects.toThrow('already loading');
  });

  it('is reusable after a previous load resolves (multi-use)', async () => {
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.load()).resolves.toBe(TAG);
    loadMock.mockImplementationOnce(() => Promise.resolve(`${TAG}&r=2`));
    await expect(ad.load()).resolves.toBe(`${TAG}&r=2`);
    expect(loadMock).toHaveBeenCalledTimes(2);
  });
});

describe('EzoicInstreamAd.getNextAdTagUrl', () => {
  it('resolves null when the waterfall is exhausted', async () => {
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.getNextAdTagUrl()).resolves.toBeNull();
    expect(nextMock).toHaveBeenCalledWith(12345);
  });

  it('resolves the next tag URL', async () => {
    nextMock.mockImplementationOnce(() => Promise.resolve(`${TAG}&eb_br=2`));
    const ad = new EzoicInstreamAd('12345');
    await expect(ad.getNextAdTagUrl()).resolves.toBe(`${TAG}&eb_br=2`);
  });
});

describe('EzoicInstreamAd.reportImpression', () => {
  it('passes revenueUsd through when provided', async () => {
    const ad = new EzoicInstreamAd('12345');
    await ad.reportImpression({ revenueUsd: 0.012 });
    expect(impressionMock).toHaveBeenCalledWith(12345, 0.012);
  });

  it('passes null when revenue is omitted', async () => {
    const ad = new EzoicInstreamAd('12345');
    await ad.reportImpression();
    expect(impressionMock).toHaveBeenCalledWith(12345, null);
  });
});

describe('EzoicInstreamAd.destroy', () => {
  it('calls the native destroy for this id', async () => {
    const ad = new EzoicInstreamAd('12345');
    await ad.destroy();
    expect(destroyMock).toHaveBeenCalledWith(12345);
  });
});
