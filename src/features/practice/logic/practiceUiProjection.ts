import type {PracticeSession, PracticeSet} from '@shared/schemas/practice';

export type PracticeUiState =
  | 'not_created'
  | 'generating'
  | 'generation_failed'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export type PracticeUiProjection = {
  state: PracticeUiState;
  practiceSet: PracticeSet | null;
  session: PracticeSession | null;
  questionProgress?: {current: number; total: number};
};

export function projectPracticeUi(input: {
  latestSet: PracticeSet | null;
  latestSession: PracticeSession | null;
  isPreparing?: boolean;
}): PracticeUiProjection {
  const {latestSet, latestSession, isPreparing = false} = input;

  if (latestSession?.status === 'in_progress') {
    const total = latestSession.question_order.length;
    const set =
      latestSet?.id === latestSession.practice_set_id ? latestSet : null;
    return {
      state: 'in_progress',
      practiceSet: set,
      session: latestSession,
      questionProgress: {
        current: Math.min(latestSession.current_index + 1, total),
        total,
      },
    };
  }

  if (isPreparing || latestSet?.status === 'generating') {
    return {
      state: 'generating',
      practiceSet: latestSet,
      session: null,
    };
  }

  if (latestSet?.status === 'generation_failed') {
    return {
      state: 'generation_failed',
      practiceSet: latestSet,
      session: null,
    };
  }

  if (latestSession?.status === 'completed') {
    return {
      state: 'completed',
      practiceSet: latestSet?.status === 'ready' ? latestSet : null,
      session: latestSession,
    };
  }

  if (latestSession?.status === 'abandoned') {
    return {
      state: 'abandoned',
      practiceSet: latestSet?.status === 'ready' ? latestSet : null,
      session: latestSession,
    };
  }

  if (latestSet?.status === 'ready') {
    return {
      state: 'ready',
      practiceSet: latestSet,
      session: null,
    };
  }

  return {
    state: 'not_created',
    practiceSet: null,
    session: null,
  };
}
