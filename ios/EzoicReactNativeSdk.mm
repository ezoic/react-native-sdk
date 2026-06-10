#import "EzoicReactNativeSdk.h"
#import <EzoicReactNativeSdk/EzoicReactNativeSdk-Swift.h>

@implementation EzoicReactNativeSdk {
  EzoicAdsImpl *_impl;
}

- (instancetype)init {
  if (self = [super init]) {
    _impl = [EzoicAdsImpl new];
  }
  return self;
}

- (void)initialize:(JS::NativeEzoicAds::EzoicConfig &)config
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  NSMutableDictionary *dict = [NSMutableDictionary new];
  dict[@"domain"] = config.domain();
  if (config.autoReadConsent().has_value()) dict[@"autoReadConsent"] = @(config.autoReadConsent().value());
  if (config.subjectToCOPPA().has_value()) dict[@"subjectToCOPPA"] = @(config.subjectToCOPPA().value());
  if (config.requestATTBeforeAds().has_value()) dict[@"requestATTBeforeAds"] = @(config.requestATTBeforeAds().value());
  if (config.debugEnabled().has_value()) dict[@"debugEnabled"] = @(config.debugEnabled().value());
  if (config.testMode().has_value()) dict[@"testMode"] = @(config.testMode().value());
  [_impl initialize:dict
            resolve:^(id _Nullable v) { resolve(v); }
             reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)setGDPRConsent:(BOOL)applies consentString:(NSString *)consentString {
  [_impl setGDPRConsent:applies consentString:consentString];
}

- (void)setGPPConsent:(NSString *)gppString sectionIds:(NSString *)sectionIds {
  [_impl setGPPConsent:gppString sectionIds:sectionIds];
}

- (void)setSubjectToCOPPA:(BOOL)value {
  [_impl setSubjectToCOPPA:value];
}

- (void)trackPageview:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  [_impl trackPageview:^(id _Nullable v) { resolve(v); }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeEzoicAdsSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"EzoicReactNativeSdk";
}

@end
