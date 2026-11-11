import { describe, expect, it } from '@jest/globals';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const {
  assetName,
  assetUrl,
  readPins,
  isCurrent,
  frameworkPaths,
  LOCAL,
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

  it('reads only the CMP framework pin of the CMP package', () => {
    const pins = readPins(join(root, 'cmp'));
    expect(pins.frameworks.map((f: { name: string }) => f.name)).toEqual([
      'EzoicCmpSDKBinary',
    ]);
  });

  describe('--check freshness', () => {
    const SHA = 'a'.repeat(64);
    const NAME = 'EzoicCmpSDKBinary';

    function extracted(stampSha256: string) {
      const dir = mkdtempSync(join(tmpdir(), 'fetch-ios-sdk-'));
      const paths = frameworkPaths(dir, NAME);
      for (const slice of ['ios-arm64', 'ios-arm64_x86_64-simulator']) {
        const fw = join(paths.framework, slice, `${NAME}.framework`);
        mkdirSync(fw, { recursive: true });
        writeFileSync(join(fw, NAME), '');
      }
      writeFileSync(join(paths.framework, 'Info.plist'), '');
      writeFileSync(
        paths.stamp,
        JSON.stringify({ version: '1.22.0', sha256: stampSha256 })
      );
      return paths;
    }

    it('accepts a framework extracted from the pinned release asset', () => {
      expect(isCurrent(extracted(SHA), '1.22.0', SHA)).toBe(true);
    });

    it('rejects a framework extracted from EZOIC_IOS_SDK_ZIP_DIR', () => {
      expect(isCurrent(extracted(LOCAL), '1.22.0', SHA)).toBe(false);
    });

    it('rejects another version', () => {
      expect(isCurrent(extracted(SHA), '1.23.0', SHA)).toBe(false);
    });
  });
});
