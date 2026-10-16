import AsyncStorage from '@react-native-async-storage/async-storage';

export const TTS_VOICE_STORAGE_KEY = 'tts_voice_id';

/** Saves the chosen TTS voice id; `null` clears it (automatic voice). */
export async function savePreferredVoiceId(id: string | null): Promise<void> {
  try {
    if (id === null) {
      await AsyncStorage.removeItem(TTS_VOICE_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(TTS_VOICE_STORAGE_KEY, id);
    }
  } catch {
    // Persistence is best-effort; the choice still applies until restart.
  }
}

export async function readPreferredVoiceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TTS_VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}
