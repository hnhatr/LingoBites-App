import * as Keychain from 'react-native-keychain';

const SERVICE_PREFIX = 'com.lingobites.lesson-v2.';
const KEYCHAIN_USERNAME = 'capability-token';

export type LessonTokenResult =
  | {ok: true; token: string | null}
  | {ok: false; errorCode: 'KEYCHAIN_ERROR'; error: unknown};

function serviceFor(lessonId: string): string {
  return `${SERVICE_PREFIX}${lessonId}`;
}

export async function saveLessonToken(
  lessonId: string,
  token: string,
): Promise<LessonTokenResult> {
  try {
    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, {
      service: serviceFor(lessonId),
    });
    return {ok: true, token: null};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

export async function getLessonToken(
  lessonId: string,
): Promise<LessonTokenResult> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: serviceFor(lessonId),
    });
    return {
      ok: true,
      token: credentials === false ? null : credentials.password,
    };
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

export async function deleteLessonToken(
  lessonId: string,
): Promise<
  {ok: true} | {ok: false; errorCode: 'KEYCHAIN_ERROR'; error: unknown}
> {
  try {
    await Keychain.resetGenericPassword({service: serviceFor(lessonId)});
    return {ok: true};
  } catch (error) {
    return {ok: false, errorCode: 'KEYCHAIN_ERROR', error};
  }
}

export async function clearLessonTokens(lessonIds: string[]): Promise<void> {
  await Promise.all(lessonIds.map(lessonId => deleteLessonToken(lessonId)));
}
