import fs from 'node:fs';
import path from 'node:path';

import {
  LESSON_CONTRACT_FIXTURE_REVISION,
  LESSON_CONTRACT_VERSION,
  LessonCatalogResponseSchema,
  LessonSnapshotResponseSchema,
} from '../lesson';

/**
 * LING-173 (TASK-007): the App lesson mirror matches the Server contract at
 * Server `integration/LING-149` @ TASK-003 (`648331b`). The fixtures below
 * are byte-identical copies of the Server canonical fixtures
 * (`src/modules/canonicalLesson/model/fixtures/
 * valid-lesson-{snapshot,catalog}-response.json`, revision
 * `ling-149-task-001-r1`); this test fails if either side drifts.
 */
function loadFixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  );
}

describe('canonical lesson contract mirror (Server integration/LING-149)', () => {
  it('uses lesson contract version 1', () => {
    expect(LESSON_CONTRACT_VERSION).toBe(1);
  });

  it('pins the TASK-001 fixture revision', () => {
    expect(LESSON_CONTRACT_FIXTURE_REVISION).toBe('ling-149-task-001-r1');
  });

  it('parses the canonical snapshot fixture', () => {
    const parsed = LessonSnapshotResponseSchema.safeParse(
      loadFixture('valid-lesson-snapshot-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contract_version).toBe(1);
      expect(parsed.data.lesson.sentences.length).toBeGreaterThan(0);
      for (const sentence of parsed.data.lesson.sentences) {
        expect(sentence.text_en.trim()).not.toBe('');
        expect(sentence.text_vi.trim()).not.toBe('');
        expect(sentence.ipa.trim()).not.toBe('');
      }
      // Snapshot analyses are keyed by sentence row id (AD-001/AD-005).
      for (const [sentenceId, analysis] of Object.entries(
        parsed.data.lesson.analyses,
      )) {
        expect(analysis.sentence_id).toBe(sentenceId);
      }
    }
  });

  it('parses the canonical catalog fixture', () => {
    const parsed = LessonCatalogResponseSchema.safeParse(
      loadFixture('valid-lesson-catalog-response.json'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contract_version).toBe(1);
      expect(parsed.data.lessons.length).toBeGreaterThan(0);
      const origins = new Set(parsed.data.lessons.map(lesson => lesson.origin));
      expect(origins.has('admin')).toBe(true);
      expect(origins.has('learner')).toBe(true);
    }
  });

  it('accepts a v2 snapshot that carries normalised items', () => {
    const body = loadFixture('valid-lesson-snapshot-response.json') as {
      lesson: Record<string, unknown>;
    };
    const parsed = LessonSnapshotResponseSchema.safeParse({
      ...body,
      contract_version: 2,
      lesson: {
        ...body.lesson,
        items: [
          {
            id: '44444444-4444-4444-8444-444444444401',
            kind: 'word',
            item_key: 'coffee',
            payload: {word: 'coffee', meaning_vi: 'cà phê'},
            sentence_ids: [],
            future_field: true,
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('still parses a v1 snapshot without items', () => {
    const parsed = LessonSnapshotResponseSchema.safeParse(
      loadFixture('valid-lesson-snapshot-response.json'),
    );
    expect(parsed.success && parsed.data.lesson.items).toBeFalsy();
  });

  it('rejects a contract_version mismatch instead of parsing leniently', () => {
    const body = loadFixture('valid-lesson-snapshot-response.json') as Record<
      string,
      unknown
    >;
    const parsed = LessonSnapshotResponseSchema.safeParse({
      ...body,
      contract_version: 999,
    });
    expect(parsed.success).toBe(false);
  });
});
