import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  saveFlashcard,
  saveGrammarBookmark,
  unsaveFlashcard,
} from '@features/review';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {useLibraryCounts} from '../useLibraryCounts';

/** A stored download row; counting only reads its origin and source type. */
function saveLesson(id: string, origin: string, sourceType: string) {
  getDatabase().execute(
    `INSERT INTO lesson_downloads (
      lesson_id, content_revision, server_revision, contract_version,
      snapshot_json, media_dir, downloaded_at
    ) VALUES (?, 1, NULL, 1, ?, NULL, '2026-10-01T00:00:00.000Z');`,
    [id, JSON.stringify({lesson: {id, origin, source_type: sourceType}})],
  );
}

const vocabulary = (id: string, word: string) => ({
  id,
  word,
  meaning_vi: word,
});

let latest: ReturnType<typeof useLibraryCounts>;

function CountsProbe() {
  latest = useLibraryCounts();
  return null;
}

let dir: string;
let connection: RealSqliteConnection;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-library-counts-'));
  connection = openRealSqlite(path.join(dir, 'lingobites.sqlite'));
  resetDatabaseForTests(connection);
  runMigrations(getDatabase());
});

afterEach(() => {
  resetDatabaseForTests(null);
  connection.close();
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('useLibraryCounts (real SQLite)', () => {
  it('counts only the learner’s own lessons, each under exactly one card', () => {
    saveLesson('a', 'learner', 'learner_text');
    saveLesson('b', 'learner', 'learner_ocr');
    saveLesson('c', 'admin', 'admin_text');
    saveLesson('d', 'learner', 'youtube');
    saveFlashcard({lessonId: 'l1', vocabulary: vocabulary('v1', 'hello')});
    saveGrammarBookmark({lessonId: 'l1', grammarId: 'g1', packageId: 'p1'});

    act(() => {
      ReactTestRenderer.create(<CountsProbe />);
    });

    // The downloaded admin lesson is public, not "mine".
    expect(latest.counts).toEqual({
      mine: 2,
      video: 1,
      vocabulary: 1,
      grammar: 1,
      public: 0,
      publicVideo: 0,
    });
  });

  it('keeps the same counts on refresh when nothing changed', () => {
    act(() => {
      ReactTestRenderer.create(<CountsProbe />);
    });
    const before = latest.counts;

    act(() => latest.refresh());

    expect(latest.counts).toBe(before);
  });

  it('picks up a saved, then unsaved word on refresh', () => {
    act(() => {
      ReactTestRenderer.create(<CountsProbe />);
    });
    const saved = saveFlashcard({
      lessonId: 'l1',
      vocabulary: vocabulary('v1', 'hello'),
    });

    act(() => latest.refresh());
    expect(latest.counts.vocabulary).toBe(1);

    if (!saved.ok) throw new Error('save failed');
    unsaveFlashcard(saved.flashcardId);
    act(() => latest.refresh());
    expect(latest.counts.vocabulary).toBe(0);
  });
});
