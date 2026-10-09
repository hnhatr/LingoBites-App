import AsyncStorage from '@react-native-async-storage/async-storage';

import {saveLessonSnapshotBody} from '../canonicalDownloadRepository';
import {
  fetchLessonCreationStatus,
  fetchLessonSnapshot,
} from '../canonicalLessonClient';
import {fetchActiveComposes} from '../composeClient';
import {
  dismissCompose,
  getComposeEntry,
  hydrateComposeTracker,
  markComposeSeen,
  pollCompose,
  pollRunningComposes,
  resetComposeTrackerForTests,
  runningComposeFor,
  trackCompose,
  useComposeTracker,
} from '../composeTracker';

jest.mock('../canonicalLessonClient', () => ({
  fetchLessonCreationStatus: jest.fn(),
  fetchLessonSnapshot: jest.fn(),
}));
jest.mock('../canonicalDownloadRepository', () => ({
  getLessonDownload: jest.fn(() => null),
  saveLessonSnapshotBody: jest.fn(),
}));
jest.mock('../composeClient', () => ({
  fetchActiveComposes: jest.fn(),
}));

const mockedStatus = fetchLessonCreationStatus as jest.Mock;
const mockedActive = fetchActiveComposes as jest.Mock;

const SOURCE = '11111111-1111-4111-8111-111111111111';
const REQUEST = '33333333-3333-4333-8333-333333333301';
const OTHER = '33333333-3333-4333-8333-333333333302';
const LESSON = '55555555-5555-4555-8555-555555555501';
const STORAGE_KEY = 'lesson-compose-requests:v1';

const progress = (stage: string, charged = false) => ({
  stage,
  stage_started_at: null,
  elapsed_ms: 4000,
  expected_ms: 25000,
  quota_charged: charged,
  reason_vi: null,
  suggestion_vi: null,
  dropped_sentence_ids: [],
});

function track(requestId = REQUEST) {
  trackCompose({
    requestId,
    sourceLessonId: SOURCE,
    sourceTitle: 'Ở quán cà phê',
    sentenceIds: ['s1', 's2'],
    now: 1000,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetComposeTrackerForTests();
  await AsyncStorage.clear();
  mockedActive.mockResolvedValue({ok: true, value: []});
});

describe('compose tracker (wait design §3)', () => {
  it('follows a request until its lesson is ready, and stores it', async () => {
    track();
    expect(runningComposeFor(SOURCE)?.requestId).toBe(REQUEST);
    mockedStatus.mockResolvedValueOnce({
      ok: true,
      value: {
        contract_version: 1,
        status: 'processing',
        lesson_id: null,
        error: null,
        compose: progress('writing'),
      },
    });
    await pollCompose(REQUEST);
    expect(getComposeEntry(REQUEST)?.progress?.stage).toBe('writing');

    mockedStatus.mockResolvedValueOnce({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON,
        error: null,
        compose: progress('done', true),
      },
    });
    (fetchLessonSnapshot as jest.Mock).mockResolvedValueOnce({
      ok: true,
      value: {snapshot: {}, rawBody: {lesson: LESSON}},
    });
    await pollRunningComposes();
    // The ready lesson is saved for the library before it is opened.
    expect(saveLessonSnapshotBody).toHaveBeenCalledWith({
      body: {lesson: LESSON},
    });
    expect(getComposeEntry(REQUEST)).toMatchObject({
      status: 'succeeded',
      lessonId: LESSON,
      seen: false,
    });
    const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
    expect(stored[0].status).toBe('succeeded');

    markComposeSeen(REQUEST);
    expect(getComposeEntry(REQUEST)?.seen).toBe(true);
    dismissCompose(REQUEST);
    expect(getComposeEntry(REQUEST)).toBeNull();
  });

  it('keeps a failure with its code and marks a lost network', async () => {
    track();
    mockedStatus.mockResolvedValueOnce({
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      message: 'lost',
      retryable: true,
    });
    await pollCompose(REQUEST);
    expect(getComposeEntry(REQUEST)?.waitingNetwork).toBe(true);

    mockedStatus.mockResolvedValueOnce({
      ok: true,
      value: {
        contract_version: 1,
        status: 'failed',
        lesson_id: null,
        error: {code: 'COMPOSE_TIMEOUT', retryable: true},
        compose: progress('writing', false),
      },
    });
    await pollCompose(REQUEST);
    expect(getComposeEntry(REQUEST)).toMatchObject({
      status: 'failed',
      error: {code: 'COMPOSE_TIMEOUT', retryable: true},
      waitingNetwork: false,
    });
    // A running request is never dismissed by mistake; a finished one is.
    track(OTHER);
    dismissCompose(OTHER);
    expect(getComposeEntry(OTHER)).not.toBeNull();
  });

  it('restores stored requests and adds the Server running ones', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          requestId: REQUEST,
          sourceLessonId: SOURCE,
          sourceTitle: 'Ở quán cà phê',
          sentenceIds: ['s1', 's2'],
          createdAt: 1000,
          status: 'running',
          progress: null,
          lessonId: null,
          error: null,
          seen: false,
          waitingNetwork: false,
        },
        {broken: true},
      ]),
    );
    mockedActive.mockResolvedValue({
      ok: true,
      value: [
        {
          id: REQUEST,
          status: 'processing',
          source_lesson_id: SOURCE,
          source_lesson_title: 'Ở quán cà phê',
          sentence_ids: ['s1', 's2'],
          compose: progress('writing'),
        },
        {
          id: OTHER,
          status: 'queued',
          source_lesson_id: SOURCE,
          source_lesson_title: 'Từ máy khác',
          sentence_ids: ['s3', 's4'],
          compose: progress('queued'),
        },
      ],
    });
    await hydrateComposeTracker(10_000);
    const entries = useComposeTracker.getState().entries;
    expect(entries.map(entry => entry.requestId)).toEqual([REQUEST, OTHER]);
    expect(getComposeEntry(OTHER)?.sourceTitle).toBe('Từ máy khác');
  });

  it('stops following a request the Server no longer knows', async () => {
    track();
    mockedStatus.mockResolvedValueOnce({
      ok: false,
      kind: 'not-found',
      errorCode: 'CREATION_REQUEST_NOT_FOUND',
      message: 'gone',
      retryable: false,
    });
    await pollCompose(REQUEST);
    expect(getComposeEntry(REQUEST)).toBeNull();
  });
});
