import {useCallback, useEffect, useState} from 'react';

import {readCatalogItems} from '@core/db/catalogItems';

import {type LocalPack, type PackRow, rowsFrom} from './packRows';
import {learnedCount, listDownloadedPacks} from './wordPackRepository';
import {fetchWordPath} from './wordPathClient';

/** The packs on the device, with their items and how many are learned. */
function localPacks(): LocalPack[] {
  return listDownloadedPacks().map(pack => {
    const byCode = readCatalogItems(pack.itemCodes);
    return {
      pack,
      learned: learnedCount(pack.itemCodes),
      items: pack.itemCodes.flatMap(code => byCode.get(code) ?? []),
    };
  });
}

/**
 * The word path's pack rows: the Server's path merged with the packs on the
 * device, or the device's packs alone when offline. `rows` is null until the
 * first load ends.
 */
export function useWordPathRows(): {
  rows: PackRow[] | null;
  offline: boolean;
  reload: () => Promise<void>;
} {
  const [offline, setOffline] = useState(false);
  const [rows, setRows] = useState<PackRow[] | null>(null);

  const reload = useCallback(async () => {
    const local = localPacks();
    const result = await fetchWordPath();
    if (result.ok) {
      setOffline(false);
      setRows(rowsFrom(result.value, local));
    } else {
      setOffline(true);
      setRows(rowsFrom(null, local));
    }
  }, []);

  useEffect(() => {
    reload().catch(() => setOffline(true));
  }, [reload]);

  return {rows, offline, reload};
}
