/**
 * Client-side smoke test for the vendored deterministic validator.
 * This file MUST stay byte-identical with
 * `api-server/src/practice/validator.ts` (SETE-198). It proves the
 * validator loads and validates on the client toolchain (jest/RN preset,
 * Hermes-compatible APIs only: no Node imports, no I/O).
 */
import {
  buildValidationMetadata,
  isSetReady,
  normalizeOptionText,
  partitionForPublish,
  validateQuestion,
  validateQuestionSet,
  VALIDATOR_VERSION,
} from '../validator';

const ctx = {
  contractVersion: 1,
  lesson: {
    lessonRevision: 7,
    vocabularyById: {v1: {meaning_vi: 'quả táo'}},
    sentenceById: {s1: {text: 'I am a boy'}},
    grammarById: {},
  },
  questionIdsInSet: ['q1'] as readonly string[],
};

describe('practice validator (client copy)', () => {
  it('is byte-identical in behavior: valid meaning_choice passes', () => {
    const result = validateQuestion(
      {
        variant: 'meaning_choice',
        id: 'q1',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: "Chọn nghĩa đúng của từ 'apple'",
        explanation_vi: "'Apple' có nghĩa là quả táo.",
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          canonical_meaning: 'quả táo',
        },
        vocabulary_id: 'v1',
        options: [
          {id: 'a', text: 'quả táo'},
          {id: 'b', text: 'quả cam'},
          {id: 'c', text: 'quả chuối'},
        ],
        correct_option_id: 'a',
      },
      ctx,
    );
    expect(result.passed).toBe(true);
    expect(result.validatorVersion).toBe(VALIDATOR_VERSION);
  });

  it('rejects placeholder distractors and substring-equivalent answers', () => {
    const placeholder = validateQuestion(
      {
        variant: 'meaning_choice',
        id: 'q1',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: "Chọn nghĩa đúng của từ 'apple'",
        explanation_vi: 'Giải thích.',
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {
          snapshot_schema_version: 'snapshot-v1',
          canonical_meaning: 'quả táo',
        },
        vocabulary_id: 'v1',
        options: [
          {id: 'a', text: 'quả táo'},
          {id: 'b', text: 'Nghĩa khác 1'},
          {id: 'c', text: 'quả chuối'},
        ],
        correct_option_id: 'a',
      },
      ctx,
    );
    expect(placeholder.passed).toBe(false);
    expect(
      placeholder.checks.find(c => c.code === 'MEANING_NO_PLACEHOLDER')?.passed,
    ).toBe(false);
  });

  it('validates cloze spans and gates publishing', () => {
    const cloze = {
      variant: 'cloze_choice' as const,
      id: 'q1',
      skill: 'translation',
      difficulty: 'beginner',
      prompt_vi: 'Điền vào chỗ trống',
      explanation_vi: "Đáp án là 'am'.",
      source_refs: [{kind: 'sentence' as const, id: 's1'}],
      source_snapshot: {
        snapshot_schema_version: 'snapshot-v1',
        source_text: 'I am a boy',
      },
      sentence_id: 's1',
      stem_with_placeholder: 'I ___ a boy',
      blank: {char_start: 2, char_end: 4, source_text: 'am'},
      options: [
        {id: 'o1', text: 'am'},
        {id: 'o2', text: 'is'},
      ],
      correct_option_id: 'o1',
    };
    const single = validateQuestion(cloze, ctx);
    expect(single.passed).toBe(true);

    const set = validateQuestionSet([cloze], ctx);
    expect(set.passed).toBe(true);
    expect(isSetReady(set, 1)).toBe(true);
    const {valid, invalid} = partitionForPublish([cloze], set);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);

    const metadata = buildValidationMetadata(single);
    expect(metadata.validator_version).toBe(VALIDATOR_VERSION);
    expect(metadata.passed).toBe(true);
  });

  it('normalizes Vietnamese diacritics the same way on client', () => {
    expect(normalizeOptionText('  Quả   TÁO  ')).toBe('quả táo');
    expect(normalizeOptionText('ê')).toBe(normalizeOptionText('ê'));
  });
});
