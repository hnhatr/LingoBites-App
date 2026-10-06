package com.lingobites

import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Platform device-identifier adapter (SETE-303 / T6).
 *
 * Exposes `Settings.Secure.ANDROID_ID` to JS. The value is returned raw and
 * unvalidated: JS canonicalizes it (16 lowercase hex) and falls back to a
 * validated random UUID when it is missing or malformed. Resolving `null`
 * (not rejecting) keeps a missing identifier on the normal fallback path;
 * rejection is reserved for an unexpected read failure.
 */
class DeviceIdentityModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = MODULE_NAME

  @ReactMethod
  fun getAndroidId(promise: Promise) {
    try {
      val androidId =
        Settings.Secure.getString(
          reactApplicationContext.contentResolver,
          Settings.Secure.ANDROID_ID,
        )
      promise.resolve(androidId)
    } catch (error: Exception) {
      promise.reject(ERROR_CODE, "Unable to read ANDROID_ID.", error)
    }
  }

  companion object {
    const val MODULE_NAME = "DeviceIdentity"
    const val ERROR_CODE = "E_DEVICE_ID"
  }
}
