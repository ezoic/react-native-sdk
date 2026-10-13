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
  BOOL _loadStarted;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<EzoicBannerViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    [self installFreshHost];
  }
  return self;
}

// The host loads exactly once; a new ad unit/size or a recycled component view
// gets a fresh host. Nil the abandoned host's delegate first: a late lifecycle
// callback from it would otherwise emit a Fabric event for the wrong ad.
- (void)installFreshHost {
  _host.hostDelegate = nil;
  [_host removeFromSuperview];
  _host = [EzoicBannerHostView new];
  _host.hostDelegate = self;
  self.contentView = _host;
  _loadStarted = NO;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &newProps = *std::static_pointer_cast<EzoicBannerViewProps const>(props);
  NSString *adUnit = [NSString stringWithUTF8String:newProps.adUnitIdentifier.c_str()];
  NSString *size = [NSString stringWithUTF8String:newProps.size.c_str()];
  if (![adUnit isEqualToString:_lastAdUnit] || ![size isEqualToString:_lastSize]) {
    // Ad unit or size changed after a load already started: swap in a fresh
    // host and reset the load guard so finalizeUpdates starts a new load.
    if (_loadStarted) [self installFreshHost];
    _lastAdUnit = adUnit;
    _lastSize = size;
    [_host configureWithAdUnitIdentifier:adUnit size:size];
  }
  _host.collapseOnNoFill = newProps.collapseOnNoFill;
  [super updateProps:props oldProps:oldProps];
}

// RCTMountingManager mounts on Insert as updateProps → updateEventEmitter →
// finalizeUpdates. Starting the load here (not in updateProps) guarantees the
// event emitter is attached before the native SDK can fail synchronously and
// emit onError, which would otherwise be dropped while _eventEmitter is nil.
- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask {
  [super finalizeUpdates:updateMask];
  if (!_loadStarted && _lastAdUnit.length > 0) {
    _loadStarted = YES;
    [_host startLoad];
  }
}

// Fabric recycles component views: without this a reused view that receives
// the same adUnitIdentifier/size as its previous tenant never reconfigures,
// so nothing loads and no callback fires.
- (void)prepareForRecycle {
  [self installFreshHost];
  _lastAdUnit = nil;
  _lastSize = nil;
  [super prepareForRecycle];
}

- (void)bannerDidLoad {
  if (_eventEmitter) std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)->onLoad({});
}
- (void)bannerDidFail:(NSString *)message code:(NSInteger)code {
  if (_eventEmitter)
    std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)
      ->onError({.message = std::string([message UTF8String]), .code = (int)code});
}
- (void)bannerDidChangeSize:(double)width height:(double)height {
  if (_eventEmitter)
    std::static_pointer_cast<EzoicBannerViewEventEmitter const>(_eventEmitter)
      ->onSizeChange({.width = width, .height = height});
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
