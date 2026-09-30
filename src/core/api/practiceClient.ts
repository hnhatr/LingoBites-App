import type {PracticeSet} from '../schemas/practice';
import {getAppConfig} from './appConfig';
import {authenticatedFetch} from './authenticatedFetch';

export type PracticeConfigInput = {
  types: ('meaning_choice' | 'cloze_choice')[];
  difficulty: string;
  question_count: number;
};

export type CreatePracticeSetResponse =
  | {
      status: 'reused';
      practiceSet: PracticeSet;
    }
  | {
      status: 'generating' | 'ready' | 'generation_failed' | 'invalidated';
      practiceSetId: string;
      pollAfterMs: number;
    }
  | {
      /** Server refused generation (HTTP 422, e.g. lesson not ready or insufficient source). Not a network problem — do not retry blindly. */
      status: 'rejected';
      code: string;
    };

export async function createPracticeSetApi(
  lessonId: string,
  lessonRevision: number,
  config: PracticeConfigInput,
  idempotencyKey: string,
): Promise<CreatePracticeSetResponse> {
  const baseUrl = getAppConfig().apiBaseUrl;
  const url = `${baseUrl}/v1/lessons/${lessonId}/practice-sets`;

  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      lesson_revision: lessonRevision,
      config,
    }),
  });

  if (response.status === 200) {
    const data = await response.json();
    return {
      status: 'reused',
      practiceSet: data.practice_set,
    };
  }

  if (response.status === 202) {
    const data = await response.json();
    return {
      status: data.status,
      practiceSetId: data.practice_set_id,
      pollAfterMs: data.poll_after_ms,
    };
  }

  if (response.status === 422) {
    let code = 'UNKNOWN';
    try {
      const data = await response.json();
      if (typeof data?.error?.code === 'string') {
        code = data.error.code;
      }
    } catch {
      // Unreadable body: keep the generic code so callers still
      // distinguish refusal from a transport failure.
    }
    return {status: 'rejected', code};
  }

  throw new Error(`Failed to create practice set: ${response.status}`);
}

export type GetPracticeSetResponse =
  | {
      status: 'ready' | 'generation_failed';
      practiceSet: PracticeSet;
    }
  | {
      status: 'generating';
      practiceSetId: string;
      pollAfterMs: number;
    }
  | {
      status: 'invalidated' | 'not_found';
    };

export async function getPracticeSetApi(
  lessonId: string,
  practiceSetId: string,
): Promise<GetPracticeSetResponse> {
  const baseUrl = getAppConfig().apiBaseUrl;
  const url = `${baseUrl}/v1/practice-sets/${practiceSetId}`;

  const response = await authenticatedFetch(url, {
    method: 'GET',
    headers: {},
  });

  if (response.status === 200) {
    const data = await response.json();
    return {
      status: data.status,
      practiceSet: data,
    };
  }

  if (response.status === 202) {
    const data = await response.json();
    return {
      status: data.status,
      practiceSetId: data.practice_set_id,
      pollAfterMs: data.poll_after_ms,
    };
  }

  if (response.status === 410) {
    return {status: 'invalidated'};
  }
  if (response.status === 404) {
    return {status: 'not_found'};
  }

  throw new Error(`Failed to get practice set: ${response.status}`);
}
