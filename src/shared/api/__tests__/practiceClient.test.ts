import * as AuthSession from '@shared/auth/authSession';
import {createPracticeSetApi, getPracticeSetApi} from '../practiceClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const config = {
  types: ['meaning_choice'] as ('meaning_choice' | 'cloze_choice')[],
  difficulty: 'beginner',
  question_count: 5,
};

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(AuthSession, 'ensureValidSession').mockResolvedValue({
    status: 'valid',
    session: {
      access_token: 'test-token',
      session_id: '1',
      refresh_token: '2',
      access_expires_at: '2050',
      refresh_expires_at: '2050',
    },
    userId: 'user1',
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('practiceClient auth headers (SETE-209)', () => {
  it('sends the authenticated token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: jest.fn().mockResolvedValue({
        status: 'generating',
        practice_set_id: 'set-1',
        poll_after_ms: 1000,
      }),
    });

    await createPracticeSetApi('lesson-1', 3, config, 'idem-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers.Authorization).not.toContain('[object Object]');
  });

  it('getPracticeSetApi sends the token too', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: jest.fn().mockResolvedValue({
        status: 'generating',
        practice_set_id: 'set-1',
        poll_after_ms: 1000,
      }),
    });

    await getPracticeSetApi('lesson-1', 'set-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('maps HTTP 422 refusal to a typed rejected result, not a throw', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({
        request_id: 'r1',
        status: 'failed',
        error: {code: 'INSUFFICIENT_VALIDATED_SOURCE', message: 'too few'},
      }),
    });

    await expect(
      createPracticeSetApi('lesson-1', 3, config, 'idem-1'),
    ).resolves.toEqual({
      status: 'rejected',
      code: 'INSUFFICIENT_VALIDATED_SOURCE',
    });
  });

  it('maps HTTP 422 with an unreadable body to rejected UNKNOWN', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });

    await expect(
      createPracticeSetApi('lesson-1', 3, config, 'idem-1'),
    ).resolves.toEqual({status: 'rejected', code: 'UNKNOWN'});
  });
});
