import {
  getDatabase,
  resetDatabaseForTests,
  withTransaction,
} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  getDueFlashcards,
  listFlashcards,
  listFlashcardSources,
  removeFlashcardFromLesson,
  saveFlashcard,
  unsaveFlashcard,
} from '../FlashcardRepository';

/**
 * Repository behaviour on real SQLite: one card per item code (decision G3),
 * lessons as sources. Rows inserted by hand without sources stand for cards
 * synced from another device.
 */

type Row = Record<string, any>;

function rows(sql: string, params: unknown[] = []): Row[] {
  const result = getDatabase().execute(sql, params as never[]).rows;
  const out: Row[] = [];
  for (let i = 0; i < (result?.length ?? 0); i += 1) {
    out.push(result!.item(i) as Row);
  }
  return out;
}

const vocab = (id: string, word: string, extra: Row = {}) => ({
  id,
  word,
  meaningVi: `nghĩa ${word}`,
  ipa: null,
  wordType: null,
  ...extra,
});

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  getDatabase();
});

describe('saveFlashcard (item codes)', () => {
  it('stores the lemma key and the lesson as a source', () => {
    const result = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', 'Coffee', {sourceSentence: 'I like coffee.'}),
    });
    expect(result).toMatchObject({ok: true, duplicate: false});
    const [card] = rows('SELECT item_key FROM flashcards;');
    expect(card!.item_key).toBe('word:coffee');
    expect(
      rows('SELECT lesson_id, source_sentence FROM flashcard_sources;'),
    ).toEqual([{lesson_id: 'L1', source_sentence: 'I like coffee.'}]);
  });

  it('reuses the card when the same lemma is saved from another lesson', () => {
    const first = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', 'Coffee'),
    });
    // Different casing, punctuation and vocabulary id: still the same lemma.
    const second = saveFlashcard({
      lessonId: 'L2',
      vocabulary: vocab('v9', 'coffee.'),
    });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.flashcardId).toBe(first.flashcardId);
      expect(second.duplicate).toBe(true);
    }
    expect(rows('SELECT id FROM flashcards;')).toHaveLength(1);
    expect(rows('SELECT card_id FROM review_schedule;')).toHaveLength(1);
    expect(
      rows('SELECT lesson_id FROM flashcard_sources ORDER BY lesson_id;').map(
        r => r.lesson_id,
      ),
    ).toEqual(['L1', 'L2']);
  });

  it('shows a card saved elsewhere as saved in every source lesson', () => {
    saveFlashcard({lessonId: 'L1', vocabulary: vocab('v1', 'coffee')});
    saveFlashcard({lessonId: 'L2', vocabulary: vocab('v2', 'coffee')});
    saveFlashcard({lessonId: 'L3', vocabulary: vocab('v3', 'tea')});

    expect(listFlashcards({lessonId: 'L1'}).map(c => c.word)).toEqual([
      'coffee',
    ]);
    expect(listFlashcards({lessonId: 'L2'}).map(c => c.word)).toEqual([
      'coffee',
    ]);
    expect(listFlashcards({lessonId: 'L3'}).map(c => c.word)).toEqual(['tea']);
    expect(listFlashcards({lessonId: 'L4'})).toEqual([]);
    expect(listFlashcards()).toHaveLength(2);
  });

  it('keeps the review schedule when an unsaved card is saved again elsewhere', () => {
    const first = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', 'coffee'),
    });
    if (!first.ok) throw new Error('save failed');
    getDatabase().execute(
      'UPDATE review_schedule SET interval_days = 7 WHERE card_id = ?;',
      [first.flashcardId],
    );
    expect(unsaveFlashcard(first.flashcardId)).toBe(true);
    expect(listFlashcards()).toEqual([]);

    const again = saveFlashcard({
      lessonId: 'L2',
      vocabulary: vocab('v2', 'coffee'),
    });
    expect(again).toMatchObject({ok: true, flashcardId: first.flashcardId});
    expect(listFlashcards()).toHaveLength(1);
    expect(
      rows('SELECT interval_days FROM review_schedule WHERE card_id = ?;', [
        first.flashcardId,
      ])[0]!.interval_days,
    ).toBe(7);
    expect(getDueFlashcards({today: new Date().toISOString()})).toHaveLength(1);
  });

  it('a tombstoned card does not block saving the lemma again', () => {
    const first = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', 'coffee'),
    });
    if (!first.ok) throw new Error('save failed');
    getDatabase().execute(
      'UPDATE flashcards SET tombstone = 1, is_saved = 0 WHERE id = ?;',
      [first.flashcardId],
    );
    const next = saveFlashcard({
      lessonId: 'L2',
      vocabulary: vocab('v2', 'coffee'),
    });
    expect(next).toMatchObject({ok: true, duplicate: false});
    if (next.ok) {
      expect(next.flashcardId).not.toBe(first.flashcardId);
    }
  });

  it('fills in the catalog item id when the item is saved again with it', () => {
    const first = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('a1', 'Coffee'),
    });
    const second = saveFlashcard({
      lessonId: 'L2',
      vocabulary: vocab('word:coffee', 'coffee'),
      item: {itemKey: 'word:coffee', itemId: 'item-coffee', kind: 'word'},
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second).toMatchObject({
        flashcardId: first.flashcardId,
        duplicate: true,
      });
    }
    expect(rows('SELECT item_key, item_id, kind FROM flashcards;')).toEqual([
      {item_key: 'word:coffee', item_id: 'item-coffee', kind: 'word'},
    ]);
  });

  it('keys a pattern card by its catalog code', () => {
    const result = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('pattern:can-i-have', 'Can I have a {drink}?'),
      item: {itemKey: 'pattern:can-i-have', itemId: 'item-p', kind: 'pattern'},
    });
    expect(result).toMatchObject({ok: true, duplicate: false});
    expect(listFlashcards()[0]).toMatchObject({
      itemKey: 'pattern:can-i-have',
      itemId: 'item-p',
      kind: 'pattern',
    });
  });

  it('refuses a word with no usable item code', () => {
    expect(
      saveFlashcard({lessonId: 'L1', vocabulary: vocab('v1', '...')}),
    ).toEqual({ok: false, errorCode: 'INVALID_ITEM'});
    expect(rows('SELECT id FROM flashcards;')).toEqual([]);
  });

  it('works inside a caller transaction and rolls back with it', () => {
    const db = getDatabase();
    expect(() =>
      withTransaction(db, () => {
        const saved = saveFlashcard({
          lessonId: 'L1',
          vocabulary: vocab('v1', 'coffee'),
        });
        expect(saved).toMatchObject({ok: true, duplicate: false});
        throw new Error('caller aborts');
      }),
    ).toThrow('caller aborts');
    expect(rows('SELECT id FROM flashcards;')).toHaveLength(0);
    expect(rows('SELECT * FROM flashcard_sources;')).toHaveLength(0);

    withTransaction(db, () => {
      saveFlashcard({lessonId: 'L1', vocabulary: vocab('v1', 'coffee')});
      saveFlashcard({lessonId: 'L2', vocabulary: vocab('v2', 'coffee')});
    });
    expect(rows('SELECT id FROM flashcards;')).toHaveLength(1);
    expect(rows('SELECT * FROM flashcard_sources;')).toHaveLength(2);
  });
});

describe('listFlashcardSources', () => {
  it('groups source lessons per card, oldest first, and omits cards without any', () => {
    const first = saveFlashcard({
      lessonId: 'L2',
      vocabulary: vocab('v1', 'coffee', {sourceSentence: 'Coffee is hot.'}),
      now: '2026-10-02T00:00:00.000Z',
    });
    saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v2', 'Coffee'),
      now: '2026-10-03T00:00:00.000Z',
    });
    saveFlashcard({
      lessonId: 'L3',
      vocabulary: vocab('v3', 'tea'),
      now: '2026-10-01T00:00:00.000Z',
    });
    getDatabase().execute(
      `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
         is_saved, created_at, updated_at, item_key)
       VALUES ('legacy', 'L9', 'v9', 'x', 'x', 1, 'x', 'x', 'word:x');`,
    );

    const sources = listFlashcardSources();
    if (!first.ok) throw new Error('save failed');
    expect(sources.get(first.flashcardId)).toEqual([
      {
        lessonId: 'L2',
        sourceSentence: 'Coffee is hot.',
        createdAt: '2026-10-02T00:00:00.000Z',
      },
      {
        lessonId: 'L1',
        sourceSentence: null,
        createdAt: '2026-10-03T00:00:00.000Z',
      },
    ]);
    expect(sources.size).toBe(2);
    expect(sources.has('legacy')).toBe(false);
  });
});

describe('removeFlashcardFromLesson', () => {
  const save = (lessonId: string, id: string, word = 'coffee') => {
    const result = saveFlashcard({lessonId, vocabulary: vocab(id, word)});
    if (!result.ok) throw new Error('save failed');
    return result.flashcardId;
  };

  it('keeps the card saved while another lesson still sources it', () => {
    const card = save('L1', 'v1');
    save('L2', 'v2');

    expect(removeFlashcardFromLesson(card, 'L1')).toBe(true);

    // Gone from L1 (even though L1 is the card's own first lesson) ...
    expect(listFlashcards({lessonId: 'L1'})).toEqual([]);
    // ... but still saved, reviewable and listed under L2.
    expect(listFlashcards({lessonId: 'L2'}).map(c => c.id)).toEqual([card]);
    expect(listFlashcards()).toHaveLength(1);
    expect(getDueFlashcards({today: new Date().toISOString()})).toHaveLength(1);
  });

  it('unsaves the card when its last source is removed, keeping the schedule', () => {
    const card = save('L1', 'v1');
    save('L2', 'v2');
    getDatabase().execute(
      'UPDATE review_schedule SET interval_days = 7 WHERE card_id = ?;',
      [card],
    );

    removeFlashcardFromLesson(card, 'L1');
    removeFlashcardFromLesson(card, 'L2');

    expect(listFlashcards()).toEqual([]);
    expect(listFlashcards({includeUnsaved: true})).toHaveLength(1);
    expect(
      rows('SELECT interval_days FROM review_schedule WHERE card_id = ?;', [
        card,
      ])[0]!.interval_days,
    ).toBe(7);

    // Saving it again from anywhere brings the same card (and schedule) back.
    expect(save('L3', 'v3')).toBe(card);
    expect(listFlashcards({lessonId: 'L3'})).toHaveLength(1);
  });

  it('unsaves a legacy card with no source rows outright', () => {
    getDatabase().execute(
      `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
         is_saved, created_at, updated_at, item_key)
       VALUES ('legacy', 'L1', 'v1', 'x', 'x', 1, 'x', 'x', 'word:x');`,
    );
    expect(listFlashcards({lessonId: 'L1'}).map(c => c.id)).toEqual(['legacy']);
    expect(removeFlashcardFromLesson('legacy', 'L1')).toBe(true);
    expect(listFlashcards()).toEqual([]);
  });

  it('removing a lesson that is not a source changes nothing for the others', () => {
    const card = save('L1', 'v1');
    save('L2', 'v2');
    expect(removeFlashcardFromLesson(card, 'L9')).toBe(true);
    expect(listFlashcards({lessonId: 'L1'})).toHaveLength(1);
    expect(listFlashcards({lessonId: 'L2'})).toHaveLength(1);
  });

  it('reports false for an unknown card', () => {
    expect(removeFlashcardFromLesson('missing', 'L1')).toBe(false);
  });
});
