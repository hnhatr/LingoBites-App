import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect, useState} from 'react';

import {TILE_MODES, type TileMode} from '@core/learning';

export const TILE_MODE_STORAGE_KEY = 'tile_composer_mode';

/** The default tile mode for answers with a model (Ghép chữ). */
const DEFAULT_MODE: TileMode = 'letters';

function isTileMode(value: string | null): value is TileMode {
  return TILE_MODES.includes(value as TileMode);
}

/**
 * The learner's tile mode, remembered across entries and launches (decided
 * with the user: default Ghép chữ, keep the last choice). Best-effort, like
 * the theme: storage failures keep the in-memory choice.
 */
export function useTileMode(): [TileMode, (mode: TileMode) => void] {
  const [mode, setMode] = useState<TileMode>(DEFAULT_MODE);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TILE_MODE_STORAGE_KEY)
      .then(saved => {
        if (alive && isTileMode(saved)) setMode(saved);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const choose = (next: TileMode) => {
    setMode(next);
    AsyncStorage.setItem(TILE_MODE_STORAGE_KEY, next).catch(() => undefined);
  };
  return [mode, choose];
}
