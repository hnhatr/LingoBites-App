import {
  buildCanonicalLessonProgression,
  hasDownloadedLessons,
} from '@features/lesson/player';
import {getDueFlashcards} from '@features/review';
import {listErrorEvents, listSpeakingRecordings} from '@features/speaking';

import {getDatabase} from '@core/db/database';

import type {LearnerProfileData, LearnerStateSnapshot} from './types';

export function getLearnerProfileData(): LearnerProfileData | null {
  try {
    const db = getDatabase();
    const result = db.execute('SELECT value FROM app_settings WHERE key = ?;', [
      'learner_profile',
    ]);
    const row = result.rows?.item(0) as {value: string} | undefined;
    if (row && row.value) {
      return JSON.parse(row.value) as LearnerProfileData;
    }
  } catch (_e) {
    // Missing or invalid profile data degrades safely
  }
  return null;
}

export function saveLearnerProfileData(profile: LearnerProfileData): void {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.execute("DELETE FROM app_settings WHERE key = 'learner_profile';");
    db.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?);`,
      ['learner_profile', JSON.stringify(profile), now],
    );
  } catch (_e) {
    // Ignore db errors in save profile
  }
}

export function getLearnerStateSnapshot(nowIso?: string): LearnerStateSnapshot {
  const dueFlashcards = getDueFlashcards(nowIso ? {today: nowIso} : {});

  const dueReviewCount = dueFlashcards.length;
  const estimatedReviewMinutes = Math.ceil(dueReviewCount * 0.5);

  const recentErrors = listErrorEvents();
  const speakingRecordings = listSpeakingRecordings();

  const lastSpeakingAtIso =
    speakingRecordings.length > 0
      ? speakingRecordings[speakingRecordings.length - 1].createdAt
      : null;

  const progression = buildCanonicalLessonProgression();
  const profileData = getLearnerProfileData();

  return {
    dueReviewCount,
    estimatedReviewMinutes,
    recentErrors,
    speakingRecordings,
    lastSpeakingAtIso,
    hasDownloadedLessons: hasDownloadedLessons(),
    lessonProgression: {
      completedLessonIds: progression.completedLessonIds,
      nextLessonId: progression.nextLessonId,
      nextLessonTitle: progression.nextLessonTitle,
      nextLessonEstimatedMinutes: progression.nextLessonEstimatedMinutes,
      prerequisiteGapLessonId: progression.prerequisiteGapLessonId,
      prerequisiteGapTitle: progression.prerequisiteGapTitle,
      oldLessonId: progression.oldLessonId,
      oldLessonTitle: progression.oldLessonTitle,
    },
    profileData,
  };
}
