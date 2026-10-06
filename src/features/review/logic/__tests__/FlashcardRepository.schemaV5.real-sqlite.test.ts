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
  saveFlashcard,
  unsaveFlashcard,
} from '../FlashcardRepository';

/**
 * Schema v5 behaviour of the repository on real SQLite: one card per lemma,
 * lessons as sources.
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

describe('saveFlashcard (schema v5)', () => {
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

  it('adopts a legacy card without a key when the same lesson saves it again', () => {
    getDatabase().execute(
      `INSERT INTO flashcards (id, lesson_id, vocabulary_id, word, meaning_vi,
         is_saved, created_at, updated_at)
       VALUES ('legacy', 'L1', 'v1', 'Coffee', 'cà phê', 0, 'x', 'x');`,
    );
    const result = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', 'Coffee'),
    });
    expect(result).toMatchObject({
      ok: true,
      flashcardId: 'legacy',
      duplicate: true,
    });
    const [card] = rows(
      "SELECT item_key, is_saved FROM flashcards WHERE id = 'legacy';",
    );
    expect(card).toEqual({item_key: 'word:coffee', is_saved: 1});
  });

  it('saves a word with no usable key as a plain per-lesson card', () => {
    const result = saveFlashcard({
      lessonId: 'L1',
      vocabulary: vocab('v1', '...'),
    });
    expect(result).toMatchObject({ok: true, duplicate: false});
    expect(rows('SELECT item_key FROM flashcards;')[0]!.item_key).toBeNull();
    // Saving it again from the same lesson is still a duplicate of that card.
    expect(
      saveFlashcard({lessonId: 'L1', vocabulary: vocab('v1', '...')}),
    ).toMatchObject({
      ok: true,
      duplicate: true,
    });
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
         is_saved, created_at, updated_at)
       VALUES ('legacy', 'L9', 'v9', '...', 'x', 1, 'x', 'x');`,
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
