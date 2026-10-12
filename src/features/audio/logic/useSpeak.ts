import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {speak, stop, type TtsErrorCode} from './ttsService';

/**
 * Speaks English text for one screen and keeps the last failure so the
 * screen can show it. Speech stops when the screen unmounts or the app leaves
 * the foreground, so audio never plays on after the learner has moved on.
 */
export function useSpeak() {
  const [notice, setNotice] = useState<TtsErrorCode | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState?.addEventListener?.('change', state => {
      if (state !== 'active') {
        stop().catch(() => undefined);
      }
    });
    return () => {
      mounted.current = false;
      subscription?.remove();
      stop().catch(() => undefined);
    };
  }, []);

  const say = useCallback((text: string) => {
    speak(text)
      .then(result => {
        if (mounted.current) {
          setNotice(result.ok ? null : result.errorCode);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setNotice('UNAVAILABLE');
        }
      });
  }, []);

  return {speak: say, notice};
}
