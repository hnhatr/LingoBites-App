export type ContentMasteryState =
  | 'new'
  | 'learning'
  | 'reviewing'
  | 'mastered'
  | 'relearning';

export type ContentPackageId = string;

export type ContentPackageSummary = {
  id: ContentPackageId;
  slug: string;
  schemaVersion: string;
  sourceUrl: string;
  sha256: string;
  importedAt: string;
  deactivatedAt: string | null;
  isActive: boolean;
  lessonCount: number;
};

export type AudioAsset = {
  id: string;
  slug: string;
  url: string;
  checksum: string;
  locale?: string;
  transcript?: string;
};

export type SrsItemType = 'vocabulary' | 'grammar' | 'dialogue_turn' | 'qa';

export type SrsItem = {
  id: string;
  slug: string;
  item_type: SrsItemType;
  source_ref_id: string;
  front: string;
  back: string;
  hint_vi?: string;
};

export type DialogueTurn = {
  id: string;
  slug: string;
  speaker: 'A' | 'B';
  text_en: string;
  text_vi: string;
  audio_ref_id?: string;
  grammar_ref_ids: string[];
};

export type QAItem = {
  id: string;
  slug: string;
  type: 'multiple_choice' | 'translation' | 'fill_blank';
  question: string;
  options?: string[];
  answer: string;
  explanation_vi?: string;
  skill?: 'vocabulary' | 'grammar' | 'translation' | 'speaking' | 'listening';
};
