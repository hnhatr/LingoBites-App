import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vocab path P5: the situations the learner bookmarked in the combo set-up
 * sheet. Kept on this device only; a new install starts with none.
 */
export const SITUATION_BOOKMARKS_KEY = 'combo_situation_bookmarks_v1';

export async function loadSituationBookmarks(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SITUATION_BOOKMARKS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((code): code is string => typeof code === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveSituationBookmarks(codes: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SITUATION_BOOKMARKS_KEY, JSON.stringify(codes));
  } catch {
    // Best-effort; a failed save only loses the bookmark on the next launch.
  }
}
