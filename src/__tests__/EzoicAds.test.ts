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
    presentConsentIfRequired: jest.fn(),
    presentConsentSettings: jest.fn(),
    isConsentRequired: jest.fn(),
    resetConsent: jest.fn(),
  },
}));

import NativeEzoicAds from '../NativeEzoicAds';
import { EzoicAds, EzoicErrorCode } from '../index';

const trackMock = NativeEzoicAds.trackPageview as jest.Mock;
const presentMock = NativeEzoicAds.presentConsentIfRequired as jest.Mock<
  () => Promise<unknown>
>;
const settingsMock = NativeEzoicAds.presentConsentSettings as jest.Mock<
  () => Promise<unknown>
>;
const requiredMock = NativeEzoicAds.isConsentRequired as jest.Mock<
  () => Promise<unknown>
>;
const resetMock = NativeEzoicAds.resetConsent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// `initialize` memoizes per JS context, so each test loads a fresh copy of the
// module (and its mocked TurboModule) the way a JS reload would.
function freshModule() {
  let mod!: {
    EzoicAds: typeof EzoicAds;
    initialize: jest.Mock<(config: unknown) => Promise<void>>;
    presentConsent: jest.Mock<() => Promise<unknown>>;
  };
  jest.isolateModules(() => {
    const native = require('../NativeEzoicAds').default;
    mod = {
      EzoicAds: require('../index').EzoicAds,
      initialize: native.initialize,
      presentConsent: native.presentConsentIfRequired,
    };
  });
  mod.presentConsent.mockImplementation(() =>
    Promise.resolve({ type: 'notRequired' })
  );
  return mod;
}

const alreadyInitialized = () =>
  Object.assign(new Error('Ezoic SDK is already initialized.'), {
    code: 'EzoicAds',
    userInfo: { code: 1002 },
  });

describe('EzoicAds.initialize', () => {
  it('forwards only the domain when no flags are set', async () => {
    const m = freshModule();
    await m.EzoicAds.initialize({ domain: 'example.com' });
    expect(m.initialize).toHaveBeenCalledWith({ domain: 'example.com' });
  });

  it('forwards the 1.13 flags to native', async () => {
    const m = freshModule();
    await m.EzoicAds.initialize({
      domain: 'example.com',
      autoTrackPageviews: false,
      cmpEnabled: false,
      autoPresentConsent: false,
    });
    expect(m.initialize).toHaveBeenCalledWith({
      domain: 'example.com',
      autoTrackPageviews: false,
      cmpEnabled: false,
      autoPresentConsent: false,
    });
  });

  it('throws synchronously without a domain', () => {
    const m = freshModule();
    expect(() => m.EzoicAds.initialize({ domain: '' })).toThrow('domain');
    expect(m.initialize).not.toHaveBeenCalled();
  });

  it('resolves when native is already initialized (JS reload)', async () => {
    const m = freshModule();
    m.initialize.mockImplementationOnce(() =>
      Promise.reject(alreadyInitialized())
    );
    await expect(
      m.EzoicAds.initialize({ domain: 'example.com' })
    ).resolves.toBeUndefined();
    expect(m.presentConsent).toHaveBeenCalledTimes(1);
  });

  it('skips the consent prompt on re-init when autoPresentConsent is false', async () => {
    const m = freshModule();
    m.initialize.mockImplementationOnce(() =>
      Promise.reject(alreadyInitialized())
    );
    await m.EzoicAds.initialize({
      domain: 'example.com',
      autoPresentConsent: false,
    });
    expect(m.presentConsent).not.toHaveBeenCalled();
  });

  it('shares one native call between concurrent and later calls', async () => {
    const m = freshModule();
    let finish: () => void = () => {};
    m.initialize.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const first = m.EzoicAds.initialize({ domain: 'example.com' });
    const second = m.EzoicAds.initialize({ domain: 'example.com' });
    expect(second).toBe(first);
    finish();
    await Promise.all([first, second]);
    await m.EzoicAds.initialize({ domain: 'example.com' });
    expect(m.initialize).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed initialize', async () => {
    const m = freshModule();
    const failure = Object.assign(new Error('network'), {
      code: 'EzoicAds',
      userInfo: { code: 4001 },
    });
    m.initialize.mockImplementationOnce(() => Promise.reject(failure));
    await expect(m.EzoicAds.initialize({ domain: 'example.com' })).rejects.toBe(
      failure
    );
    await expect(
      m.EzoicAds.initialize({ domain: 'example.com' })
    ).resolves.toBeUndefined();
    expect(m.initialize).toHaveBeenCalledTimes(2);
    expect(m.presentConsent).not.toHaveBeenCalled();
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

  it('passes an empty label through (native treats it as unlabelled)', async () => {
    await EzoicAds.trackPageview('');
    expect(trackMock).toHaveBeenCalledWith('');
  });
});

describe('EzoicAds.presentConsentIfRequired', () => {
  it('resolves the parsed native outcome', async () => {
    presentMock.mockResolvedValue({ type: 'decided', decision: 'acceptAll' });
    await expect(EzoicAds.presentConsentIfRequired()).resolves.toEqual({
      type: 'decided',
      decision: 'acceptAll',
    });
    expect(presentMock).toHaveBeenCalledTimes(1);
  });

  it('resolves failed(-1) for an unrecognized native value', async () => {
    presentMock.mockResolvedValue({ type: 'bogus' });
    await expect(EzoicAds.presentConsentIfRequired()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'Unrecognized outcome',
    });
  });

  it('resolves failed(-1) instead of rejecting if the bridge rejects', async () => {
    presentMock.mockRejectedValue(new Error('bridge down'));
    await expect(EzoicAds.presentConsentIfRequired()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'bridge down',
    });
  });

  it('stringifies a non-Error bridge rejection', async () => {
    presentMock.mockRejectedValue('bridge down');
    await expect(EzoicAds.presentConsentIfRequired()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'bridge down',
    });
  });
});

describe('EzoicAds.presentConsentSettings', () => {
  it('resolves the parsed native outcome', async () => {
    settingsMock.mockResolvedValue({
      type: 'failed',
      code: -1,
      message: 'No foreground Activity',
    });
    await expect(EzoicAds.presentConsentSettings()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'No foreground Activity',
    });
    expect(settingsMock).toHaveBeenCalledTimes(1);
  });

  it('resolves failed(-1) for an unrecognized native value', async () => {
    settingsMock.mockResolvedValue(null);
    await expect(EzoicAds.presentConsentSettings()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'Unrecognized outcome',
    });
  });

  it('resolves failed(-1) instead of rejecting if the bridge rejects', async () => {
    settingsMock.mockRejectedValue(new Error('bridge down'));
    await expect(EzoicAds.presentConsentSettings()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'bridge down',
    });
  });
});

describe('EzoicAds.isConsentRequired', () => {
  it.each([true, false, null])('resolves %s from native', async (value) => {
    requiredMock.mockResolvedValue(value);
    await expect(EzoicAds.isConsentRequired()).resolves.toBe(value);
  });

  it('maps an undefined native value to null', async () => {
    requiredMock.mockResolvedValue(undefined);
    await expect(EzoicAds.isConsentRequired()).resolves.toBeNull();
  });
});

describe('EzoicAds.resetConsent', () => {
  it('forwards to native', () => {
    EzoicAds.resetConsent();
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});

describe('EzoicErrorCode', () => {
  it('exposes consentRequired = 5001', () => {
    expect(EzoicErrorCode.consentRequired).toBe(5001);
  });
});
