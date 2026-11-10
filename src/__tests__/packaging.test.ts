import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const ads = JSON.parse(read('package.json'));

const SHA256 = /^([0-9a-f]{64}|TODO-RELEASE)$/;

describe('package pins', () => {
  it('bundles the native iOS SDK of the package version', () => {
    expect(ads.ezoic.iosSdk.version).toBe(ads.version);
  });

  it('bundles both frameworks in the ads package', () => {
    expect(Object.keys(ads.ezoic.iosSdk.sha256)).toEqual([
      'EzoicAdsSDKBinary',
      'EzoicCmpSDKBinary',
    ]);
  });

  it('pins every framework to a sha256 or the release placeholder', () => {
    for (const sha of Object.values(ads.ezoic.iosSdk.sha256)) {
      expect(sha).toMatch(SHA256);
    }
  });

  it('pins the same native Android SDK version as the iOS one', () => {
    expect(read('android', 'build.gradle')).toContain(
      `"com.ezoic.sdk:ezoic-ads-sdk:${ads.ezoic.iosSdk.version}"`
    );
  });
});
