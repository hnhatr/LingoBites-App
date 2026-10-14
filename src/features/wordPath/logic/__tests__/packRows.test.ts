import type {CatalogItem} from '@core/schemas/lesson';

import {
  continuePackOf,
  type LocalPack,
  matchesQuery,
  packKindOf,
  packStatusOf,
  rowsFrom,
  stalePackIds,
} from '../packRows';
import type {WordPath} from '../wordPathClient';

/** Vocab path P5: the word path rows: word or sentence pack, status, preview, and the pack to continue. */

function item(
  code: string,
  kind: CatalogItem['kind'],
  text: string,
): CatalogItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code,
    kind,
    text,
    meaning_vi: `nghĩa ${text}`,
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
  };
}

const WORD_PACK = '00000000-0000-4000-8000-00000000000a';
const SENTENCE_PACK = '00000000-0000-4000-8000-00000000000b';

const path: WordPath = {
  request_id: 'r',
  status: 'success',
  levels: [
    {
      cefr_level: 'A1',
      topics: [
        {
          topic_code: null,
          title_vi: 'chung',
          packs: [
            {
              id: WORD_PACK,
              position: 1,
              title_vi: 'Gói A1 · chung 1',
              item_count: 3,
              kind_counts: {word: 3, phrase: 0, pattern: 0, grammar: 0},
              preview: [
                {text: 'hello', meaning_vi: 'xin chào'},
                {text: 'tea', meaning_vi: 'trà'},
              ],
            },
          ],
        },
        {
          topic_code: 'topic:food',
          title_vi: 'food',
          packs: [
            {
              id: SENTENCE_PACK,
              position: 2,
              title_vi: 'Gói A1 · food 2',
              item_count: 2,
              kind_counts: {word: 0, phrase: 1, pattern: 1, grammar: 0},
              preview: [{text: 'The bill, please.', meaning_vi: 'Tính tiền.'}],
              cover_url: 'https://cdn.example/food.png',
            },
          ],
        },
      ],
    },
  ],
};

const local: LocalPack = {
  pack: {
    packId: WORD_PACK,
    cefrLevel: 'A1',
    topicCode: null,
    position: 1,
    titleVi: 'Gói A1 · chung 1',
    itemCodes: ['word:hello', 'word:tea', 'word:milk'],
    downloadedAt: '2026-01-01T00:00:00.000Z',
  },
  learned: 1,
  items: [
    item('word:hello', 'word', 'hello'),
    item('word:tea', 'word', 'tea'),
    item('word:milk', 'word', 'milk'),
  ],
};

describe('packKindOf', () => {
  it('is a sentence pack only when phrases and patterns outnumber words', () => {
    expect(packKindOf({word: 3, phrase: 1, pattern: 1, grammar: 0})).toBe(
      'word',
    );
    expect(packKindOf({word: 2, phrase: 2, pattern: 1, grammar: 0})).toBe(
      'sentence',
    );
    expect(packKindOf({word: 2, phrase: 1, pattern: 1, grammar: 0})).toBe(
      'word',
    );
  });
});

describe('packStatusOf', () => {
  it('follows download and learned counts', () => {
    expect(packStatusOf(false, 0, 12)).toBe('not_downloaded');
    expect(packStatusOf(true, 0, 12)).toBe('ready');
    expect(packStatusOf(true, 5, 12)).toBe('learning');
    expect(packStatusOf(true, 12, 12)).toBe('done');
  });
});

describe('rowsFrom', () => {
  it('reads the Server path and the device together', () => {
    const rows = rowsFrom(path, [local]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      packId: WORD_PACK,
      kind: 'word',
      topic: null,
      downloaded: true,
      learned: 1,
      status: 'learning',
    });
    expect(rows[1]).toMatchObject({
      packId: SENTENCE_PACK,
      kind: 'sentence',
      topic: 'food',
      downloaded: false,
      status: 'not_downloaded',
    });
    expect(rows[1]!.preview[0]!.text).toBe('The bill, please.');
  });

  it('carries the cover and topic code for the library card', () => {
    const rows = rowsFrom(path, [local]);
    expect(rows[0]).toMatchObject({coverUrl: null, topicCode: null});
    expect(rows[1]).toMatchObject({
      coverUrl: 'https://cdn.example/food.png',
      topicCode: 'topic:food',
    });
    const [offline] = rowsFrom(null, [local]);
    expect(offline!.coverUrl).toBeNull();
  });

  it('fills in kinds and preview from the device for an older Server', () => {
    const older: WordPath = {
      ...path,
      levels: [
        {
          cefr_level: 'A1',
          topics: [
            {
              topic_code: null,
              title_vi: 'chung',
              packs: [
                {
                  id: WORD_PACK,
                  position: 1,
                  title_vi: 'Gói A1 · chung 1',
                  item_count: 3,
                },
              ],
            },
          ],
        },
      ],
    };
    const [row] = rowsFrom(older, [local]);
    expect(row!.kindCounts.word).toBe(3);
    expect(row!.preview.map(entry => entry.text)).toEqual([
      'hello',
      'tea',
      'milk',
    ]);
  });

  it('shows only what is on the device when offline', () => {
    const rows = rowsFrom(null, [local]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({packId: WORD_PACK, downloaded: true});
  });
});

describe('continuePackOf and matchesQuery', () => {
  it('picks the pack being learned, else the first not done', () => {
    const rows = rowsFrom(path, [local]);
    expect(continuePackOf(rows)?.packId).toBe(WORD_PACK);
    const fresh = rowsFrom(path, []);
    expect(continuePackOf(fresh)?.packId).toBe(WORD_PACK);
  });

  it('matches the title, topic and first items', () => {
    const [wordRow, sentenceRow] = rowsFrom(path, []);
    expect(matchesQuery(wordRow!, 'xin chào')).toBe(true);
    expect(matchesQuery(wordRow!, 'chung 1')).toBe(true);
    expect(matchesQuery(sentenceRow!, 'food')).toBe(true);
    expect(matchesQuery(sentenceRow!, 'hello')).toBe(false);
  });
});

describe('stalePackIds', () => {
  it('names the downloaded packs the Server no longer has', () => {
    expect(stalePackIds(path, [WORD_PACK, 'old-pack'])).toEqual(['old-pack']);
    expect(stalePackIds(path, [WORD_PACK, SENTENCE_PACK])).toEqual([]);
  });

  it('drops nothing when the Server path has no packs', () => {
    expect(
      stalePackIds({...path, levels: []}, [WORD_PACK, 'old-pack']),
    ).toEqual([]);
  });
});
