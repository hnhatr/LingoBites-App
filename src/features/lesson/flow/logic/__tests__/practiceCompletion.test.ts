import fs from 'node:fs';
import path from 'node:path';

import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {
  isFlowLesson,
  practiceCompleted,
  remainingPracticeCount,
  resumeStep,
} from '../practiceCompletion';

const snapshot = LessonSnapshotResponseSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  ),
).lesson;

const activity = (step: number) =>
  snapshot.blocks.find(
    block => block.type === 'activity' && block.step === step,
  )!;

const attempt = (
  step: number,
  outcome: 'pass_independent' | 'fail' | 'unscorable' = 'fail',
) => ({blockId: activity(step).id, outcome});

describe('practice completion (PR 8 rule G5)', () => {
  it('runs the seed lesson in the six-step player', () => {
    expect(isFlowLesson(snapshot)).toBe(true);
    expect(isFlowLesson({...snapshot, spec: undefined})).toBe(false);
  });

  it('runs a learner lesson only when it carries a spec (S4.3)', () => {
    const composed = LessonSnapshotResponseSchema.parse(
      JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            '../../../../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-composed-response.json',
          ),
          'utf8',
        ),
      ),
    ).lesson;
    expect(isFlowLesson(composed)).toBe(true);
    // A plain learner lesson: no spec, no step blocks.
    expect(
      isFlowLesson({
        ...composed,
        spec: null,
        blocks: composed.blocks.map(block => ({...block, step: null})),
      }),
    ).toBe(false);
    expect(isFlowLesson({...composed, spec: null})).toBe(false);
  });

  it('needs a scorable attempt on every activity of steps 2–4', () => {
    expect(practiceCompleted(snapshot, [])).toBe(false);
    expect(remainingPracticeCount(snapshot, [])).toBe(2);
    expect(practiceCompleted(snapshot, [attempt(3)])).toBe(false);
    // A failed attempt still counts; an unscorable one does not.
    expect(practiceCompleted(snapshot, [attempt(3), attempt(4)])).toBe(true);
    expect(
      practiceCompleted(snapshot, [attempt(3), attempt(4, 'unscorable')]),
    ).toBe(false);
  });

  it('leaves step 5 out and needs at least one practice activity', () => {
    expect(practiceCompleted(snapshot, [attempt(5, 'pass_independent')])).toBe(
      false,
    );
    const noPractice = {
      ...snapshot,
      blocks: snapshot.blocks.filter(
        block => !(block.type === 'activity' && block.step !== 5),
      ),
    };
    expect(practiceCompleted(noPractice, [attempt(5)])).toBe(false);
  });

  it('resumes at the first step with an activity left', () => {
    expect(resumeStep(snapshot, [])).toBe(1);
    expect(resumeStep(snapshot, [attempt(3)])).toBe(4);
    expect(resumeStep(snapshot, [attempt(3), attempt(4)])).toBe(5);
    expect(resumeStep(snapshot, [attempt(3), attempt(4), attempt(5)])).toBe(6);
  });
});
