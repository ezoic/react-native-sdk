import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// The facade only forwards to the TurboModule, so mock it; react-native is
// stubbed so `../index` (which also pulls in the Fabric components) can load.
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
    trackPageview: jest.fn(() => Promise.resolve(true)),
  },
}));

import NativeEzoicAds from '../NativeEzoicAds';
import { EzoicAds } from '../index';

const initializeMock = NativeEzoicAds.initialize as jest.Mock;
const trackMock = NativeEzoicAds.trackPageview as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EzoicAds.initialize', () => {
  it('forwards the 1.13 flags to native', async () => {
    await EzoicAds.initialize({
      domain: 'example.com',
      autoTrackPageviews: false,
      cmpEnabled: false,
      autoPresentConsent: false,
    });
    expect(initializeMock).toHaveBeenCalledWith({
      domain: 'example.com',
      autoTrackPageviews: false,
      cmpEnabled: false,
      autoPresentConsent: false,
    });
  });
});

describe('EzoicAds.trackPageview', () => {
  it('passes null when no screen is given', async () => {
    await expect(EzoicAds.trackPageview()).resolves.toBe(true);
    expect(trackMock).toHaveBeenCalledWith(null);
  });

  it('passes the screen label through', async () => {
    await EzoicAds.trackPageview('Home');
    expect(trackMock).toHaveBeenCalledWith('Home');
  });
});
