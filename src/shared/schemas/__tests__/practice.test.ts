import {
  MeaningChoiceSchema,
  ClozeChoiceSchema,
  PRACTICE_CONTRACT_VERSION,
  PRACTICE_GENERATOR_VERSION,
  PRACTICE_VALIDATOR_VERSION,
  PRACTICE_GRADER_VERSION,
  PRACTICE_CALCULATOR_VERSION,
  PRACTICE_SNAPSHOT_SCHEMA_VERSION,
} from '../practice';
describe('practice schemas', () => {
  it('Version constants are defined', () => {
    expect(PRACTICE_CONTRACT_VERSION).toBeDefined();
    expect(PRACTICE_GENERATOR_VERSION).toBeDefined();
    expect(PRACTICE_VALIDATOR_VERSION).toBeDefined();
    expect(PRACTICE_GRADER_VERSION).toBeDefined();
    expect(PRACTICE_CALCULATOR_VERSION).toBeDefined();
    expect(PRACTICE_SNAPSHOT_SCHEMA_VERSION).toBeDefined();
  });

  it('MeaningChoiceSchema validates correct data', () => {
    const validData = {
      id: 'q1',
      skill: 'vocabulary',
      difficulty: 'beginner',
      prompt_vi: 'Chọn nghĩa đúng',
      explanation_vi: 'Giải thích',
      source_refs: [{ kind: 'vocabulary', id: 'v1' }],
      source_snapshot: { snapshot_schema_version: 'v1', canonical_meaning: 'apple' },
      provenance: { generation_attempt: 1, prompt_version: 'v1' },
      validation: { validator_version: 'v1', checks: [], passed: true },
      variant: 'meaning_choice',
      vocabulary_id: 'v1',
      options: [
        { id: 'opt1', text: 'Táo' },
        { id: 'opt2', text: 'Cam' },
      ],
      correct_option_id: 'opt1',
    };
    const result = MeaningChoiceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('MeaningChoiceSchema rejects correct_option_id not in options', () => {
    const invalidData = {
      id: 'q1',
      skill: 'vocabulary',
      difficulty: 'beginner',
      prompt_vi: 'Chọn nghĩa đúng',
      explanation_vi: 'Giải thích',
      source_refs: [{ kind: 'vocabulary', id: 'v1' }],
      source_snapshot: { snapshot_schema_version: 'v1', canonical_meaning: 'apple' },
      provenance: { generation_attempt: 1, prompt_version: 'v1' },
      validation: { validator_version: 'v1', checks: [], passed: true },
      variant: 'meaning_choice',
      vocabulary_id: 'v1',
      options: [
        { id: 'opt1', text: 'Táo' },
        { id: 'opt2', text: 'Cam' },
      ],
      correct_option_id: 'opt3', // Not in options
    };
    const result = MeaningChoiceSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('correct_option_id');
    }
  });

  it('ClozeChoiceSchema validates correct data', () => {
    const validData = {
      id: 'q2',
      skill: 'grammar',
      difficulty: 'beginner',
      prompt_vi: 'Điền vào chỗ trống',
      explanation_vi: 'Giải thích',
      source_refs: [{ kind: 'sentence', id: 's1' }],
      source_snapshot: { snapshot_schema_version: 'v1', source_text: 'I am a boy' },
      provenance: { generation_attempt: 1, prompt_version: 'v1' },
      validation: { validator_version: 'v1', checks: [], passed: true },
      variant: 'cloze_choice',
      sentence_id: 's1',
      stem_with_placeholder: 'I ___ a boy',
      blank: { char_start: 2, char_end: 4, source_text: 'am' },
      options: [
        { id: 'opt1', text: 'am' },
        { id: 'opt2', text: 'is' },
      ],
      correct_option_id: 'opt1',
    };
    const result = ClozeChoiceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('ClozeChoiceSchema rejects correct_option_id not in options', () => {
    const invalidData = {
      id: 'q2',
      skill: 'grammar',
      difficulty: 'beginner',
      prompt_vi: 'Điền vào chỗ trống',
      explanation_vi: 'Giải thích',
      source_refs: [{ kind: 'sentence', id: 's1' }],
      source_snapshot: { snapshot_schema_version: 'v1', source_text: 'I am a boy' },
      provenance: { generation_attempt: 1, prompt_version: 'v1' },
      validation: { validator_version: 'v1', checks: [], passed: true },
      variant: 'cloze_choice',
      sentence_id: 's1',
      stem_with_placeholder: 'I ___ a boy',
      blank: { char_start: 2, char_end: 4, source_text: 'am' },
      options: [
        { id: 'opt1', text: 'am' },
        { id: 'opt2', text: 'is' },
      ],
      correct_option_id: 'opt3', // Not in options
    };
    const result = ClozeChoiceSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('correct_option_id');
    }
  });
});
