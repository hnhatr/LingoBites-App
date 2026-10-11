import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import type {LessonItemEntry, LessonSnapshot} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {hasLessonPracticeRun} from '../practiceCompletion';
import {
  markPracticeSegment,
  nextPracticeSegment,
  type PracticeSegmentView,
  practiceSegmentViews,
} from '../practiceSegments';

/** Plan "practice segments": K2, K4, K5. */
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const LESSON_ID = id(500);

const BLOCK = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
  ['We walk to the park.', 'Chúng tôi đi bộ đến công viên.'],
  ['They play football.', 'Họ chơi bóng đá.'],
] as const;

const WORDS = [
  ['coffee', 'cà phê'],
  ['book', 'cuốn sách'],
  ['park', 'công viên'],
  ['football', 'bóng đá'],
] as const;

function item(n: number, text: string, meaningVi: string): LessonItemEntry {
  return {
    role: 'required',
    introduction: 'new',
    position: n,
    item: {
      id: id(900 + n),
      code: `word:${text}`,
      kind: 'word',
      text,
      meaning_vi: meaningVi,
      ipa: null,
      part_of_speech: null,
      note_vi: null,
      audience: 'all',
      payload: {},
      audio: null,
      image: null,
      examples: [],
      variants: [],
      errors: [],
    },
  };
}

/**
 * `blocks` copies of five practisable sentences, then `filler` sentences too
 * long to listen to or translate and without lesson words.
 */
const LONG = Array.from({length: 22}, () => 'very').join(' ');

function lesson(blocks: number, filler = 0, revision = 3): LessonSnapshot {
  const sentences = [
    ...Array.from({length: blocks}, () => BLOCK).flat(),
    ...Array.from(
      {length: filler},
      (_, n) => [`${LONG} ${n}.`, `Câu dài ${n}.`] as const,
    ),
  ];
  return {
    id: LESSON_ID,
    slug: 'morning',
    title: 'Morning',
    description: '',
    origin: 'learner',
    source_type: 'learner_text',
    content_revision: revision,
    unit: null,
    youtube: null,
    sentences: sentences.map(([en, vi], index) => ({
      id: id(index + 1),
      position: index,
      text_en: en,
      text_vi: vi,
      ipa: 'ə',
      start_ms: null,
      end_ms: null,
    })),
    blocks: [],
    analyses: {},
    lesson_items: WORDS.map(([text, vi], index) => item(index, text, vi)),
  } as LessonSnapshot;
}

beforeEach(() => {
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('practiceSegmentViews', () => {
  it('lists every segment, none practised yet', () => {
    const views = practiceSegmentViews(lesson(4));
    expect(views.map(view => view.sentenceIds.length)).toEqual([7, 7, 6]);
    expect(views.every(view => view.available)).toBe(true);
    expect(views.every(view => view.practicedAt === null)).toBe(true);
  });

  it('remembers a finished segment for the same revision only (K4)', () => {
    markPracticeSegment(LESSON_ID, 3, 1, new Date('2026-10-11T08:00:00.000Z'));
    expect(practiceSegmentViews(lesson(4))[1]!.practicedAt).toBe(
      '2026-10-11T08:00:00.000Z',
    );
    expect(
      practiceSegmentViews(lesson(4, 0, 4)).every(
        view => view.practicedAt === null,
      ),
    ).toBe(true);
  });

  it('marks a segment too thin to practise as unavailable (K5)', () => {
    const views = practiceSegmentViews(lesson(1, 6));
    expect(views).toHaveLength(2);
    expect(views[0]!.available).toBe(true);
    expect(views[1]!.available).toBe(false);
    expect(hasLessonPracticeRun(lesson(1, 6))).toBe(true);
  });
});

describe('nextPracticeSegment', () => {
  const view = (
    index: number,
    practicedAt: string | null,
    available = true,
  ): PracticeSegmentView => ({
    index,
    sentenceIds: [id(index)],
    firstSentenceEn: '',
    startMs: null,
    endMs: null,
    available,
    practicedAt,
  });

  it('goes through the segments in order (K2)', () => {
    expect(nextPracticeSegment([view(0, null), view(1, null)])).toBe(0);
    expect(
      nextPracticeSegment([view(0, '2026-10-11T08:00:00Z'), view(1, null)]),
    ).toBe(1);
  });

  it('skips segments that cannot run', () => {
    expect(nextPracticeSegment([view(0, null, false), view(1, null)])).toBe(1);
    expect(nextPracticeSegment([view(0, null, false)])).toBeNull();
  });

  it('returns to the segment practised longest ago once all are done', () => {
    expect(
      nextPracticeSegment([
        view(0, '2026-10-11T09:00:00Z'),
        view(1, '2026-10-11T07:00:00Z'),
        view(2, '2026-10-11T08:00:00Z'),
      ]),
    ).toBe(1);
  });
});
