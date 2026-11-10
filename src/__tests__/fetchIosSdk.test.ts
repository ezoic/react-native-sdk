import { describe, expect, it } from '@jest/globals';
import { join } from 'path';

const {
  assetName,
  assetUrl,
  readPins,
} = require('../../scripts/fetch-ios-sdk.js');

const root = join(__dirname, '..', '..');

describe('fetch-ios-sdk', () => {
  it('names the dist release asset after the framework without "Binary"', () => {
    expect(assetName('EzoicAdsSDKBinary')).toBe('EzoicAdsSDK');
    expect(assetName('EzoicCmpSDKBinary')).toBe('EzoicCmpSDK');
  });

  it('downloads the -cocoapods zip from the dist GitHub release', () => {
    expect(assetUrl('1.22.0', 'EzoicAdsSDKBinary')).toBe(
      'https://github.com/ezoic/ezoic-swift-sdk-dist/releases/download/1.22.0/EzoicAdsSDK-1.22.0-cocoapods.xcframework.zip'
    );
    expect(assetUrl('1.22.0', 'EzoicCmpSDKBinary')).toBe(
      'https://github.com/ezoic/ezoic-swift-sdk-dist/releases/download/1.22.0/EzoicCmpSDK-1.22.0-cocoapods.xcframework.zip'
    );
  });

  it('reads both framework pins of the ads package', () => {
    const pins = readPins(root);
    expect(pins.frameworks.map((f: { name: string }) => f.name)).toEqual([
      'EzoicAdsSDKBinary',
      'EzoicCmpSDKBinary',
    ]);
  });
});
