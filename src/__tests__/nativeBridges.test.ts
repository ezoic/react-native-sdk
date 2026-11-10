import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
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
    kotlinCode:
      /\(this as\? EzoicError\)\?\.code \?: \(this as\? CmpError\)\?\.code \?: UNKNOWN_ERROR_CODE/,
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
