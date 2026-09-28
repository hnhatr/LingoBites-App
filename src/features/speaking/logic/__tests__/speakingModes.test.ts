/**
 * Tests for Speaking Room mode listing + shadowing content aggregation
 * (SETE-110 / M5, REQ-23, VC-17).
 */

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {insertPackageRecord} from '@features/lesson/packages/logic/data/ContentPackageRepository';
import {getShadowingContent, listSpeakingRoomModes} from '../speakingModes';

function setup() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

function seedActivePackageWithShadowingContent(db: ReturnType<typeof open>) {
  insertPackageRecord({
    id: 'pkg-1',
    slug: 'pkg-1',
    schemaVersion: '0.1.0',
    sourceUrl: 'https://example.com/a.zip',
    sha256: 'a',
    importedAt: '2026-09-06T00:00:00.000Z',
    isActive: true,
  });
  db.execute(
    `INSERT INTO content_lessons (
      id, package_id, slug, schema_version, title_en, title_vi, blurb_vi,
      level, target_skills_json, estimated_duration_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'lesson-1',
      'pkg-1',
      'lesson-1',
      '0.1.0',
      'Title',
      'Bài học 1',
      'blurb',
      'A2',
      '[]',
      10,
    ],
  );
  db.execute(
    `INSERT INTO content_items (
      id, lesson_id, package_id, slug, chunk_order, phrase_en, phrase_vi,
      explanation_vi, context_sentence_en, context_sentence_vi, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'chunk-1',
      'lesson-1',
      'pkg-1',
      'chunk-1',
      0,
      'Hello there',
      'Xin chào',
      'explanation',
      null,
      null,
      JSON.stringify({audio_ref_ids: ['audio-1']}),
    ],
  );
  db.execute(
    `INSERT INTO content_activities (
      id, lesson_id, package_id, slug, activity_type, title_vi,
      chunk_ref_ids_json, qa_ref_ids_json, instructions_vi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'activity-1',
      'lesson-1',
      'pkg-1',
      'activity-1',
      'speaking_drill',
      'Luyện nói',
      JSON.stringify(['chunk-1']),
      JSON.stringify([]),
      null,
    ],
  );
}

describe('listSpeakingRoomModes', () => {
  beforeEach(() => setup());

  it('always lists all six required modes', () => {
    const modes = listSpeakingRoomModes();
    expect(modes.map(m => m.mode)).toEqual([
      'shadowing',
      'quick_answer',
      'standup',
      'app_description',
      'bug_report',
      'mock_interview',
    ]);
  });

  it('flags every mode unavailable when no content package is active', () => {
    const modes = listSpeakingRoomModes();
    expect(modes.every(m => !m.available)).toBe(true);
  });

  it('shows duration and level on every mode card (SETE-262)', () => {
    const modes = listSpeakingRoomModes();
    for (const mode of modes) {
      expect(mode.durationMin).toBeGreaterThan(0);
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(mode.level);
      expect(mode.icon).toBeTruthy();
    }
  });

  it('marks exactly one mode as recommended (SETE-262)', () => {
    const modes = listSpeakingRoomModes();
    expect(modes.filter(m => m.recommended)).toHaveLength(1);
  });

  it('orders modes by commitment with mock interview last (SETE-262)', () => {
    const modes = listSpeakingRoomModes();
    expect(modes[modes.length - 1]?.mode).toBe('mock_interview');
    const durations = modes.map(m => m.durationMin);
    expect([...durations].sort((a, b) => a - b)).toEqual(durations);
  });

  it('flags shadowing available once matching content_activities exist', () => {
    const db = setup();
    seedActivePackageWithShadowingContent(db);

    const modes = listSpeakingRoomModes();
    const shadowing = modes.find(m => m.mode === 'shadowing');
    expect(shadowing?.available).toBe(true);

    // The five modes with no content-schema representation yet always show
    // the "not available yet" state (REQ-23) — never a broken/empty screen.
    const others = modes.filter(m => m.mode !== 'shadowing');
    expect(others.every(m => !m.available)).toBe(true);
  });
});

describe('getShadowingContent', () => {
  beforeEach(() => setup());

  it('returns lines built from matching activities and their chunks', () => {
    const db = setup();
    seedActivePackageWithShadowingContent(db);

    const content = getShadowingContent();
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({
      lessonId: 'lesson-1',
      lessonTitleVi: 'Bài học 1',
    });
    expect(content[0].lines).toEqual([
      {textEn: 'Hello there', textVi: 'Xin chào', audioAssetId: 'audio-1'},
    ]);
  });

  it('returns an empty list when nothing is installed', () => {
    expect(getShadowingContent()).toEqual([]);
  });
});
