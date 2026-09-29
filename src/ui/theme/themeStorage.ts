import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ThemePreference} from './themeRegistry';

export const THEME_STORAGE_KEY = 'app_theme_id';

export async function saveThemeId(id: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Persistence is best-effort; failing to save must not crash the app.
  }
}

export async function getSavedThemeId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}
