import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';

export const YOUTUBE_DISCLOSURE_KEY = 'youtube_disclosure_ack_v1';

export type YouTubeDisclosureCopy = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
};

/**
 * First-submit privacy gate (SETE-283, HVB-08a): the transcript is sent to
 * the backend / AI providers for translation and IPA, so the user must
 * explicitly confirm once before the first request. Later submits skip.
 *
 * Fail-closed: when storage is unavailable the disclosure shows again
 * rather than silently assuming consent.
 */
export async function hasAcknowledgedYouTubeDisclosure(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function acknowledgeYouTubeDisclosure(): Promise<void> {
  try {
    await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
  } catch {
    // Best-effort: the next submit simply asks again.
  }
}

export async function ensureYouTubeDisclosureAcknowledged(
  copy: YouTubeDisclosureCopy,
): Promise<boolean> {
  if (await hasAcknowledgedYouTubeDisclosure()) {
    return true;
  }
  const confirmed = await new Promise<boolean>(resolve => {
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
  if (!confirmed) {
    return false;
  }
  await acknowledgeYouTubeDisclosure();
  return true;
}
