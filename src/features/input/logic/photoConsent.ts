import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';

/**
 * E3 (P8): a photo goes to the server (text reading and safety check) and,
 * for "Tả" or "Dùng", to an AI provider. The learner confirms once, and can
 * withdraw in Settings. Versioned so a changed notice asks again.
 */
export const PHOTO_CONSENT_KEY = 'photo_upload_consent_v1';

export type PhotoConsentCopy = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
};

export async function hasAcceptedPhotoConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PHOTO_CONSENT_KEY)) === '1';
  } catch {
    // Fail closed: ask again rather than assume consent.
    return false;
  }
}

export async function withdrawPhotoConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PHOTO_CONSENT_KEY);
  } catch {
    // Best-effort; the next photo asks again only if the key is gone.
  }
}

/** Resolves true when the learner has consented (now or before). */
export async function ensurePhotoConsent(
  copy: PhotoConsentCopy,
): Promise<boolean> {
  if (await hasAcceptedPhotoConsent()) return true;
  const accepted = await new Promise<boolean>(resolve => {
    Alert.alert(
      copy.title,
      copy.body,
      [
        {
          text: copy.cancelLabel,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {text: copy.confirmLabel, onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    );
  });
  if (accepted) {
    try {
      await AsyncStorage.setItem(PHOTO_CONSENT_KEY, '1');
    } catch {
      // The next photo asks again.
    }
  }
  return accepted;
}
