import type {AnalyzeSourceType} from '@core/api/types';
import {validateLessonV2InputText} from '@core/utils/textValidation';

export type LessonDestination = 'canonical_creation';

export type LessonFeatureFlags = Record<string, boolean>;

export type UnifiedLessonReadiness = {unifiedReady?: boolean};

export type NavigateFn = (
  screen: 'LessonCreation',
  params: {
    submissionId: string;
    initialSource: 'text' | 'ocr';
    initialText: string;
  },
) => void;

export function resolveLessonDestination(
  _flags?: LessonFeatureFlags,
  _readiness?: UnifiedLessonReadiness,
): LessonDestination {
  return 'canonical_creation';
}

export async function startLessonFromConfirmedText(args: {
  confirmedText: string;
  sourceType: AnalyzeSourceType;
  destination?: LessonDestination;
  origin?: 'PasteText' | 'OCRReview';
  navigate: NavigateFn;
}): Promise<{ok: true} | {ok: false; message: string; retryable: boolean}> {
  const validation = validateLessonV2InputText(args.confirmedText);
  if (!validation.valid) {
    return {ok: false, message: validation.message, retryable: false};
  }
  const initialSource =
    args.sourceType === 'paste_text' || args.origin === 'PasteText'
      ? 'text'
      : 'ocr';
  args.navigate('LessonCreation', {
    submissionId: `${args.origin ?? 'draft'}-${Date.now()}`,
    initialSource,
    initialText: validation.value,
  });
  return {ok: true};
}
