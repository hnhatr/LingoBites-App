import type {CatalogItem} from '@core/schemas/lesson';

/** A catalog item for the pattern and tense tests. */
export function catalogItem(
  code: string,
  kind: CatalogItem['kind'],
  text: string,
  overrides: Partial<CatalogItem> = {},
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
    ...overrides,
  };
}
