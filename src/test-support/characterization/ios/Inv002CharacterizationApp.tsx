import React, {useEffect, useRef} from 'react';
import {View} from 'react-native';
import {getAppConfig} from '@shared/api/appConfig';
import {runInv002ProductionPath} from './inv002ProductionPath';

export function Inv002CharacterizationApp(): React.JSX.Element {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    runInv002ProductionPath().then(async result => {
      const line = JSON.stringify(result);
      console.warn('[LING93_INV002]', line);
      try {
        const {apiBaseUrl} = getAppConfig();
        await fetch(`${apiBaseUrl}/characterization/inv002-result`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: line,
        });
      } catch {
        // Marker may still appear in Metro / device logs.
      }
    }).catch(() => {});
  }, []);
  return <View />;
}
