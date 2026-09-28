import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getReviewSystemEnabled,
  REVIEW_SYSTEM_STORAGE_KEY,
  saveReviewSystemEnabled,
} from '../reviewSystemStorage';

describe('reviewSystemStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults the review system toggle to disabled', async () => {
    expect(await getReviewSystemEnabled()).toBe(false);
  });

  it('persists and reads the review system toggle', async () => {
    await saveReviewSystemEnabled(true);

    expect(await getReviewSystemEnabled()).toBe(true);
    expect(await AsyncStorage.getItem(REVIEW_SYSTEM_STORAGE_KEY)).toBe('true');
  });

  it('falls back to disabled if AsyncStorage throws', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));

    expect(await getReviewSystemEnabled()).toBe(false);
  });
});
