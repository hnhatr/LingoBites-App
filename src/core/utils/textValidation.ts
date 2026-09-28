import i18n from '@core/i18n/index';

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
