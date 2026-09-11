import { describe, expect, it, jest, beforeEach } from '@jest/globals';

// Persist collapsed state across re-invocations of the function component so
// we can fire `onSizeChange` and inspect the next render without a renderer.
const mockCollapse = { value: false, inited: false };

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: (init: boolean) => {
      if (!mockCollapse.inited) {
        mockCollapse.value = init;
        mockCollapse.inited = true;
      }
      return [
        mockCollapse.value,
        (next: boolean | ((prev: boolean) => boolean)) => {
          mockCollapse.value =
            typeof next === 'function' ? next(mockCollapse.value) : next;
        },
      ];
    },
  };
});

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

beforeEach(() => {
  mockCollapse.value = false;
  mockCollapse.inited = false;
});

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

describe('EzoicOutstreamAdView collapse', () => {
  it('passes collapseOnNoFill true to the native component by default', () => {
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1' });
    expect(el.props.collapseOnNoFill).toBe(true);
  });

  it('unwraps nativeEvent for onSizeChange and forwards the payload', () => {
    const onSizeChange = jest.fn();
    const el = EzoicOutstreamAdView({ adUnitIdentifier: '1', onSizeChange });
    el.props.onSizeChange({ nativeEvent: { width: 320, height: 180 } });
    expect(onSizeChange).toHaveBeenCalledWith({ width: 320, height: 180 });
  });

  it('sets style height 0 after a {height: 0} size event and restores after a non-zero size', () => {
    const style = { width: 320, height: 250 };
    let el = EzoicOutstreamAdView({ adUnitIdentifier: '1', style });
    el.props.onSizeChange({ nativeEvent: { width: 0, height: 0 } });
    el = EzoicOutstreamAdView({ adUnitIdentifier: '1', style });
    expect(el.props.style).toEqual([style, { height: 0 }]);

    el.props.onSizeChange({ nativeEvent: { width: 320, height: 180 } });
    el = EzoicOutstreamAdView({ adUnitIdentifier: '1', style });
    expect(el.props.style).toEqual(style);
  });

  it('does not collapse style when collapseOnNoFill={false}', () => {
    const style = { width: 320, height: 250 };
    let el = EzoicOutstreamAdView({
      adUnitIdentifier: '1',
      style,
      collapseOnNoFill: false,
    });
    el.props.onSizeChange({ nativeEvent: { width: 0, height: 0 } });
    el = EzoicOutstreamAdView({
      adUnitIdentifier: '1',
      style,
      collapseOnNoFill: false,
    });
    expect(el.props.style).toEqual(style);
    expect(el.props.collapseOnNoFill).toBe(false);
  });
});
