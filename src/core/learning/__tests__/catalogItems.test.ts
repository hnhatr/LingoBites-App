import fs from 'node:fs';
import path from 'node:path';

import {ItemKindValues} from '../catalogItem';
import {deriveItemCode, parseItemCode} from '../itemCode';
import {vocabularyItemKey} from '../itemKey';
import {parseItemPayload, payloadItemRefs} from '../itemPayload';
import {expandPattern, parseFrame, type PatternSlot} from '../patternFrame';

/**
 * The item helpers are copies of the Server's; these cases and the shared item
 * fixtures (`fixtures/items`, copied from the Server's `test/fixtures/items`)
 * keep both sides in agreement.
 */
type FixtureItem = {
  code: string;
  kind: (typeof ItemKindValues)[number];
  text: string;
  payload: Record<string, unknown>;
  preview: string[];
};

const dir = path.join(__dirname, 'fixtures', 'items');
const fixtures: FixtureItem[] = fs
  .readdirSync(dir)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));

describe('catalog item codes', () => {
  it('codes words and phrases exactly like the flashcard keys', () => {
    expect(deriveItemCode('word', '  Coffee ')).toBe('word:coffee');
    expect(deriveItemCode('phrase', 'Orange   Juice')).toBe(
      'phrase:orange juice',
    );
    expect(deriveItemCode('word', 'Don’t')).toBe("word:don't");
    for (const text of ['Coffee', '  Wake   UP ', 'don’t']) {
      const key = vocabularyItemKey(text)!;
      const kind = key.startsWith('word:') ? 'word' : 'phrase';
      expect(deriveItemCode(kind, text)).toBe(key);
    }
  });

  it('slugs the other kinds without slot placeholders', () => {
    expect(
      deriveItemCode('pattern', 'Can I have a {size} {drink}, please?'),
    ).toBe('pattern:can-i-have-a-please');
    expect(deriveItemCode('listening', 'What size would you like?')).toBe(
      'listening:what-size-would-you-like',
    );
    expect(deriveItemCode('pattern', '{drink}')).toBeNull();
    expect(deriveItemCode('word', '?!')).toBeNull();
  });

  it('parses valid codes and rejects malformed ones', () => {
    expect(parseItemCode('pattern:can-i-have')).toEqual({
      kind: 'pattern',
      body: 'can-i-have',
    });
    for (const bad of [
      'coffee',
      ':coffee',
      'grammar:present simple',
      'word:',
      'word:Coffee',
      'word: coffee',
      'phrase:orange  juice',
      'pattern:{size}',
      `word:${'a'.repeat(151)}`,
    ]) {
      expect(parseItemCode(bad)).toBeNull();
    }
  });
});

describe('shared item fixtures', () => {
  it('has one fixture per kind, each with a valid code and payload', () => {
    expect(fixtures.map(item => item.kind).sort()).toEqual(
      [...ItemKindValues].sort(),
    );
    for (const item of fixtures) {
      expect(parseItemCode(item.code)?.kind).toBe(item.kind);
      expect(parseItemPayload(item.kind, item.text, item.payload).ok).toBe(
        true,
      );
    }
  });

  it('expands the pattern fixture into its stored preview', () => {
    const byCode = new Map(fixtures.map(item => [item.code, item.text]));
    const pattern = fixtures.find(item => item.kind === 'pattern')!;
    const slots = pattern.payload.slots as Record<string, PatternSlot>;
    expect(
      expandPattern(pattern.text, slots, code => byCode.get(code) ?? null, 20),
    ).toEqual(pattern.preview);
    const parsed = parseItemPayload('pattern', pattern.text, pattern.payload);
    expect(
      parsed.ok
        ? payloadItemRefs('pattern', parsed.payload).map(ref => ref.code)
        : [],
    ).toEqual(['word:coffee', 'phrase:orange juice']);
  });

  it('flags malformed frames', () => {
    expect(parseFrame('Can I have {a} {a}?')).toEqual({
      ok: false,
      reason: 'duplicate_slot',
    });
    expect(parseFrame('Can I {have')).toEqual({
      ok: false,
      reason: 'malformed_brace',
    });
  });
});
