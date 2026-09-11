import { codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type LoadEvent = Readonly<{}>;
type ErrorEvent = Readonly<{ message: string; code: CodegenTypes.Int32 }>;
type SizeChangeEvent = Readonly<{
  width: CodegenTypes.Double;
  height: CodegenTypes.Double;
}>;

export interface NativeProps extends ViewProps {
  adUnitIdentifier: string;
  // Collapse the native view when a load fails and no ad is displayed.
  collapseOnNoFill?: CodegenTypes.WithDefault<boolean, true>;
  onLoad?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onError?: CodegenTypes.BubblingEventHandler<ErrorEvent> | null;
  // Displayed ad size changed (dp/pt): the creative size after a successful
  // load, or 0x0 when the native view collapses on a terminal no-fill.
  onSizeChange?: CodegenTypes.DirectEventHandler<SizeChangeEvent> | null;
  onImpression?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  // `onClick` is reserved by core ViewProps (a gesture handler), so the native
  // outstream-click event is exposed as `onAdClick`. The public
  // `EzoicOutstreamAdView` component maps the user-facing `onClick` prop onto
  // this.
  onAdClick?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onOpen?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onClose?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'EzoicOutstreamAdView'
) as HostComponent<NativeProps>;
