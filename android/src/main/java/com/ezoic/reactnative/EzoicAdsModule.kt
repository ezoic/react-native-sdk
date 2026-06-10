package com.ezoic.reactnative

import com.facebook.react.bridge.ReactApplicationContext

class EzoicAdsModule(reactContext: ReactApplicationContext) :
  NativeEzoicAdsSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeEzoicAdsSpec.NAME
  }
}
