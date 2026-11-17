import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Codegen fails the Android build when a spec method is missing, but iOS only
// fails at runtime when JS calls it, so check both natives against the spec.
// Since 1.22.0, ConsentOutcome.Failed carries an Exception / Error, not an
// EzoicError: the bridges must read `code` through a cast and fall back.

const root = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

function specMethods(source: string): string[] {
  const body = source.match(
    /export interface Spec extends TurboModule \{([\s\S]*?)\n\}/
  );
  if (!body?.[1]) throw new Error('Spec interface not found');
  return [...body[1].matchAll(/^ {2}(\w+)\(/gm)].map((m) => m[1] ?? '');
}

// addListener/removeListeners come from RCTEventEmitter on iOS.
const EVENT_EMITTER = ['addListener', 'removeListeners'];

const bridges = [
  {
    name: '@ezoic/react-native-sdk',
    spec: ['src', 'NativeEzoicAds.ts'],
    kotlin: [
      'android',
      'src',
      'main',
      'java',
      'com',
      'ezoic',
      'reactnative',
      'EzoicAdsModule.kt',
    ],
    objc: ['ios', 'EzoicReactNativeSdk.mm'],
    swift: ['ios', 'EzoicAdsImpl.swift'],
    kotlinCode: /\(this as\? EzoicError\)\?\.code \?: UNKNOWN_ERROR_CODE/,
  },
  {
    name: '@ezoic/react-native-cmp-sdk',
    spec: ['cmp', 'src', 'NativeEzoicCmp.ts'],
    kotlin: [
      'cmp',
      'android',
      'src',
      'main',
      'java',
      'com',
      'ezoic',
      'reactnative',
      'cmp',
      'EzoicCmpModule.kt',
    ],
    objc: ['cmp', 'ios', 'EzoicReactNativeCmpSdk.mm'],
    swift: ['cmp', 'ios', 'EzoicCmpImpl.swift'],
    kotlinCode: /\(this as\? CmpError\)\?\.code \?: UNKNOWN_ERROR_CODE/,
  },
];

describe.each(bridges)('$name native bridge', (bridge) => {
  const methods = specMethods(read(...bridge.spec));

  it('finds the spec methods', () => {
    expect(methods).toContain('presentConsentSettings');
    expect(methods).toContain('isPrivacyOptionsRequired');
  });

  it.each(methods)('implements %s on Android', (method) => {
    expect(read(...bridge.kotlin)).toMatch(
      new RegExp(`override fun ${method}\\(`)
    );
  });

  it.each(methods.filter((m) => !EVENT_EMITTER.includes(m)))(
    'implements %s on iOS',
    (method) => {
      expect(read(...bridge.objc)).toMatch(
        new RegExp(`^- \\(void\\)${method}[:\\s]`, 'm')
      );
    }
  );

  it('reads the Failed code through a cast on Android', () => {
    const kotlin = read(...bridge.kotlin);
    expect(kotlin).toMatch(bridge.kotlinCode);
    expect(kotlin).toContain(
      'is ConsentOutcome.Failed -> consentFailureMap(error.consentErrorCode(),'
    );
  });

  it('reads the Failed code through a cast on iOS', () => {
    expect(read(...bridge.swift)).toMatch(
      /case \.failed\(let error\):\s+(\/\/[^\n]*\n\s+)?return consentFailure\(code: \(error as\? EzoicErrorCode\)\?\.code \?\? unknownErrorCode,/
    );
  });
});

// `"ezoic": { "includeCmp": false }` in the app's package.json removes the CMP
// (Android: ezoic-cmp-sdk excluded; iOS: no EzoicCmpSDKBinary, no
// EZOIC_INCLUDE_CMP), so the ads bridge must still compile without it.
describe('@ezoic/react-native-sdk without the built-in CMP', () => {
  const kotlinDir = [
    'android',
    'src',
    'main',
    'java',
    'com',
    'ezoic',
    'reactnative',
  ];
  const kotlinFiles = readdirSync(join(root, ...kotlinDir)).filter((f) =>
    f.endsWith('.kt')
  );
  const swiftFiles = readdirSync(join(root, 'ios')).filter((f) =>
    f.endsWith('.swift')
  );

  it.each(kotlinFiles)('%s references no CMP-only class', (file) => {
    const source = read(...kotlinDir, file);
    expect(source).not.toMatch(/\bCmpError\b/);
    expect(source).not.toMatch(/\bEzoicCmp(Configuration)?\b/);
  });

  it.each(swiftFiles)(
    '%s imports the CMP module only under EZOIC_INCLUDE_CMP',
    (file) => {
      let depth = 0;
      let guarded = 0;
      for (const line of read('ios', file).split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#if')) {
          depth++;
          if (trimmed === '#if EZOIC_INCLUDE_CMP') guarded = depth;
        } else if (trimmed.startsWith('#endif')) {
          if (guarded === depth) guarded = 0;
          depth--;
        } else if (/^(@_spi\(\w+\) )?import EzoicCmpSDKBinary$/.test(trimmed)) {
          expect(guarded).toBeGreaterThan(0);
        }
      }
    }
  );

  it('references the CMP provider when included, so a static link keeps it', () => {
    expect(read('ios', 'EzoicCmpLink.swift')).toMatch(
      /#if EZOIC_INCLUDE_CMP\n@_spi\(EzoicInternal\) import EzoicCmpSDKBinary\n[\s\S]*= BuiltInCmpProvider\.self\n#endif/
    );
    expect(read('ios', 'EzoicAdsImpl.swift')).toMatch(
      /#if EZOIC_INCLUDE_CMP\s+(\/\/[^\n]*\n\s+)*_ = ezoicBuiltInCmpProviderClass\s+#endif/
    );
  });

  it('sets EZOIC_INCLUDE_CMP and vendors the CMP only when included', () => {
    const podspec = read('EzoicReactNativeSdk.podspec');
    expect(podspec).toMatch(
      /include_cmp = ezoic_settings\["includeCmp"\] != false/
    );
    expect(podspec).toMatch(
      /if include_cmp\n\s+s\.pod_target_xcconfig = \{\n\s+"SWIFT_ACTIVE_COMPILATION_CONDITIONS" => "\$\(inherited\) EZOIC_INCLUDE_CMP"/
    );
    expect(podspec).toContain('[core_framework, ads_framework, cmp_framework]');
    expect(podspec).toContain('[core_framework, ads_framework]');
  });

  it('excludes ezoic-cmp-sdk on Android when the flag is false', () => {
    const gradle = read('android', 'build.gradle');
    expect(gradle).toContain(
      'new File(rootProject.projectDir, "../package.json")'
    );
    expect(gradle).toMatch(
      /implementation\("com\.ezoic\.sdk:ezoic-ads-sdk:[^"]+"\) \{\n\s+if \(!ezoicIncludeCmp\) \{\n\s+exclude group: "com\.ezoic\.sdk", module: "ezoic-cmp-sdk"/
    );
  });
});
