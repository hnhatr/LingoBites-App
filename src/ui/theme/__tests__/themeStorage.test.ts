import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSavedThemeId, saveThemeId, THEME_STORAGE_KEY} from '../themeStorage';

describe('themeStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when nothing was saved', async () => {
    expect(await getSavedThemeId()).toBeNull();
  });

  it('persists and reads back the saved theme id', async () => {
    await saveThemeId('dark');
    expect(await getSavedThemeId()).toBe('dark');
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('returns null if AsyncStorage throws (corrupt/unavailable)', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));
    expect(await getSavedThemeId()).toBeNull();
    spy.mockRestore();
  });
});
