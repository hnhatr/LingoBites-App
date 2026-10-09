/**
 * Shared read helpers for downloaded canonical lessons (LING-149 TASK-008).
 * Today and Speaking consume the same offline snapshot rows as the unified
 * player (`lesson_downloads` + `lesson_progress`).
 */
import type {LessonSnapshot} from '@core/schemas/lesson';
import {getLessonProgress} from '@core/sync/lessonProgress';

import {
  type LessonDownloadRecord,
  listLessonDownloads,
} from './canonicalDownloadRepository';

export type DownloadedLessonSummary = {
  lessonId: string;
  title: string;
  slug: string;
  description: string;
  estimatedDurationMinutes: number;
  snapshot: LessonSnapshot;
  downloadedAt: string;
};

export function listDownloadedLessonSummaries(): DownloadedLessonSummary[] {
  return listLessonDownloads().slice().reverse().map(mapDownloadToSummary);
}

export function hasDownloadedLessons(): boolean {
  return listLessonDownloads().length > 0;
}

function mapDownloadToSummary(
  record: LessonDownloadRecord,
): DownloadedLessonSummary {
  const lesson = record.snapshot;
  const sentenceCount = lesson.sentences.length;
  const estimatedDurationMinutes = Math.max(1, Math.ceil(sentenceCount * 0.5));
  return {
    lessonId: record.lessonId,
    title: lesson.title,
    slug: lesson.slug,
    description: lesson.description ?? '',
    estimatedDurationMinutes,
    snapshot: lesson,
    downloadedAt: record.downloadedAt,
  };
}

export type CanonicalLessonProgression = {
  completedLessonIds: string[];
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  nextLessonEstimatedMinutes: number | undefined;
  prerequisiteGapLessonId: string | null;
  prerequisiteGapTitle: string | null;
  oldLessonId: string | null;
  oldLessonTitle: string | null;
  /** PR 16 (B9): the oldest downloaded lesson started but not completed. */
  inProgressLessonId: string | null;
  inProgressLessonTitle: string | null;
};

/** Oldest download first — stable progression order for Today. */
export function buildCanonicalLessonProgression(): CanonicalLessonProgression {
  const ordered = listDownloadedLessonSummaries();
  const completedLessonIdSet = new Set<string>();
  let inProgressLessonId: string | null = null;
  let inProgressLessonTitle: string | null = null;
  for (const lesson of ordered) {
    const progress = getLessonProgress(lesson.lessonId);
    if (progress?.status === 'completed') {
      completedLessonIdSet.add(lesson.lessonId);
    } else if (progress?.status === 'in_progress' && !inProgressLessonId) {
      inProgressLessonId = lesson.lessonId;
      inProgressLessonTitle = lesson.title;
    }
  }
  const completedLessonIds = ordered
    .map(item => item.lessonId)
    .filter(id => completedLessonIdSet.has(id));

  let nextLessonId: string | null = null;
  let nextLessonTitle: string | null = null;
  let nextLessonEstimatedMinutes: number | undefined;
  let prerequisiteGapLessonId: string | null = null;
  let prerequisiteGapTitle: string | null = null;
  let oldLessonId: string | null = null;
  let oldLessonTitle: string | null = null;

  for (let index = 0; index < ordered.length; index += 1) {
    const lesson = ordered[index];
    if (!completedLessonIdSet.has(lesson.lessonId)) {
      if (!nextLessonId) {
        nextLessonId = lesson.lessonId;
        nextLessonTitle = lesson.title;
        nextLessonEstimatedMinutes = lesson.estimatedDurationMinutes;
        if (index > 0) {
          const prereq = ordered[index - 1];
          if (!completedLessonIdSet.has(prereq.lessonId)) {
            prerequisiteGapLessonId = prereq.lessonId;
            prerequisiteGapTitle = prereq.title;
          }
        }
      }
    } else {
      oldLessonId = lesson.lessonId;
      oldLessonTitle = lesson.title;
    }
  }

  return {
    completedLessonIds,
    nextLessonId,
    nextLessonTitle,
    nextLessonEstimatedMinutes,
    prerequisiteGapLessonId,
    prerequisiteGapTitle,
    oldLessonId,
    oldLessonTitle,
    inProgressLessonId,
    inProgressLessonTitle,
  };
}

export function lessonMatchesKeywords(
  lesson: DownloadedLessonSummary,
  keywords: string[],
): boolean {
  const haystack = [lesson.slug, lesson.title, lesson.description]
    .join(' ')
    .toLowerCase();
  return keywords.some(keyword => haystack.includes(keyword.toLowerCase()));
}

export function sentencesToSpeakingLines(
  lesson: DownloadedLessonSummary,
): {textEn: string; textVi: string; audioAssetId: null}[] {
  return lesson.snapshot.sentences.map(sentence => ({
    textEn: sentence.text_en,
    textVi: sentence.text_vi,
    audioAssetId: null,
  }));
}
