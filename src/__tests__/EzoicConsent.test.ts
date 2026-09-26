import { describe, expect, it } from '@jest/globals';
import { parseConsentOutcome } from '../EzoicConsent';

const UNRECOGNIZED = {
  type: 'failed',
  code: -1,
  message: 'Unrecognized outcome',
};

describe('parseConsentOutcome', () => {
  it.each(['notRequired', 'alreadyDecided', 'dismissed', 'alreadyPresenting'])(
    'parses %s',
    (type) => {
      expect(parseConsentOutcome({ type })).toEqual({ type });
    }
  );

  it.each(['acceptAll', 'rejectAll', 'custom'])(
    'parses decided/%s',
    (decision) => {
      expect(parseConsentOutcome({ type: 'decided', decision })).toEqual({
        type: 'decided',
        decision,
      });
    }
  );

  it('parses failed with code and message', () => {
    expect(
      parseConsentOutcome({
        type: 'failed',
        code: 1001,
        message: 'SDK not initialized',
      })
    ).toEqual({ type: 'failed', code: 1001, message: 'SDK not initialized' });
  });

  it('parses the wrapper-defined no-host failure', () => {
    expect(
      parseConsentOutcome({
        type: 'failed',
        code: -1,
        message: 'No foreground Activity',
      })
    ).toEqual({ type: 'failed', code: -1, message: 'No foreground Activity' });
  });

  it('drops extra keys', () => {
    expect(
      parseConsentOutcome({ type: 'dismissed', decision: 'acceptAll' })
    ).toEqual({ type: 'dismissed' });
  });

  it('fills defaults for a failed outcome missing code/message', () => {
    expect(parseConsentOutcome({ type: 'failed' })).toEqual({
      type: 'failed',
      code: -1,
      message: 'Unknown error',
    });
  });

  it('fills defaults for a failed outcome with non-number/non-string fields', () => {
    expect(
      parseConsentOutcome({ type: 'failed', code: '5001', message: 42 })
    ).toEqual({ type: 'failed', code: -1, message: 'Unknown error' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'decided'],
    ['a number', 5001],
    ['an array', []],
    ['an empty object', {}],
    ['an unknown type', { type: 'accepted' }],
    ['a non-string type', { type: 1 }],
    ['decided without a decision', { type: 'decided' }],
    ['decided with an unknown decision', { type: 'decided', decision: 'yes' }],
  ])('maps %s to failed(-1)', (_label, raw) => {
    expect(parseConsentOutcome(raw)).toEqual(UNRECOGNIZED);
  });
});
