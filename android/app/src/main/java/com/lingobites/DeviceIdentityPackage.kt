package com.lingobites

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [DeviceIdentityModule] (SETE-303 / T6). This package has no views;
 * it only exposes the platform device identifier to the JS adapter.
 */
class DeviceIdentityPackage : ReactPackage {

  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> = listOf(DeviceIdentityModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
