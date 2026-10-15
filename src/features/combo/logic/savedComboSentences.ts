import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vocab path P5: the combo sentences the learner saved with "Lưu", listed in
 * the Library under "Câu đã lưu". Kept on this device only, newest first.
 * Sentences saved with ♥ in a YouTube lesson share the list; they carry the
 * lesson they came from instead of a combo set.
 */
export const SAVED_COMBO_SENTENCES_KEY = 'combo_saved_sentences_v1';

export type SavedComboSentence = {
  id: string;
  setId: string;
  itemCode: string;
  textEn: string;
  textVi: string;
  savedAt: string;
  /** Set for a sentence saved from a lesson (`setId` is then empty). */
  lessonId?: string;
};

function isSaved(value: unknown): value is SavedComboSentence {
  const entry = value as Partial<SavedComboSentence> | null;
  return (
    typeof entry?.id === 'string' &&
    typeof entry.setId === 'string' &&
    typeof entry.textEn === 'string' &&
    typeof entry.textVi === 'string'
  );
}

export async function loadSavedComboSentences(): Promise<SavedComboSentence[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_COMBO_SENTENCES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSaved) : [];
  } catch {
    return [];
  }
}

async function store(sentences: SavedComboSentence[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SAVED_COMBO_SENTENCES_KEY,
      JSON.stringify(sentences),
    );
  } catch {
    // Best-effort; a failed save only loses the bookmark on the next launch.
  }
}

/** Saves the sentence, or removes it when it is already saved. Returns the new list. */
export async function toggleSavedComboSentence(
  sentence: Omit<SavedComboSentence, 'savedAt'>,
  now: Date,
): Promise<SavedComboSentence[]> {
  const current = await loadSavedComboSentences();
  const next = current.some(entry => entry.id === sentence.id)
    ? current.filter(entry => entry.id !== sentence.id)
    : [{...sentence, savedAt: now.toISOString()}, ...current];
  await store(next);
  return next;
}
