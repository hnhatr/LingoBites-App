import type {AnalyzeSourceType} from '@shared/api/types';
import {validateLessonV2InputText} from '@shared/utils/textValidation';

export type LessonDestination = 'unified_lesson';

export type LessonFeatureFlags = Record<string, boolean>;

export type UnifiedLessonReadiness = {unifiedReady?: boolean};

export type NavigateFn = (
  screen: 'UnifiedLessonGeneration',
  params: {jobId: string; confirmedText: string; level?: string},
) => void;

/**
 * Minimal structural job-creation contract injected by feature-layer
 * callers. `shared` must not import feature modules (module boundaries),
 * so the unified job client is passed in rather than imported.
 */
export type UnifiedGenerationJobCreator = (input: {
  confirmedText: string;
  level?: string;
  idempotencyKey?: string;
}) => Promise<
  | {ok: true; job: {id: string}}
  | {
      ok: false;
      message: string;
      retryable?: boolean;
      cancelled?: boolean;
    }
>;

export function resolveLessonDestination(
  _flags?: LessonFeatureFlags,
  _readiness?: UnifiedLessonReadiness,
): LessonDestination {
  return 'unified_lesson';
}

export async function startLessonFromConfirmedText(args: {
  confirmedText: string;
  sourceType: AnalyzeSourceType;
  destination?: LessonDestination;
  origin?: 'PasteText' | 'OCRReview';
  navigate: NavigateFn;
  createGenerationJob?: UnifiedGenerationJobCreator;
}): Promise<{ok: true} | {ok: false; message: string; retryable: boolean}> {
  return startUnifiedLessonFromConfirmedText(args);
}

/**
 * Unified creation handoff: validate locally, create one job-only
 * generation job (a fresh idempotency key per attempt, minted by the
 * injected creator), then hand navigation to the job-progress screen.
 * The screen polls job status and opens the canonical lesson route on
 * materialization. Failures map to the existing retryable contract so
 * the caller shows its retry state without corrupting anything.
 */
async function startUnifiedLessonFromConfirmedText(args: {
  confirmedText: string;
  navigate: NavigateFn;
  createGenerationJob?: UnifiedGenerationJobCreator;
}): Promise<{ok: true} | {ok: false; message: string; retryable: boolean}> {
  const validation = validateLessonV2InputText(args.confirmedText);
  if (!validation.valid) {
    return {ok: false, message: validation.message, retryable: false};
  }
  if (!args.createGenerationJob) {
    return {
      ok: false,
      message: 'Unified lesson creation is unavailable.',
      retryable: false,
    };
  }
  const result = await args.createGenerationJob({
    confirmedText: validation.value,
  });
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      retryable: result.retryable ?? false,
    };
  }
  args.navigate('UnifiedLessonGeneration', {
    jobId: result.job.id,
    confirmedText: validation.value,
  });
  return {ok: true};
}
