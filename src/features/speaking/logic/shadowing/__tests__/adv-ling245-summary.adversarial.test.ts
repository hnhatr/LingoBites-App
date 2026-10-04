import React from 'react';
import {AppState} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  type ShadowingSessionSummary,
  useShadowingSession,
  type UseShadowingSessionResult,
} from '../useShadowingSession';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_A = '22222222-2222-4222-8222-222222222221';
const SENTENCE_B = '22222222-2222-4222-8222-222222222222';
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockSaveShadowingAttempt = jest.fn();

jest.mock('@features/audio', () => ({speak: jest.fn()}));

jest.mock('../../recordingService', () => ({
  startRecording: (...args: unknown[]) => mockStartRecording(...args),
  stopRecording: (...args: unknown[]) => mockStopRecording(...args),
  deleteRecordingFile: jest.fn(),
  playRecording: jest.fn(),
}));

jest.mock('../../upload/recordingUploadQueue', () => ({
  requestRecordingUploadDrain: jest.fn(),
}));

jest.mock('../saveShadowingAttempt', () => ({
  saveShadowingAttempt: (...args: unknown[]) =>
    mockSaveShadowingAttempt(...args),
}));

jest.mock('../shadowingLessons', () => ({
  loadShadowingLessonSnapshot: () => ({
    lessonId: LESSON_ID,
    titleVi: 'Bai thu nghiem',
    sentences: [
      {
        id: SENTENCE_A,
        position: 0,
        textEn: 'First',
        textVi: 'Mot',
        ipa: '/first/',
      },
      {
        id: SENTENCE_B,
        position: 1,
        textEn: 'Second',
        textVi: 'Hai',
        ipa: '/second/',
      },
    ],
  }),
}));

jest.mock('@core/db/database', () => ({
  getDatabase: () => ({
    execute: jest.fn(() => ({rows: {item: () => undefined}})),
  }),
}));

describe('LING-245 summary source data', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-04T10:00:00.000Z'));
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
    mockStartRecording.mockReset();
    mockStopRecording.mockReset();
    mockSaveShadowingAttempt.mockReset();
    mockStartRecording.mockImplementation(async (_mode, takeId: string) => ({
      ok: true,
      filePath: `/tmp/${takeId}.m4a`,
    }));
    mockStopRecording.mockImplementation(
      async (filePath: string, startedAtMs: number) => ({
        ok: true,
        filePath,
        durationMs: Date.now() - startedAtMs,
      }),
    );
    mockSaveShadowingAttempt
      .mockReturnValueOnce({
        ok: true,
        replay: false,
        unlinkedFilePaths: [],
        recording: {
          id: 'recording-a',
          serverRecordingId: null,
          uploadState: 'pending',
        },
        attemptId: 'attempt-a',
      })
      .mockReturnValueOnce({
        ok: true,
        replay: false,
        unlinkedFilePaths: [],
        recording: {
          id: 'recording-b',
          serverRecordingId: null,
          uploadState: 'local_only',
        },
        attemptId: 'attempt-b',
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('H4 / AC-013 HELD: summary counts only saved session attempts and includes exactly the failed rows', async () => {
    const summaries: ShadowingSessionSummary[] = [];
    const latest: {current: UseShadowingSessionResult | null} = {current: null};
    let takeNumber = 0;
    function Driver() {
      latest.current = useShadowingSession({
        lessonId: LESSON_ID,
        generateTakeId: () => `take-${(takeNumber += 1)}`,
        onSessionComplete: summary => summaries.push(summary),
      });
      return null;
    }
    await act(async () => {
      ReactTestRenderer.create(React.createElement(Driver));
    });

    await act(async () => {
      await latest.current?.startRecordingTake();
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      await latest.current?.stopRecordingTake();
    });
    act(() => {
      latest.current?.setSelfCheckItem('fullSentence', true);
      latest.current?.setSelfCheckItem('keyWords', true);
      latest.current?.setSelfCheckItem('rhythm', true);
    });
    await act(async () => {
      await latest.current?.saveAndContinue();
    });

    await act(async () => {
      await latest.current?.startRecordingTake();
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      await latest.current?.stopRecordingTake();
    });
    await act(async () => {
      await latest.current?.saveAndContinue();
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual(
      expect.objectContaining({
        savedCount: 2,
        failedCount: 1,
        elapsedMs: 3000,
      }),
    );
    expect(summaries[0]?.failedSentences).toEqual([
      expect.objectContaining({
        sentenceId: SENTENCE_B,
        recordingId: 'recording-b',
      }),
    ]);
  });
});
