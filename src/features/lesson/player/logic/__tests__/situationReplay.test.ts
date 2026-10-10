import type {LessonPatternEntry} from '../lessonHubContent';
import {replayDayKey, replayLine} from '../situationReplay';

function entry(key: string, choices: string[]): LessonPatternEntry {
  return {
    key,
    itemId: key,
    frame: 'Can I have a {drink}, please?',
    meaningVi: '',
    noteVi: null,
    role: 'required',
    introduction: 'new',
    segments: [
      {type: 'text', value: 'Can I have a '},
      {type: 'slot', name: 'drink'},
      {type: 'text', value: ', please?'},
    ],
    slots: [{name: 'drink', labelVi: 'Đồ uống', choices}],
    variants: [],
    errors: [],
  } as unknown as LessonPatternEntry;
}

describe('situation replay', () => {
  it('changes one detail to a value other than the default', () => {
    const line = replayLine(
      [entry('p1', ['tea', 'coffee', 'juice'])],
      '2026-10-10',
    );
    expect(line).not.toBeNull();
    expect(line!.before).toBe('Can I have a tea, please?');
    expect(line!.after).not.toBe(line!.before);
    expect(line!.after).toMatch(/^Can I have a (coffee|juice), please\?$/);
    expect(line!.changedLabelVi).toBe('Đồ uống');
  });

  it('is stable for one day and can differ on another', () => {
    const entries = [entry('p1', ['tea', 'coffee', 'juice', 'milk'])];
    expect(replayLine(entries, '2026-10-10')).toEqual(
      replayLine(entries, '2026-10-10'),
    );
    const days = [
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
    ];
    const afters = new Set(days.map(day => replayLine(entries, day)!.after));
    expect(afters.size).toBeGreaterThan(1);
  });

  it('returns nothing when no pattern has a second value', () => {
    expect(replayLine([entry('p1', ['tea'])], '2026-10-10')).toBeNull();
    expect(replayLine([], '2026-10-10')).toBeNull();
  });

  it('keys the day by local calendar date', () => {
    expect(replayDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
