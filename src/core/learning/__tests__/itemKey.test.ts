import {
  grammarItemKey,
  normalizeItemKey,
  vocabularyItemKey,
  vocabularyKind,
} from '../itemKey';
// Byte-identical copy of the Server fixture: both sides must agree.
import fixture from './fixtures/learning-item-keys.json';

describe('learning item keys', () => {
  it('normalises exactly as the shared fixture says', () => {
    expect(fixture.revision).toBe('learning-items-r1');
    for (const {input, key} of fixture.cases) {
      expect(normalizeItemKey(input)).toBe(key);
    }
  });

  it('is idempotent', () => {
    for (const {input} of fixture.cases) {
      const once = normalizeItemKey(input);
      expect(normalizeItemKey(once)).toBe(once);
    }
  });

  it('treats whitespace as a phrase', () => {
    for (const {key, kind} of fixture.kinds) {
      expect(vocabularyKind(key)).toBe(kind);
    }
  });

  it('builds the kind-prefixed identity and drops unusable input', () => {
    expect(vocabularyItemKey('Coffee')).toBe('word:coffee');
    expect(vocabularyItemKey('  Wake   UP ')).toBe('phrase:wake up');
    expect(vocabularyItemKey('...')).toBeNull();
    expect(grammarItemKey('Present Simple.')).toBe('grammar:present simple');
    expect(grammarItemKey('   ')).toBeNull();
  });
});
