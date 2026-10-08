import type {
  LessonAnalysis,
  LessonItemEntry,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {
  collectLessonGrammar,
  collectLessonVocabulary,
  mergeAnalyses,
  sortedSentences,
} from '../lessonHubContent';

const S1 = '11111111-1111-4111-8111-111111111101';
const S2 = '11111111-1111-4111-8111-111111111102';

function analysis(
  sentenceId: string,
  words: string[],
  grammar: string[],
): LessonAnalysis {
  return {
    sentence_id: sentenceId,
    vocabulary: words.map((word, index) => ({
      id: `${sentenceId}-v${index}`,
      word,
      pos: 'verb',
      ipa: 'ipa',
      meaning: `nghĩa ${word}`,
    })),
    grammar: grammar.map((name, index) => ({
      id: `${sentenceId}-g${index}`,
      name,
      description: `mô tả ${name}`,
      formula: 'S + V',
      analysis: `dùng ${name} ở câu này`,
    })),
    created_at: '2026-10-01T00:00:00.000Z',
  };
}

const snapshot: LessonSnapshot = {
  id: '33333333-3333-4333-8333-333333333301',
  slug: 'morning',
  title: 'Morning routine',
  description: '',
  origin: 'learner',
  source_type: 'learner_text',
  content_revision: 1,
  unit: null,
  youtube: null,
  sentences: [
    {
      id: S2,
      position: 1,
      text_en: 'Then I make coffee.',
      text_vi: 'Sau đó tôi pha cà phê.',
      ipa: 'ipa-2',
      start_ms: null,
      end_ms: null,
    },
    {
      id: S1,
      position: 0,
      text_en: 'I wake up at six.',
      text_vi: 'Tôi thức dậy lúc sáu giờ.',
      ipa: 'ipa-1',
      start_ms: null,
      end_ms: null,
    },
  ],
  blocks: [],
  analyses: {},
};

describe('lessonHubContent', () => {
  it('orders sentences by position', () => {
    expect(sortedSentences(snapshot).map(s => s.id)).toEqual([S1, S2]);
  });

  it('lets late analyses override stored ones without mutating either', () => {
    const stored = {[S1]: analysis(S1, ['old'], [])};
    const late = {[S1]: analysis(S1, ['new'], [])};
    const merged = mergeAnalyses(stored, late);
    expect(merged[S1].vocabulary[0].word).toBe('new');
    expect(stored[S1].vocabulary[0].word).toBe('old');
  });

  it('lists analysis words in sentence order, deduplicated', () => {
    const entries = collectLessonVocabulary(snapshot, {
      [S2]: analysis(S2, ['coffee', 'make'], []),
      [S1]: analysis(S1, ['wake up', 'Coffee'], []),
    });
    expect(entries.map(entry => entry.word)).toEqual([
      'wake up',
      'Coffee',
      'make',
    ]);
    expect(entries[0]).toMatchObject({
      key: 'phrase:wake up',
      meaning: 'nghĩa wake up',
      ipa: 'ipa',
    });
  });

  it('reads the catalog words and phrases of a curriculum lesson', () => {
    const catalogItem = (
      n: number,
      kind: 'word' | 'pattern',
      code: string,
      text: string,
      meaning: string,
      ipa: string | null,
    ): LessonItemEntry => ({
      role: 'required',
      introduction: 'new',
      position: n,
      item: {
        id: `44444444-4444-4444-8444-44444444440${n}`,
        code,
        kind,
        text,
        meaning_vi: meaning,
        ipa,
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
    });
    const entries = collectLessonVocabulary(
      {
        ...snapshot,
        lesson_items: [
          catalogItem(
            1,
            'pattern',
            'pattern:can-i-have',
            'Can I have a {x}?',
            'Cho tôi',
            null,
          ),
          catalogItem(0, 'word', 'word:brew', 'brew', 'pha', 'bruː'),
        ],
      },
      {[S1]: analysis(S1, ['ignored'], [])},
    );
    expect(entries).toEqual([
      {key: 'word:brew', word: 'brew', meaning: 'pha', ipa: 'bruː', pos: null},
    ]);
  });

  it('lists analysis grammar once, with the sentence it was found in', () => {
    const entries = collectLessonGrammar(snapshot, {
      [S2]: analysis(S2, [], ['Present simple']),
      [S1]: analysis(S1, [], ['present simple', 'Adverb of time']),
    });
    expect(entries.map(entry => entry.name)).toEqual([
      'present simple',
      'Adverb of time',
    ]);
    expect(entries[1]).toMatchObject({
      inText: 'dùng Adverb of time ở câu này',
      examples: [{en: 'I wake up at six.', vi: 'Tôi thức dậy lúc sáu giờ.'}],
    });
  });
});
