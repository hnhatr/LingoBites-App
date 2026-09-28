/**
 * Integration tests for the lesson runtime session (SETE-108 / M3).
 *
 * Runs against the real DB mock (migrations + repository) so the SRS
 * creation-on-exit path exercises actual SQL, matching the acceptance
 * criteria: SRS items are created only for completed content, skipped
 * content never graduates, and replaying a finished lesson never duplicates
 * review rows.
 */

import {__resetMockDatabases} from '../../../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {insertPackageRecord} from '@features/lesson/packages/logic/data/ContentPackageRepository';
import {listContentReviewItems} from '@features/lesson/packages/logic/data/ContentRuntimeRepository';
import {createLessonRuntimeSession} from '../ContentLessonRuntime';

const NOW = '2026-09-06T12:00:00.000Z';
const LESSON_ID = 'lesson-1';
const PACKAGE_ID = 'pkg-1';

function seedLesson() {
  const db = open({name: DB_NAME});

  insertPackageRecord({
    id: PACKAGE_ID,
    slug: 'daily-standup',
    schemaVersion: '0.1.0',
    sourceUrl: 'https://example.com/pkg.zip',
    sha256: 'abc',
    importedAt: NOW,
    isActive: true,
  });

  db.execute(
    `INSERT INTO content_lessons (
      id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
      level, target_skills_json, estimated_duration_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      LESSON_ID,
      PACKAGE_ID,
      'daily-standup',
      '0.1.0',
      'Daily Stand-up',
      'Họp Đứng Hàng Ngày',
      'blurb',
      'A2',
      JSON.stringify(['speaking', 'listening']),
      20,
    ],
  );

  const chunk1Payload = {
    grammar_ref_ids: ['gram-1'],
    vocab_ref_ids: [],
    dialogue_turns: [
      {
        id: 'dt-1',
        slug: 'turn-1',
        speaker: 'A',
        text_en: "I'm working on it.",
        text_vi: 'Tôi đang làm việc đó.',
        grammar_ref_ids: [],
      },
    ],
    qa_items: [],
    audio_ref_ids: ['audio-1'],
    srs_ref_ids: [],
  };
  db.execute(
    `INSERT INTO content_items (
      id, lesson_id, package_id, slug, chunk_order, phrase_en, phrase_vi,
      explanation_vi, context_sentence_en, context_sentence_vi, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'chunk-1',
      LESSON_ID,
      PACKAGE_ID,
      'chunk-1',
      0,
      "I'm working on it.",
      'Tôi đang làm việc đó.',
      'Giải thích thì hiện tại tiếp diễn.',
      null,
      null,
      JSON.stringify(chunk1Payload),
    ],
  );

  const chunk2Payload = {
    grammar_ref_ids: [],
    vocab_ref_ids: [],
    dialogue_turns: [],
    qa_items: [
      {
        id: 'qa-2',
        slug: 'qa-2',
        type: 'multiple_choice',
        question: 'What are you doing?',
        options: ['Working', 'Sleeping'],
        answer: 'Working',
      },
    ],
    audio_ref_ids: [],
    srs_ref_ids: [],
  };
  db.execute(
    `INSERT INTO content_items (
      id, lesson_id, package_id, slug, chunk_order, phrase_en, phrase_vi,
      explanation_vi, context_sentence_en, context_sentence_vi, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'chunk-2',
      LESSON_ID,
      PACKAGE_ID,
      'chunk-2',
      1,
      'What are you working on?',
      'Bạn đang làm việc gì?',
      'Giải thích cách hỏi.',
      null,
      null,
      JSON.stringify(chunk2Payload),
    ],
  );

  const activities: Array<[string, string, string[], string[]]> = [
    ['act-listen', 'listen_and_repeat', ['chunk-1'], []],
    ['act-role', 'role_play', ['chunk-1'], []],
    ['act-fill', 'fill_blank', ['chunk-2'], ['qa-2']],
    ['act-mc', 'multiple_choice', ['chunk-2'], ['qa-2']],
  ];
  for (const [id, type, chunkRefIds, qaRefIds] of activities) {
    db.execute(
      `INSERT INTO content_activities (
        id, lesson_id, package_id, slug, activity_type, title_vi,
        chunk_ref_ids_json, qa_ref_ids_json, instructions_vi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        LESSON_ID,
        PACKAGE_ID,
        id,
        type,
        'Hoạt động',
        JSON.stringify(chunkRefIds),
        JSON.stringify(qaRefIds),
        null,
      ],
    );
  }

  db.execute(
    `INSERT INTO content_audio_assets (
      id, lesson_id, package_id, slug, url, checksum, bytes, locale, transcript
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'audio-1',
      LESSON_ID,
      PACKAGE_ID,
      'audio-1',
      'https://example.com/audio-1.mp3',
      'sha256:placeholder',
      0,
      'en-US',
      null,
    ],
  );

  const srsItems: Array<[string, string, string]> = [
    ['srs-chunk1', 'grammar', 'chunk-1'],
    ['srs-chunk2', 'vocabulary', 'chunk-2'],
    ['srs-qa2', 'qa', 'qa-2'],
    ['srs-dt1', 'dialogue_turn', 'dt-1'],
    ['srs-gram1', 'grammar', 'gram-1'],
  ];
  for (const [id, itemType, sourceRefId] of srsItems) {
    db.execute(
      `INSERT INTO content_units (
        id, lesson_id, package_id, unit_type, slug, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?);`,
      [
        id,
        LESSON_ID,
        PACKAGE_ID,
        'srs',
        id,
        JSON.stringify({
          id,
          slug: id,
          item_type: itemType,
          source_ref_id: sourceRefId,
          front: `Front ${id}`,
          back: `Back ${id}`,
        }),
      ],
    );
  }
}

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  seedLesson();
}

describe('LessonRuntimeSession', () => {
  beforeEach(() => {
    setup();
  });

  it('returns null for an unknown lesson id', () => {
    expect(createLessonRuntimeSession('does-not-exist')).toBeNull();
  });

  it('builds the full step sequence covering every activity type', () => {
    const session = createLessonRuntimeSession(LESSON_ID)!;
    const kinds = session.steps.map(step => step.kind);
    expect(kinds).toEqual([
      'context',
      'shadowing',
      'role_play',
      'context',
      'guided_practice',
      'active_recall',
      'exit_check',
      'feedback',
    ]);
  });

  it('records skipped steps as skipped, not completed, and creates SRS items only for completed content', () => {
    const session = createLessonRuntimeSession(LESSON_ID)!;

    session.recordAttempt('completed'); // context chunk-1
    session.recordAttempt('completed'); // shadowing
    session.recordAttempt('completed'); // role_play (dt-1)
    session.recordAttempt('skipped'); // context chunk-2
    session.recordAttempt('skipped'); // guided_practice (qa-2 via act-fill)
    session.recordAttempt('completed'); // active_recall (qa-2 via act-mc)
    session.recordAttempt('completed'); // exit_check
    session.recordAttempt('completed'); // feedback

    expect(session.isFinished()).toBe(true);
    expect(session.getAttempt('context:chunk-2')).toBe('skipped');
    expect(session.getAttempt('context:chunk-1')).toBe('completed');

    const result = session.finish(NOW);

    // chunk-1 completed -> srs-chunk1 + srs-gram1 (grammar tied to chunk-1)
    // qa-2 completed via active_recall (even though guided_practice was skipped)
    // dt-1 completed via role_play -> srs-dt1
    // chunk-2 never completed -> srs-chunk2 excluded
    expect(result.createdReviewItemCount).toBe(4);

    const created = listContentReviewItems(LESSON_ID);
    const createdIds = created.map(item => item.srsItemId).sort();
    expect(createdIds).toEqual([
      'srs-chunk1',
      'srs-dt1',
      'srs-gram1',
      'srs-qa2',
    ]);

    for (const item of created) {
      expect(item.masteryState).toBe('new');
      expect(new Date(item.nextReviewAt).getTime()).toBe(
        new Date('2026-09-07T12:00:00.000Z').getTime(),
      );
    }
  });

  it('goToPreviousStep rewinds the index and clears the prior attempt', () => {
    const session = createLessonRuntimeSession(LESSON_ID)!;
    session.recordAttempt('completed');
    expect(session.getStepIndex()).toBe(1);
    expect(session.goToPreviousStep()).toBe(true);
    expect(session.getStepIndex()).toBe(0);
    expect(session.getAttempt('context:chunk-1')).toBe('pending');
    expect(session.goToPreviousStep()).toBe(false);
  });

  it('replaying finish() never duplicates review rows', () => {
    const session = createLessonRuntimeSession(LESSON_ID)!;
    for (let i = 0; i < session.steps.length; i += 1) {
      session.recordAttempt('completed');
    }
    const first = session.finish(NOW);
    expect(first.createdReviewItemCount).toBe(5);

    const second = session.finish(NOW);
    expect(second.createdReviewItemCount).toBe(0);
    expect(listContentReviewItems(LESSON_ID)).toHaveLength(5);
  });
});
