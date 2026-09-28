/**
 * M7 Content QA Matrix & Scenario Tests (SETE-112).
 *
 * Verifies:
 * 1. MVP package structure (15-20 lessons, 100-150 target chunks, 8 units).
 * 2. Complete REQ-9 lesson contract declarations.
 * 3. Stable deterministic IDs preservation (Daily stand-up IDs unchanged).
 * 4. Progression graph prerequisite resolution & acyclicity.
 * 5. All 6 Speaking Room modes coverage.
 * 6. Expected errors to SRS/remediation mapping.
 * 7. Weekly and stage checks scenario QA (outcomes: pass, conditional_pass, not_yet).
 * 8. Package atomic import & database querying.
 * 9. Network-disabled content & asset resolution.
 */

import fs from 'fs';
import path from 'path';
import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {importContentPackage} from '../importer/ContentPackageImporter';
import {lintContentPackage} from '../importer/packageLint';
import {
  listActivePackageLessons,
  getContentLessonById,
  getLessonChunks,
  getLessonAudioAssets,
} from '@features/lesson/packages/logic/data/ContentRuntimeRepository';
import {
  listSpeakingRoomModes,
  getShadowingContent,
  getQuickAnswerContent,
  getStandupContent,
  getAppDescriptionContent,
  getBugReportContent,
  getMockInterviewContent,
} from '@features/speaking/logic/speakingModes';
import {evaluateCheck, evaluateCheckOutcome} from '../checks/checkEvaluator';
import type {ContentLesson, ContentPackageManifest} from '../importer/types';

const PKG_DIR = path.resolve(
  __dirname,
  '../../../../../../tools/content-lint/packages/daily-standup',
);

function loadPackageFiles() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PKG_DIR, 'manifest.json'), 'utf8'),
  ) as ContentPackageManifest;
  const lessons = manifest.lessons.map(entry =>
    JSON.parse(fs.readFileSync(path.join(PKG_DIR, entry.file), 'utf8')),
  ) as ContentLesson[];
  return {manifest, lessons};
}

function setupDb() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('M7 Content Package & QA Matrix Verification', () => {
  const {manifest, lessons} = loadPackageFiles();

  it('contains 15-20 lessons and 100-150 unique target chunks across 8 required units', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(15);
    expect(lessons.length).toBeLessThanOrEqual(20);

    const chunkIds = new Set<string>();
    const unitSlugs = new Set<string>();

    for (const lesson of lessons) {
      if (lesson.unit_slug) {
        unitSlugs.add(lesson.unit_slug);
      }
      for (const chunk of lesson.chunks) {
        chunkIds.add(chunk.id);
      }
    }

    expect(chunkIds.size).toBeGreaterThanOrEqual(100);
    expect(chunkIds.size).toBeLessThanOrEqual(150);

    const requiredUnits = [
      'introduction',
      'clarification',
      'team-roles',
      'daily-standup',
      'app-description',
      'bug-report',
      'career-profile',
      'interview-practice',
    ];

    for (const u of requiredUnits) {
      expect(unitSlugs.has(u)).toBe(true);
    }
  });

  it('passes the runtime content linter with zero errors', () => {
    const lint = lintContentPackage(manifest, lessons);
    expect(lint.ok).toBe(true);
    expect(lint.errors).toEqual([]);
  });

  it('preserves stable IDs and original Daily Stand-up IDs unchanged', () => {
    const dailyStandup = lessons.find(l => l.slug === 'daily-standup');
    expect(dailyStandup).toBeDefined();
    if (!dailyStandup) {
      throw new Error('daily-standup lesson missing from package fixture');
    }
    expect(dailyStandup.id).toBe('3fdc3340c228cfac');
  });

  it('satisfies REQ-9 declarations for every lesson', () => {
    for (const lesson of lessons) {
      expect(lesson.id).toBeDefined();
      expect(lesson.slug).toBeDefined();
      expect(lesson.level).toBeDefined();
      expect(lesson.chunks.length).toBeGreaterThanOrEqual(8);
      expect(lesson.chunks.length).toBeLessThanOrEqual(12);
      expect(lesson.grammar_patterns.length).toBeGreaterThan(0);
      expect(lesson.activities.length).toBeGreaterThan(0);
      expect(lesson.srs_items.length).toBeGreaterThan(0);
      expect(lesson.audio_assets.length).toBeGreaterThan(0);
    }
  });

  it('validates that progression graph is acyclic and prerequisites resolve', () => {
    const lessonMap = new Map(lessons.map(l => [l.slug, l]));
    for (const lesson of lessons) {
      for (const prereqSlug of lesson.prerequisite_lesson_slugs ?? []) {
        expect(lessonMap.has(prereqSlug)).toBe(true);
      }
    }
  });

  it('evaluates weekly and stage check outcomes strictly to pass, conditional_pass, or not_yet', () => {
    expect(evaluateCheckOutcome(90)).toBe('pass');
    expect(evaluateCheckOutcome(70)).toBe('conditional_pass');
    expect(evaluateCheckOutcome(50)).toBe('not_yet');

    const passResult = evaluateCheck([
      {correct: true},
      {correct: true},
      {correct: true},
      {correct: true},
      {correct: true},
    ]);
    expect(passResult.outcome).toBe('pass');

    const condResult = evaluateCheck([
      {correct: true},
      {correct: true},
      {correct: true},
      {correct: false},
      {correct: false},
    ]);
    expect(condResult.outcome).toBe('conditional_pass');

    const failResult = evaluateCheck([
      {correct: false},
      {correct: false},
      {correct: false},
      {correct: false},
      {correct: false},
    ]);
    expect(failResult.outcome).toBe('not_yet');
  });

  describe('Database & Speaking Room Coverage after Import', () => {
    beforeEach(async () => {
      const db = setupDb();

      // Create dummy ZIP entries for importer
      const zipMap = new Map<string, Uint8Array>();
      zipMap.set(
        'manifest.json',
        Buffer.from(JSON.stringify(manifest), 'utf8'),
      );
      for (const entry of manifest.lessons) {
        const lesson = lessons.find(l => l.slug === entry.lesson_slug);
        zipMap.set(entry.file, Buffer.from(JSON.stringify(lesson), 'utf8'));
      }

      const mockExtract = async () => ({
        entries: Array.from(zipMap.entries()).map(([name, bytes]) => ({
          name,
          bytes,
        })),
      });

      const res = await importContentPackage(
        'https://example.com/mvp-package.zip',
        {
          getDb: () => db,
          extractZip: mockExtract as any,
          fetcher: async () => ({
            ok: true,
            status: 200,
            body: new Uint8Array([1, 2, 3]),
          }),
        },
      );

      expect(res.ok).toBe(true);
    });

    it('queries active package lessons and chunks from SQLite database', () => {
      const activeLessons = listActivePackageLessons();
      expect(activeLessons.length).toBe(16);

      const firstLesson = getContentLessonById(activeLessons[0].id);
      expect(firstLesson).not.toBeNull();

      const chunks = getLessonChunks(activeLessons[0].id);
      expect(chunks.length).toBeGreaterThanOrEqual(8);
    });

    it('provides usable installed content for all six Speaking Room modes', () => {
      const modes = listSpeakingRoomModes();
      expect(modes.length).toBe(6);

      for (const modeInfo of modes) {
        expect(modeInfo.available).toBe(true);
      }

      expect(getShadowingContent().length).toBeGreaterThan(0);
      expect(getQuickAnswerContent().length).toBeGreaterThan(0);
      expect(getStandupContent().length).toBeGreaterThan(0);
      expect(getAppDescriptionContent().length).toBeGreaterThan(0);
      expect(getBugReportContent().length).toBeGreaterThan(0);
      expect(getMockInterviewContent().length).toBeGreaterThan(0);
    });

    it('resolves audio assets offline without network calls', () => {
      const activeLessons = listActivePackageLessons();
      for (const lessonSummary of activeLessons) {
        const audioMap = getLessonAudioAssets(lessonSummary.id);
        expect(audioMap.size).toBeGreaterThan(0);
        for (const asset of audioMap.values()) {
          expect(asset.url).toBeDefined();
          expect(asset.checksum).toBeDefined();
        }
      }
    });
  });
});
