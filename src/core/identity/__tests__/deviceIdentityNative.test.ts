import {Platform} from 'react-native';
import {readPlatformIdentifiers} from '../deviceIdentityNative';

describe('readPlatformIdentifiers (SETE-303 / T6)', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('reads ANDROID_ID on android', async () => {
    Platform.OS = 'android' as typeof Platform.OS;
    await expect(
      readPlatformIdentifiers({
        nativeModuleOverride: {
          getAndroidId: async () => 'a1b2c3d4e5f60718',
        },
      }),
    ).resolves.toEqual({
      androidId: 'a1b2c3d4e5f60718',
      identifierForVendor: null,
    });
  });

  it('reads IFV on ios', async () => {
    Platform.OS = 'ios' as typeof Platform.OS;
    await expect(
      readPlatformIdentifiers({
        nativeModuleOverride: {
          getIdentifierForVendor: async () =>
            '550e8400-e29b-41d4-a716-446655440000',
        },
      }),
    ).resolves.toEqual({
      androidId: null,
      identifierForVendor: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('resolves nulls when the native module is missing (fresh simulator)', async () => {
    Platform.OS = 'android' as typeof Platform.OS;
    await expect(
      readPlatformIdentifiers({nativeModuleOverride: null}),
    ).resolves.toEqual({androidId: null, identifierForVendor: null});
    Platform.OS = 'ios' as typeof Platform.OS;
    await expect(
      readPlatformIdentifiers({nativeModuleOverride: {}}),
    ).resolves.toEqual({androidId: null, identifierForVendor: null});
  });

  it('degrades a native read failure to nulls instead of throwing', async () => {
    Platform.OS = 'android' as typeof Platform.OS;
    await expect(
      readPlatformIdentifiers({
        nativeModuleOverride: {
          getAndroidId: async () => {
            throw new Error('E_DEVICE_ID');
          },
        },
      }),
    ).resolves.toEqual({androidId: null, identifierForVendor: null});
  });
});
