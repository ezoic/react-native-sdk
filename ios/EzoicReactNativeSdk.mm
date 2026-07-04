#import "EzoicReactNativeSdk.h"
#import <EzoicReactNativeSdk/EzoicReactNativeSdk-Swift.h>

static NSString *const kEzoicRewardedEvent = @"EzoicRewardedAdEvent";
static NSString *const kEzoicInterstitialEvent = @"EzoicInterstitialAdEvent";

@implementation EzoicReactNativeSdk {
  EzoicAdsImpl *_impl;
  BOOL _hasListeners;
}

- (instancetype)init {
  if (self = [super init]) {
    _impl = [EzoicAdsImpl new];
    __weak __typeof(self) weakSelf = self;
    // The Swift impl invokes this for every rewarded lifecycle signal; forward
    // to JS through RCTEventEmitter (guarded by an active-listener check so we
    // don't log the "no listeners" warning when nothing is subscribed).
    _impl.eventEmitter = ^(NSString *name, NSDictionary *body) {
      __typeof(self) strongSelf = weakSelf;
      if (strongSelf != nil && strongSelf->_hasListeners) {
        [strongSelf sendEventWithName:name body:body];
      }
    };
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ kEzoicRewardedEvent, kEzoicInterstitialEvent ];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
}

- (void)invalidate {
  [_impl invalidate];
  [super invalidate];
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

- (void)loadRewardedAd:(NSString *)adUnitIdentifier
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
  [_impl loadRewardedAd:adUnitIdentifier
                resolve:^(id _Nullable v) { resolve(v); }
                 reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)showRewardedAd:(NSString *)adUnitIdentifier
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
  [_impl showRewardedAd:adUnitIdentifier
                resolve:^(id _Nullable v) { resolve(v); }
                 reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)loadInterstitialAd:(NSString *)adUnitIdentifier
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject {
  [_impl loadInterstitialAd:adUnitIdentifier
                    resolve:^(id _Nullable v) { resolve(v); }
                     reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)showInterstitialAd:(NSString *)adUnitIdentifier
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject {
  [_impl showInterstitialAd:adUnitIdentifier
                    resolve:^(id _Nullable v) { resolve(v); }
                     reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)loadInstreamAd:(double)adUnitIdentifier
            contentUrl:(NSString *)contentUrl
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
  [_impl loadInstreamAd:adUnitIdentifier
             contentUrl:contentUrl
                resolve:^(id _Nullable v) { resolve(v); }
                 reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)getInstreamNextAdTagUrl:(double)adUnitIdentifier
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject {
  [_impl getInstreamNextAdTagUrl:adUnitIdentifier
                         resolve:^(id _Nullable v) { resolve(v); }
                          reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)reportInstreamImpression:(double)adUnitIdentifier
                      revenueUsd:(NSNumber *)revenueUsd
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject {
  [_impl reportInstreamImpression:adUnitIdentifier
                       revenueUsd:revenueUsd
                          resolve:^(id _Nullable v) { resolve(v); }
                           reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (void)destroyInstreamAd:(double)adUnitIdentifier
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
  [_impl destroyInstreamAd:adUnitIdentifier
                   resolve:^(id _Nullable v) { resolve(v); }
                    reject:^(NSString *code, NSString *msg, NSError *_Nullable e) { reject(code, msg, e); }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeEzoicAdsSpecJSI>(params);
}

+ (NSString *)moduleName {
  return @"EzoicReactNativeSdk";
}

@end
