// Links the built-in Ezoic CMP into the app.
//
// The ads binary finds the built-in CMP at runtime by its Objective-C class
// name (`EZBuiltInCmpProvider`) and never references it, so on its own the
// static linker would leave every CMP object file out of the app. This
// reference to the provider class makes the linker load it (and everything it
// uses); the Objective-C class list then keeps it alive under dead stripping.
//
// EZOIC_INCLUDE_CMP is set by EzoicReactNativeSdk.podspec unless the app's
// package.json has `"ezoic": { "includeCmp": false }`, in which case the pod
// vendors no EzoicCmpSDKBinary and this file compiles to nothing.
#if EZOIC_INCLUDE_CMP
@_spi(EzoicInternal) import EzoicCmpSDKBinary

/// Not API: referenced (from `EzoicAdsImpl.init`) only to link the built-in CMP.
let ezoicBuiltInCmpProviderClass: AnyClass = BuiltInCmpProvider.self
#endif
