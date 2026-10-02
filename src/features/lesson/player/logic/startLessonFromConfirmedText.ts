import type {AnalyzeSourceType} from '@core/api/types';
import {validateLessonV2InputText} from '@core/utils/textValidation';

export type NavigateFn = (
  screen: 'LessonCreation',
  params: {
    submissionId: string;
    initialSource: 'text' | 'ocr';
    initialText: string;
  },
) => void;

export async function startLessonFromConfirmedText(args: {
  confirmedText: string;
  sourceType: AnalyzeSourceType;
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
