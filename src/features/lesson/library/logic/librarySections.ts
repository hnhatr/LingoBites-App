import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LibrarySectionKey} from '@core/navigation';
import type {LessonOrigin, LessonSourceType} from '@core/schemas/lesson';

export type LibrarySectionId = LibrarySectionKey;

/** `mine`: the learner's own data; `explore`: lessons everyone can see. */
export type LibraryGroup = 'mine' | 'explore';

export interface LibrarySectionConfig {
  id: LibrarySectionId;
  group: LibraryGroup;
  icon: HandoffIconName;
  title: string;
  description: string;
  /** What the learner sees when the section has nothing yet. */
  emptyHint: string;
  /** Own-lesson sections: which downloaded lessons belong to the section. */
  lessons?: {origin: LessonOrigin; sourceTypes: LessonSourceType[]};
  /** Public sections: the server catalog query behind the section. */
  catalog?: {origin: LessonOrigin; sourceType: LessonSourceType};
  unit: 'bài' | 'từ' | 'quy tắc';
}

/**
 * Visibility: public lessons (admin origin) are listed from the server
 * catalog and seen by everyone; own sections only list what this learner
 * created or saved. Each downloaded lesson belongs to at most one own
 * section, so the hub never lists the same lesson under two cards.
 */
export const LIBRARY_SECTIONS: readonly LibrarySectionConfig[] = [
  {
    id: 'mine',
    group: 'mine',
    icon: 'edit',
    title: 'Bài học của tôi',
    description: 'Bài bạn tạo từ văn bản và ảnh',
    emptyHint: 'Chưa có bài, tạo bài đầu tiên',
    lessons: {origin: 'learner', sourceTypes: ['learner_text', 'learner_ocr']},
    unit: 'bài',
  },
  {
    id: 'video',
    group: 'mine',
    icon: 'play_circle',
    title: 'Video của tôi',
    description: 'Bài bạn tạo từ video YouTube',
    emptyHint: 'Chưa có bài từ video',
    lessons: {origin: 'learner', sourceTypes: ['youtube']},
    unit: 'bài',
  },
  {
    id: 'vocabulary',
    group: 'mine',
    icon: 'style',
    title: 'Từ vựng của tôi',
    description: 'Từ bạn đã lưu để ôn tập',
    emptyHint: 'Bấm ♡ trong bài học để lưu từ',
    unit: 'từ',
  },
  {
    id: 'grammar',
    group: 'mine',
    icon: 'rule',
    title: 'Ngữ pháp của tôi',
    description: 'Quy tắc bạn đã lưu',
    emptyHint: 'Bấm ♡ trong bài học để lưu quy tắc',
    unit: 'quy tắc',
  },
  {
    id: 'public',
    group: 'explore',
    icon: 'auto_stories',
    title: 'Bài học công khai',
    description: 'Bài do LingoBites biên soạn',
    emptyHint: 'Chưa có bài công khai',
    catalog: {origin: 'admin', sourceType: 'admin_text'},
    unit: 'bài',
  },
  {
    id: 'publicVideo',
    group: 'explore',
    icon: 'subtitles',
    title: 'Video công khai',
    description: 'Học qua video YouTube có phụ đề',
    emptyHint: 'Chưa có video công khai',
    catalog: {origin: 'admin', sourceType: 'youtube'},
    unit: 'bài',
  },
];

export function getLibrarySection(id: LibrarySectionId): LibrarySectionConfig {
  return LIBRARY_SECTIONS.find(section => section.id === id)!;
}

/** Section that lists the learner's own downloaded lessons. */
export function isOwnLessonSection(section: LibrarySectionConfig): boolean {
  return section.lessons !== undefined;
}

/** Section that lists public lessons from the server catalog. */
export function isPublicSection(section: LibrarySectionConfig): boolean {
  return section.catalog !== undefined;
}

export function lessonBelongsToSection(
  section: LibrarySectionConfig,
  lesson: {origin: LessonOrigin; sourceType: LessonSourceType},
): boolean {
  return (
    section.lessons !== undefined &&
    section.lessons.origin === lesson.origin &&
    section.lessons.sourceTypes.includes(lesson.sourceType)
  );
}
