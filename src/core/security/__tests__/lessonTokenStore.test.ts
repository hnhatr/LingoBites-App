import * as Keychain from 'react-native-keychain';
import {
  deleteLessonToken,
  getLessonToken,
  saveLessonToken,
} from '../lessonTokenStore';

const keychain = Keychain as jest.Mocked<typeof Keychain>;

describe('lessonTokenStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores and reads a token through a lesson-scoped Keychain service', async () => {
    keychain.getGenericPassword.mockResolvedValue({
      username: 'capability-token',
      password: 'secret-token',
      service: 'mock',
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });

    await expect(saveLessonToken('lesson-1', 'secret-token')).resolves.toEqual({
      ok: true,
      token: null,
    });
    await expect(getLessonToken('lesson-1')).resolves.toEqual({
      ok: true,
      token: 'secret-token',
    });
    expect(keychain.setGenericPassword).toHaveBeenCalledWith(
      'capability-token',
      'secret-token',
      expect.objectContaining({service: 'com.lingobites.lesson-v2.lesson-1'}),
    );
    expect(keychain.getGenericPassword).toHaveBeenCalledWith({
      service: 'com.lingobites.lesson-v2.lesson-1',
    });
  });

  it('returns an explicit error when Keychain access fails', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce(new Error('denied'));

    await expect(getLessonToken('lesson-1')).resolves.toMatchObject({
      ok: false,
      errorCode: 'KEYCHAIN_ERROR',
    });
  });

  it('deletes only the lesson-scoped credential', async () => {
    await expect(deleteLessonToken('lesson-1')).resolves.toEqual({ok: true});
    expect(keychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'com.lingobites.lesson-v2.lesson-1',
    });
  });
});
