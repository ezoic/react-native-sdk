import type { ColorValue } from 'react-native';

/**
 * Appearance of the native ad template. Sizes are in dp (Android) / points
 * (iOS). Colors accept anything React Native accepts. Unset colors follow the
 * platform theme, including dark mode.
 *
 * `mediaHeight` is never below 120 and `adLabelText` is never blank: Google
 * requires a minimum media size and an ad label on native ads.
 */
export interface EzoicNativeAdStyle {
  /** Card background. Default: transparent. */
  backgroundColor?: ColorValue;
  /** Card corner radius. Default: 0. */
  cornerRadius?: number;
  /** Padding inside the card. Default: 8. */
  padding?: number;
  headlineTextColor?: ColorValue;
  /** Default: 16 (bold). */
  headlineTextSize?: number;
  advertiserTextColor?: ColorValue;
  /** Default: 12. */
  advertiserTextSize?: number;
  bodyTextColor?: ColorValue;
  /** Default: 14. */
  bodyTextSize?: number;
  /** Call-to-action button fill. Default: the platform button. */
  callToActionBackgroundColor?: ColorValue;
  callToActionTextColor?: ColorValue;
  /** Default: 14. */
  callToActionTextSize?: number;
  /** Applies when `callToActionBackgroundColor` is set. Default: 4. */
  callToActionCornerRadius?: number;
  /** Height of the media view, at least 120. Default: 175. */
  mediaHeight?: number;
  /** Text of the ad label, e.g. "Sponsored". Default: "Ad". */
  adLabelText?: string;
  /** Default: #202124. */
  adLabelTextColor?: ColorValue;
  /** Default: #FBBC04. */
  adLabelBackgroundColor?: ColorValue;
}

const COLOR_KEYS = [
  'backgroundColor',
  'headlineTextColor',
  'advertiserTextColor',
  'bodyTextColor',
  'callToActionBackgroundColor',
  'callToActionTextColor',
  'adLabelTextColor',
  'adLabelBackgroundColor',
] as const;

const NUMBER_KEYS = [
  'cornerRadius',
  'padding',
  'headlineTextSize',
  'advertiserTextSize',
  'bodyTextSize',
  'callToActionTextSize',
  'callToActionCornerRadius',
  'mediaHeight',
] as const;

/**
 * Serializes a style to the JSON the native template parses (colors as ARGB
 * numbers via `toColor`, which is react-native's `processColor` at runtime).
 * Key order is fixed so an unchanged style yields an identical prop string.
 */
export function serializeNativeAdStyle(
  style: EzoicNativeAdStyle | undefined,
  toColor: (color: ColorValue) => unknown
): string {
  if (!style) return '';
  const out: Record<string, number | string> = {};
  for (const key of COLOR_KEYS) {
    const value = style[key];
    if (value == null) continue;
    const color = toColor(value);
    if (typeof color === 'number') out[key] = color;
  }
  for (const key of NUMBER_KEYS) {
    const value = style[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  if (typeof style.adLabelText === 'string') {
    out.adLabelText = style.adLabelText;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : '';
}
