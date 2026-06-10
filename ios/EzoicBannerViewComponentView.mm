#import <React/RCTViewComponentView.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/ComponentDescriptors.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/EventEmitters.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/Props.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/RCTComponentViewHelpers.h>
#import <EzoicReactNativeSdk/EzoicReactNativeSdk-Swift.h>

using namespace facebook::react;

@interface EzoicBannerView : RCTViewComponentView <EzoicBannerHostViewDelegate>
@end

@implementation EzoicBannerView {
  EzoicBannerHostView *_host;
  NSString *_lastAdUnit;
  NSString *_lastSize;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<EzoicBannerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _host = [EzoicBannerHostView new];
    _host.hostDelegate = self;
    self.contentView = _host;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &newProps = *std::static_pointer_cast<EzoicBannerViewProps const>(props);
  NSString *adUnit = [NSString stringWithUTF8String:newProps.adUnitIdentifier.c_str()];
  NSString *size = [NSString stringWithUTF8String:newProps.size.c_str()];
  if (![adUnit isEqualToString:_lastAdUnit] || ![size isEqualToString:_lastSize]) {
    _lastAdUnit = adUnit;
    _lastSize = size;
    [_host configureWithAdUnitIdentifier:adUnit size:size];
  }
  [super updateProps:props oldProps:oldProps];
}

- (void)bannerDidLoad {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onLoad({});
}
- (void)bannerDidFail:(NSString *)message code:(NSInteger)code {
  if (_eventEmitter)
    std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)
      ->onError({.message = std::string([message UTF8String]), .code = (int)code});
}
- (void)bannerDidRecordImpression {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onImpression({});
}
- (void)bannerDidRecordClick {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onAdClick({});
}
- (void)bannerWillPresentScreen {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onOpen({});
}
- (void)bannerDidDismissScreen {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onClose({});
}

Class<RCTComponentViewProtocol> EzoicBannerViewCls(void) { return EzoicBannerView.class; }

@end
