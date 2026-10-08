/**
 * COPY of the Server's `src/modules/items/model/itemCode.ts` (keep both in
 * sync); `normalizeItemKey` lives in `./itemKey`. Pinned by the shared
 * fixtures under `__tests__/fixtures`.
 */
import {
  ITEM_CODE_BODY_MAX,
  ITEM_DERIVED_SLUG_MAX,
  type ItemKind,
  ItemKindValues,
} from './catalogItem';
import {normalizeItemKey} from './itemKey';

/** `{slot}` placeholders are dropped before a pattern's text becomes a slug. */
function slugBody(text: string): string {
  return normalizeItemKey(text.replace(/\{[^}]*\}/g, ' '))
    .replace(/[^\p{L}\p{N}']+/gu, '-')
    .replace(/-+/g, '-')
    .slice(0, ITEM_DERIVED_SLUG_MAX)
    .replace(/^-+|-+$/g, '');
}

/**
 * Default code for an item: words and phrases keep the normalised text (the
 * same key flashcards already use), every other kind gets a dashed slug.
 * Returns `null` when nothing usable is left.
 */
export function deriveItemCode(kind: ItemKind, text: string): string | null {
  const body =
    kind === 'word' || kind === 'phrase'
      ? normalizeItemKey(text).slice(0, ITEM_CODE_BODY_MAX).trim()
      : slugBody(text);
  return body.length > 0 ? `${kind}:${body}` : null;
}

export type ParsedItemCode = {kind: ItemKind; body: string};

/**
 * A code is `<kind>:<body>` where the body is 1–150 characters, lowercase, has
 * no surrounding or repeated whitespace, no tab/newline and no `{` `}`.
 * The database enforces the prefix, length, case and trim rules as well.
 */
export function parseItemCode(code: string): ParsedItemCode | null {
  const separator = code.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const kind = code.slice(0, separator);
  const body = code.slice(separator + 1);
  if (!(ItemKindValues as readonly string[]).includes(kind)) {
    return null;
  }
  if (
    body.length === 0 ||
    body.length > ITEM_CODE_BODY_MAX ||
    body !== body.trim() ||
    body !== body.toLowerCase() ||
    /\s{2,}|[\t\n\r{}]/.test(body)
  ) {
    return null;
  }
  return {kind: kind as ItemKind, body};
}
