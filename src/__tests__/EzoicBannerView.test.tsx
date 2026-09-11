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

import { EzoicBannerView } from '../index';

beforeEach(() => {
  mockCollapse.value = false;
  mockCollapse.inited = false;
});

describe('EzoicBannerView defaults', () => {
  it('passes collapseOnNoFill true to the native component by default', () => {
    const el = EzoicBannerView({ adUnitIdentifier: '1' });
    expect(el.props.collapseOnNoFill).toBe(true);
  });

  it('forwards collapseOnNoFill={false} to the native component', () => {
    const el = EzoicBannerView({
      adUnitIdentifier: '1',
      collapseOnNoFill: false,
    });
    expect(el.props.collapseOnNoFill).toBe(false);
  });
});

describe('EzoicBannerView onSizeChange', () => {
  it('unwraps nativeEvent and forwards the payload', () => {
    const onSizeChange = jest.fn();
    const el = EzoicBannerView({ adUnitIdentifier: '1', onSizeChange });
    el.props.onSizeChange({ nativeEvent: { width: 300, height: 250 } });
    expect(onSizeChange).toHaveBeenCalledWith({ width: 300, height: 250 });
  });
});

describe('EzoicBannerView collapse style', () => {
  it('sets style height 0 after a {height: 0} size event and restores after a non-zero size', () => {
    const style = { width: 300, height: 250 };
    const onSizeChange = jest.fn();
    let el = EzoicBannerView({ adUnitIdentifier: '1', style, onSizeChange });
    expect(el.props.style).toEqual(style);

    el.props.onSizeChange({ nativeEvent: { width: 0, height: 0 } });
    expect(onSizeChange).toHaveBeenCalledWith({ width: 0, height: 0 });
    el = EzoicBannerView({ adUnitIdentifier: '1', style, onSizeChange });
    expect(el.props.style).toEqual([style, { height: 0 }]);

    el.props.onSizeChange({ nativeEvent: { width: 300, height: 250 } });
    el = EzoicBannerView({ adUnitIdentifier: '1', style, onSizeChange });
    expect(el.props.style).toEqual(style);
  });

  it('does not collapse style when collapseOnNoFill={false}', () => {
    const style = { width: 300, height: 250 };
    let el = EzoicBannerView({
      adUnitIdentifier: '1',
      style,
      collapseOnNoFill: false,
    });
    el.props.onSizeChange({ nativeEvent: { width: 0, height: 0 } });
    el = EzoicBannerView({
      adUnitIdentifier: '1',
      style,
      collapseOnNoFill: false,
    });
    expect(el.props.style).toEqual(style);
    expect(el.props.collapseOnNoFill).toBe(false);
  });
});
