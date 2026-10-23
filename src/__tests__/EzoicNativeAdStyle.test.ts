import { describe, expect, it } from '@jest/globals';
import { serializeNativeAdStyle } from '../EzoicNativeAdStyle';

// Stand-in for react-native's processColor: hex strings become ARGB numbers,
// anything else is unresolvable (null), like an unknown color name.
const toColor = (value: unknown) => {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return 0xff000000 + parseInt(value.slice(1), 16);
};

describe('serializeNativeAdStyle', () => {
  it('is empty when no style is given', () => {
    expect(serializeNativeAdStyle(undefined, toColor)).toBe('');
    expect(serializeNativeAdStyle({}, toColor)).toBe('');
  });

  it('serializes colors as ARGB numbers and keeps sizes and label text', () => {
    const json = serializeNativeAdStyle(
      {
        backgroundColor: '#1E1E2E',
        cornerRadius: 16,
        headlineTextSize: 18,
        callToActionBackgroundColor: '#89B4FA',
        adLabelText: 'Sponsored',
      },
      toColor
    );
    expect(JSON.parse(json)).toEqual({
      backgroundColor: 0xff1e1e2e,
      callToActionBackgroundColor: 0xff89b4fa,
      cornerRadius: 16,
      headlineTextSize: 18,
      adLabelText: 'Sponsored',
    });
  });

  it('drops unresolvable colors and non-finite sizes', () => {
    const json = serializeNativeAdStyle(
      {
        backgroundColor: 'not-a-color',
        padding: Number.NaN,
        mediaHeight: Infinity,
        bodyTextSize: 13,
      },
      toColor
    );
    expect(JSON.parse(json)).toEqual({ bodyTextSize: 13 });
  });

  it('produces the same string for the same style regardless of key order', () => {
    const a = serializeNativeAdStyle(
      { cornerRadius: 4, backgroundColor: '#000000' },
      toColor
    );
    const b = serializeNativeAdStyle(
      { backgroundColor: '#000000', cornerRadius: 4 },
      toColor
    );
    expect(a).toBe(b);
  });
});
