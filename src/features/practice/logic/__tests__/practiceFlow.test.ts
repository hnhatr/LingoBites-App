import {preparePracticeSet, hashPracticeConfig} from '../practiceFlow';
import {
  createPracticeSetApi,
  getPracticeSetApi,
} from '../../../../shared/api/practiceClient';
import {
  findActiveSessionLocally,
  findReusablePracticeSetLocally,
  getPracticeSet,
  savePracticeSet,
} from '../data/PracticeRepository';

jest.mock('../../../../shared/api/practiceClient');
jest.mock('../data/PracticeRepository');

const mockCreateApi = createPracticeSetApi as jest.Mock;
const mockGetApi = getPracticeSetApi as jest.Mock;
const mockFindActiveSession = findActiveSessionLocally as jest.Mock;
const mockFindReusable = findReusablePracticeSetLocally as jest.Mock;
const mockGetSet = getPracticeSet as jest.Mock;
const mockSaveSet = savePracticeSet as jest.Mock;

describe('practiceFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseConfig = {
    types: ['meaning_choice' as const],
    difficulty: 'beginner',
    question_count: 5,
  };
  const idempotencyKey = 'test-key';
  const lessonId = 'lesson-1';

  it('resumes active session if one exists', async () => {
    mockFindActiveSession.mockReturnValue({
      id: 'session-1',
      practice_set_id: 'set-1',
    });
    mockGetSet.mockReturnValue({id: 'set-1', lesson_revision: 2});

    // Requesting with revision 2 (match)
    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res).toEqual({
      status: 'ready',
      practiceSet: {id: 'set-1', lesson_revision: 2},
      sessionToResume: {id: 'session-1', practice_set_id: 'set-1'},
      hasVersionMismatchWarning: false,
    });
    expect(mockCreateApi).not.toHaveBeenCalled();
  });

  it('resumes active session with warning if lesson_revision drifts', async () => {
    mockFindActiveSession.mockReturnValue({
      id: 'session-1',
      practice_set_id: 'set-1',
    });
    mockGetSet.mockReturnValue({id: 'set-1', lesson_revision: 1}); // old revision

    // Requesting with revision 2 (drift)
    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res).toEqual({
      status: 'ready',
      practiceSet: {id: 'set-1', lesson_revision: 1},
      sessionToResume: {id: 'session-1', practice_set_id: 'set-1'},
      hasVersionMismatchWarning: true,
    });
  });

  it('reuses local set if valid and no active session', async () => {
    mockFindActiveSession.mockReturnValue(null);
    const mockSet = {id: 'set-local', lesson_revision: 2};
    mockFindReusable.mockReturnValue(mockSet);

    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res).toEqual({
      status: 'ready',
      practiceSet: mockSet,
      hasVersionMismatchWarning: false,
    });
    expect(mockFindReusable).toHaveBeenCalledWith(
      lessonId,
      2,
      hashPracticeConfig(baseConfig),
    );
    expect(mockCreateApi).not.toHaveBeenCalled();
  });

  it('creates new set and polls if no local reuse', async () => {
    mockFindActiveSession.mockReturnValue(null);
    mockFindReusable.mockReturnValue(null);

    mockCreateApi.mockResolvedValue({
      status: 'generating',
      practiceSetId: 'set-new',
      pollAfterMs: 10,
    });
    mockGetApi
      .mockResolvedValueOnce({
        status: 'generating',
        practiceSetId: 'set-new',
        pollAfterMs: 10,
      })
      .mockResolvedValueOnce({status: 'ready', practiceSet: {id: 'set-new'}});

    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res).toEqual({
      status: 'ready',
      practiceSet: {id: 'set-new'},
      hasVersionMismatchWarning: false,
    });

    expect(mockCreateApi).toHaveBeenCalledTimes(1);
    expect(mockGetApi).toHaveBeenCalledTimes(2);
    expect(mockSaveSet).toHaveBeenCalledWith({id: 'set-new'});
  });

  it('returns network_error on API failure without saving', async () => {
    mockFindActiveSession.mockReturnValue(null);
    mockFindReusable.mockReturnValue(null);
    mockCreateApi.mockRejectedValue(new Error('Network disconnected'));

    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res.status).toBe('network_error');
    expect(mockSaveSet).not.toHaveBeenCalled();
  });

  it('forwards server refusal (HTTP 422) without polling or saving', async () => {
    mockFindActiveSession.mockReturnValue(null);
    mockFindReusable.mockReturnValue(null);
    mockCreateApi.mockResolvedValue({
      status: 'rejected',
      code: 'INSUFFICIENT_VALIDATED_SOURCE',
    });

    const res = await preparePracticeSet(
      lessonId,
      2,
      baseConfig,
      idempotencyKey,
    );
    expect(res).toEqual({
      status: 'rejected',
      code: 'INSUFFICIENT_VALIDATED_SOURCE',
    });
    expect(mockGetApi).not.toHaveBeenCalled();
    expect(mockSaveSet).not.toHaveBeenCalled();
  });
});
