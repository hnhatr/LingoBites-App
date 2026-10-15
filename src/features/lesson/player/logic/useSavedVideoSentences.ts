import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {
  loadSavedComboSentences,
  type SavedComboSentence,
  toggleSavedComboSentence,
} from '@features/combo';

import type {LessonSentence} from '@core/schemas/lesson';

/** ♥ state of a video lesson's sentences (passed to the cards and transcript). */
export type SentenceSaveControl = {
  isSaved: (sentenceId: string) => boolean;
  toggle: (sentence: LessonSentence) => void;
  /** How many of this lesson's sentences are saved. */
  savedCount: number;
};

/** One saved entry per lesson sentence, so saving twice never duplicates it. */
export function savedVideoSentenceId(
  lessonId: string,
  sentenceId: string,
): string {
  return `video:${lessonId}:${sentenceId}`;
}

/**
 * YouTube lesson FR-05: ♥ keeps a sentence in the Library's "Câu đã lưu",
 * next to the saved combo sentences. Kept on this device only.
 */
export function useSavedVideoSentences(lessonId: string): SentenceSaveControl {
  const [saved, setSaved] = useState<readonly SavedComboSentence[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadSavedComboSentences().then(list => {
      if (mounted.current) setSaved(list);
    });
    return () => {
      mounted.current = false;
    };
  }, [lessonId]);

  const savedIds = useMemo(
    () =>
      new Set(
        saved
          .filter(entry => entry.lessonId === lessonId)
          .map(entry => entry.id),
      ),
    [lessonId, saved],
  );

  const isSaved = useCallback(
    (sentenceId: string) =>
      savedIds.has(savedVideoSentenceId(lessonId, sentenceId)),
    [lessonId, savedIds],
  );

  const toggle = useCallback(
    (sentence: LessonSentence) => {
      toggleSavedComboSentence(
        {
          id: savedVideoSentenceId(lessonId, sentence.id),
          setId: '',
          itemCode: '',
          textEn: sentence.text_en,
          textVi: sentence.text_vi,
          lessonId,
        },
        new Date(),
      ).then(list => {
        if (mounted.current) setSaved(list);
      });
    },
    [lessonId],
  );

  return {isSaved, toggle, savedCount: savedIds.size};
}
