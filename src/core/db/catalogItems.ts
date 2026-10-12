import {type CatalogItem, CatalogItemSchema} from '@core/schemas/lesson';

import {getDatabase} from './database';

/**
 * Catalog items kept on the device outside lesson snapshots (vocab path P5:
 * items of downloaded word packs). A broken row only hides that item.
 */

function rowsOf<T>(result: {
  rows?: {length: number; item: (index: number) => unknown};
}): T[] {
  const out: T[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    out.push(result.rows!.item(index) as T);
  }
  return out;
}

/** Writes or replaces these items. Callers wrap the call in their own transaction. */
export function saveCatalogItems(
  items: readonly CatalogItem[],
  source: string,
  at: string,
): void {
  const db = getDatabase();
  for (const item of items) {
    db.execute(
      `INSERT OR REPLACE INTO catalog_items (item_code, item_json, source, updated_at)
       VALUES (?, ?, ?, ?);`,
      [item.code, JSON.stringify(item), source, at],
    );
  }
}

export function readCatalogItems(
  codes: readonly string[],
): Map<string, CatalogItem> {
  const found = new Map<string, CatalogItem>();
  if (codes.length === 0) return found;
  const rows = rowsOf<{item_json: string}>(
    getDatabase().execute(
      `SELECT item_json FROM catalog_items
        WHERE item_code IN (${codes.map(() => '?').join(', ')});`,
      [...new Set(codes)],
    ),
  );
  for (const row of rows) {
    try {
      const parsed = CatalogItemSchema.safeParse(JSON.parse(row.item_json));
      if (parsed.success) found.set(parsed.data.code, parsed.data);
    } catch {
      // A broken row only hides that item.
    }
  }
  return found;
}
