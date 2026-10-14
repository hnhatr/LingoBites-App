/**
 * Vocab path P5: word packs kept on the device. A pack is stored whole (its
 * items and its list) in one transaction, so a pack is either fully there or
 * not at all. Reads never call the Server.
 */
import {saveCatalogItems} from '@core/db/catalogItems';
import {getDatabase, withTransaction} from '@core/db/database';

import type {WordPackDetail} from './wordPathClient';

export type DownloadedPack = {
  packId: string;
  cefrLevel: string;
  topicCode: string | null;
  position: number;
  titleVi: string;
  itemCodes: string[];
  downloadedAt: string;
};

function rowsOf<T>(result: {
  rows?: {length: number; item: (index: number) => unknown};
}): T[] {
  const out: T[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    out.push(result.rows!.item(index) as T);
  }
  return out;
}

/** Stores a downloaded pack: its items and its place in the list. Re-downloading replaces both. */
export function saveWordPack(detail: WordPackDetail, now: Date): void {
  const db = getDatabase();
  const at = now.toISOString();
  withTransaction(db, () => {
    saveCatalogItems(detail.items, 'word_pack', at);
    db.execute(
      `INSERT OR REPLACE INTO word_pack_downloads (pack_id, cefr_level, topic_code,
         position, title_vi, item_codes_json, downloaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        detail.pack.id,
        detail.pack.cefr_level,
        detail.pack.topic_code,
        detail.pack.position,
        detail.pack.title_vi,
        JSON.stringify(detail.items.map(item => item.code)),
        at,
      ],
    );
  });
}

type PackRow = {
  pack_id: string;
  cefr_level: string;
  topic_code: string | null;
  position: number;
  title_vi: string;
  item_codes_json: string;
  downloaded_at: string;
};

function packOf(row: PackRow): DownloadedPack {
  return {
    packId: row.pack_id,
    cefrLevel: row.cefr_level,
    topicCode: row.topic_code,
    position: row.position,
    titleVi: row.title_vi,
    itemCodes: JSON.parse(row.item_codes_json) as string[],
    downloadedAt: row.downloaded_at,
  };
}

export function listDownloadedPacks(): DownloadedPack[] {
  return rowsOf<PackRow>(
    getDatabase().execute(
      `SELECT pack_id, cefr_level, topic_code, position, title_vi,
              item_codes_json, downloaded_at
         FROM word_pack_downloads
        ORDER BY cefr_level, position;`,
    ),
  ).map(packOf);
}

/**
 * Forgets these downloaded packs. Their items stay in the catalog and what the
 * learner learned stays in item memory, which is kept by item, not by pack.
 */
export function removeDownloadedPacks(packIds: readonly string[]): void {
  if (packIds.length === 0) return;
  getDatabase().execute(
    `DELETE FROM word_pack_downloads
      WHERE pack_id IN (${packIds.map(() => '?').join(', ')});`,
    [...packIds],
  );
}

export function findDownloadedPack(packId: string): DownloadedPack | null {
  const row = rowsOf<PackRow>(
    getDatabase().execute(
      `SELECT pack_id, cefr_level, topic_code, position, title_vi,
              item_codes_json, downloaded_at
         FROM word_pack_downloads WHERE pack_id = ?;`,
      [packId],
    ),
  )[0];
  return row ? packOf(row) : null;
}

/** Which of these items are already in the learner's schedule (item memory). */
export function learnedCodes(codes: readonly string[]): Set<string> {
  if (codes.length === 0) return new Set();
  const unique = [...new Set(codes)];
  return new Set(
    rowsOf<{item_code: string}>(
      getDatabase().execute(
        `SELECT item_code FROM item_memory
          WHERE item_code IN (${unique.map(() => '?').join(', ')});`,
        unique,
      ),
    ).map(row => row.item_code),
  );
}

/** How many of these items are already in the learner's schedule (item memory). */
export function learnedCount(codes: readonly string[]): number {
  if (codes.length === 0) return 0;
  const row = rowsOf<{n: number}>(
    getDatabase().execute(
      `SELECT COUNT(*) AS n FROM item_memory
        WHERE item_code IN (${codes.map(() => '?').join(', ')});`,
      [...new Set(codes)],
    ),
  )[0];
  return row?.n ?? 0;
}
