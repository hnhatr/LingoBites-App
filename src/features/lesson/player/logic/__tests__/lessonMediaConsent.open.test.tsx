import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {
  type LessonSnapshot,
  parseLessonSnapshotResponse,
} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {
  canonicalLessonBody,
  SEED_MEDIA_URL,
} from '@test/support/canonicalDownloadSeed';

import {
  getLessonMediaDir,
  saveLessonSnapshotBody,
  stageLessonMedia,
} from '../canonicalDownloadRepository';
import {fetchLessonSnapshot} from '../canonicalLessonClient';
import {setMediaDownloadConsent} from '../mediaDownloadConsent';
import {
  type CanonicalLessonViewState,
  useCanonicalLesson,
} from '../useCanonicalLesson';
import {useLessonMediaDownload} from '../useLessonMediaDownload';

jest.mock('../canonicalLessonClient', () => ({
  ...jest.requireActual('../canonicalLessonClient'),
  fetchLessonSnapshot: jest.fn(),
}));

jest.mock('../canonicalDownloadRepository', () => ({
  ...jest.requireActual('../canonicalDownloadRepository'),
  stageLessonMedia: jest.fn(),
  sweepLessonMedia: jest.fn(async () => ({removed: []})),
}));

const mockedFetch = fetchLessonSnapshot as jest.Mock;
const mockedStage = stageLessonMedia as jest.Mock;

function mediaBody() {
  return canonicalLessonBody({withMedia: true});
}

function snapshotOf(body: unknown): LessonSnapshot {
  const parsed = parseLessonSnapshotResponse(body);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.response.lesson;
}

const LESSON_ID = snapshotOf(mediaBody()).id;
const MEDIA_DIR = `lesson-media/${LESSON_ID}/3`;

function serveSnapshot(body = mediaBody()) {
  mockedFetch.mockResolvedValue({
    ok: true,
    value: {snapshot: snapshotOf(body), rawBody: body},
  });
}

async function openLesson(): Promise<CanonicalLessonViewState> {
  let latest!: ReturnType<typeof useCanonicalLesson>;
  function Driver() {
    latest = useCanonicalLesson(LESSON_ID);
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Driver />);
  });
  await act(async () => {
    await latest.open();
  });
  return latest.state;
}

beforeEach(() => {
  jest.clearAllMocks();
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  mockedStage.mockResolvedValue(MEDIA_DIR);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('opening a lesson with media (download consent)', () => {
  it('stores the text but no media while undecided', async () => {
    serveSnapshot();
    const state = await openLesson();
    expect(state.status).toBe('ready');
    expect(mockedStage).not.toHaveBeenCalled();
    expect(getLessonMediaDir(LESSON_ID)).toBeNull();
  });

  it('stores no media with manual consent', async () => {
    setMediaDownloadConsent('manual');
    serveSnapshot();
    await openLesson();
    expect(mockedStage).not.toHaveBeenCalled();
  });

  it('downloads media with auto consent', async () => {
    setMediaDownloadConsent('auto');
    serveSnapshot();
    await openLesson();
    expect(mockedStage).toHaveBeenCalledWith(LESSON_ID, 3, [SEED_MEDIA_URL]);
    expect(getLessonMediaDir(LESSON_ID)).toBe(MEDIA_DIR);
  });

  it('still opens the lesson when the media download fails', async () => {
    setMediaDownloadConsent('auto');
    mockedStage.mockRejectedValue(new Error('network lost'));
    serveSnapshot();
    const state = await openLesson();
    expect(state.status).toBe('ready');
    expect(state.status === 'ready' && state.offline).toBe(false);
    expect(getLessonMediaDir(LESSON_ID)).toBeNull();
  });

  it('keeps media already stored for the same revision', async () => {
    saveLessonSnapshotBody({body: mediaBody(), mediaDir: MEDIA_DIR});
    serveSnapshot();
    await openLesson();
    expect(mockedStage).not.toHaveBeenCalled();
    expect(getLessonMediaDir(LESSON_ID)).toBe(MEDIA_DIR);
  });
});

describe('useLessonMediaDownload', () => {
  function drive(snapshot: LessonSnapshot | null) {
    let latest!: ReturnType<typeof useLessonMediaDownload>;
    function Driver() {
      latest = useLessonMediaDownload(snapshot);
      return null;
    }
    act(() => {
      ReactTestRenderer.create(<Driver />);
    });
    return () => latest;
  }

  it('is none for a lesson without media', () => {
    const body = canonicalLessonBody();
    saveLessonSnapshotBody({body});
    expect(drive(snapshotOf(body))().status).toBe('none');
  });

  it('downloads on request and removes again', async () => {
    const body = mediaBody();
    saveLessonSnapshotBody({body});
    const media = drive(snapshotOf(body));
    expect(media().status).toBe('missing');
    await act(async () => {
      await media().download();
    });
    expect(media().status).toBe('saved');
    expect(getLessonMediaDir(LESSON_ID)).toBe(MEDIA_DIR);
    await act(async () => {
      await media().remove();
    });
    expect(media().status).toBe('missing');
    expect(getLessonMediaDir(LESSON_ID)).toBeNull();
  });

  it('reports a failed download', async () => {
    mockedStage.mockRejectedValue(new Error('network lost'));
    const body = mediaBody();
    saveLessonSnapshotBody({body});
    const media = drive(snapshotOf(body));
    await act(async () => {
      await media().download();
    });
    expect(media().status).toBe('failed');
  });
});
