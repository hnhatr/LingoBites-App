import AsyncStorage from '@react-native-async-storage/async-storage';

export const FLASHCARD_DISCLOSURE_STORAGE_KEY =
  'flashcard_first_save_disclosure_acknowledged';

export async function saveFlashcardDisclosureAcknowledged(): Promise<void> {
  try {
    await AsyncStorage.setItem(FLASHCARD_DISCLOSURE_STORAGE_KEY, 'true');
  } catch {
    // Persistence is best-effort; failing to save must not crash the app.
  }
}

export async function getFlashcardDisclosureAcknowledged(): Promise<boolean> {
  try {
    return (
      (await AsyncStorage.getItem(FLASHCARD_DISCLOSURE_STORAGE_KEY)) === 'true'
    );
  } catch {
    return false;
  }
}
