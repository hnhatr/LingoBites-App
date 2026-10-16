import {catalogItem} from '@test/support/catalogItemFixture';

import {frameSlots, frameText} from '../frameText';
import {
  filterPatterns,
  functionLabels,
  type LibraryPattern,
  type LibraryTense,
  memoryLevel,
  patternLevels,
  tenseGrid,
  tenseInfo,
} from '../libraryModel';

/** Vocab path P6: the pattern library's filters and the tense map's grid. */

const worth: LibraryPattern = {
  item: catalogItem(
    'pattern:worth',
    'pattern',
    'It is worth noting that {clause}',
    {
      meaning_vi: 'Đáng chú ý là',
      payload: {
        slots: {clause: {label_vi: 'mệnh đề', values: ['x']}},
        tense_mode: 'clause',
      },
    },
  ),
  cefrLevel: 'B2',
  tags: ['function:emphasis', 'exam:ielts-writing'],
};
const because: LibraryPattern = {
  item: catalogItem('pattern:because', 'pattern', 'This is because {reason}', {
    meaning_vi: 'Điều này là vì',
  }),
  cefrLevel: 'B1',
  tags: ['function:cause'],
};

test('patterns filter by text (accents ignored), function, level and exam', () => {
  const all = [worth, because];
  const none = {text: '', functionCode: null, cefrLevel: null, examCode: null};
  expect(filterPatterns(all, none)).toEqual(all);
  expect(filterPatterns(all, {...none, text: 'dieu nay'})).toEqual([because]);
  expect(filterPatterns(all, {...none, text: 'NOTING'})).toEqual([worth]);
  expect(
    filterPatterns(all, {...none, functionCode: 'function:cause'}),
  ).toEqual([because]);
  expect(filterPatterns(all, {...none, cefrLevel: 'B2'})).toEqual([worth]);
  expect(
    filterPatterns(all, {...none, examCode: 'exam:ielts-writing'}),
  ).toEqual([worth]);
  expect(
    filterPatterns(all, {
      ...none,
      examCode: 'exam:ielts-writing',
      cefrLevel: 'B1',
    }),
  ).toEqual([]);
});

test('levels come in CEFR order and function labels in filter order', () => {
  expect(patternLevels([worth, because])).toEqual(['B1', 'B2']);
  expect(
    functionLabels(worth, [
      {code: 'function:cause', labelVi: 'Nguyên nhân'},
      {code: 'function:emphasis', labelVi: 'Nhấn mạnh'},
    ]),
  ).toEqual(['Nhấn mạnh']);
});

test('a frame shows its slots by their labels, read leniently', () => {
  expect(frameText(worth.item)).toBe('It is worth noting that [mệnh đề]');
  expect(frameText(because.item)).toBe('This is because […]');
  expect(frameSlots(worth.item)).toEqual([
    {name: 'clause', labelVi: 'mệnh đề', values: ['x']},
  ]);
  expect(frameSlots(because.item)).toEqual([]);
});

const tense = (code: string, time: string | null, aspect: string | null) =>
  ({item: catalogItem(code, 'grammar', code), time, aspect}) as LibraryTense;

test('tenses sit on the time × aspect grid; the rest goes below', () => {
  const pastSimple = tense('grammar:past-simple', 'past', 'simple');
  const futurePerfect = tense('grammar:future-perfect', 'future', 'perfect');
  const goingTo = tense('grammar:be-going-to', 'future', null);
  const twin = tense('grammar:past-simple-2', 'past', 'simple');
  const grid = tenseGrid([pastSimple, futurePerfect, goingTo, twin]);
  expect(grid.cells).toHaveLength(3);
  expect(grid.cells[0]![0]).toBe(pastSimple);
  expect(grid.cells[2]![2]).toBe(futurePerfect);
  expect(grid.cells[1]!.every(cell => cell === null)).toBe(true);
  expect(grid.others).toEqual([goingTo, twin]);
});

test('memory levels follow the review stage', () => {
  expect(memoryLevel(null)).toBe('new');
  expect(memoryLevel({stage: 1, stableAt: null})).toBe('started');
  expect(memoryLevel({stage: 2, stableAt: null})).toBe('recalling');
  expect(memoryLevel({stage: 4, stableAt: null})).toBe('stable');
  expect(memoryLevel({stage: 2, stableAt: '2026-10-01'})).toBe('stable');
});

test('a tense payload gives its forms, signals, uses and confusions', () => {
  expect(
    tenseInfo({
      family: 'tense',
      forms: {
        affirmative: 'S + V2',
        negative: "S didn't V",
        question: 'Did S V?',
      },
      signals: ['yesterday', 3],
      uses_vi: ['Việc đã xong'],
      contrast_with: ['grammar:present-perfect'],
    }),
  ).toEqual({
    forms: {
      affirmative: 'S + V2',
      negative: "S didn't V",
      question: 'Did S V?',
    },
    signals: ['yesterday'],
    usesVi: ['Việc đã xong'],
    contrastWith: ['grammar:present-perfect'],
  });
  expect(tenseInfo({family: 'tense'})).toEqual({
    forms: null,
    signals: [],
    usesVi: [],
    contrastWith: [],
  });
});
