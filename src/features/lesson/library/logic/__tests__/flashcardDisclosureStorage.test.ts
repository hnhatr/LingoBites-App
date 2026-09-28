import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FLASHCARD_DISCLOSURE_STORAGE_KEY,
  getFlashcardDisclosureAcknowledged,
  saveFlashcardDisclosureAcknowledged,
} from '../flashcardDisclosureStorage';

describe('flashcardDisclosureStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns false before the first acknowledgement is saved', async () => {
    expect(await getFlashcardDisclosureAcknowledged()).toBe(false);
  });

  it('persists and reads back the acknowledgement flag', async () => {
    await saveFlashcardDisclosureAcknowledged();

    expect(await getFlashcardDisclosureAcknowledged()).toBe(true);
    expect(await AsyncStorage.getItem(FLASHCARD_DISCLOSURE_STORAGE_KEY)).toBe(
      'true',
    );
  });

  it('returns false if AsyncStorage throws', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));

    expect(await getFlashcardDisclosureAcknowledged()).toBe(false);

    spy.mockRestore();
  });
});
