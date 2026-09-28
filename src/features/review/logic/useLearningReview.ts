/**
 * Hook for LING-17 TASK-006 Review surface integration.
 * Fetches latest-incorrect exercises and learning vocabularies via `fetchReview`,
 * allows status transitions via `setVocabularyProgress`, and records attempts via
 * `submitExerciseAttempt`.
 */
import {useCallback, useEffect, useState} from 'react';
import {
  setVocabularyProgress,
  submitExerciseAttempt,
  type LearningAttemptAnswer,
  type VocabularyProgressStatus,
} from '@features/lesson/player';
import {
  fetchReview,
  type ReviewExerciseEntry,
  type ReviewVocabularyEntry,
} from './api/learningReviewClient';

export function useLearningReview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ReviewExerciseEntry[]>([]);
  const [vocabularies, setVocabularies] = useState<ReviewVocabularyEntry[]>([]);

  const loadReview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const result = await fetchReview({signal});
    if (result.ok) {
      setExercises(result.exercises);
      setVocabularies(result.vocabularies);
    } else if (!result.cancelled) {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadReview(controller.signal);
    return () => controller.abort();
  }, [loadReview]);

  const updateVocabularyStatus = useCallback(
    async (vocabularyId: string, status: VocabularyProgressStatus) => {
      const result = await setVocabularyProgress(vocabularyId, status);
      if (result.ok) {
        if (status === 'known') {
          setVocabularies(prev =>
            prev.filter(v => v.vocabulary.id !== vocabularyId),
          );
        } else {
          setVocabularies(prev =>
            prev.map(v =>
              v.vocabulary.id === vocabularyId
                ? {...v, progress: result.progress}
                : v,
            ),
          );
        }
      }
      return result;
    },
    [],
  );

  const submitExercise = useCallback(
    async (exerciseId: string, answer: LearningAttemptAnswer) => {
      const result = await submitExerciseAttempt(exerciseId, answer);
      if (result.ok && result.result.is_correct) {
        setExercises(prev => prev.filter(e => e.exercise.id !== exerciseId));
      }
      return result;
    },
    [],
  );

  return {
    loading,
    error,
    exercises,
    vocabularies,
    loadReview,
    updateVocabularyStatus,
    submitExercise,
  };
}
