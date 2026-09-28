/**
 * Speaking Room mode listing + content availability (SETE-110 / M5, M7 MVP expansion, REQ-23).
 *
 * All six required modes are a fixed list. When content for a mode is installed
 * in the active package, `available` is true and usable content lines/prompts
 * are returned.
 */

import {
  getContentLessonById,
  getLessonActivities,
  getLessonChunks,
  listActivePackageLessons,
} from '@features/lesson/packages';
import type {SpeakingMode} from '@shared/db/types';
import type {HandoffIconName} from '@ui/icons/iconRegistry';

export type SpeakingModeInfo = {
  mode: SpeakingMode;
  titleVi: string;
  descriptionVi: string;
  available: boolean;
  /** Estimated commitment, in minutes — shown as "~X phút" on the card. */
  durationMin: number;
  /** CEFR level label (A2 / B1 / B2), same vocabulary as lesson cards. */
  level: string;
  /** Per-mode medallion icon so the list scans instead of reading as a wall of text. */
  icon: HandoffIconName;
  /** Exactly one mode is the obvious default, badged "Gợi ý hôm nay". */
  recommended: boolean;
};

const SHADOWING_ACTIVITY_TYPES = new Set([
  'listen_and_repeat',
  'speaking_drill',
]);

export type SpeakingContentLine = {
  textEn: string;
  textVi: string;
  audioAssetId: string | null;
};

export type SpeakingModeContent = {
  lessonId: string;
  lessonTitleVi: string;
  lines: SpeakingContentLine[];
};

/** Shadowing content: lines built from listen_and_repeat / speaking_drill activities. */
export function getShadowingContent(): SpeakingModeContent[] {
  const lessons = listActivePackageLessons();
  const content: SpeakingModeContent[] = [];
  for (const lesson of lessons) {
    const activities = getLessonActivities(lesson.id).filter(activity =>
      SHADOWING_ACTIVITY_TYPES.has(activity.type),
    );
    if (activities.length === 0) {
      continue;
    }
    const chunks = getLessonChunks(lesson.id);
    const chunksById = new Map(chunks.map(chunk => [chunk.id, chunk]));
    const lines: SpeakingContentLine[] = [];
    for (const activity of activities) {
      for (const chunkId of activity.chunkRefIds) {
        const chunk = chunksById.get(chunkId);
        if (!chunk) {
          continue;
        }
        lines.push({
          textEn: chunk.phraseEn,
          textVi: chunk.phraseVi,
          audioAssetId: chunk.audioRefIds[0] ?? null,
        });
      }
    }
    if (lines.length > 0) {
      content.push({
        lessonId: lesson.id,
        lessonTitleVi: lesson.titleVi,
        lines,
      });
    }
  }
  return content;
}

/** Helper to collect content for a given mode by matching lesson slugs/keywords/activities. */
export function getModeContentByKeywords(
  keywords: string[],
): SpeakingModeContent[] {
  const lessons = listActivePackageLessons();
  const content: SpeakingModeContent[] = [];
  for (const lessonSummary of lessons) {
    const lesson = getContentLessonById(lessonSummary.id);
    if (!lesson) continue;
    const matchesKeyword = keywords.some(
      kw =>
        lesson.slug.toLowerCase().includes(kw) ||
        lesson.titleEn.toLowerCase().includes(kw) ||
        lesson.titleVi.toLowerCase().includes(kw),
    );
    if (matchesKeyword) {
      const chunks = getLessonChunks(lesson.id);
      const lines: SpeakingContentLine[] = chunks.map(chunk => ({
        textEn: chunk.phraseEn,
        textVi: chunk.phraseVi,
        audioAssetId: chunk.audioRefIds[0] ?? null,
      }));
      if (lines.length > 0) {
        content.push({
          lessonId: lesson.id,
          lessonTitleVi: lesson.titleVi,
          lines,
        });
      }
    }
  }
  return content;
}

export function getQuickAnswerContent(): SpeakingModeContent[] {
  return getModeContentByKeywords([
    'clarification',
    'repetition',
    'quick',
    'role',
    'asking',
  ]);
}

export function getStandupContent(): SpeakingModeContent[] {
  return getModeContentByKeywords(['standup', 'stand-up', 'daily']);
}

export function getAppDescriptionContent(): SpeakingModeContent[] {
  return getModeContentByKeywords([
    'app',
    'architecture',
    'system',
    'api',
    'data-flow',
  ]);
}

export function getBugReportContent(): SpeakingModeContent[] {
  return getModeContentByKeywords(['bug', 'triage', 'reporting', 'root-cause']);
}

export function getMockInterviewContent(): SpeakingModeContent[] {
  return getModeContentByKeywords([
    'interview',
    'career',
    'profile',
    'behavioral',
    'system-design',
  ]);
}

/**
 * SETE-262: fixed per-mode metadata, ordered by commitment (shortest and
 * easiest first, mock interview last). Shadowing is the recommended default:
 * it is the shortest warm-up and the only mode backed by installed content.
 */
const MODE_COPY: Record<
  SpeakingMode,
  {
    titleVi: string;
    descriptionVi: string;
    durationMin: number;
    level: string;
    icon: HandoffIconName;
    recommended: boolean;
  }
> = {
  shadowing: {
    titleVi: 'Lặp lại theo mẫu (Shadowing)',
    descriptionVi: 'Nghe câu mẫu, ghi âm lại và tự kiểm tra.',
    durationMin: 2,
    level: 'A2',
    icon: 'repeat',
    recommended: true,
  },
  quick_answer: {
    titleVi: 'Trả lời nhanh',
    descriptionVi: 'Trả lời một câu hỏi ngắn trong vài giây.',
    durationMin: 2,
    level: 'A2',
    icon: 'bolt',
    recommended: false,
  },
  standup: {
    titleVi: 'Báo cáo hàng ngày (Stand-up)',
    descriptionVi: 'Luyện nói tóm tắt công việc hôm nay.',
    durationMin: 3,
    level: 'B1',
    icon: 'event_note',
    recommended: false,
  },
  app_description: {
    titleVi: 'Mô tả ứng dụng/hệ thống',
    descriptionVi: 'Luyện mô tả một tính năng hoặc hệ thống bằng tiếng Anh.',
    durationMin: 5,
    level: 'B1',
    icon: 'smartphone',
    recommended: false,
  },
  bug_report: {
    titleVi: 'Báo lỗi (Bug report)',
    descriptionVi: 'Luyện trình bày một lỗi kỹ thuật bằng tiếng Anh.',
    durationMin: 5,
    level: 'B2',
    icon: 'warning',
    recommended: false,
  },
  mock_interview: {
    titleVi: 'Phỏng vấn thử',
    descriptionVi: 'Luyện trả lời câu hỏi phỏng vấn công việc.',
    durationMin: 10,
    level: 'B2',
    icon: 'record_voice_over',
    recommended: false,
  },
};

/** REQ-23: the six required modes, each flagged with whether content exists. */
export function listSpeakingRoomModes(): SpeakingModeInfo[] {
  const shadowingAvailable = getShadowingContent().length > 0;
  const quickAnswerAvailable = getQuickAnswerContent().length > 0;
  const standupAvailable = getStandupContent().length > 0;
  const appDescriptionAvailable = getAppDescriptionContent().length > 0;
  const bugReportAvailable = getBugReportContent().length > 0;
  const mockInterviewAvailable = getMockInterviewContent().length > 0;

  const availability: Record<SpeakingMode, boolean> = {
    shadowing: shadowingAvailable,
    quick_answer: quickAnswerAvailable,
    standup: standupAvailable,
    app_description: appDescriptionAvailable,
    bug_report: bugReportAvailable,
    mock_interview: mockInterviewAvailable,
  };
  return (Object.keys(MODE_COPY) as SpeakingMode[]).map(mode => ({
    mode,
    titleVi: MODE_COPY[mode].titleVi,
    descriptionVi: MODE_COPY[mode].descriptionVi,
    available: availability[mode],
    durationMin: MODE_COPY[mode].durationMin,
    level: MODE_COPY[mode].level,
    icon: MODE_COPY[mode].icon,
    recommended: MODE_COPY[mode].recommended,
  }));
}
