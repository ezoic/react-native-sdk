import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

// Both packages ship from one tag at one version, and the CMP framework the ads
// package bundles must be the one the CMP package bundles.

const root = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');
const ads = JSON.parse(read('package.json'));
const cmp = JSON.parse(read('cmp', 'package.json'));

const SHA256 = /^([0-9a-f]{64}|TODO-RELEASE)$/;

describe('package pins', () => {
  it('ships both packages at the same version', () => {
    expect(cmp.version).toBe(ads.version);
  });

  it('keeps package-lock.json at the package version', () => {
    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.version).toBe(ads.version);
    expect(lock.packages[''].version).toBe(ads.version);
  });

  it('bundles the native iOS SDK of the package version', () => {
    expect(ads.ezoic.iosSdk.version).toBe(ads.version);
    expect(cmp.ezoic.iosSdk.version).toBe(cmp.version);
  });

  it('bundles both frameworks in the ads package and only the CMP in the CMP package', () => {
    expect(Object.keys(ads.ezoic.iosSdk.sha256)).toEqual([
      'EzoicAdsSDKBinary',
      'EzoicCmpSDKBinary',
    ]);
    expect(Object.keys(cmp.ezoic.iosSdk.sha256)).toEqual(['EzoicCmpSDKBinary']);
  });

  it('pins every framework to a sha256 or the release placeholder', () => {
    for (const sha of [
      ...Object.values(ads.ezoic.iosSdk.sha256),
      ...Object.values(cmp.ezoic.iosSdk.sha256),
    ]) {
      expect(sha).toMatch(SHA256);
    }
  });

  it('pins the same CMP framework in both packages', () => {
    expect(cmp.ezoic.iosSdk.sha256.EzoicCmpSDKBinary).toBe(
      ads.ezoic.iosSdk.sha256.EzoicCmpSDKBinary
    );
  });

  it('pins the same native Android SDK version as the iOS one', () => {
    expect(read('android', 'build.gradle')).toContain(
      `"com.ezoic.sdk:ezoic-ads-sdk:${ads.ezoic.iosSdk.version}"`
    );
    expect(read('cmp', 'android', 'build.gradle')).toContain(
      `"com.ezoic.sdk:ezoic-cmp-sdk:${cmp.ezoic.iosSdk.version}"`
    );
  });
});

describe('CMP package copies', () => {
  it('keeps the consent outcome parser identical to the ads package', () => {
    expect(read('cmp', 'src', 'EzoicConsent.ts')).toBe(
      read('src', 'EzoicConsent.ts')
    );
  });

  it('ships the same LICENSE', () => {
    expect(read('cmp', 'LICENSE')).toBe(read('LICENSE'));
  });

  it('publishes from this repository', () => {
    expect(cmp.repository).toEqual({ ...ads.repository, directory: 'cmp' });
  });
});
