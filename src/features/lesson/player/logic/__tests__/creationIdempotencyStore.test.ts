import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearCreationIdempotencyKey,
  contentKeyForBody,
  getOrCreateCreationIdempotencyKey,
  resetCreationIdempotencyMemoryForTests,
  rotateCreationIdempotencyKey,
} from '../creationIdempotencyStore';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const URL_A = 'youtube:https://youtube.com/watch?v=a';
const URL_B = 'youtube:https://youtube.com/watch?v=b';

beforeEach(async () => {
  resetCreationIdempotencyMemoryForTests();
  await AsyncStorage.clear();
});

describe('creation idempotency store (INV-001 / INV-002)', () => {
  it('reuses the same key for the same submission and content key', async () => {
    const first = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    const second = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toBe(first);
  });

  it('mints distinct keys per submission', async () => {
    const first = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    const second = await getOrCreateCreationIdempotencyKey('draft-2', URL_A);
    expect(first).not.toBe(second);
  });

  it('mints a new key when the trimmed content changes (INV-001)', async () => {
    const forA = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    const forB = await getOrCreateCreationIdempotencyKey('draft-1', URL_B);
    expect(forB).not.toBe(forA);
  });

  it('rotates the key only for an explicit retry after failure', async () => {
    const before = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    const rotated = await rotateCreationIdempotencyKey('draft-1', URL_A);
    expect(rotated).not.toBe(before);
    expect(await getOrCreateCreationIdempotencyKey('draft-1', URL_A)).toBe(
      rotated,
    );
  });

  it('forgets the key once the submission reaches a terminal state', async () => {
    const before = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    await clearCreationIdempotencyKey('draft-1');
    const after = await getOrCreateCreationIdempotencyKey('draft-1', URL_A);
    expect(after).not.toBe(before);
  });

  it('keeps an in-memory key when persistence fails (INV-001 c)', async () => {
    const originalSetItem = AsyncStorage.setItem;
    const spy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (String(key).startsWith('lesson-creation-idempotency:')) {
          return Promise.reject(new Error('disk full'));
        }
        return originalSetItem(key, value);
      });
    const forA = await getOrCreateCreationIdempotencyKey('draft-c', URL_A);
    const forB = await getOrCreateCreationIdempotencyKey('draft-c', URL_B);
    expect(forB).not.toBe(forA);
    spy.mockRestore();
  });

  it('derives content keys from trimmed YouTube URLs', () => {
    expect(
      contentKeyForBody({
        source: 'youtube',
        url: ' https://youtube.com/watch?v=x ',
      }),
    ).toBe('youtube:https://youtube.com/watch?v=x');
  });
});
