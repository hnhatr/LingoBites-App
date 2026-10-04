import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import React from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {countSpeakingAttempts} from '@features/speaking/logic/data/SpeakingAttemptRepository';
import {countSpeakingRecordingsForSentence} from '@features/speaking/logic/data/SpeakingRepository';
import {listPendingSyncEvents} from '@features/sync/logic/adapters/SyncOutboxRepository';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import * as saveShadowingAttemptModule from '../saveShadowingAttempt';
import {
  SHADOWING_MAX_RECORDING_MS,
  useShadowingSession,
  type UseShadowingSessionResult,
} from '../useShadowingSession';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222221';
const S2 = '22222222-2222-4222-8222-222222222222';
const TAKE_OLD = '33333333-3333-4333-8333-333333333331';
const TAKE_NEW = '33333333-3333-4333-8333-333333333332';
const TAKE_OTHER = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const T0 = '2026-10-04T10:00:00.000Z';

const mockSpeak = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockDeleteRecordingFile = jest.fn();
const mockPlayRecording = jest.fn();
const mockRequestDrain = jest.fn();

jest.mock('@features/audio', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
}));

jest.mock('../../recordingService', () => ({
  startRecording: (...args: unknown[]) => mockStartRecording(...args),
  stopRecording: (...args: unknown[]) => mockStopRecording(...args),
  deleteRecordingFile: (...args: unknown[]) => mockDeleteRecordingFile(...args),
  playRecording: (...args: unknown[]) => mockPlayRecording(...args),
}));

jest.mock('../../upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: () => mockRequestDrain(),
}));

jest.mock('../shadowingLessons', () => ({
  loadShadowingLessonSnapshot: () => ({
    lessonId: LESSON_ID,
    titleVi: 'Lesson',
    sentences: [
      {
        id: S1,
        position: 0,
        textEn: 'First line',
        textVi: 'Câu một',
        ipa: '/fɜːrst/',
      },
      {
        id: S2,
        position: 1,
        textEn: 'Second line',
        textVi: 'Câu hai',
        ipa: '/sekənd/',
      },
    ],
  }),
}));

type ResolveStop = (value: {
  ok: boolean;
  filePath?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
}) => void;

let dbPath: string;
let db: RealSqliteConnection;
let appStateHandler: ((state: AppStateStatus) => void) | null;
let takeSequence: string[];
let virtualFiles: Set<string>;

function input(
  takeId: string,
  sentenceId: string,
  filePath: string,
  overrides: Partial<
    Parameters<typeof saveShadowingAttemptModule.saveShadowingAttempt>[0]
  > = {},
) {
  return {
    takeId,
    lessonId: LESSON_ID,
    sentenceId,
    filePath,
    durationMs: 1500,
    checkFullSentence: true,
    checkKeyWords: true,
    checkRhythm: true,
    sentence: {
      textEn: 'Hello world',
      textVi: 'Xin chào',
      ipa: '/həˈloʊ/',
    },
    practicedAt: T0,
    ...overrides,
  };
}

function makeDriver(generateTakeId = () => TAKE_NEW) {
  const latest: {current: UseShadowingSessionResult | null} = {current: null};
  function Driver() {
    latest.current = useShadowingSession({
      lessonId: LESSON_ID,
      generateTakeId,
    });
    return null;
  }
  return {Driver, latest};
}

function installSingletonRecorderModel() {
  let activePath: string | null = null;
  mockStartRecording.mockImplementation(async () => {
    const filePath = takeSequence.shift() ?? '/files/fallback.m4a';
    if (activePath === null) {
      activePath = filePath;
      virtualFiles.add(filePath);
    }
    return {ok: true, filePath};
  });
  mockStopRecording.mockImplementation(
    async (_requestedPath: string, startedAt: number) => {
      const stoppedPath = activePath;
      activePath = null;
      return {
        ok: true,
        filePath: stoppedPath ?? 'Already stopped',
        durationMs: Date.now() - startedAt,
      };
    },
  );
}

async function mountRecordedTake(filePath = '/files/current.m4a') {
  takeSequence = [filePath];
  const driver = makeDriver();
  await act(async () => {
    ReactTestRenderer.create(React.createElement(driver.Driver));
  });
  await act(async () => {
    await driver.latest.current?.startRecordingTake();
    jest.advanceTimersByTime(1_000);
  });
  await act(async () => {
    await driver.latest.current?.stopRecordingTake();
  });
  expect(driver.latest.current?.sessionState).toBe('recorded');
  expect(driver.latest.current?.take?.filePath).toBe(filePath);
  return driver;
}

function markTakePassing(
  driver: Awaited<ReturnType<typeof mountRecordedTake>>,
) {
  act(() => {
    driver.latest.current?.setSelfCheckItem('fullSentence', true);
    driver.latest.current?.setSelfCheckItem('keyWords', true);
    driver.latest.current?.setSelfCheckItem('rhythm', true);
  });
  expect(driver.latest.current?.selfCheck).toEqual({
    fullSentence: true,
    keyWords: true,
    rhythm: true,
  });
}

function recordingRow(id: string): {id: string; file_path: string} | undefined {
  return getDatabase()
    .execute(
      'SELECT id, file_path FROM speaking_recordings WHERE id = ? LIMIT 1;',
      [id],
    )
    .rows?.item(0) as {id: string; file_path: string} | undefined;
}

beforeEach(() => {
  dbPath = path.join(
    os.tmpdir(),
    `ling242-adversarial-${Date.now()}-${Math.random()}.sqlite`,
  );
  db = openRealSqlite(dbPath);
  resetDatabaseForTests(db);
  runMigrations(db);
  db.execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    ['current_account_id', USER_ID, T0],
  );

  appStateHandler = null;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, handler) => {
      appStateHandler = handler;
      return {remove: jest.fn()};
    });
  jest.useFakeTimers();
  jest.setSystemTime(new Date(T0));
  jest.clearAllMocks();

  takeSequence = ['/files/current.m4a'];
  virtualFiles = new Set();
  mockStartRecording.mockImplementation(async () => {
    const filePath = takeSequence.shift() ?? '/files/fallback.m4a';
    virtualFiles.add(filePath);
    return {ok: true, filePath};
  });
  mockStopRecording.mockImplementation(
    async (filePath: string, startedAt: number) => ({
      ok: true,
      filePath,
      durationMs: Date.now() - startedAt,
    }),
  );
  mockDeleteRecordingFile.mockImplementation(async (filePath: string) => {
    virtualFiles.delete(filePath);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  db.close();
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }
  resetDatabaseForTests(null);
});

describe('LING-242 adversarial shadowing session', () => {
  it('ADV-001 / INV-001: replacement does not unlink a file still owned by another saved attempt', async () => {
    const sharedPath = '/files/shared.m4a';
    virtualFiles.add(sharedPath);
    expect(
      saveShadowingAttemptModule.saveShadowingAttempt(
        input(TAKE_OLD, S1, sharedPath),
      ).ok,
    ).toBe(true);
    expect(
      saveShadowingAttemptModule.saveShadowingAttempt(
        input(TAKE_OTHER, S2, sharedPath),
      ).ok,
    ).toBe(true);

    const driver = await mountRecordedTake('/files/new.m4a');
    markTakePassing(driver);
    await act(async () => {
      await driver.latest.current?.saveAndContinue();
    });

    expect(recordingRow(TAKE_OTHER)).toEqual({
      id: TAKE_OTHER,
      file_path: sharedPath,
    });
    expect(virtualFiles.has(sharedPath)).toBe(true);
  });

  it('ADV-002 / INV-001: concurrent re-record and save cannot unlink the newly saved take', async () => {
    const oldPath = '/files/racing-take.m4a';
    const driver = await mountRecordedTake(oldPath);
    markTakePassing(driver);
    takeSequence.push('/files/re-recorded.m4a');

    let releaseDelete: (() => void) | undefined;
    mockDeleteRecordingFile.mockImplementationOnce(
      (filePath: string) =>
        new Promise<void>(resolve => {
          releaseDelete = () => {
            virtualFiles.delete(filePath);
            resolve();
          };
        }),
    );

    const reRecord = driver.latest.current!.reRecord;
    const save = driver.latest.current!.saveAndContinue;
    let reRecordPromise!: Promise<void>;
    await act(async () => {
      reRecordPromise = reRecord();
      await save();
    });

    expect(recordingRow(TAKE_NEW)).toEqual({
      id: TAKE_NEW,
      file_path: oldPath,
    });
    await act(async () => {
      releaseDelete?.();
      await reRecordPromise;
    });

    expect(virtualFiles.has(oldPath)).toBe(true);
  });

  it('ADV-003 / AC-007: auto-stop racing background keeps one recorded take', async () => {
    const stopResolvers: ResolveStop[] = [];
    mockStopRecording.mockImplementation(
      () =>
        new Promise(resolve => {
          stopResolvers.push(resolve as ResolveStop);
        }),
    );

    const takeSequenceBeforeMount = ['/files/lifecycle.m4a'];
    takeSequence = takeSequenceBeforeMount;
    const driver = makeDriver();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(driver.Driver));
    });
    await act(async () => {
      await driver.latest.current?.startRecordingTake();
    });
    act(() => {
      jest.advanceTimersByTime(SHADOWING_MAX_RECORDING_MS);
    });
    act(() => {
      appStateHandler?.('background');
    });

    expect(stopResolvers).toHaveLength(1);
    await act(async () => {
      stopResolvers[0]?.({
        ok: true,
        filePath: '/files/lifecycle.m4a',
        durationMs: SHADOWING_MAX_RECORDING_MS,
      });
      await Promise.resolve();
    });
    expect(driver.latest.current?.sessionState).toBe('recorded');
    expect(driver.latest.current?.take?.filePath).toBe('/files/lifecycle.m4a');
    expect(mockStopRecording.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('ADV-004 / BR-002: a second session mount cannot disarm the active 30s stop', async () => {
    takeSequence = ['/files/first-session.m4a'];
    const first = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(first.Driver));
    });
    await act(async () => {
      await first.latest.current?.startRecordingTake();
    });

    const second = makeDriver(() => TAKE_OTHER);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(second.Driver));
    });
    await act(async () => {
      jest.advanceTimersByTime(SHADOWING_MAX_RECORDING_MS);
    });

    expect(first.latest.current?.sessionState).toBe('recorded');
    expect(first.latest.current?.take?.filePath).toBe(
      '/files/first-session.m4a',
    );
    expect(mockStopRecording.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('ADV-005 / AC-007: an older timer cannot consume the newer session recording', async () => {
    takeSequence = ['/files/first-session.m4a', '/files/second-session.m4a'];
    installSingletonRecorderModel();
    const first = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(first.Driver));
    });
    await act(async () => {
      await first.latest.current?.startRecordingTake();
      jest.advanceTimersByTime(20_000);
    });

    const second = makeDriver(() => TAKE_OTHER);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(second.Driver));
    });
    await act(async () => {
      await second.latest.current?.startRecordingTake();
      jest.advanceTimersByTime(10_000);
    });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });

    expect(first.latest.current?.take?.filePath).toBe(
      '/files/first-session.m4a',
    );
    expect(second.latest.current?.sessionState).toBe('recorded');
    expect(second.latest.current?.take?.filePath).toBe(
      '/files/second-session.m4a',
    );
  });

  it('ADV-006 / AC-007: background stops the visible session without cross-assigning takes', async () => {
    const handlers: Array<(state: AppStateStatus) => void> = [];
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type, handler) => {
        handlers.push(handler);
        return {remove: jest.fn()};
      },
    );
    takeSequence = ['/files/background-old.m4a', '/files/background-new.m4a'];
    installSingletonRecorderModel();

    const first = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(first.Driver));
    });
    await act(async () => {
      await first.latest.current?.startRecordingTake();
    });
    const second = makeDriver(() => TAKE_OTHER);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(second.Driver));
    });
    await act(async () => {
      await second.latest.current?.startRecordingTake();
    });
    await act(async () => {
      handlers.forEach(handler => handler('background'));
      await Promise.resolve();
    });

    expect(first.latest.current?.take?.filePath).toBe(
      '/files/background-old.m4a',
    );
    expect(second.latest.current?.sessionState).toBe('recorded');
    expect(second.latest.current?.take?.filePath).toBe(
      '/files/background-new.m4a',
    );
  });

  it('ADV-007 / AC-007: a third session start cannot inherit the first session native path', async () => {
    takeSequence = ['/files/first-native.m4a', '/files/third-native.m4a'];
    installSingletonRecorderModel();

    const first = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(first.Driver));
    });
    await act(async () => {
      await first.latest.current?.startRecordingTake();
    });

    await act(async () => {
      ReactTestRenderer.create(React.createElement(makeDriver().Driver));
    });

    const third = makeDriver(() => TAKE_OTHER);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(third.Driver));
    });
    await act(async () => {
      await third.latest.current?.startRecordingTake();
      jest.advanceTimersByTime(SHADOWING_MAX_RECORDING_MS);
    });

    expect(first.latest.current?.take?.filePath).toBe(
      '/files/first-native.m4a',
    );
    expect(third.latest.current?.sessionState).toBe('recorded');
    expect(third.latest.current?.take?.filePath).toBe(
      '/files/third-native.m4a',
    );
  });

  it('ADV-008 / AC-007: background stops the active recorder behind a newer idle session', async () => {
    const handlers: Array<(state: AppStateStatus) => void> = [];
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type, handler) => {
        handlers.push(handler);
        return {remove: jest.fn()};
      },
    );
    takeSequence = ['/files/background-active.m4a'];

    const active = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(active.Driver));
    });
    await act(async () => {
      await active.latest.current?.startRecordingTake();
    });
    await act(async () => {
      ReactTestRenderer.create(React.createElement(makeDriver().Driver));
    });
    await act(async () => {
      handlers.forEach(handler => handler('background'));
      await Promise.resolve();
    });

    expect(active.latest.current?.sessionState).toBe('recorded');
    expect(active.latest.current?.take?.filePath).toBe(
      '/files/background-active.m4a',
    );
    expect(mockStopRecording.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('H1 / BR-002 HELD: a third mount leaves the active session auto-stop armed', async () => {
    takeSequence = ['/files/three-mounts.m4a'];
    const first = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(first.Driver));
    });
    await act(async () => {
      await first.latest.current?.startRecordingTake();
    });
    await act(async () => {
      ReactTestRenderer.create(React.createElement(makeDriver().Driver));
      ReactTestRenderer.create(React.createElement(makeDriver().Driver));
      jest.advanceTimersByTime(SHADOWING_MAX_RECORDING_MS);
    });

    expect(first.latest.current?.sessionState).toBe('recorded');
    expect(first.latest.current?.take?.filePath).toBe(
      '/files/three-mounts.m4a',
    );
  });

  it('H3 / AC-012 HELD: discarding while recording stops and removes the unsaved take', async () => {
    takeSequence = ['/files/discard-recording.m4a'];
    const driver = makeDriver(() => TAKE_NEW);
    await act(async () => {
      ReactTestRenderer.create(React.createElement(driver.Driver));
    });
    await act(async () => {
      await driver.latest.current?.startRecordingTake();
    });
    await act(async () => {
      await driver.latest.current?.discardUnsavedTake();
    });

    expect(driver.latest.current?.sessionState).toBe('idle');
    expect(virtualFiles.has('/files/discard-recording.m4a')).toBe(false);
    expect(mockStopRecording.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it.each(['reRecord', 'skipSentence', 'discardUnsavedTake'] as const)(
    'H1 / INV-001 HELD: %s does not delete a take protected by a recording row',
    async action => {
      const protectedPath = `/files/protected-${action}.m4a`;
      const driver = await mountRecordedTake(protectedPath);
      expect(
        saveShadowingAttemptModule.saveShadowingAttempt(
          input(TAKE_NEW, S1, protectedPath),
        ).ok,
      ).toBe(true);

      await act(async () => {
        await driver.latest.current?.[action]();
      });

      expect(recordingRow(TAKE_NEW)?.file_path).toBe(protectedPath);
      expect(mockDeleteRecordingFile).not.toHaveBeenCalledWith(protectedPath);
      expect(virtualFiles.has(protectedPath)).toBe(true);
    },
  );

  it('H3 / AC-010 S1 HELD: a repeated save keeps one persisted row set', async () => {
    const driver = await mountRecordedTake('/files/idempotent.m4a');
    markTakePassing(driver);
    const save = driver.latest.current!.saveAndContinue;
    await act(async () => {
      await Promise.all([save(), save()]);
    });

    expect(countSpeakingAttempts()).toBeLessThanOrEqual(1);
    expect(
      countSpeakingRecordingsForSentence('shadowing', S1),
    ).toBeLessThanOrEqual(1);
    expect(listPendingSyncEvents()).toHaveLength(1);
    expect(recordingRow(TAKE_NEW)?.file_path).toBe('/files/idempotent.m4a');
    expect(virtualFiles.has('/files/idempotent.m4a')).toBe(true);
  });

  it('H4 / BR-007 HELD: skip advances without persisted or upload side effects', async () => {
    const driver = makeDriver();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(driver.Driver));
    });
    act(() => {
      driver.latest.current?.skipSentence();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(driver.latest.current?.sentenceIndex).toBe(1);
    expect(countSpeakingAttempts()).toBe(0);
    expect(countSpeakingRecordingsForSentence('shadowing', S1)).toBe(0);
    expect(listPendingSyncEvents()).toHaveLength(0);
    expect(mockRequestDrain).not.toHaveBeenCalled();
  });

  it('AC-012 HELD: closing deletes only the unsaved take and preserves prior saved data', async () => {
    const savedPath = '/files/saved-prior-sentence.m4a';
    virtualFiles.add(savedPath);
    expect(
      saveShadowingAttemptModule.saveShadowingAttempt(
        input(TAKE_OLD, S2, savedPath),
      ).ok,
    ).toBe(true);
    const driver = await mountRecordedTake('/files/unsaved-current.m4a');

    await act(async () => {
      await driver.latest.current?.discardUnsavedTake();
    });

    expect(virtualFiles.has('/files/unsaved-current.m4a')).toBe(false);
    expect(recordingRow(TAKE_OLD)?.file_path).toBe(savedPath);
    expect(virtualFiles.has(savedPath)).toBe(true);
  });
});
