import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  __esModule: true,
  TurboModuleRegistry: {
    getEnforcing: () => ({}),
  },
}));

jest.mock('../NativeEzoicCmp', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    presentConsentIfRequired: jest.fn(),
    presentConsentSettings: jest.fn(),
    isConsentRequired: jest.fn(),
    isPrivacyOptionsRequired: jest.fn(),
    resetConsent: jest.fn(),
  },
}));

import NativeEzoicCmp from '../NativeEzoicCmp';
import { EzoicCmp } from '../index';

type AsyncMock = jest.Mock<() => Promise<unknown>>;
const initMock = NativeEzoicCmp.initialize as jest.Mock;
const presentMock = NativeEzoicCmp.presentConsentIfRequired as AsyncMock;
const settingsMock = NativeEzoicCmp.presentConsentSettings as AsyncMock;
const requiredMock = NativeEzoicCmp.isConsentRequired as AsyncMock;
const privacyOptionsMock = NativeEzoicCmp.isPrivacyOptionsRequired as AsyncMock;
const resetMock = NativeEzoicCmp.resetConsent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EzoicCmp.initialize', () => {
  it('forwards only the domain when no options are set', () => {
    EzoicCmp.initialize('example.com');
    expect(initMock).toHaveBeenCalledWith('example.com', {});
  });

  it('forwards only the options that are set, including false', () => {
    EzoicCmp.initialize('example.com', {
      cmpEnabled: false,
      debugEnabled: true,
    });
    expect(initMock).toHaveBeenCalledWith('example.com', {
      cmpEnabled: false,
      debugEnabled: true,
    });
  });

  it('forwards autoReadConsent', () => {
    EzoicCmp.initialize('example.com', { autoReadConsent: false });
    expect(initMock).toHaveBeenCalledWith('example.com', {
      autoReadConsent: false,
    });
  });

  it('drops unknown keys', () => {
    EzoicCmp.initialize('example.com', {
      testMode: true,
    } as unknown as Parameters<typeof EzoicCmp.initialize>[1]);
    expect(initMock).toHaveBeenCalledWith('example.com', {});
  });

  it('throws synchronously without a domain', () => {
    expect(() => EzoicCmp.initialize('')).toThrow('domain');
    expect(initMock).not.toHaveBeenCalled();
  });
});

const presents: [
  'presentConsentIfRequired' | 'presentConsentSettings',
  AsyncMock,
][] = [
  ['presentConsentIfRequired', presentMock],
  ['presentConsentSettings', settingsMock],
];
const flags: ['isConsentRequired' | 'isPrivacyOptionsRequired', AsyncMock][] = [
  ['isConsentRequired', requiredMock],
  ['isPrivacyOptionsRequired', privacyOptionsMock],
];

describe.each(presents)('EzoicCmp.%s', (method, mock) => {
  const call = () => EzoicCmp[method]();

  it('resolves the parsed native outcome', async () => {
    mock.mockResolvedValue({ type: 'decided', decision: 'rejectAll' });
    await expect(call()).resolves.toEqual({
      type: 'decided',
      decision: 'rejectAll',
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('resolves the native not-initialized failure', async () => {
    mock.mockResolvedValue({
      type: 'failed',
      code: 1001,
      message: 'The Ezoic CMP has not been initialized.',
    });
    await expect(call()).resolves.toEqual({
      type: 'failed',
      code: 1001,
      message: 'The Ezoic CMP has not been initialized.',
    });
  });

  it('resolves failed(-1) for an unrecognized native value', async () => {
    mock.mockResolvedValue({ type: 'bogus' });
    await expect(call()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'Unrecognized outcome',
    });
  });

  it('resolves failed(-1) instead of rejecting if the bridge rejects', async () => {
    mock.mockRejectedValue(new Error('bridge down'));
    await expect(call()).resolves.toEqual({
      type: 'failed',
      code: -1,
      message: 'bridge down',
    });
  });
});

describe.each(flags)('EzoicCmp.%s', (method, mock) => {
  it.each([true, false, null])('resolves %s from native', async (value) => {
    mock.mockResolvedValue(value);
    await expect(EzoicCmp[method]()).resolves.toBe(value);
  });

  it('maps an undefined native value to null', async () => {
    mock.mockResolvedValue(undefined);
    await expect(EzoicCmp[method]()).resolves.toBeNull();
  });
});

describe('EzoicCmp.resetConsent', () => {
  it('forwards to native', () => {
    EzoicCmp.resetConsent();
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
