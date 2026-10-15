import {
  comboHistoryGroupOf,
  comboOpenedLabel,
  comboWordLabel,
  groupComboHistory,
  splitOnWord,
} from '../comboHistoryGroups';

// Thursday 15 October 2026, 15:00 local time.
const NOW = new Date(2026, 9, 15, 15, 0);

function at(day: number, hour = 9) {
  return new Date(2026, 9, day, hour, 30).toISOString();
}

function set(id: string, createdAt: string) {
  return {
    id,
    itemCode: `word:${id}`,
    grammarCode: 'g',
    situationCode: 's',
    sentenceCount: 1,
    createdAt,
  };
}

describe('combo history groups', () => {
  it('reads the word out of the item code', () => {
    expect(comboWordLabel('word:december')).toBe('december');
    expect(comboWordLabel('december')).toBe('december');
  });

  it('puts a set in today, this week (from Monday) or earlier', () => {
    expect(comboHistoryGroupOf(at(15), NOW)).toBe('today');
    expect(comboHistoryGroupOf(at(12), NOW)).toBe('week');
    expect(comboHistoryGroupOf(at(11), NOW)).toBe('earlier');
    expect(comboHistoryGroupOf('not a date', NOW)).toBe('earlier');
  });

  it('groups newest-first sets in order', () => {
    const groups = groupComboHistory(
      [set('a', at(15)), set('b', at(13)), set('c', at(14)), set('d', at(2))],
      NOW,
    );
    expect(groups.map(g => [g.key, g.sets.map(s => s.id)])).toEqual([
      ['today', ['a']],
      ['week', ['b', 'c']],
      ['earlier', ['d']],
    ]);
  });

  it('labels a set with the time today and the date before', () => {
    expect(comboOpenedLabel(at(15, 14), NOW)).toBe('14:30');
    expect(comboOpenedLabel(at(2), NOW)).toBe('02/10');
  });

  it('splits a sentence around the word, ignoring case', () => {
    expect(splitOnWord('My birthday is in December.', 'december')).toEqual([
      'My birthday is in ',
      'December',
      '.',
    ]);
    expect(splitOnWord('No match here.', 'tea')).toEqual(['No match here.']);
  });
});
