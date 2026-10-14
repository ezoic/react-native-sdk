import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// RN's iOS codegen only lists a library's Fabric views in
// RCTThirdPartyComponentsProvider when codegenConfig.ios.componentProvider maps
// each codegen component name to its ObjC class. A missing entry renders the
// view as Unimplemented on iOS.

const root = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

const componentNames = readdirSync(join(root, 'src'))
  .filter((file) => file.endsWith('NativeComponent.ts'))
  .flatMap((file) =>
    [
      ...read('src', file).matchAll(/codegenNativeComponent<\w+>\(\s*'(\w+)'/g),
    ].map((match) => match[1] ?? '')
  );

const componentViewClasses = readdirSync(join(root, 'ios'))
  .filter((file) => file.endsWith('.mm'))
  .flatMap((file) =>
    [
      ...read('ios', file).matchAll(
        /@interface (\w+) : RCTViewComponentView\b/g
      ),
    ].map((match) => match[1] ?? '')
  );

const componentProvider: Record<string, string> =
  JSON.parse(read('package.json')).codegenConfig?.ios?.componentProvider ?? {};

describe('codegenConfig.ios.componentProvider', () => {
  it('finds the Fabric components to check', () => {
    expect(componentNames).toEqual([
      'EzoicBannerView',
      'EzoicNativeAdView',
      'EzoicOutstreamAdView',
    ]);
  });

  it.each(componentNames)(
    'maps %s to its RCTViewComponentView class',
    (name) => {
      expect(componentViewClasses).toContain(componentProvider[name]);
    }
  );
});
