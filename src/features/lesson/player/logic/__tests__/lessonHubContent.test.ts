import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

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
  blocks: [
    {
      id: '22222222-2222-4222-8222-222222222201',
      type: 'vocabulary',
      position: 0,
      title: null,
      data: {items: [{lemma: 'Coffee', meaning: 'cà phê', ipa: 'ˈkɒfi'}]},
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      type: 'grammar',
      position: 1,
      title: null,
      data: {
        nameEn: 'Present simple',
        nameVi: 'Thì hiện tại đơn',
        pattern: 'S + V(s/es)',
        explanationVi: 'Thói quen hằng ngày.',
        examples: [{en: 'I wake up at six.', vi: 'Tôi thức dậy lúc sáu giờ.'}],
      },
    },
  ],
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

  it('lists block vocabulary first, then analysis words, deduplicated', () => {
    const entries = collectLessonVocabulary(snapshot, {
      [S2]: analysis(S2, ['coffee', 'make'], []),
      [S1]: analysis(S1, ['wake up'], []),
    });
    expect(entries.map(entry => entry.word)).toEqual([
      'Coffee',
      'wake up',
      'make',
    ]);
    expect(entries[0]).toMatchObject({meaning: 'cà phê', ipa: 'ˈkɒfi'});
  });

  it('reads Server snapshot items: catalog id as key, pronunciation as ipa', () => {
    const catalogId = '44444444-4444-4444-8444-444444444401';
    const entries = collectLessonVocabulary(
      {
        ...snapshot,
        blocks: [
          {
            id: '22222222-2222-4222-8222-222222222208',
            type: 'vocabulary',
            position: 0,
            title: null,
            data: {
              items: [
                {
                  id: catalogId,
                  word: 'brew',
                  meaning: 'pha',
                  pronunciation: 'bruː',
                  position: 0,
                },
              ],
            },
          },
        ],
      },
      {},
    );
    expect(entries).toEqual([
      {key: catalogId, word: 'brew', meaning: 'pha', ipa: 'bruː', pos: null},
    ]);
  });

  it('skips vocabulary block items without a word or meaning', () => {
    const entries = collectLessonVocabulary(
      {
        ...snapshot,
        blocks: [
          {
            id: '22222222-2222-4222-8222-222222222209',
            type: 'vocabulary',
            position: 0,
            title: null,
            data: {items: [{lemma: 'orphan'}, 'not an object', null]},
          },
        ],
      },
      {},
    );
    expect(entries).toEqual([]);
  });

  it('merges a sentence analysis into the matching grammar block', () => {
    const entries = collectLessonGrammar(snapshot, {
      [S1]: analysis(S1, [], ['present simple', 'Adverb of time']),
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      name: 'Present simple',
      nameVi: 'Thì hiện tại đơn',
      formula: 'S + V(s/es)',
      inText: 'dùng present simple ở câu này',
    });
    expect(entries[1]).toMatchObject({
      name: 'Adverb of time',
      examples: [{en: 'I wake up at six.', vi: 'Tôi thức dậy lúc sáu giờ.'}],
    });
  });
});
