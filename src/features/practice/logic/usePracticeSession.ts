import {useCallback, useMemo, useRef, useState} from 'react';

import {recordPracticeSessionActivity} from '@features/engagement';
import {getLessonDownload} from '@features/lesson/player';
import {saveFlashcard} from '@features/review';
import {requestSync} from '@features/sync';

import {createRequestId} from '@core/api/requestId';
import {
  buildPracticeSource,
  generatePracticeSet,
  getPracticeEligibility,
  gradeAnswer,
  type PracticeAnswer,
  type PracticeGrade,
  type PracticeQuestion,
  practiceSeed,
  type PracticeSource,
  type PracticeSummary,
  summarizeAnswers,
  type WordLearningItem,
} from '@core/learning';
import {
  listActivityAttempts,
  recordActivityAttempt,
} from '@core/sync/activityAttempts';

export type PracticeUnavailableReason = 'not_downloaded' | 'not_enough_content';

export type PracticeState =
  | {status: 'unavailable'; reason: PracticeUnavailableReason}
  | {
      status: 'question';
      index: number;
      total: number;
      question: PracticeQuestion;
      /** Set once the learner answered this question. */
      answer: {optionId: string; grade: PracticeGrade} | null;
    }
  | {
      status: 'finished';
      summary: PracticeSummary;
      /** Words answered wrongly, ready to save as flashcards. */
      missed: WordLearningItem[];
    };

export type UsePracticeSessionResult = {
  state: PracticeState;
  lessonTitle: string | null;
  select: (optionId: string) => void;
  next: () => void;
  restart: () => void;
  /** Item keys already saved as flashcards from this result screen. */
  savedItemKeys: ReadonlySet<string>;
  saveMissed: (itemKey: string) => void;
  saveAllMissed: () => void;
};

/** One quiz per attempt; a new attempt number reshuffles the questions. */
function nextAttemptNo(lessonId: string): number {
  try {
    const sessions = new Set(
      listActivityAttempts(lessonId)
        .filter(attempt => attempt.kind === 'practice')
        .map(attempt => attempt.sessionId)
        .filter((id): id is string => id !== null),
    );
    return sessions.size + 1;
  } catch {
    return 1;
  }
}

/**
 * Drives one quick-practice quiz of a downloaded lesson: generate (seeded, so
 * the same lesson revision and attempt always give the same questions), grade,
 * record each answer as an `activity_attempts` row, and offer the missed words
 * as flashcards. Everything runs on the device and works offline.
 */
export function usePracticeSession(lessonId: string): UsePracticeSessionResult {
  const download = useMemo(() => getLessonDownload(lessonId), [lessonId]);
  const source: PracticeSource | null = useMemo(
    () => (download ? buildPracticeSource(download.snapshot) : null),
    [download],
  );
  const eligible = useMemo(
    () => (source ? getPracticeEligibility(source).eligible : false),
    [source],
  );

  const [attemptNo, setAttemptNo] = useState(() => nextAttemptNo(lessonId));
  const sessionId = useRef(createRequestId());
  const shownAt = useRef(Date.now());

  const questions = useMemo(
    () =>
      source && eligible
        ? generatePracticeSet(
            source,
            practiceSeed(source.lessonId, source.contentRevision, attemptNo),
          )
        : [],
    [source, eligible, attemptNo],
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [finished, setFinished] = useState(false);
  const [savedItemKeys, setSavedItemKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const current = questions[index] ?? null;
  const currentAnswer = current
    ? answers.find(answer => answer.questionId === current.id) ?? null
    : null;

  const select = useCallback(
    (optionId: string) => {
      if (!current || currentAnswer) {
        return;
      }
      const grade = gradeAnswer(current, optionId);
      setAnswers(previous => [...previous, {questionId: current.id, optionId}]);
      recordActivityAttempt({
        kind: 'practice',
        activity: current.variant,
        lessonId,
        itemKey: current.itemKey,
        sessionId: sessionId.current,
        result: grade.correct ? 'correct' : 'incorrect',
        durationMs: Math.max(0, Date.now() - shownAt.current),
      });
    },
    [current, currentAnswer, lessonId],
  );

  const next = useCallback(() => {
    if (!currentAnswer) {
      return;
    }
    if (index + 1 >= questions.length) {
      setFinished(true);
      recordPracticeSessionActivity(lessonId);
      requestSync();
      return;
    }
    shownAt.current = Date.now();
    setIndex(index + 1);
  }, [currentAnswer, index, questions.length, lessonId]);

  const restart = useCallback(() => {
    sessionId.current = createRequestId();
    shownAt.current = Date.now();
    setAnswers([]);
    setIndex(0);
    setFinished(false);
    setSavedItemKeys(new Set());
    setAttemptNo(previous => previous + 1);
  }, []);

  const summary = useMemo(
    () => summarizeAnswers(questions, answers),
    [questions, answers],
  );
  const missed = useMemo(
    () =>
      (source?.words ?? []).filter(word =>
        summary.missedItemKeys.includes(word.itemKey),
      ),
    [source, summary.missedItemKeys],
  );

  const saveMissed = useCallback(
    (itemKey: string) => {
      const word = source?.words.find(item => item.itemKey === itemKey);
      if (!word || !source) {
        return;
      }
      const sentence = source.sentences.find(candidate =>
        word.sentenceIds.includes(candidate.id),
      );
      const result = saveFlashcard({
        lessonId,
        vocabulary: {
          id: word.itemKey,
          word: word.word,
          meaningVi: word.meaningVi,
          ipa: word.ipa,
          wordType: word.pos,
          sourceSentence: sentence?.textEn ?? null,
        },
      });
      if (result.ok) {
        setSavedItemKeys(previous => new Set(previous).add(itemKey));
      }
    },
    [source, lessonId],
  );

  const saveAllMissed = useCallback(() => {
    missed.forEach(word => {
      if (!savedItemKeys.has(word.itemKey)) {
        saveMissed(word.itemKey);
      }
    });
  }, [missed, savedItemKeys, saveMissed]);

  let state: PracticeState;
  if (!download || !source) {
    state = {status: 'unavailable', reason: 'not_downloaded'};
  } else if (!eligible || questions.length === 0) {
    state = {status: 'unavailable', reason: 'not_enough_content'};
  } else if (finished) {
    state = {status: 'finished', summary, missed};
  } else {
    state = {
      status: 'question',
      index,
      total: questions.length,
      question: current!,
      answer: currentAnswer
        ? {
            optionId: currentAnswer.optionId,
            grade: gradeAnswer(current!, currentAnswer.optionId),
          }
        : null,
    };
  }

  return {
    state,
    lessonTitle: download?.snapshot.title ?? null,
    select,
    next,
    restart,
    savedItemKeys,
    saveMissed,
    saveAllMissed,
  };
}
