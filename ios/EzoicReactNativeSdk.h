#import <EzoicReactNativeSdkSpec/EzoicReactNativeSdkSpec.h>
#import <React/RCTEventEmitter.h>

// Subclasses RCTEventEmitter so the rewarded ad lifecycle can be surfaced to
// JS via NativeEventEmitter, while still vending the codegen'd TurboModule.
@interface EzoicReactNativeSdk : RCTEventEmitter <NativeEzoicAdsSpec>

@end
