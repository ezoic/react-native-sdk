import { describe, expect, it } from '@jest/globals';
import {
  normalizeConfig,
  normalizeSize,
  coerceAdUnitId,
  mapRewardResult,
  normalizeRefreshOverride,
} from '../helpers';

describe('normalizeConfig', () => {
  it('passes through domain and defaults nothing it should not', () => {
    expect(normalizeConfig({ domain: 'example.com' })).toEqual({
      domain: 'example.com',
    });
  });
  it('keeps explicit flags', () => {
    expect(
      normalizeConfig({ domain: 'x.com', debugEnabled: true, testMode: false })
    ).toEqual({ domain: 'x.com', debugEnabled: true, testMode: false });
  });
  it('keeps the 1.13 pageview and consent flags', () => {
    expect(
      normalizeConfig({
        domain: 'x.com',
        autoTrackPageviews: false,
        cmpEnabled: false,
        autoPresentConsent: false,
      })
    ).toEqual({
      domain: 'x.com',
      autoTrackPageviews: false,
      cmpEnabled: false,
      autoPresentConsent: false,
    });
  });
  it('omits the 1.13 flags when unset so native defaults (true) apply', () => {
    const out = normalizeConfig({ domain: 'x.com' });
    expect(out).not.toHaveProperty('autoTrackPageviews');
    expect(out).not.toHaveProperty('cmpEnabled');
    expect(out).not.toHaveProperty('autoPresentConsent');
  });
  it('throws when domain is missing', () => {
    // @ts-expect-error intentionally invalid
    expect(() => normalizeConfig({})).toThrow(/domain/i);
  });
});

describe('normalizeSize', () => {
  it('returns a single WxH string unchanged', () => {
    expect(normalizeSize('300x250')).toBe('300x250');
  });
  it('trims whitespace in a list', () => {
    expect(normalizeSize('300x250, 320x50')).toBe('300x250,320x50');
  });
  it('returns empty string for undefined', () => {
    expect(normalizeSize(undefined)).toBe('');
  });
});

describe('coerceAdUnitId', () => {
  it('keeps a numeric string', () => {
    expect(coerceAdUnitId('12345')).toBe('12345');
  });
  it('coerces a number to string', () => {
    expect(coerceAdUnitId(12345 as unknown as string)).toBe('12345');
  });
});

describe('mapRewardResult', () => {
  it('returns the reward when earned', () => {
    expect(
      mapRewardResult({ earned: true, type: 'coins', amount: 10 })
    ).toEqual({ type: 'coins', amount: 10 });
  });
  it('returns null when not earned', () => {
    expect(mapRewardResult({ earned: false, type: '', amount: 0 })).toBeNull();
  });
  it('returns null for missing result', () => {
    expect(mapRewardResult(null)).toBeNull();
    expect(mapRewardResult(undefined)).toBeNull();
  });
});

describe('normalizeRefreshOverride', () => {
  it('maps invalid input to the unset sentinel instead of a real setting', () => {
    expect(normalizeRefreshOverride(undefined)).toBe(-1);
    expect(normalizeRefreshOverride(null)).toBe(-1);
    expect(normalizeRefreshOverride(-5)).toBe(-1);
    expect(normalizeRefreshOverride(Number.NaN)).toBe(-1);
    expect(normalizeRefreshOverride(Number.POSITIVE_INFINITY)).toBe(-1);
  });
  it('truncates fractions to whole numbers', () => {
    expect(normalizeRefreshOverride(30.9)).toBe(30);
    expect(normalizeRefreshOverride(0.5)).toBe(0);
  });
});
