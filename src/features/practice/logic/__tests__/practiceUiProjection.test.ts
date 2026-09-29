import type {PracticeSession, PracticeSet} from '@core/schemas/practice';
import {projectPracticeUi} from '../practiceUiProjection';

function makeSet(overrides: Partial<PracticeSet> = {}): PracticeSet {
  return {
    id: 'set-1',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    source_fingerprint: 'fp',
    config_hash: 'hash',
    difficulty: 'beginner',
    requested_count: 5,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'generator-v1',
    },
    questions: [],
    created_at: '2026-09-10T00:00:00Z',
    ready_at: '2026-09-10T00:01:00Z',
    ...overrides,
  };
}

function makeSession(
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    id: 'session-1',
    practice_set_id: 'set-1',
    set_revision: 1,
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    status: 'in_progress',
    question_order: ['q1', 'q2', 'q3'],
    current_index: 1,
    attempt_no: 1,
    started_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:05:00Z',
    ...overrides,
  };
}

describe('projectPracticeUi', () => {
  it('returns not_created when no set or session exists', () => {
    expect(projectPracticeUi({latestSet: null, latestSession: null})).toEqual({
      state: 'not_created',
      practiceSet: null,
      session: null,
    });
  });

  it('returns generating when set is generating', () => {
    const set = makeSet({status: 'generating', ready_at: undefined});
    expect(projectPracticeUi({latestSet: set, latestSession: null}).state).toBe(
      'generating',
    );
  });

  it('returns generating when client is preparing', () => {
    expect(
      projectPracticeUi({
        latestSet: null,
        latestSession: null,
        isPreparing: true,
      }).state,
    ).toBe('generating');
  });

  it('returns generation_failed without implying lesson failure', () => {
    const set = makeSet({status: 'generation_failed', ready_at: undefined});
    const projection = projectPracticeUi({latestSet: set, latestSession: null});
    expect(projection.state).toBe('generation_failed');
    expect(projection.practiceSet?.status).toBe('generation_failed');
  });

  it('returns ready for a downloaded set without session', () => {
    expect(
      projectPracticeUi({latestSet: makeSet(), latestSession: null}).state,
    ).toBe('ready');
  });

  it('returns in_progress with question progress', () => {
    const projection = projectPracticeUi({
      latestSet: makeSet(),
      latestSession: makeSession(),
    });
    expect(projection.state).toBe('in_progress');
    expect(projection.questionProgress).toEqual({current: 2, total: 3});
  });

  it('returns completed for a finished session', () => {
    const projection = projectPracticeUi({
      latestSet: makeSet(),
      latestSession: makeSession({
        status: 'completed',
        current_index: 3,
        completed_at: '2026-09-10T00:10:00Z',
      }),
    });
    expect(projection.state).toBe('completed');
  });

  it('returns abandoned when the latest session was abandoned', () => {
    const projection = projectPracticeUi({
      latestSet: makeSet(),
      latestSession: makeSession({
        status: 'abandoned',
        completed_at: '2026-09-10T00:10:00Z',
      }),
    });
    expect(projection.state).toBe('abandoned');
  });
});
