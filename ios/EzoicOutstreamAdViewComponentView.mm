#import <React/RCTViewComponentView.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/ComponentDescriptors.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/EventEmitters.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/Props.h>
#import <react/renderer/components/EzoicReactNativeSdkSpec/RCTComponentViewHelpers.h>
#import <EzoicReactNativeSdk/EzoicReactNativeSdk-Swift.h>

using namespace facebook::react;

@interface EzoicOutstreamAdView : RCTViewComponentView <EzoicOutstreamAdHostViewDelegate>
@end

@implementation EzoicOutstreamAdView {
  EzoicOutstreamAdHostView *_host;
  NSString *_lastAdUnit;
  BOOL _loadStarted;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<EzoicOutstreamAdViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _host = [EzoicOutstreamAdHostView new];
    _host.hostDelegate = self;
    self.contentView = _host;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &newProps = *std::static_pointer_cast<EzoicOutstreamAdViewProps const>(props);
  NSString *adUnit = [NSString stringWithUTF8String:newProps.adUnitIdentifier.c_str()];
  if (![adUnit isEqualToString:_lastAdUnit]) {
    // Ad unit changed after a load already started: swap in a fresh host
    // (mirrors prepareForRecycle) and reset the load guard so finalizeUpdates
    // starts a new load for the new id.
    if (_loadStarted) {
      // Nil the abandoned host's delegate first: a late lifecycle callback from
      // it would otherwise emit a Fabric event for the wrong ad unit.
      _host.hostDelegate = nil;
      [_host removeFromSuperview];
      _host = [EzoicOutstreamAdHostView new];
      _host.hostDelegate = self;
      self.contentView = _host;
      _loadStarted = NO;
    }
    _lastAdUnit = adUnit;
    [_host configureWithAdUnitIdentifier:adUnit];
  }
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

- (void)outstreamAdDidLoad {
  if (_eventEmitter) std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)->onLoad({});
}
- (void)outstreamAdDidFail:(NSString *)message code:(NSInteger)code {
  if (_eventEmitter)
    std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)
      ->onError({.message = std::string([message UTF8String]), .code = (int)code});
}
- (void)outstreamAdDidRecordImpression {
  if (_eventEmitter) std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)->onImpression({});
}
- (void)outstreamAdDidRecordClick {
  if (_eventEmitter) std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)->onAdClick({});
}
- (void)outstreamAdWillPresentScreen {
  if (_eventEmitter) std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)->onOpen({});
}
- (void)outstreamAdDidDismissScreen {
  if (_eventEmitter) std::static_pointer_cast<EzoicOutstreamAdViewEventEmitter const>(_eventEmitter)->onClose({});
}

- (void)prepareForRecycle {
  // Recycled views are reused for a new ad unit; rebuild the host (which owns
  // the native EzoicOutstreamAdView, destroyed on deinit) and reset the guards.
  // Nil the delegate first: a late lifecycle callback from the abandoned host
  // would otherwise emit a Fabric event for the wrong ad unit.
  _host.hostDelegate = nil;
  [_host removeFromSuperview];
  _host = [EzoicOutstreamAdHostView new];
  _host.hostDelegate = self;
  self.contentView = _host;
  _lastAdUnit = nil;
  _loadStarted = NO;
  [super prepareForRecycle];
}

Class<RCTComponentViewProtocol> EzoicOutstreamAdViewCls(void) { return EzoicOutstreamAdView.class; }

@end
