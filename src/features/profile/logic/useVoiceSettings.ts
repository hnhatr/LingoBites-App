import {useCallback, useEffect, useState} from 'react';

import {
  getPreferredVoiceId,
  listEnUsVoices,
  previewVoice,
  setPreferredVoiceId,
  type TtsVoiceOption,
} from '@features/audio';

export const VOICE_PREVIEW_TEXT = 'Hello! This is how I will sound.';

type VoiceSettingsState =
  | {status: 'loading'}
  | {status: 'unavailable'}
  | {
      status: 'ready';
      voices: TtsVoiceOption[];
      recommendedId: string | null;
    };

/**
 * "Giọng đọc" settings: the installed en-US voices, the learner's choice
 * (`null` = automatic) and a preview. A saved voice that is no longer
 * installed reads as automatic, matching what `speak()` falls back to.
 */
export function useVoiceSettings() {
  const [state, setState] = useState<VoiceSettingsState>({status: 'loading'});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listEnUsVoices(), getPreferredVoiceId()]).then(
      ([list, savedId]) => {
        if (!active) {
          return;
        }
        if (!list.ok || list.voices.length === 0) {
          setState({status: 'unavailable'});
          return;
        }
        setState({
          status: 'ready',
          voices: list.voices,
          recommendedId: list.recommendedId,
        });
        setSelectedId(
          list.voices.some(voice => voice.id === savedId) ? savedId : null,
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const preview = useCallback((voiceId: string) => {
    previewVoice(voiceId, VOICE_PREVIEW_TEXT).catch(() => undefined);
  }, []);

  const choose = useCallback(
    (voiceId: string | null) => {
      setSelectedId(voiceId);
      setPreferredVoiceId(voiceId).catch(() => undefined);
      const heard =
        voiceId ?? (state.status === 'ready' ? state.recommendedId : null);
      if (heard) {
        preview(heard);
      }
    },
    [preview, state],
  );

  return {state, selectedId, choose, preview};
}
