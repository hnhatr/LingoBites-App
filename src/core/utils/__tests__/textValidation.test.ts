import {
  countWords,
  getDraftTextState,
  MAX_INPUT_TEXT_LENGTH,
  MAX_LESSON_V2_WORDS,
  validateConfirmedText,
  validateLessonV2InputText,
} from '../textValidation';

describe('validateConfirmedText', () => {
  it('rejects empty input', () => {
    const result = validateConfirmedText('   ');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain('nhập hoặc dán');
    }
  });

  it('rejects text over MAX_INPUT_TEXT_LENGTH', () => {
    const result = validateConfirmedText('a'.repeat(MAX_INPUT_TEXT_LENGTH + 1));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain('3000');
    }
  });

  it('accepts text at max length', () => {
    const value = 'a'.repeat(MAX_INPUT_TEXT_LENGTH);
    const result = validateConfirmedText(value);
    expect(result).toEqual({valid: true, value});
  });

  it('trims surrounding whitespace', () => {
    const result = validateConfirmedText('  hello world  ');
    expect(result).toEqual({valid: true, value: 'hello world'});
  });
});

describe('validateLessonV2InputText', () => {
  it('rejects empty input', () => {
    expect(validateLessonV2InputText('   ').valid).toBe(false);
  });

  it('rejects text over the V2 word limit', () => {
    const result = validateLessonV2InputText(
      Array.from({length: MAX_LESSON_V2_WORDS + 1}, () => 'word').join(' '),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain('500');
    }
  });

  it('accepts and trims text at the V2 word limit', () => {
    const value = Array.from({length: MAX_LESSON_V2_WORDS}, () => 'word').join(
      ' ',
    );
    expect(validateLessonV2InputText(` ${value} `)).toEqual({
      valid: true,
      value,
    });
  });
});

describe('countWords and getDraftTextState', () => {
  it('counts words across spaces and line breaks', () => {
    expect(countWords('  one   two\nthree\t')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  it('flags a draft only when it passes the word limit', () => {
    const atLimit = Array.from({length: MAX_LESSON_V2_WORDS}, () => 'a').join(
      ' ',
    );
    const overLimit = `${atLimit} extra`;
    expect(getDraftTextState(atLimit)).toMatchObject({
      words: MAX_LESSON_V2_WORDS,
      overWordLimit: false,
    });
    expect(getDraftTextState(overLimit)).toMatchObject({
      words: MAX_LESSON_V2_WORDS + 1,
      overWordLimit: true,
    });
  });
});
