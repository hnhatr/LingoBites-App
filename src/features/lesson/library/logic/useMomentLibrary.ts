import {useCallback, useEffect, useState} from 'react';

import {
  fetchMomentLibrary,
  type MomentLibraryItem,
  readCachedMomentLibrary,
} from './momentLibrary';

export type MomentLibraryState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'ready'; moments: MomentLibraryItem[]; fromCache: boolean};

/**
 * E5: the learner's moments from the server, or the last list this device
 * saw when offline. Loads on mount; `load` reloads.
 */
export function useMomentLibrary(): {
  state: MomentLibraryState;
  load: () => Promise<void>;
} {
  const [state, setState] = useState<MomentLibraryState>({status: 'loading'});

  const load = useCallback(async () => {
    setState({status: 'loading'});
    const result = await fetchMomentLibrary();
    if (result.ok) {
      setState({status: 'ready', moments: result.value, fromCache: false});
      return;
    }
    // Offline or the server is down: the last list this device saw still helps.
    const cached = await readCachedMomentLibrary();
    setState(
      cached && cached.length > 0
        ? {status: 'ready', moments: cached, fromCache: true}
        : {status: 'error', message: result.message},
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {state, load};
}
