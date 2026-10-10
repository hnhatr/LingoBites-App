import {useUpdates} from 'expo-updates';
import {useEffect, useState} from 'react';

import {type LaunchUpdatePhase, runLaunchUpdate} from './launchUpdate';

export type LaunchUpdateState = {
  phase: LaunchUpdatePhase;
  /** Download progress from 0 to 1 while `phase` is `downloading`. */
  progress: number;
};

/** Runs the launch update once per cold start and reports its progress. */
export function useLaunchUpdate(): LaunchUpdateState {
  const [phase, setPhase] = useState<LaunchUpdatePhase>('checking');
  const {downloadProgress} = useUpdates();

  useEffect(() => {
    let active = true;
    runLaunchUpdate(next => {
      if (active) {
        setPhase(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const progress = phase === 'reloading' ? 1 : downloadProgress ?? 0;
  return {phase, progress};
}
