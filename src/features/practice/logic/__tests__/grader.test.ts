import {PRACTICE_GRADER_VERSION} from '@shared/schemas/practice';
import {gradeAnswer, isGradable, GRADER_VERSION} from '../grader';

function choice(
  id: string,
  correctId: string,
  options: Array<{id: string; text: string}>,
) {
  return {id, options, correct_option_id: correctId};
}

describe('grader (HI-4: option-ID grading, never text)', () => {
  it('exposes the contract grader version', () => {
    expect(GRADER_VERSION).toBe(PRACTICE_GRADER_VERSION);
    expect(GRADER_VERSION).toBe('grader-v1');
  });

  it('grades a correct option ID as correct', () => {
    const outcome = gradeAnswer(
      choice('q1', 'opt-2', [
        {id: 'opt-1', text: 'Táo'},
        {id: 'opt-2', text: 'Cam'},
      ]),
      'opt-2',
    );
    expect(outcome).toEqual({
      isCorrect: true,
      graded: true,
      graderVersion: GRADER_VERSION,
    });
  });

  it('grades a wrong option ID as incorrect', () => {
    const outcome = gradeAnswer(
      choice('q1', 'opt-2', [
        {id: 'opt-1', text: 'Táo'},
        {id: 'opt-2', text: 'Cam'},
      ]),
      'opt-1',
    );
    expect(outcome.isCorrect).toBe(false);
    expect(outcome.graded).toBe(true);
  });

  it('grades correctly when two options share the same text (acceptance 1)', () => {
    const question = choice('q-dup', 'opt-2', [
      {id: 'opt-1', text: 'quả táo'},
      {id: 'opt-2', text: 'quả táo'},
      {id: 'opt-3', text: 'quả cam'},
    ]);
    // Text matching alone could never distinguish opt-1 from opt-2.
    expect(gradeAnswer(question, 'opt-2').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'opt-1').isCorrect).toBe(false);
    expect(gradeAnswer(question, 'opt-1').graded).toBe(true);
  });

  it('ignores whitespace/case differences: ID decides, not normalized text', () => {
    const question = choice('q-ws', 'opt-1', [
      {id: 'opt-1', text: 'Cam'},
      {id: 'opt-2', text: '  CAM  '},
    ]);
    expect(gradeAnswer(question, 'opt-1').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'opt-2').isCorrect).toBe(false);
  });

  it('marks an unknown selected ID as wrong but graded', () => {
    const outcome = gradeAnswer(
      choice('q1', 'opt-1', [{id: 'opt-1', text: 'a'}]),
      'opt-zzz',
    );
    expect(outcome.isCorrect).toBe(false);
    expect(outcome.graded).toBe(true);
  });

  it('is ungradable when correct_option_id resolves to no option (legacy defect state)', () => {
    const outcome = gradeAnswer(
      choice('q-bad', 'opt-missing', [{id: 'opt-1', text: 'a'}]),
      'opt-1',
    );
    expect(outcome.graded).toBe(false);
    expect(outcome.isCorrect).toBe(false);
  });

  it('is ungradable for null selection or missing options', () => {
    const q = choice('q1', 'opt-1', [{id: 'opt-1', text: 'a'}]);
    expect(gradeAnswer(q, null).graded).toBe(false);
    expect(gradeAnswer(q, undefined).graded).toBe(false);
    expect(gradeAnswer({id: 'q', correct_option_id: 'x'}, 'x').graded).toBe(
      false,
    );
  });

  it('isGradable mirrors the graded flag', () => {
    expect(isGradable(choice('q', 'opt-1', [{id: 'opt-1', text: 'a'}]))).toBe(
      true,
    );
    expect(isGradable(choice('q', 'opt-x', [{id: 'opt-1', text: 'a'}]))).toBe(
      false,
    );
  });

  it('is a pure function: same inputs always give the same output', () => {
    const q = choice('q', 'opt-1', [
      {id: 'opt-1', text: 'a'},
      {id: 'opt-2', text: 'b'},
    ]);
    expect(gradeAnswer(q, 'opt-1')).toEqual(gradeAnswer(q, 'opt-1'));
    expect(gradeAnswer(q, 'opt-2')).toEqual(gradeAnswer(q, 'opt-2'));
  });
});
