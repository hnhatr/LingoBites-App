import AsyncStorage from '@react-native-async-storage/async-storage';

export const REVIEW_SYSTEM_STORAGE_KEY = 'review_system_enabled';

export async function saveReviewSystemEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_SYSTEM_STORAGE_KEY, String(enabled));
  } catch {
    // Persistence is best-effort; failing to save must not crash the app.
  }
}

export async function getReviewSystemEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REVIEW_SYSTEM_STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}
