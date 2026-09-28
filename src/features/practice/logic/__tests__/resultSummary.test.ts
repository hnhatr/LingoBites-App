import {PRACTICE_CALCULATOR_VERSION} from '@shared/schemas/practice';
import type {AnswerEvent, PracticeQuestion} from '@shared/schemas/practice';
import {
  accuracyOverGraded,
  calculateResultSummary,
  CALCULATOR_VERSION,
} from '../resultSummary';

function meaningChoice(
  id: string,
  skill: string,
  vocabId: string,
  correctId: string,
  options: Array<{id: string; text: string}>,
): PracticeQuestion {
  return {
    id,
    variant: 'meaning_choice',
    skill,
    difficulty: 'beginner',
    prompt_vi: `prompt ${id}`,
    explanation_vi: `explanation ${id}`,
    source_refs: [{kind: 'vocabulary', id: vocabId}],
    source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
    provenance: {generation_attempt: 1, prompt_version: 'v1'},
    validation: {validator_version: 'v1', checks: [], passed: true},
    vocabulary_id: vocabId,
    options,
    correct_option_id: correctId,
  };
}

function clozeChoice(id: string, sentenceId: string): PracticeQuestion {
  return {
    id,
    variant: 'cloze_choice',
    skill: 'sentence',
    difficulty: 'beginner',
    prompt_vi: `prompt ${id}`,
    explanation_vi: `explanation ${id}`,
    source_refs: [{kind: 'sentence', id: sentenceId}],
    source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
    provenance: {generation_attempt: 1, prompt_version: 'v1'},
    validation: {validator_version: 'v1', checks: [], passed: true},
    sentence_id: sentenceId,
    stem_with_placeholder: 'I ___ a boy',
    blank: {char_start: 2, char_end: 4, source_text: 'am'},
    options: [
      {id: `${id}-opt-1`, text: 'am'},
      {id: `${id}-opt-2`, text: 'is'},
    ],
    correct_option_id: `${id}-opt-1`,
  };
}

function event(
  sessionId: string,
  questionId: string,
  sequence: number,
  isCorrect: boolean,
): AnswerEvent {
  return {
    event_id: `ev-${sequence}`,
    contract_version: 1,
    session_id: sessionId,
    question_id: questionId,
    sequence,
    selected_option_id: 'opt',
    is_correct: isCorrect,
    answered_at: '2026-09-10T00:00:00Z',
    duration_ms: 500,
    try_index: 1,
    grading: {mode: 'device_deterministic', grader_version: 'grader-v1'},
  };
}

describe('resultSummary calculator', () => {
  it('exposes the contract calculator version', () => {
    expect(CALCULATOR_VERSION).toBe(PRACTICE_CALCULATOR_VERSION);
  });

  it('computes accuracy over graded questions only (acceptance 2)', () => {
    const graded = meaningChoice('q1', 'vocabulary', 'v1', 'q1-opt-1', [
      {id: 'q1-opt-1', text: 'a'},
      {id: 'q1-opt-2', text: 'b'},
    ]);
    // Ungradable question: correct_option_id resolves to no option
    // (the legacy defect state). It must not dilute accuracy.
    const ungradable = {
      ...meaningChoice('q2', 'vocabulary', 'v2', 'missing', [
        {id: 'q2-opt-1', text: 'c'},
        {id: 'q2-opt-2', text: 'd'},
      ]),
      correct_option_id: 'missing',
    } as PracticeQuestion;
    const byId = new Map([
      ['q1', graded],
      ['q2', ungradable],
    ]);
    const summary = calculateResultSummary({
      sessionId: 'sess',
      summaryId: 'sum-1',
      questionOrder: ['q1', 'q2'],
      questionsById: byId,
      events: [event('sess', 'q1', 1, true), event('sess', 'q2', 2, false)],
      calculatedAt: '2026-09-10T01:00:00Z',
    });
    // q1 correct (1/1 graded = 100%), q2 excluded from the denominator.
    expect(summary.correct).toBe(1);
    expect(summary.score_percent).toBe(100);
    // ...but still counted as answered.
    expect(summary.answered).toBe(2);
    expect(summary.total_questions).toBe(2);
  });

  it('returns 0 accuracy when nothing graded was answered', () => {
    const summary = calculateResultSummary({
      sessionId: 'sess',
      summaryId: 'sum-1',
      questionOrder: ['q1'],
      questionsById: new Map(),
      events: [],
      calculatedAt: '2026-09-10T01:00:00Z',
    });
    expect(summary.score_percent).toBe(0);
    expect(summary.correct).toBe(0);
    expect(summary.answered).toBe(0);
  });

  it('builds per-skill breakdown and review candidates', () => {
    const q1 = meaningChoice('q1', 'vocabulary', 'v1', 'q1-opt-1', [
      {id: 'q1-opt-1', text: 'a'},
      {id: 'q1-opt-2', text: 'b'},
    ]);
    const q2 = clozeChoice('q2', 's9');
    const q3 = meaningChoice('q3', 'translation', 'v3', 'q3-opt-1', [
      {id: 'q3-opt-1', text: 'x'},
      {id: 'q3-opt-2', text: 'y'},
    ]);
    const byId = new Map([
      ['q1', q1],
      ['q2', q2],
      ['q3', q3],
    ]);
    const summary = calculateResultSummary({
      sessionId: 'sess',
      summaryId: 'sum-1',
      questionOrder: ['q1', 'q2', 'q3'],
      questionsById: byId,
      events: [
        event('sess', 'q1', 1, true),
        event('sess', 'q2', 2, false),
        event('sess', 'q3', 3, false),
      ],
      calculatedAt: '2026-09-10T01:00:00Z',
    });
    expect(summary.correct).toBe(1);
    expect(summary.score_percent).toBe(33);
    expect(summary.breakdown).toEqual({vocabulary: 1});
    expect(summary.review_candidates).toEqual(
      expect.arrayContaining([
        {source_kind: 'sentence', source_id: 's9', wrong_count: 1},
        {source_kind: 'vocabulary', source_id: 'v3', wrong_count: 1},
      ]),
    );
    expect(summary.review_candidates).toHaveLength(2);
  });

  it('aggregates repeated wrong answers to the same source', () => {
    const q1 = meaningChoice('q1', 'vocabulary', 'v1', 'q1-opt-1', [
      {id: 'q1-opt-1', text: 'a'},
      {id: 'q1-opt-2', text: 'b'},
    ]);
    const byId = new Map([['q1', q1]]);
    const summary = calculateResultSummary({
      sessionId: 'sess',
      summaryId: 'sum-1',
      questionOrder: ['q1'],
      questionsById: byId,
      events: [event('sess', 'q1', 1, false), event('sess', 'q1', 2, false)],
      calculatedAt: '2026-09-10T01:00:00Z',
    });
    expect(summary.review_candidates).toEqual([
      {source_kind: 'vocabulary', source_id: 'v1', wrong_count: 2},
    ]);
  });

  it('accuracyOverGraded rounds and handles zero', () => {
    expect(accuracyOverGraded(2, 3)).toBe(67);
    expect(accuracyOverGraded(0, 0)).toBe(0);
    expect(accuracyOverGraded(1, 1)).toBe(100);
  });
});
