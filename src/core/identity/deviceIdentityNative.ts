import {NativeModules, Platform} from 'react-native';
import type {RawPlatformIdentifiers} from './deviceIdentifier';

type DeviceIdentityNativeModule = {
  getAndroidId?: () => Promise<string | null>;
  getIdentifierForVendor?: () => Promise<string | null>;
};

function nativeModule(): DeviceIdentityNativeModule | null {
  const module = (NativeModules as Record<string, unknown>).DeviceIdentity;
  if (!module || typeof module !== 'object') {
    return null;
  }
  return module as DeviceIdentityNativeModule;
}

export type ReadPlatformIdentifiersDeps = {
  /** Test seam: replaces the TurboModule/bridge lookup. */
  nativeModuleOverride?: DeviceIdentityNativeModule | null;
};

/**
 * Reads the raw platform device identifiers via the first-party native
 * adapter (SETE-303 / T6: `DeviceIdentityModule` on Android,
 * `DeviceIdentity` on iOS).
 *
 * Never throws for a missing module or a null identifier — both resolve to
 * null fields so the resolver takes the validated UUID fallback. Only an
 * actual native read failure rejects, and the bootstrap orchestrator treats
 * that as unavailable (fallback) rather than fatal, matching the
 * "graceful skip, create new" decision (OUT-3 revised).
 */
export async function readPlatformIdentifiers(
  deps: ReadPlatformIdentifiersDeps = {},
): Promise<RawPlatformIdentifiers> {
  const module =
    deps.nativeModuleOverride !== undefined
      ? deps.nativeModuleOverride
      : nativeModule();
  if (Platform.OS === 'android') {
    if (typeof module?.getAndroidId !== 'function') {
      return {androidId: null, identifierForVendor: null};
    }
    try {
      return {
        androidId: await module.getAndroidId(),
        identifierForVendor: null,
      };
    } catch {
      return {androidId: null, identifierForVendor: null};
    }
  }
  if (typeof module?.getIdentifierForVendor !== 'function') {
    return {androidId: null, identifierForVendor: null};
  }
  try {
    return {
      androidId: null,
      identifierForVendor: await module.getIdentifierForVendor(),
    };
  } catch {
    return {androidId: null, identifierForVendor: null};
  }
}
