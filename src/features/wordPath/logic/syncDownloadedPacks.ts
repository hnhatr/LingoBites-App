import {stalePackIds} from './packRows';
import {listDownloadedPacks, removeDownloadedPacks} from './wordPackRepository';
import type {WordPath} from './wordPathClient';
import {fetchWordPath} from './wordPathClient';

/**
 * Drops the downloaded packs that the Server's path no longer has, so a rebuild
 * on the Server does not leave old packs on the device. Returns how many went.
 */
export function dropStalePacks(path: WordPath): number {
  const stale = stalePackIds(
    path,
    listDownloadedPacks().map(pack => pack.packId),
  );
  removeDownloadedPacks(stale);
  return stale.length;
}

/**
 * Fetches the word path and drops stale packs, only when packs are on the
 * device. Offline or on a Server error nothing changes. Returns how many went.
 */
export async function syncDownloadedPacks(): Promise<number> {
  if (listDownloadedPacks().length === 0) return 0;
  const result = await fetchWordPath();
  return result.ok ? dropStalePacks(result.value) : 0;
}
