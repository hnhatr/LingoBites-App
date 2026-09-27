import {getDatabase} from '@shared/db/database';
import {
  getDueContentReviewItems,
  listActivePackageLessons,
  listContentReviewItems,
} from '@shared/db/ContentRuntimeRepository';
import {getDueFlashcards} from '@modules/review';
import {
  listErrorEvents,
  listSpeakingRecordings,
} from '@modules/speaking/speakingQueryPort';
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
  const dueContentItems = getDueContentReviewItems(nowIso ? {now: nowIso} : {});
  const dueFlashcards = getDueFlashcards(nowIso ? {today: nowIso} : {});

  const dueReviewCount = dueContentItems.length + dueFlashcards.length;
  // Estimated review minutes: ~0.5 minutes per due item (rounded up)
  const estimatedReviewMinutes = Math.ceil(dueReviewCount * 0.5);

  const recentErrors = listErrorEvents();
  const speakingRecordings = listSpeakingRecordings();

  const lastSpeakingAtIso =
    speakingRecordings.length > 0
      ? speakingRecordings[speakingRecordings.length - 1].createdAt
      : null;

  const activeLessons = listActivePackageLessons();
  const allReviewItems = listContentReviewItems();

  const completedLessonIdSet = new Set<string>();
  for (const item of allReviewItems) {
    if (item.masteryState !== 'new') {
      completedLessonIdSet.add(item.lessonId);
    }
  }
  const completedLessonIds = Array.from(completedLessonIdSet);

  let nextLessonId: string | null = null;
  let nextLessonTitle: string | null = null;
  let nextLessonEstimatedMinutes: number | undefined = undefined;
  let prerequisiteGapLessonId: string | null = null;
  let prerequisiteGapTitle: string | null = null;
  let oldLessonId: string | null = null;
  let oldLessonTitle: string | null = null;

  for (let i = 0; i < activeLessons.length; i += 1) {
    const lesson = activeLessons[i];
    if (!completedLessonIdSet.has(lesson.id)) {
      if (!nextLessonId) {
        nextLessonId = lesson.id;
        nextLessonTitle = lesson.titleVi || lesson.titleEn;
        nextLessonEstimatedMinutes = lesson.estimatedDurationMinutes;

        // If previous lesson in active package sequence was not completed, it's a prerequisite gap
        if (i > 0 && !completedLessonIdSet.has(activeLessons[i - 1].id)) {
          const prereq = activeLessons[i - 1];
          prerequisiteGapLessonId = prereq.id;
          prerequisiteGapTitle = prereq.titleVi || prereq.titleEn;
        }
      }
    } else {
      oldLessonId = lesson.id;
      oldLessonTitle = lesson.titleVi || lesson.titleEn;
    }
  }

  // Fast mastery & recognition items
  const fastMasteryItemIds = allReviewItems
    .filter(item => item.masteryState === 'mastered')
    .map(item => item.id);

  const recognitionOnlyItemIds = allReviewItems
    .filter(
      item =>
        item.masteryState === 'new' ||
        item.masteryState === 'learning' ||
        item.itemType === 'vocabulary',
    )
    .map(item => item.id);

  const profileData = getLearnerProfileData();

  return {
    dueReviewCount,
    dueReviewItems: dueContentItems,
    estimatedReviewMinutes,
    recentErrors,
    speakingRecordings,
    lastSpeakingAtIso,
    lessonProgression: {
      completedLessonIds,
      nextLessonId,
      nextLessonTitle,
      nextLessonEstimatedMinutes,
      prerequisiteGapLessonId,
      prerequisiteGapTitle,
      oldLessonId,
      oldLessonTitle,
    },
    fastMasteryItemIds,
    recognitionOnlyItemIds,
    profileData,
  };
}
