import * as Keychain from 'react-native-keychain';

/**
 * In-memory Keychain double for auth tests (SETE-303 / T6). Exercises the
 * real session-store logic (service naming, enumeration, pointer handling)
 * without native bindings.
 */
const keychain = Keychain as jest.Mocked<typeof Keychain>;

export const vault = new Map<string, {username: string; password: string}>();

export function installKeychainVault(): void {
  vault.clear();
  jest.clearAllMocks();
  keychain.setGenericPassword.mockImplementation(
    async (username, password, options) => {
      vault.set(options?.service ?? 'default', {username, password});
      return {service: options?.service ?? 'default', storage: 'mock' as never};
    },
  );
  keychain.getGenericPassword.mockImplementation(async options => {
    const service = options?.service ?? 'default';
    const found = vault.get(service);
    return found ? {...found, service, storage: 'mock' as never} : false;
  });
  keychain.resetGenericPassword.mockImplementation(async options => {
    vault.delete(options?.service ?? 'default');
    return true;
  });
  keychain.getAllGenericPasswordServices.mockImplementation(async () => [
    ...vault.keys(),
  ]);
}
