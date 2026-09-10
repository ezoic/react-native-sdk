import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  __esModule: true,
  codegenNativeComponent: (name: string) => name,
  TurboModuleRegistry: {
    getEnforcing: () => ({}),
  },
  NativeEventEmitter: class {
    addListener() {
      return { remove: () => {} };
    }
  },
}));

jest.mock('../NativeEzoicAds', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(() => Promise.resolve()),
    setGDPRConsent: jest.fn(),
    setGPPConsent: jest.fn(),
    setSubjectToCOPPA: jest.fn(),
    trackPageview: jest.fn(() => Promise.resolve(true)),
    getPageviewId: jest.fn(() => Promise.resolve(null)),
    getVisitorId: jest.fn(() => Promise.resolve(null)),
    trackPageviewWithIds: jest.fn(() => Promise.resolve(null)),
  },
}));

import NativeEzoicAds from '../NativeEzoicAds';
import { EzoicAds } from '../index';

const getPageviewIdMock = NativeEzoicAds.getPageviewId as jest.Mock;
const getVisitorIdMock = NativeEzoicAds.getVisitorId as jest.Mock;
const trackPageviewWithIdsMock =
  NativeEzoicAds.trackPageviewWithIds as jest.Mock;

beforeEach(() => {
  getPageviewIdMock.mockReset();
  getVisitorIdMock.mockReset();
  trackPageviewWithIdsMock.mockReset();
  getPageviewIdMock.mockImplementation(() => Promise.resolve(null));
  getVisitorIdMock.mockImplementation(() => Promise.resolve(null));
  trackPageviewWithIdsMock.mockImplementation(() => Promise.resolve(null));
});

describe('EzoicAds pageview identity', () => {
  it('reads current pageview and visitor ids', async () => {
    getPageviewIdMock.mockImplementationOnce(() => Promise.resolve('pv-123'));
    getVisitorIdMock.mockImplementationOnce(() => Promise.resolve('visit-456'));

    await expect(EzoicAds.getPageviewId()).resolves.toBe('pv-123');
    await expect(EzoicAds.getVisitorId()).resolves.toBe('visit-456');
  });

  it('returns ids from trackPageviewWithIds and null on failure', async () => {
    trackPageviewWithIdsMock
      .mockImplementationOnce(() =>
        Promise.resolve({ pageviewId: 'pv-123', visitorId: 'visit-456' })
      )
      .mockImplementationOnce(() => Promise.resolve(null));

    await expect(EzoicAds.trackPageviewWithIds()).resolves.toEqual({
      pageviewId: 'pv-123',
      visitorId: 'visit-456',
    });
    await expect(EzoicAds.trackPageviewWithIds()).resolves.toBeNull();
  });
});
