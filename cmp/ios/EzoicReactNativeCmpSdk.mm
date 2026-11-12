#import "EzoicReactNativeCmpSdk.h"
#if __has_include(<EzoicReactNativeCmpSdk/EzoicReactNativeCmpSdk-Swift.h>)
#import <EzoicReactNativeCmpSdk/EzoicReactNativeCmpSdk-Swift.h>
#else
#import "EzoicReactNativeCmpSdk-Swift.h"
#endif
#import <React/RCTUtils.h>

@implementation EzoicReactNativeCmpSdk {
  EzoicCmpImpl *_impl;
}

- (instancetype)init {
  if (self = [super init]) {
    _impl = [EzoicCmpImpl new];
    _impl.hostViewControllerProvider = ^UIViewController *_Nullable {
      return RCTPresentedViewController();
    };
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (void)initialize:(NSString *)domain config:(JS::NativeEzoicCmp::EzoicCmpConfig &)config {
  NSMutableDictionary *dict = [NSMutableDictionary new];
  if (config.cmpEnabled().has_value()) dict[@"cmpEnabled"] = @(config.cmpEnabled().value());
  if (config.autoReadConsent().has_value()) dict[@"autoReadConsent"] = @(config.autoReadConsent().value());
  if (config.debugEnabled().has_value()) dict[@"debugEnabled"] = @(config.debugEnabled().value());
  [_impl initialize:domain config:dict];
}

- (void)presentConsentIfRequired:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl presentConsentIfRequired:^(id _Nullable v) { resolve(v); }];
}

- (void)presentConsentSettings:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl presentConsentSettings:^(id _Nullable v) { resolve(v); }];
}

- (void)isConsentRequired:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl isConsentRequired:^(id _Nullable v) { resolve(v); }];
}

- (void)isPrivacyOptionsRequired:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl isPrivacyOptionsRequired:^(id _Nullable v) { resolve(v); }];
}

- (void)resetConsent {
  [_impl resetConsent];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeEzoicCmpSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"EzoicReactNativeCmpSdk";
}

@end
