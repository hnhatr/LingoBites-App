import type {LessonTask} from '@core/schemas/lesson';

import {seedSnapshot} from '@test/support/lessonFlow';

import {blockAttempt, maxSupport} from '../activityOutcome';
import {hintLadder, parseHintLevels, supportLevelOf} from '../hints';

const tasks = seedSnapshot().tasks!;
const guided = tasks.find(task => task.kind === 'guided')!;
const independent = tasks.find(task => task.kind === 'independent')!;
const MODEL = 'Can I have a large tea, please?';

describe('hint ladder (PR 11 G1, G8)', () => {
  it("uses the task's own levels, reading the model on `replay`", () => {
    expect(hintLadder({task: guided, model: MODEL})).toEqual([
      {level: 1, type: 'replay', text: 'Nghe lại câu mẫu.', speak: MODEL},
      {
        level: 2,
        type: 'keyword',
        text: 'Can I have… small… coffee',
        speak: null,
      },
      {
        level: 3,
        type: 'model',
        text: 'Can I have a small coffee, please?',
        speak: null,
      },
    ]);
  });

  it('falls back to three fixed levels like the admin preview', () => {
    expect(
      hintLadder({
        task: independent,
        model: MODEL,
        frame: 'Can I have a {size} {drink}, please?',
      }),
    ).toEqual([
      {level: 1, type: 'keyword', text: 'Can …', speak: MODEL},
      {
        level: 2,
        type: 'pattern',
        text: 'Can I have a {size} {drink}, please?',
        speak: null,
      },
      {level: 3, type: 'model', text: MODEL, speak: null},
    ]);
    expect(hintLadder({task: null, model: 'Thank you very much.'})[1]).toEqual({
      level: 2,
      type: 'keyword',
      text: 'Thank you …',
      speak: null,
    });
  });

  it('ignores malformed hint levels instead of failing', () => {
    const broken: LessonTask = {
      ...guided,
      hint_levels: [{level: 2, type: 'replay', content_vi: 'x'}],
    };
    expect(parseHintLevels(broken)).toEqual([]);
    expect(hintLadder({task: broken, model: MODEL})[0]!.type).toBe('keyword');
  });
});

describe('support levels (PR 11 G2)', () => {
  const ladder = hintLadder({task: null, model: MODEL});

  it('maps the highest opened level', () => {
    expect(supportLevelOf([])).toBe('none');
    expect(supportLevelOf(ladder.slice(0, 1))).toBe('hint_1');
    expect(supportLevelOf(ladder.slice(0, 2))).toBe('hint_2');
    expect(supportLevelOf(ladder)).toBe('model');
    expect(
      supportLevelOf([{level: 1, type: 'model', text: MODEL, speak: null}]),
    ).toBe('model');
    expect(maxSupport('hint_2', 'hint_1')).toBe('hint_2');
  });

  it('never lets a supported block pass independently', () => {
    expect(
      blockAttempt([
        {result: 'first_try', support: 'none'},
        {result: 'first_try', support: 'hint_2'},
      ]),
    ).toEqual({outcome: 'pass_with_support', supportLevel: 'hint_2'});
    expect(
      blockAttempt([
        {result: 'first_try', support: 'none'},
        {result: 'first_try', support: 'none'},
      ]),
    ).toEqual({outcome: 'pass_independent', supportLevel: 'none'});
    expect(
      blockAttempt([
        {result: 'after_retry', support: 'none'},
        {result: 'not_yet', support: 'model'},
      ]),
    ).toEqual({outcome: 'fail', supportLevel: 'model'});
    expect(blockAttempt([])).toEqual({
      outcome: 'unscorable',
      supportLevel: 'none',
    });
  });
});
