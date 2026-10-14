import type {HandoffIconName} from '@ui/icons/iconRegistry';

import type {LibrarySectionKey} from '@core/navigation';
import type {
  LessonCatalogKind,
  LessonOrigin,
  LessonSourceType,
} from '@core/schemas/lesson';

export type LibrarySectionId = LibrarySectionKey;

/**
 * The Library hub's icon tabs: `explore` lists what LingoBites provides
 * (packs, public lessons and videos); the others hold the learner's own
 * saved items, created lessons and moments.
 */
export type LibraryTab = 'explore' | 'saved' | 'created' | 'moments';

/** Colour family of a Library tab or folder (see `libraryTone`). */
export type LibraryTone = 'teal' | 'coral' | 'yellow' | 'violet';

export interface LibraryTabConfig {
  id: LibraryTab;
  icon: HandoffIconName;
  title: string;
  tone: LibraryTone;
}

/** Tab order on the hub; the first one opens by default. */
export const LIBRARY_TABS: readonly LibraryTabConfig[] = [
  {id: 'explore', icon: 'language', title: 'Khám phá', tone: 'teal'},
  {id: 'saved', icon: 'bookmark', title: 'Đã lưu', tone: 'coral'},
  {id: 'created', icon: 'edit', title: 'Bài tôi tạo', tone: 'yellow'},
  {id: 'moments', icon: 'auto_awesome', title: 'Khoảnh khắc', tone: 'violet'},
];

export interface LibrarySectionConfig {
  id: LibrarySectionId;
  tab: LibraryTab;
  icon: HandoffIconName;
  title: string;
  description: string;
  /** What the learner sees when the section has nothing yet. */
  emptyHint: string;
  /** Own-lesson sections: which downloaded lessons belong to the section. */
  lessons?: {origin: LessonOrigin; sourceTypes: LessonSourceType[]};
  /** Public sections: the server catalog query behind the section. */
  catalog?: {
    origin: LessonOrigin;
    sourceType: LessonSourceType;
    /** `video`: public videos only; their six-step lessons open from them. */
    kind?: LessonCatalogKind;
  };
  /** E5: the learner's "Khoảnh khắc" moments, read from the server list. */
  moments?: boolean;
  /** Vocab path P5: the combo sets kept on this device. */
  combos?: boolean;
  /** Vocab path P5: the word packs to download and learn. */
  wordPath?: boolean;
  unit: 'bài' | 'từ' | 'quy tắc' | 'bộ câu' | 'gói';
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
    tab: 'created',
    icon: 'edit',
    title: 'Bài học của tôi',
    description: 'Bài bạn tạo từ văn bản và ảnh',
    emptyHint: 'Chưa có bài, tạo bài đầu tiên',
    lessons: {
      origin: 'learner',
      sourceTypes: ['learner_text', 'learner_ocr'],
    },
    unit: 'bài',
  },
  {
    id: 'moments',
    tab: 'moments',
    icon: 'auto_awesome',
    title: 'Khoảnh khắc',
    description: 'Bài làm từ tình huống và ảnh',
    emptyHint:
      'Chưa có khoảnh khắc. Chụp ảnh hoặc kể một tình huống để bắt đầu',
    moments: true,
    unit: 'bài',
  },
  {
    id: 'video',
    tab: 'created',
    icon: 'play_circle',
    title: 'Video của tôi',
    description: 'Bài bạn tạo từ video YouTube',
    emptyHint: 'Chưa có bài từ video',
    lessons: {origin: 'learner', sourceTypes: ['youtube']},
    unit: 'bài',
  },
  {
    id: 'vocabulary',
    tab: 'saved',
    icon: 'style',
    title: 'Từ vựng của tôi',
    description: 'Từ bạn đã lưu để ôn tập',
    emptyHint: 'Bấm ♡ trong bài học để lưu từ',
    unit: 'từ',
  },
  {
    id: 'grammar',
    tab: 'saved',
    icon: 'rule',
    title: 'Ngữ pháp của tôi',
    description: 'Quy tắc bạn đã lưu',
    emptyHint: 'Bấm ♡ trong bài học để lưu quy tắc',
    unit: 'quy tắc',
  },
  {
    id: 'combos',
    tab: 'saved',
    icon: 'style',
    title: 'Bộ câu đã học',
    description: 'Bộ câu tổ hợp bạn đã mở, đọc được cả khi ngoại tuyến',
    emptyHint: 'Mở một bộ câu từ gói từ để bắt đầu',
    combos: true,
    unit: 'bộ câu',
  },
  {
    id: 'wordPath',
    tab: 'explore',
    icon: 'style',
    title: 'Học theo gói',
    description:
      'Gói từ và gói câu theo cấp độ, tải về máy để học cả khi ngoại tuyến',
    emptyHint: 'Chưa có gói nào trên máy. Chạm để xem các gói có sẵn',
    wordPath: true,
    unit: 'gói',
  },
  {
    id: 'public',
    tab: 'explore',
    icon: 'auto_stories',
    title: 'Bài học công khai',
    description: 'Bài do LingoBites biên soạn',
    emptyHint: 'Chưa có bài công khai',
    catalog: {origin: 'admin', sourceType: 'admin_text'},
    unit: 'bài',
  },
  {
    id: 'publicVideo',
    tab: 'explore',
    icon: 'subtitles',
    title: 'Video công khai',
    description: 'Học qua video YouTube có phụ đề',
    emptyHint: 'Chưa có video công khai',
    catalog: {origin: 'admin', sourceType: 'youtube', kind: 'video'},
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
