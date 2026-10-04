import React from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {DEFAULT_TTS_RATE} from '@features/audio/logic/ttsService';

import {
  formatShadowingElapsed,
  isShadowingTakeFileProtected,
  SHADOWING_MAX_RECORDING_MS,
  SHADOWING_SLOW_TTS_RATE,
  useShadowingSession,
  type UseShadowingSessionResult,
} from '../useShadowingSession';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222221';
const S2 = '22222222-2222-4222-8222-222222222222';

const mockSpeak = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockDeleteRecordingFile = jest.fn();
const mockPlayRecording = jest.fn();
const mockSaveShadowingAttempt = jest.fn();
const mockRequestDrain = jest.fn();

jest.mock('@features/audio', () => ({
  DEFAULT_TTS_RATE: 0.5,
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

jest.mock('../saveShadowingAttempt', () => ({
  saveShadowingAttempt: (...args: unknown[]) =>
    mockSaveShadowingAttempt(...args),
}));

jest.mock('../shadowingLessons', () => ({
  loadShadowingLessonSnapshot: jest.fn(() => ({
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
  })),
}));

const mockDbExecute = jest.fn((_sql?: string, _params?: unknown[]) => ({
  rows: {item: () => undefined},
}));

jest.mock('@core/db/database', () => ({
  getDatabase: () => ({
    execute: (sql: string, params?: unknown[]) => mockDbExecute(sql, params),
  }),
}));

type SessionDriver = UseShadowingSessionResult;

function makeSessionDriver(options?: {
  initialSentenceIndex?: number;
  onSessionComplete?: () => void;
  generateTakeId?: () => string;
}) {
  const latest: {current: SessionDriver | null} = {current: null};
  function Driver() {
    latest.current = useShadowingSession({
      lessonId: LESSON_ID,
      initialSentenceIndex: options?.initialSentenceIndex,
      onSessionComplete: options?.onSessionComplete,
      generateTakeId: options?.generateTakeId,
    });
    return null;
  }
  return {Driver, latest};
}

describe('formatShadowingElapsed', () => {
  it('AC-007 S3: formats seven seconds as 00:07', () => {
    expect(formatShadowingElapsed(7_000)).toBe('00:07');
  });
});

describe('useShadowingSession', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    appStateHandler = null;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        appStateHandler = handler;
        return {remove: jest.fn()};
      });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
    jest.clearAllMocks();
    mockDbExecute.mockImplementation(() => ({
      rows: {item: () => undefined},
    }));
    mockStartRecording.mockResolvedValue({
      ok: true,
      filePath: '/tmp/take-a.m4a',
    });
    mockStopRecording.mockImplementation(
      async (_path: string, startedAt: number) => ({
        ok: true,
        filePath: '/tmp/take-a.m4a',
        durationMs: Date.now() - startedAt,
      }),
    );
    mockSaveShadowingAttempt.mockReturnValue({
      ok: true,
      replay: false,
      unlinkedFilePaths: [],
      recording: {},
      attemptId: 'attempt-1',
    });
    mockSpeak.mockResolvedValue({ok: true});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('AC-006 S1: normal and slow TTS use the sentence text with slower second rate', async () => {
    const {Driver, latest} = makeSessionDriver();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.playNormalSample();
      await latest.current?.playSlowSample();
    });
    expect(mockSpeak).toHaveBeenNthCalledWith(
      1,
      'First line',
      undefined,
      DEFAULT_TTS_RATE,
    );
    expect(mockSpeak).toHaveBeenNthCalledWith(
      2,
      'First line',
      undefined,
      SHADOWING_SLOW_TTS_RATE,
    );
    expect(SHADOWING_SLOW_TTS_RATE).toBeLessThan(DEFAULT_TTS_RATE);
  });

  it('AC-007 S1: auto-stops once at 30s and keeps the take in recorded state', async () => {
    const {Driver, latest} = makeSessionDriver({
      generateTakeId: () => 'take-1',
    });
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.startRecordingTake();
    });
    await act(async () => {
      jest.advanceTimersByTime(SHADOWING_MAX_RECORDING_MS);
    });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(latest.current?.sessionState).toBe('recorded');
    expect(latest.current?.take?.filePath).toBe('/tmp/take-a.m4a');
  });

  it('AC-007 S2: AppState background stops recording and keeps the take', async () => {
    const {Driver, latest} = makeSessionDriver();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.startRecordingTake();
    });
    await act(async () => {
      appStateHandler?.('background');
    });
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(latest.current?.sessionState).toBe('recorded');
  });

  it('AC-007 S3: elapsed counter reaches 00:07 after seven seconds', async () => {
    const {Driver, latest} = makeSessionDriver();
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.startRecordingTake();
    });
    await act(async () => {
      jest.advanceTimersByTime(7_000);
    });
    expect(formatShadowingElapsed(latest.current?.elapsedMs ?? 0)).toBe(
      '00:07',
    );
  });

  it('AC-008 S1: re-record deletes the previous unsaved take file', async () => {
    mockStartRecording
      .mockResolvedValueOnce({ok: true, filePath: '/tmp/take-old.m4a'})
      .mockResolvedValueOnce({ok: true, filePath: '/tmp/take-new.m4a'});
    mockStopRecording.mockImplementation(
      async (path: string, startedAt: number) => ({
        ok: true,
        filePath: path,
        durationMs: Date.now() - startedAt,
      }),
    );
    const {Driver, latest} = makeSessionDriver({
      generateTakeId: () => 'take-1',
    });
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.startRecordingTake();
      jest.advanceTimersByTime(1_000);
    });
    await act(async () => {
      await latest.current?.stopRecordingTake();
    });
    expect(latest.current?.sessionState).toBe('recorded');
    await act(async () => {
      await latest.current?.reRecord();
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      await latest.current?.stopRecordingTake();
    });
    expect(mockDeleteRecordingFile).toHaveBeenCalledWith('/tmp/take-old.m4a');
    await act(async () => {
      await latest.current?.playMyTake();
    });
    expect(mockPlayRecording).toHaveBeenLastCalledWith('/tmp/take-new.m4a');
  });

  it('INV-001: does not delete a take file still referenced in speaking_recordings', () => {
    mockDbExecute.mockReturnValueOnce({
      rows: {item: () => ({id: 'saved-take'})},
    } as never);
    expect(isShadowingTakeFileProtected('/saved/path.m4a')).toBe(true);
    mockDbExecute.mockReturnValueOnce({
      rows: {item: () => undefined},
    });
    expect(isShadowingTakeFileProtected('/unsaved/path.m4a')).toBe(false);
  });

  it('AC-010 S1: save passes self-check values and advances to the next sentence', async () => {
    const {Driver, latest} = makeSessionDriver({
      generateTakeId: () => 'take-save',
    });
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      await latest.current?.startRecordingTake();
      jest.advanceTimersByTime(2_000);
    });
    await act(async () => {
      await latest.current?.stopRecordingTake();
    });
    act(() => {
      latest.current?.setSelfCheckItem('fullSentence', true);
      latest.current?.setSelfCheckItem('keyWords', true);
    });
    await act(async () => {
      await latest.current?.saveAndContinue();
    });
    expect(mockSaveShadowingAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: LESSON_ID,
        sentenceId: S1,
        checkFullSentence: true,
        checkKeyWords: true,
        checkRhythm: false,
        takeId: 'take-save',
      }),
    );
    expect(latest.current?.sentenceIndex).toBe(1);
  });

  it('AC-011 S1: skip advances without calling save', async () => {
    const {Driver, latest} = makeSessionDriver({initialSentenceIndex: 0});
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });
    await act(async () => {
      latest.current?.skipSentence();
    });
    expect(latest.current?.sentenceIndex).toBe(1);
    expect(mockSaveShadowingAttempt).not.toHaveBeenCalled();
  });
});
