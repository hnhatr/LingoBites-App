import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {learningItemsFromSnapshot} from '../items';
import {
  buildPracticeSource,
  CLOZE_BLANK,
  generatePracticeSet,
  getPracticeEligibility,
  gradeAnswer,
  MIN_PRACTICE_QUESTIONS,
  practiceSeed,
  summarizeAnswers,
} from '../practice';
import {createRandom, shuffled} from '../random';

const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

const SENTENCES = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
  ['We walk to the park.', 'Chúng tôi đi bộ đến công viên.'],
  ['They play football.', 'Họ chơi bóng đá.'],
] as const;

function serverItem(
  n: number,
  kind: 'word' | 'phrase' | 'grammar',
  key: string,
  payload: object,
  sentences: number[],
) {
  return {
    id: id(900 + n),
    kind,
    item_key: key,
    payload,
    sentence_ids: sentences.map(index => id(index + 1)),
  };
}

function snapshot(overrides: Partial<LessonSnapshot> = {}): LessonSnapshot {
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
    sentences: SENTENCES.map(([en, vi], index) => ({
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
    items: [
      serverItem(
        1,
        'phrase',
        'wake up',
        {word: 'wake up', meaning_vi: 'thức dậy', ipa: null, pos: null},
        [0],
      ),
      serverItem(
        2,
        'word',
        'coffee',
        {word: 'coffee', meaning_vi: 'cà phê', ipa: 'ˈkɒfi', pos: 'noun'},
        [1],
      ),
      serverItem(
        3,
        'word',
        'book',
        {word: 'book', meaning_vi: 'cuốn sách', ipa: null, pos: 'noun'},
        [2],
      ),
      serverItem(
        4,
        'word',
        'park',
        {word: 'park', meaning_vi: 'công viên', ipa: null, pos: 'noun'},
        [3],
      ),
      serverItem(
        5,
        'word',
        'football',
        {word: 'football', meaning_vi: 'bóng đá', ipa: null, pos: 'noun'},
        [4],
      ),
      serverItem(
        6,
        'grammar',
        'present simple',
        {
          name: 'Present simple',
          name_vi: null,
          formula: 'S + V',
          description: 'x',
        },
        [0],
      ),
    ],
    ...overrides,
  };
}

const source = () => buildPracticeSource(snapshot());
const SEED = practiceSeed(id(500), 3, 1);

describe('seeded random', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = createRandom('x');
    const b = createRandom('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(createRandom('y')()).not.toBe(createRandom('x')());
  });

  it('shuffles without losing or duplicating items', () => {
    const out = shuffled([1, 2, 3, 4, 5, 6], createRandom('s'));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('learning items of a snapshot', () => {
  it('uses the Server items and keeps only sentences that still exist', () => {
    const items = learningItemsFromSnapshot(
      snapshot({
        items: [
          serverItem(
            1,
            'word',
            'coffee',
            {word: 'coffee', meaning_vi: 'cà phê', ipa: null, pos: null},
            [1],
          ),
          {
            ...serverItem(
              2,
              'word',
              'tea',
              {word: 'tea', meaning_vi: 'trà', ipa: null, pos: null},
              [],
            ),
            sentence_ids: [id(99)],
          },
        ],
      }),
    );
    expect(items.map(item => item.itemKey)).toEqual([
      'word:coffee',
      'word:tea',
    ]);
    expect(items[0]!.sentenceIds).toEqual([id(2)]);
    expect(items[1]!.sentenceIds).toEqual([]);
  });

  it('derives the same words from blocks and analyses for an older download', () => {
    const analysis: LessonAnalysis = {
      sentence_id: id(1),
      vocabulary: [
        {
          id: id(70),
          word: 'Wake up',
          pos: 'verb',
          ipa: 'weɪk ʌp',
          meaning: 'thức dậy',
        },
      ],
      grammar: [
        {
          id: id(71),
          name: 'Present simple',
          description: 'd',
          formula: 'S + V',
          analysis: 'a',
        },
      ],
      created_at: '2026-10-01T00:00:00.000Z',
    };
    const old = snapshot({
      items: undefined,
      blocks: [
        {
          id: id(80),
          type: 'vocabulary',
          position: 0,
          title: null,
          data: {
            items: [
              {
                id: id(81),
                word: 'Coffee',
                meaning: 'cà phê',
                pronunciation: 'ˈkɒfi',
              },
            ],
          },
        },
      ],
      analyses: {[id(1)]: analysis},
    });
    const items = learningItemsFromSnapshot(old);
    expect(items.map(item => item.itemKey)).toEqual([
      'word:coffee',
      'phrase:wake up',
      'grammar:present simple',
    ]);
    const coffee = items[0]!;
    expect(coffee).toMatchObject({meaningVi: 'cà phê', ipa: 'ˈkɒfi'});
    expect(coffee.sentenceIds).toEqual([id(2)]);
  });
});

describe('eligibility', () => {
  it('counts what each variant can offer', () => {
    const result = getPracticeEligibility(source());
    expect(result.eligible).toBe(true);
    expect(result.available.meaning_choice).toBe(5);
    expect(result.available.cloze_choice).toBe(5);
    expect(result.available.translation_choice).toBe(5);
    expect(result.total).toBe(15);
  });

  it('is not eligible when the lesson is too small', () => {
    const tiny = buildPracticeSource(
      snapshot({
        sentences: snapshot().sentences.slice(0, 2),
        items: snapshot().items!.slice(0, 2),
      }),
    );
    const result = getPracticeEligibility(tiny);
    expect(result.total).toBeLessThan(MIN_PRACTICE_QUESTIONS);
    expect(result.eligible).toBe(false);
    expect(generatePracticeSet(tiny, SEED)).toBeDefined();
  });

  it('skips word questions that cannot get three distinct wrong meanings', () => {
    const twins = buildPracticeSource(
      snapshot({
        items: [
          serverItem(
            1,
            'word',
            'a1',
            {word: 'one', meaning_vi: 'số một', ipa: null, pos: null},
            [],
          ),
          serverItem(
            2,
            'word',
            'a2',
            {word: 'uno', meaning_vi: 'Số một.', ipa: null, pos: null},
            [],
          ),
          serverItem(
            3,
            'word',
            'a3',
            {word: 'two', meaning_vi: 'số hai', ipa: null, pos: null},
            [],
          ),
          serverItem(
            4,
            'word',
            'a4',
            {word: 'three', meaning_vi: 'số ba', ipa: null, pos: null},
            [],
          ),
        ],
      }),
    );
    // "số một" and "Số một." normalise equal, so no word has three distinct
    // wrong meanings: a meaning question would need a duplicate option.
    expect(getPracticeEligibility(twins).available.meaning_choice).toBe(0);
  });
});

describe('generatePracticeSet', () => {
  it('is deterministic for a seed and changes with the attempt number', () => {
    const first = generatePracticeSet(source(), SEED);
    expect(generatePracticeSet(source(), SEED)).toEqual(first);
    const second = generatePracticeSet(source(), practiceSeed(id(500), 3, 2));
    expect(second).not.toEqual(first);
    // Same questions can recur, but not in the identical order and options.
    expect(JSON.stringify(second)).not.toBe(JSON.stringify(first));
  });

  it('builds valid multiple-choice questions only', () => {
    const questions = generatePracticeSet(source(), SEED, 15);
    expect(questions).toHaveLength(15);
    for (const question of questions) {
      const texts = question.options.map(option =>
        option.text.trim().toLowerCase(),
      );
      expect(new Set(texts).size).toBe(texts.length); // no duplicate options
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      const correct = question.options.find(
        o => o.id === question.correctOptionId,
      );
      expect(correct?.text).toBe(question.answerText);
      expect(
        question.options.filter(o => o.text === question.answerText),
      ).toHaveLength(1);
      expect(new Set(question.options.map(o => o.id)).size).toBe(
        question.options.length,
      );
    }
    const ids = questions.map(question => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mixes the variants and honours the requested count', () => {
    const questions = generatePracticeSet(source(), SEED, 6);
    expect(questions).toHaveLength(6);
    expect(new Set(questions.map(q => q.variant)).size).toBe(3);
    expect(generatePracticeSet(source(), SEED, 100).length).toBe(15);
  });

  it('blanks the word in cloze questions and never offers a second fitting word', () => {
    const cloze = generatePracticeSet(source(), SEED, 15).filter(
      question => question.variant === 'cloze_choice',
    );
    expect(cloze.length).toBeGreaterThan(0);
    for (const question of cloze) {
      expect(question.prompt).toContain(CLOZE_BLANK);
      expect(question.prompt.toLowerCase()).not.toContain(
        question.answerText.toLowerCase(),
      );
      expect(question.hintVi).toBeTruthy();
      const sentence = SENTENCES.find(([, vi]) => vi === question.hintVi)![0];
      for (const option of question.options.filter(
        o => o.id !== question.correctOptionId,
      )) {
        expect(sentence.toLowerCase()).not.toContain(option.text.toLowerCase());
      }
    }
  });

  it('keeps meaning questions on the word and translation questions on the sentence', () => {
    const questions = generatePracticeSet(source(), SEED, 15);
    const meaning = questions.find(q => q.variant === 'meaning_choice')!;
    expect(meaning.itemKey).toMatch(/^(word|phrase):/);
    expect(meaning.options).toHaveLength(4);
    const translation = questions.find(
      q => q.variant === 'translation_choice',
    )!;
    expect(translation.itemKey).toBeNull();
    expect(translation.sentenceId).toBeTruthy();
    expect(SENTENCES.map(([en]) => en)).toContain(translation.prompt);
  });
});

describe('grading and summary', () => {
  const questions = generatePracticeSet(source(), SEED, 6);
  const wrongOption = (question: (typeof questions)[number]) =>
    question.options.find(option => option.id !== question.correctOptionId)!.id;

  it('grades by option id', () => {
    const q = questions[0]!;
    expect(gradeAnswer(q, q.correctOptionId)).toEqual({
      correct: true,
      correctOptionId: q.correctOptionId,
      answerText: q.answerText,
    });
    expect(gradeAnswer(q, wrongOption(q)).correct).toBe(false);
    expect(gradeAnswer(q, 'nope').correct).toBe(false);
  });

  it('summarises accuracy and lists missed items once, in order', () => {
    const answers = questions.map((q, index) => ({
      questionId: q.id,
      optionId: index % 2 === 0 ? q.correctOptionId : wrongOption(q),
    }));
    const summary = summarizeAnswers(questions, answers);
    expect(summary.total).toBe(6);
    expect(summary.correct).toBe(3);
    expect(summary.accuracy).toBe(50);
    const expectedMissed = questions
      .filter((_, index) => index % 2 === 1)
      .map(q => q.itemKey)
      .filter((key): key is string => key !== null);
    expect(summary.missedItemKeys).toEqual([...new Set(expectedMissed)]);
  });

  it('ignores unknown questions and handles an empty session', () => {
    expect(summarizeAnswers(questions, [])).toEqual({
      total: 0,
      correct: 0,
      accuracy: 0,
      missedItemKeys: [],
    });
    expect(
      summarizeAnswers(questions, [{questionId: 'ghost', optionId: 'x'}]).total,
    ).toBe(0);
  });
});
