/**
 * Content Package Schema — v0.1.0
 *
 * Single export point for all content package types.
 * Import from this module only; never import sub-files directly.
 *
 * Schema version: 0.1.0
 * See CHANGELOG.md in this folder for versioning and rollback procedure.
 */

import {z} from 'zod';
import {createHash} from 'crypto';
import type {
  AudioAsset,
  DialogueTurn,
  QAItem,
  SrsItem,
  SrsItemType,
} from '@shared/content/contracts';

export type {AudioAsset, DialogueTurn, QAItem, SrsItem, SrsItemType};

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const CONTENT_SCHEMA_VERSION = '0.1.0' as const;

// ---------------------------------------------------------------------------
// Content ID strategy
//
// IDs are deterministic SHA-256 hashes of a canonical seed string.
// The seed must be derived from stable, human-authored fields only —
// never from timestamps, random values, or auto-increment counters.
//
// Lesson:    sha256("lesson:"   + lessonSlug)                     → first 16 hex chars
// Chunk:     sha256("chunk:"    + lessonSlug + ":" + chunkSlug)    → first 16 hex chars
// Activity:  sha256("activity:" + lessonSlug + ":" + activitySlug) → first 16 hex chars
// QA item:   sha256("qa:"       + lessonSlug + ":" + qaSlug)       → first 16 hex chars
// Audio:     sha256("audio:"    + lessonSlug + ":" + audioSlug)    → first 16 hex chars
// SRS item:  sha256("srs:"      + lessonSlug + ":" + srsSlug)      → first 16 hex chars
// Package:   sha256("package:"  + packageSlug)                     → first 16 hex chars
//
// IDs survive re-export as long as slugs do not change.
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 16-hex-char content ID.
 * Running this twice with the same arguments always returns the same value.
 */
export function makeContentId(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Audio asset
// ---------------------------------------------------------------------------

export const AudioAssetSchema = z.object({
  /** Deterministic ID: sha256("audio:" + lessonSlug + ":" + audioSlug) */
  id: z.string().min(1),
  /** Stable slug used in ID generation. Must not change after first export. */
  slug: z.string().min(1),
  /** URL to the audio file (may be a placeholder stub during M1). */
  url: z.string().url(),
  /**
   * SHA-256 checksum of the audio file content.
   * Use "sha256:placeholder" when audio production is not yet complete.
   */
  checksum: z.string().regex(/^sha256:([a-f0-9]{64}|placeholder)$/),
  /** IETF language tag for the spoken language, e.g. "en-US". */
  locale: z.string().optional(),
  /** Human-readable transcript of the audio. */
  transcript: z.string().optional(),
});

// ---------------------------------------------------------------------------
// SRS (Spaced Repetition System) declarations
// ---------------------------------------------------------------------------

export const SrsItemTypeSchema = z.enum([
  'vocabulary',
  'grammar',
  'dialogue_turn',
  'qa',
]);

export const SrsItemSchema = z.object({
  /** Deterministic ID: sha256("srs:" + lessonSlug + ":" + srsSlug) */
  id: z.string().min(1),
  slug: z.string().min(1),
  item_type: SrsItemTypeSchema,
  /** Reference ID to the originating chunk, vocab item, grammar point, etc. */
  source_ref_id: z.string().min(1),
  /** Front side of flashcard (English prompt). */
  front: z.string().min(1),
  /** Back side of flashcard (Vietnamese answer). */
  back: z.string().min(1),
  /** Optional hint shown after a wrong answer. */
  hint_vi: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Remediation declarations
// ---------------------------------------------------------------------------

export const RemediationSchema = z.object({
  /**
   * Trigger condition: when this remediation applies.
   * "wrong_answer" = user got a practice question wrong.
   * "low_confidence" = user marked themselves as unsure.
   */
  trigger: z.enum(['wrong_answer', 'low_confidence']),
  /** Source ref IDs to re-present (chunks, grammar points, vocab items). */
  re_present_refs: z.array(z.string()).min(1),
  /** Human-readable remediation tip in Vietnamese. */
  tip_vi: z.string().optional(),
});

export type Remediation = z.infer<typeof RemediationSchema>;

// ---------------------------------------------------------------------------
// Grammar pattern
// ---------------------------------------------------------------------------

export const GrammarPatternSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name_en: z.string().min(1),
  name_vi: z.string().min(1),
  pattern: z.string().min(1),
  explanation_vi: z.string().min(1),
  /**
   * Must include at least one speaking or listening action.
   * Lint rule enforces this requirement.
   */
  tied_to_actions: z
    .array(z.enum(['speaking', 'listening', 'reading', 'writing']))
    .min(1),
  examples: z
    .array(
      z.object({
        en: z.string(),
        vi: z.string(),
      }),
    )
    .default([]),
});

export type GrammarPattern = z.infer<typeof GrammarPatternSchema>;

// ---------------------------------------------------------------------------
// Vocabulary item
// ---------------------------------------------------------------------------

export const ContentVocabItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  word: z.string().min(1),
  word_type: z.string().optional(),
  meaning_vi: z.string().min(1),
  pronunciation_guide_vi: z.string().optional(),
  ipa: z.string().optional(),
  cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  example_en: z.string().optional(),
  example_vi: z.string().optional(),
  audio_ref_id: z.string().optional(),
});

export type ContentVocabItem = z.infer<typeof ContentVocabItemSchema>;

// ---------------------------------------------------------------------------
// Q&A item (practice questions within a chunk)
// ---------------------------------------------------------------------------

export const QAItemSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    type: z.enum(['multiple_choice', 'translation', 'fill_blank']),
    question: z.string().min(1),
    options: z.array(z.string()).optional(),
    answer: z.string().min(1),
    explanation_vi: z.string().optional(),
    skill: z
      .enum(['vocabulary', 'grammar', 'translation', 'speaking', 'listening'])
      .optional(),
  })
  .refine(
    q =>
      q.type !== 'multiple_choice' ||
      (Array.isArray(q.options) && q.options.length >= 2),
    {
      message: 'multiple_choice requires at least 2 options',
      path: ['options'],
    },
  );

// ---------------------------------------------------------------------------
// Dialogue turn
// ---------------------------------------------------------------------------

export const DialogueTurnSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  speaker: z.enum(['A', 'B']),
  text_en: z.string().min(1),
  text_vi: z.string().min(1),
  audio_ref_id: z.string().optional(),
  /** Grammar pattern IDs this turn illustrates. */
  grammar_ref_ids: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Content chunk (the core unit)
// ---------------------------------------------------------------------------

export const ChunkSchema = z.object({
  /** Deterministic ID: sha256("chunk:" + lessonSlug + ":" + chunkSlug) */
  id: z.string().min(1),
  slug: z.string().min(1),
  /** Display order within the lesson (0-based). */
  order: z.number().int().min(0),
  /** English phrase or expression taught in this chunk. */
  phrase_en: z.string().min(1),
  /** Vietnamese translation of the phrase. */
  phrase_vi: z.string().min(1),
  /**
   * Vietnamese explanation (REQUIRED — every chunk must have this).
   * Lint rule enforces this field is non-empty.
   */
  explanation_vi: z.string().min(1),
  /** Context sentence in which the phrase appears. */
  context_sentence_en: z.string().optional(),
  context_sentence_vi: z.string().optional(),
  /** Grammar pattern IDs tied to this chunk. */
  grammar_ref_ids: z.array(z.string()).default([]),
  /** Vocabulary item IDs in this chunk. */
  vocab_ref_ids: z.array(z.string()).default([]),
  /** Dialogue turns that demonstrate this chunk in context. */
  dialogue_turns: z.array(DialogueTurnSchema).default([]),
  /** Q&A practice items for this chunk. */
  qa_items: z.array(QAItemSchema).default([]),
  /** Audio asset reference IDs. */
  audio_ref_ids: z.array(z.string()).default([]),
  /** SRS item IDs generated for this chunk. */
  srs_ref_ids: z.array(z.string()).default([]),
  /** Remediation config for this chunk. */
  remediation: RemediationSchema.optional(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

// ---------------------------------------------------------------------------
// Activity declaration
// ---------------------------------------------------------------------------

export const ActivityTypeSchema = z.enum([
  'listen_and_repeat',
  'role_play',
  'fill_blank',
  'multiple_choice',
  'translation',
  'speaking_drill',
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  type: ActivityTypeSchema,
  title_vi: z.string().min(1),
  /** Chunk IDs this activity covers. */
  chunk_ref_ids: z.array(z.string()).min(1),
  /** QA item IDs to use (for quiz-style activities). */
  qa_ref_ids: z.array(z.string()).default([]),
  instructions_vi: z.string().optional(),
});

export type Activity = z.infer<typeof ActivitySchema>;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Expected Error & Check Declarations (REQ-9, REQ-40, REQ-41)
// ---------------------------------------------------------------------------

export const ExpectedErrorSchema = z.object({
  category: z.string().min(1),
  trigger_condition: z.string().min(1),
  remediation_ref_id: z.string().min(1),
  tip_vi: z.string().min(1),
});

export type ExpectedError = z.infer<typeof ExpectedErrorSchema>;

export const CheckTypeSchema = z.enum(['weekly_check', 'stage_check']);
export type CheckType = z.infer<typeof CheckTypeSchema>;

export type CheckOutcome = 'pass' | 'conditional_pass' | 'not_yet';

export const CheckItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  prompt_en: z.string().min(1),
  prompt_vi: z.string().min(1),
  unseen_prompt_en: z.string().optional(),
  unseen_prompt_vi: z.string().optional(),
  rubric_vi: z.string().optional(),
  target_chunk_ids: z.array(z.string()).default([]),
});

export type CheckItem = z.infer<typeof CheckItemSchema>;

export const CheckDefinitionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  type: CheckTypeSchema,
  stage: z.number().int().optional(),
  unit_slug: z.string().optional(),
  title_en: z.string().min(1),
  title_vi: z.string().min(1),
  instructions_vi: z.string().min(1),
  covered_lesson_slugs: z.array(z.string()).min(1),
  items: z.array(CheckItemSchema).min(1),
});

export type CheckDefinition = z.infer<typeof CheckDefinitionSchema>;

// ---------------------------------------------------------------------------
// Lesson JSON (the full lesson document)
// ---------------------------------------------------------------------------

export const LessonSchema = z.object({
  /** Deterministic ID: sha256("lesson:" + slug) */
  id: z.string().min(1),
  slug: z.string().min(1),
  schema_version: z.literal(CONTENT_SCHEMA_VERSION),
  title_en: z.string().min(1),
  title_vi: z.string().min(1),
  /** Lesson topic description for learners. */
  blurb_vi: z.string().min(1),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  /** Skills this lesson targets. */
  target_skills: z
    .array(z.enum(['speaking', 'listening', 'reading', 'writing']))
    .min(1),
  estimated_duration_minutes: z.number().int().min(1),
  /** REQ-9 declaration metadata */
  objective_vi: z.string().optional(),
  situation_vi: z.string().optional(),
  learner_role_vi: z.string().optional(),
  prerequisite_lesson_slugs: z.array(z.string()).default([]),
  pronunciation_focus_vi: z.string().optional(),
  final_speaking_task_vi: z.string().optional(),
  pass_conditions_vi: z.string().optional(),
  unit_slug: z.string().optional(),
  unit_title_vi: z.string().optional(),
  stage: z.number().int().optional(),
  expected_errors: z.array(ExpectedErrorSchema).default([]),
  /**
   * Chunks: between 8 and 12 (inclusive).
   * Enforced by the lint validator (LNT-003).
   */
  chunks: z.array(ChunkSchema).min(8).max(12),
  grammar_patterns: z.array(GrammarPatternSchema).default([]),
  vocabulary: z.array(ContentVocabItemSchema).default([]),
  activities: z.array(ActivitySchema).default([]),
  audio_assets: z.array(AudioAssetSchema).default([]),
  srs_items: z.array(SrsItemSchema).default([]),
});

export type Lesson = z.infer<typeof LessonSchema>;

// ---------------------------------------------------------------------------
// Manifest JSON (package-level descriptor)
// ---------------------------------------------------------------------------

export const ManifestSchema = z.object({
  schema_version: z.literal(CONTENT_SCHEMA_VERSION),
  /** Unique package ID: sha256("package:" + slug). */
  package_id: z.string().min(1),
  slug: z.string().min(1),
  format: z.literal('hybrid-zip'),
  /** ISO 8601 export timestamp — informational only, never used in IDs. */
  exported_at: z.string().datetime({offset: true}).optional(),
  lessons: z
    .array(
      z.object({
        lesson_id: z.string().min(1),
        lesson_slug: z.string().min(1),
        file: z.string().min(1),
      }),
    )
    .min(1),
  audio_base_url: z.string().url().optional(),
  /** Semantic version of the exporting tool. */
  tool_version: z.string().optional(),
  checks: z.array(CheckDefinitionSchema).optional(),
  progression_graph: z
    .object({
      stages: z
        .array(
          z.object({
            stage: z.number().int(),
            name_vi: z.string(),
            unit_slugs: z.array(z.string()),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export type ContentValidationResult<T> =
  | {valid: true; data: T}
  | {valid: false; errors: string[]};

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map(
    issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
}

export function validateManifest(
  raw: unknown,
): ContentValidationResult<Manifest> {
  const parsed = ManifestSchema.safeParse(raw);
  if (parsed.success) {
    return {valid: true, data: parsed.data};
  }
  return {valid: false, errors: formatZodErrors(parsed.error)};
}

export function validateLesson(raw: unknown): ContentValidationResult<Lesson> {
  const parsed = LessonSchema.safeParse(raw);
  if (parsed.success) {
    return {valid: true, data: parsed.data};
  }
  return {valid: false, errors: formatZodErrors(parsed.error)};
}
