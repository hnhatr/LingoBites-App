import {ActivityContentSchemas} from '@core/schemas/activityContent';
import type {LessonItemEntry, LessonSnapshot} from '@core/schemas/lesson';

import {
  buildLessonPracticePlan,
  LESSON_PRACTICE_WINDOW_MAX,
  type LessonPracticeSection,
  lessonPracticeSegments,
  pickStudyWindow,
} from '../lessonPractice';
import {practiceSeed} from '../practice';

const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

const SENTENCES = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
  ['We walk to the park.', 'Chúng tôi đi bộ đến công viên.'],
  ['They play football.', 'Họ chơi bóng đá.'],
] as const;

const WORDS = [
  ['phrase', 'wake up', 'thức dậy'],
  ['word', 'coffee', 'cà phê'],
  ['word', 'book', 'cuốn sách'],
  ['word', 'park', 'công viên'],
  ['word', 'football', 'bóng đá'],
] as const;

function item(
  n: number,
  kind: 'word' | 'phrase',
  text: string,
  meaningVi: string,
): LessonItemEntry {
  return {
    role: 'required',
    introduction: 'new',
    position: n,
    item: {
      id: id(900 + n),
      code: `${kind}:${text.replace(/\s+/g, '-')}`,
      kind,
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

function snapshot(
  sentences: ReadonlyArray<readonly [string, string]> = SENTENCES,
  words: ReadonlyArray<readonly [string, string, string]> = WORDS,
  overrides: Partial<LessonSnapshot> = {},
): LessonSnapshot {
  return {
    id: id(500),
    slug: 'morning',
    title: 'Morning',
    description: '',
    origin: 'learner',
    source_type: 'learner_text',
    content_revision: 3,
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
    lesson_items: words.map(([kind, text, vi], index) =>
      item(index + 1, kind as 'word' | 'phrase', text, vi),
    ),
    ...overrides,
  };
}

const SEED = practiceSeed(id(500), 3, 1);

function section<K extends LessonPracticeSection['kind']>(
  sections: LessonPracticeSection[],
  kind: K,
): Extract<LessonPracticeSection, {kind: K}> {
  const found = sections.find(candidate => candidate.kind === kind);
  if (!found) {
    throw new Error(`no ${kind} section`);
  }
  return found as Extract<LessonPracticeSection, {kind: K}>;
}

describe('buildLessonPracticePlan', () => {
  it('builds the four sections in a fixed order', () => {
    const plan = buildLessonPracticePlan(snapshot(), SEED);
    expect(plan).not.toBeNull();
    expect(plan!.lessonId).toBe(id(500));
    expect(plan!.contentRevision).toBe(3);
    expect(plan!.sentenceIds).toEqual([1, 2, 3, 4, 5].map(id));
    expect(plan!.sections.map(s => s.kind)).toEqual([
      'listen_and_repeat',
      'multiple_choice',
      'fill_blank',
      'translation',
    ]);
  });

  it('only produces content the activity schemas accept', () => {
    const plan = buildLessonPracticePlan(snapshot(), SEED)!;
    for (const s of plan.sections) {
      expect(ActivityContentSchemas[s.kind].safeParse(s.content).success).toBe(
        true,
      );
    }
  });

  it('gives every entry a ref to what it practises', () => {
    const plan = buildLessonPracticePlan(snapshot(), SEED)!;
    const listen = section(plan.sections, 'listen_and_repeat');
    expect(listen.content.prompts).toHaveLength(4);
    for (const prompt of listen.content.prompts) {
      expect(listen.refs[prompt.id]).toEqual({
        itemKey: null,
        sentenceId: prompt.sentenceId,
      });
    }
    const meaning = section(plan.sections, 'multiple_choice');
    for (const question of meaning.content.questions) {
      expect(meaning.refs[question.id]!.itemKey).toMatch(/^(word|phrase):/);
    }
  });

  it('is the same for the same seed and keeps the window for another', () => {
    const a = buildLessonPracticePlan(snapshot(), SEED);
    const b = buildLessonPracticePlan(snapshot(), SEED);
    expect(a).toEqual(b);
    const c = buildLessonPracticePlan(snapshot(), practiceSeed(id(500), 3, 2))!;
    expect(c.sentenceIds).toEqual(a!.sentenceIds);
    expect(c.sections.map(s => s.kind)).toEqual(a!.sections.map(s => s.kind));
  });

  it('asks for the English word of a meaning, never with a same-meaning option', () => {
    const plan = buildLessonPracticePlan(
      snapshot(SENTENCES, [...WORDS, ['word', 'novel', 'cuốn sách']]),
      SEED,
    )!;
    const meaning = section(plan.sections, 'multiple_choice');
    expect(meaning.content.questions.length).toBeGreaterThanOrEqual(3);
    for (const question of meaning.content.questions) {
      const texts = question.options.map(option => option.text);
      if (question.promptVi === 'cuốn sách') {
        expect(texts.filter(t => t === 'book' || t === 'novel')).toHaveLength(
          1,
        );
      }
      const right = question.options.find(
        option => option.id === question.correctOptionId,
      )!;
      const word = WORDS.find(([, text]) => text === right.text);
      if (word) {
        expect(question.promptVi).toBe(word[2]);
      }
    }
  });

  it('blanks the word inside its sentence', () => {
    const plan = buildLessonPracticePlan(snapshot(), SEED)!;
    const fill = section(plan.sections, 'fill_blank');
    expect(fill.content.questions.length).toBeGreaterThanOrEqual(3);
    for (const question of fill.content.questions) {
      const sentence = SENTENCES.find(([en]) =>
        en.startsWith(question.beforeEn),
      )!;
      expect(question.beforeEn + question.answer + question.afterEn).toBe(
        sentence[0],
      );
      expect(question.textVi).toBe(sentence[1]);
      expect(question.options).toContain(question.answer);
      // No other option fits the sentence.
      for (const option of question.options!) {
        if (option !== question.answer) {
          expect(sentence[0].toLowerCase()).not.toContain(option.toLowerCase());
        }
      }
    }
  });

  it('translates only short sentences, at most three', () => {
    const plan = buildLessonPracticePlan(
      snapshot([
        ...SENTENCES,
        [
          'This sentence is far too long to type out on a phone keyboard.',
          'Câu này quá dài.',
        ],
      ]),
      SEED,
    )!;
    const translation = section(plan.sections, 'translation');
    expect(translation.content.sentences.length).toBeLessThanOrEqual(3);
    for (const sentence of translation.content.sentences) {
      expect(sentence.modelEn.split(' ').length).toBeLessThanOrEqual(8);
    }
  });

  it('keeps a usable video clip and drops one longer than 30 seconds', () => {
    const base = snapshot();
    const plan = buildLessonPracticePlan(
      {
        ...base,
        sentences: base.sentences.map((s, index) => ({
          ...s,
          start_ms: index * 1000,
          end_ms: index === 1 ? 60_000 : index * 1000 + 900,
        })),
      },
      SEED,
    )!;
    const prompts = section(plan.sections, 'listen_and_repeat').content.prompts;
    expect(prompts[0]).toMatchObject({startMs: 0, endMs: 900});
    expect(prompts[1]).not.toHaveProperty('startMs');
    expect(prompts[1]).not.toHaveProperty('endMs');
  });

  it('returns null when the lesson has too little to practise (D5)', () => {
    expect(
      buildLessonPracticePlan(
        snapshot([['Hello there.', 'Xin chào.']], []),
        SEED,
      ),
    ).toBeNull();
    expect(buildLessonPracticePlan(snapshot([], []), SEED)).toBeNull();
  });

  it('still practises a lesson without words by listening and translating', () => {
    const plan = buildLessonPracticePlan(snapshot(SENTENCES, []), SEED)!;
    expect(plan.sections.map(s => s.kind)).toEqual([
      'listen_and_repeat',
      'translation',
    ]);
  });
});

describe('pickStudyWindow', () => {
  const filler = (n: number) =>
    [`Filler sentence number ${n}.`, `Câu đệm số ${n}.`] as const;

  it('keeps a short lesson whole', () => {
    expect(pickStudyWindow(snapshot()).map(s => s.id)).toEqual(
      [1, 2, 3, 4, 5].map(id),
    );
  });

  it('picks the run of sentences that carries the most words', () => {
    const sentences = [
      ...Array.from({length: 10}, (_, n) => filler(n)),
      ...SENTENCES,
      ...Array.from({length: 10}, (_, n) => filler(n + 10)),
    ];
    const window = pickStudyWindow(snapshot(sentences));
    expect(window).toHaveLength(LESSON_PRACTICE_WINDOW_MAX);
    const ids = window.map(s => s.id);
    for (let n = 11; n <= 15; n += 1) {
      expect(ids).toContain(id(n));
    }
    // The earliest of the equally good runs.
    expect(ids[0]).toBe(id(8));
  });

  it('starts at the beginning when no words are found', () => {
    const sentences = Array.from({length: 12}, (_, n) => filler(n));
    expect(pickStudyWindow(snapshot(sentences, []))[0]!.id).toBe(id(1));
  });
});

describe('lessonPracticeSegments', () => {
  const lines = (count: number) =>
    Array.from(
      {length: count},
      (_, n) => [`Sentence number ${n}.`, `Câu số ${n}.`] as const,
    );
  const sizes = (count: number) =>
    lessonPracticeSegments(snapshot(lines(count), [])).map(
      s => s.sentenceIds.length,
    );

  it('keeps a lesson of up to eight sentences as one segment', () => {
    expect(sizes(5)).toEqual([5]);
    expect(sizes(8)).toEqual([8]);
  });

  it('splits evenly so no segment is a lone sentence (K1)', () => {
    expect(sizes(9)).toEqual([5, 4]);
    expect(sizes(17)).toEqual([6, 6, 5]);
    expect(sizes(100)).toEqual([...Array(9).fill(8), ...Array(4).fill(7)]);
  });

  it('covers every sentence once, in lesson order', () => {
    const segments = lessonPracticeSegments(snapshot(lines(17), []));
    expect(segments.map(s => s.index)).toEqual([0, 1, 2]);
    expect(segments.flatMap(s => s.sentenceIds)).toEqual(
      Array.from({length: 17}, (_, n) => id(n + 1)),
    );
    expect(segments[1]!.firstSentenceEn).toBe('Sentence number 6.');
  });

  it('gives the video span of timed sentences and null otherwise', () => {
    const base = snapshot(lines(10), []);
    expect(lessonPracticeSegments(base)[0]).toMatchObject({
      startMs: null,
      endMs: null,
    });
    const timed = lessonPracticeSegments({
      ...base,
      sentences: base.sentences.map((s, n) => ({
        ...s,
        start_ms: n * 2000,
        end_ms: n * 2000 + 1500,
      })),
    });
    expect(timed[1]).toMatchObject({startMs: 10_000, endMs: 19_500});
  });

  it('returns no segment for a lesson without sentences', () => {
    expect(lessonPracticeSegments(snapshot([], []))).toEqual([]);
  });

  it('builds the practice of the segment it is given', () => {
    const long = snapshot([...lines(8), ...SENTENCES]);
    const segments = lessonPracticeSegments(long);
    expect(segments).toHaveLength(2);
    const plan = buildLessonPracticePlan(
      long,
      SEED,
      long.analyses,
      segments[1]!.sentenceIds,
    )!;
    expect(plan.sentenceIds).toEqual(segments[1]!.sentenceIds);
    const listen = section(plan.sections, 'listen_and_repeat');
    for (const prompt of listen.content.prompts) {
      expect(segments[1]!.sentenceIds).toContain(prompt.sentenceId);
    }
  });
});
