import { describe, expect, it, jest } from '@jest/globals';

// The Fabric component has no renderer in the node test env, so mock
// react-native: `codegenNativeComponent` returns the component name (a stable
// element type), and the TurboModule / event-emitter machinery imported
// transitively by `../index` is stubbed so the module can load.
jest.mock('react-native', () => ({
  __esModule: true,
  codegenNativeComponent: (name: string) => name,
  TurboModuleRegistry: {
    getEnforcing: () => ({}),
  },
  NativeEventEmitter: class {
    addListener() {
      return { remove: () => {} };
    }
  },
}));

import { EzoicOutstreamAdView } from '../index';

// The public wrapper is a function component; invoke it directly and inspect
// the element it returns for the native component (prop mapping, id coercion),
// which is the whole contract this wrapper adds over the codegen component.
describe('EzoicOutstreamAdView id coercion', () => {
  it('coerces a numeric id to a string', () => {
    const el = EzoicOutstreamAdView({ adUnitIdentifier: 12345 });
    expect(el.props.adUnitIdentifier).toBe('12345');
  });

  it('passes a string id through unchanged', () => {
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '678' });
    expect(el.props.adUnitIdentifier).toBe('678');
  });
});

describe('EzoicOutstreamAdView click mapping', () => {
  it('maps the user-facing onClick onto the native onAdClick prop', () => {
    const onClick = jest.fn();
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1', onClick });
    // onClick is reserved by core ViewProps, so it must not be forwarded.
    expect(el.props.onClick).toBeUndefined();
    expect(typeof el.props.onAdClick).toBe('function');
    el.props.onAdClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('EzoicOutstreamAdView event unwrapping', () => {
  it('unwraps nativeEvent for onError and forwards the payload', () => {
    const onError = jest.fn();
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1', onError });
    el.props.onError({ nativeEvent: { message: 'boom', code: 3 } });
    expect(onError).toHaveBeenCalledWith({ message: 'boom', code: 3 });
  });

  it('invokes the payload-less callbacks (load/impression/open/close)', () => {
    const onLoad = jest.fn();
    const onImpression = jest.fn();
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const el = EzoicOutstreamAdView({
      adUnitIdentifier: '1',
      onLoad,
      onImpression,
      onOpen,
      onClose,
    });
    el.props.onLoad();
    el.props.onImpression();
    el.props.onOpen();
    el.props.onClose();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('EzoicOutstreamAdView missing handlers', () => {
  it('leaves unset handlers undefined and does not throw', () => {
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1' });
    expect(el.props.onLoad).toBeUndefined();
    expect(el.props.onError).toBeUndefined();
    expect(el.props.onImpression).toBeUndefined();
    expect(el.props.onAdClick).toBeUndefined();
    expect(el.props.onOpen).toBeUndefined();
    expect(el.props.onClose).toBeUndefined();
  });

  it('forwards style through the rest props', () => {
    const style = { width: 320, height: 250 };
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1', style });
    expect(el.props.style).toEqual(style);
  });
});
