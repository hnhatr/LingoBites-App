import i18n from '@core/i18n';

export const MAX_INPUT_TEXT_LENGTH = 3000;
export const MAX_LESSON_V2_WORDS = 500;

export type TextValidationResult =
  | {valid: true; value: string}
  | {valid: false; message: string};

export function validateConfirmedText(input: string): TextValidationResult {
  const value = input.trim();

  if (!value) {
    return {valid: false, message: i18n.t('errors.empty_input')};
  }

  if (value.length > MAX_INPUT_TEXT_LENGTH) {
    return {
      valid: false,
      message: i18n.t('errors.text_too_long', {max: MAX_INPUT_TEXT_LENGTH}),
    };
  }

  return {valid: true, value};
}

export function validateLessonV2InputText(
  input: string,
  maxWords = MAX_LESSON_V2_WORDS,
): TextValidationResult {
  const value = input.trim();

  if (!value) {
    return {valid: false, message: i18n.t('errors.empty_input')};
  }

  if (value.split(/\s+/).length > maxWords) {
    return {
      valid: false,
      message: i18n.t('errors.text_too_long_words', {max: maxWords}),
    };
  }

  return {valid: true, value};
}

export function countWords(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

/**
 * Live state of the text box: the counter and the submit button both read it,
 * so the word limit is checked in one place (E0 K1).
 */
export function getDraftTextState(
  input: string,
  maxWords = MAX_LESSON_V2_WORDS,
) {
  const words = countWords(input);
  return {
    words,
    overWordLimit: words > maxWords,
    maxWords,
  };
}
