/**
 * COPY of the Server's `src/modules/items/model/item.ts` limits used by the
 * item helpers below (keep both in sync).
 */
export const ItemKindValues = [
  'word',
  'phrase',
  'pattern',
  'pronunciation',
  'listening',
] as const;
export type ItemKind = (typeof ItemKindValues)[number];

export const ITEM_CODE_BODY_MAX = 150;
export const ITEM_DERIVED_SLUG_MAX = 80;
export const ITEM_SHORT_TEXT_MAX = 500;
export const PATTERN_SLOTS_MAX = 4;
export const PATTERN_SLOT_VALUES_MAX = 30;
export const MINIMAL_PAIRS_MAX = 10;
export const ITEM_REFS_MAX = 30;
