import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearCreationIdempotencyKey,
  getOrCreateCreationIdempotencyKey,
  rotateCreationIdempotencyKey,
} from '../creationIdempotencyStore';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('creation idempotency store (INV-006)', () => {
  it('reuses the same key for the same submission across retries', async () => {
    const first = await getOrCreateCreationIdempotencyKey('draft-1');
    const second = await getOrCreateCreationIdempotencyKey('draft-1');
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toBe(first);
  });

  it('mints distinct keys per submission', async () => {
    const first = await getOrCreateCreationIdempotencyKey('draft-1');
    const second = await getOrCreateCreationIdempotencyKey('draft-2');
    expect(first).not.toBe(second);
  });

  it('rotates the key only for an explicit retry after failure', async () => {
    const before = await getOrCreateCreationIdempotencyKey('draft-1');
    const rotated = await rotateCreationIdempotencyKey('draft-1');
    expect(rotated).not.toBe(before);
    expect(await getOrCreateCreationIdempotencyKey('draft-1')).toBe(rotated);
  });

  it('forgets the key once the submission reaches a terminal state', async () => {
    const before = await getOrCreateCreationIdempotencyKey('draft-1');
    await clearCreationIdempotencyKey('draft-1');
    const after = await getOrCreateCreationIdempotencyKey('draft-1');
    expect(after).not.toBe(before);
  });
});
