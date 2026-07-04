import { codegenNativeComponent } from 'react-native';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';

type LoadEvent = Readonly<{}>;
type ErrorEvent = Readonly<{ message: string; code: CodegenTypes.Int32 }>;

export interface NativeProps extends ViewProps {
  adUnitIdentifier: string;
  onLoad?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onError?: CodegenTypes.BubblingEventHandler<ErrorEvent> | null;
  onImpression?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  // `onClick` is reserved by core ViewProps (a gesture handler), so the native
  // native-ad-click event is exposed as `onAdClick`. The public
  // `EzoicNativeAdView` component maps the user-facing `onClick` prop onto this.
  onAdClick?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onOpen?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
  onClose?: CodegenTypes.BubblingEventHandler<LoadEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'EzoicNativeAdView'
) as HostComponent<NativeProps>;
