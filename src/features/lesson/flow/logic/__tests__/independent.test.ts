import {seedSnapshot} from '@test/support/lessonFlow';

import {flowActivity, flowTask} from '../flowContent';
import {criteriaOutcome, isIndependentBlock, situationOf} from '../independent';

const snapshot = seedSnapshot();
const stepFive = snapshot.blocks.find(
  block => block.type === 'activity' && block.step === 5,
)!;
const stepFour = snapshot.blocks.find(
  block => block.type === 'activity' && block.step === 4,
)!;
const task = (block: typeof stepFive) =>
  flowTask(snapshot, flowActivity(block)!.taskId);

describe('independent use (PR 11 G4, G5)', () => {
  it('runs step 5 of the seed lesson as independent use', () => {
    expect(isIndependentBlock(stepFive, task(stepFive))).toBe(true);
    // Step 4 runs the guided task: still practice.
    expect(isIndependentBlock(stepFour, task(stepFour))).toBe(false);
    expect(isIndependentBlock({...stepFive, step: 4}, task(stepFive))).toBe(
      false,
    );
  });

  it('passes when every required criterion is ticked', () => {
    const {criteria} = task(stepFive)!;
    const all = new Set(criteria.map(entry => entry.criterion));
    expect(criteriaOutcome(criteria, all)).toBe('pass_independent');
    expect(
      criteriaOutcome(criteria, new Set(['purpose', 'content', 'clarity'])),
    ).toBe('fail');
    const optional = criteria.map(entry => ({...entry, required: false}));
    expect(criteriaOutcome(optional, new Set())).toBe('fail');
    expect(criteriaOutcome(optional, new Set(['clarity']))).toBe(
      'pass_independent',
    );
  });

  it("uses the task's situation, else the lesson's", () => {
    const own = task(stepFive)!;
    expect(situationOf(own, snapshot)?.purpose).toBe('gọi nước cam cỡ lớn');
    expect(situationOf({...own, situation: null}, snapshot)?.purpose).toBe(
      'gọi đồ uống',
    );
  });
});
