import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LessonSourceType} from '@core/schemas/lesson';

export type LibrarySectionId =
  | 'mine'
  | 'video'
  | 'samples'
  | 'vocabulary'
  | 'grammar';

export interface LibrarySectionConfig {
  id: LibrarySectionId;
  icon: HandoffIconName;
  title: string;
  description: string;
  /** What the learner sees when the section has nothing yet. */
  emptyHint: string;
  /** Lesson sections only: the `source_type`s a lesson must have to belong. */
  sourceTypes?: LessonSourceType[];
  unit: 'bài' | 'từ' | 'quy tắc';
}

/**
 * Each downloaded lesson belongs to exactly one section (by `source_type`),
 * so the hub never lists the same lesson under two cards.
 */
export const LIBRARY_SECTIONS: readonly LibrarySectionConfig[] = [
  {
    id: 'mine',
    icon: 'edit',
    title: 'Bài học của tôi',
    description: 'Bài bạn tạo từ văn bản và ảnh',
    emptyHint: 'Chưa có bài, tạo bài đầu tiên',
    sourceTypes: ['learner_text', 'learner_ocr'],
    unit: 'bài',
  },
  {
    id: 'video',
    icon: 'play_circle',
    title: 'Bài học video',
    description: 'Bài học từ video YouTube',
    emptyHint: 'Chưa có bài học video',
    sourceTypes: ['youtube'],
    unit: 'bài',
  },
  {
    id: 'samples',
    icon: 'auto_stories',
    title: 'Bài mẫu',
    description: 'Bài mẫu LingoBites đã tải về',
    emptyHint: 'Chưa tải bài mẫu nào',
    sourceTypes: ['admin_text'],
    unit: 'bài',
  },
  {
    id: 'vocabulary',
    icon: 'style',
    title: 'Từ vựng của tôi',
    description: 'Từ bạn đã lưu để ôn tập',
    emptyHint: 'Bấm ♡ trong bài học để lưu từ',
    unit: 'từ',
  },
  {
    id: 'grammar',
    icon: 'rule',
    title: 'Ngữ pháp của tôi',
    description: 'Quy tắc bạn đã lưu',
    emptyHint: 'Bấm ♡ trong bài học để lưu quy tắc',
    unit: 'quy tắc',
  },
];

export function getLibrarySection(id: LibrarySectionId): LibrarySectionConfig {
  return LIBRARY_SECTIONS.find(section => section.id === id)!;
}

export function isLessonSection(section: LibrarySectionConfig): boolean {
  return section.sourceTypes !== undefined;
}

export function lessonBelongsToSection(
  section: LibrarySectionConfig,
  sourceType: LessonSourceType,
): boolean {
  return section.sourceTypes?.includes(sourceType) ?? false;
}
