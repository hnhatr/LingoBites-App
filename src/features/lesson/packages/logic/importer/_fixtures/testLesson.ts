/**
 * Lesson fixture factory for importer tests (SETE-107 / M2).
 *
 * Produces a minimal but lint-valid lesson and matching manifest so each
 * test can build a clean package. The factory is parameterized to make
 * corruption cases trivial: `makeLesson({...})` with a known-bad field is
 * enough to trigger a specific lint rule.
 */

import {createHash} from 'crypto';
import type {
  ContentLesson,
  ContentPackageManifest,
  ContentSrsItem,
  ContentVocab,
} from '../types';

function sha256Hex(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export type MakeLessonOptions = {
  slug?: string;
  schemaVersion?: string;
  chunkCount?: number;
  includeGrammar?: boolean;
  includeVocab?: boolean;
  includeSrs?: boolean;
  missingExplanationVi?: boolean;
  invalidLevel?: boolean;
  invalidSkill?: boolean;
  invalidTargetSkills?: boolean;
  includeActivities?: boolean;
  duplicateActivityChunkRef?: boolean;
  invalidSrsType?: boolean;
  brokenVocabRef?: boolean;
  brokenAudioRef?: boolean;
  emptyGrammarActions?: boolean;
};

export function makeLesson(options: MakeLessonOptions = {}): ContentLesson {
  const slug = options.slug ?? 'daily-standup';
  const schemaVersion = options.schemaVersion ?? '0.1.0';
  const lessonId = sha256Hex(`lesson:${slug}`);
  const chunkCount = options.chunkCount ?? 10;
  if (chunkCount < 8 || chunkCount > 12) {
    throw new Error(
      `makeLesson: chunkCount ${chunkCount} outside the 8-12 lint range; pick a different value`,
    );
  }
  const chunks: ContentLesson['chunks'] = Array.from(
    {length: chunkCount},
    (_, i) => {
      const chunkSlug = `chunk-${i}`;
      const chunkId = sha256Hex(`chunk:${slug}:${chunkSlug}`);
      return {
        id: chunkId,
        slug: chunkSlug,
        order: i,
        phrase_en: `Phrase ${i}`,
        phrase_vi: `Cụm ${i}`,
        explanation_vi:
          options.missingExplanationVi && i === 0 ? '' : `Giải thích ${i}`,
        context_sentence_en: `Context ${i}`,
        context_sentence_vi: `Ngữ cảnh ${i}`,
        grammar_ref_ids: [],
        vocab_ref_ids:
          options.brokenVocabRef && i === 0 ? ['not-a-vocab-id'] : [],
        dialogue_turns: [],
        qa_items: [],
        audio_ref_ids:
          options.brokenAudioRef && i === 0 ? ['not-an-audio-id'] : [],
        srs_ref_ids: [],
        remediation: undefined,
      };
    },
  );
  const grammar = options.includeGrammar
    ? [
        {
          id: sha256Hex(`grammar:${slug}:present-continuous`),
          slug: 'present-continuous',
          name_en: 'Present continuous',
          name_vi: 'Thì hiện tại tiếp diễn',
          pattern: 'S + am/is/are + V-ing',
          explanation_vi: 'Giải thích thì hiện tại tiếp diễn.',
          tied_to_actions: options.emptyGrammarActions
            ? (['reading', 'writing'] as Array<'reading' | 'writing'>)
            : (['speaking', 'listening'] as Array<'speaking' | 'listening'>),
          examples: [{en: "I'm working.", vi: 'Tôi đang làm việc.'}],
        },
      ]
    : [];
  const vocab: ContentVocab[] = options.includeVocab
    ? [
        {
          id: sha256Hex(`vocab:${slug}:standup`),
          slug: 'standup',
          word: 'stand-up',
          word_type: 'noun',
          meaning_vi: 'buổi họp đứng',
          pronunciation_guide_vi: 'xtăn-đớp',
          ipa: '/ˈstænd.ʌp/',
          cefr_level: 'B1',
          example_en: 'Daily stand-up at 9 AM.',
          example_vi: 'Họp đứng hàng ngày lúc 9 giờ sáng.',
        },
      ]
    : [];
  const srs: ContentSrsItem[] = options.includeSrs
    ? [
        {
          id: sha256Hex(`srs:${slug}:srs-1`),
          slug: 'srs-1',
          item_type: options.invalidSrsType
            ? ('garbage' as unknown as ContentSrsItem['item_type'])
            : 'vocabulary',
          source_ref_id: chunks[0]!.id,
          front: 'Front 1',
          back: 'Back 1',
          hint_vi: 'Gợi ý 1',
        },
      ]
    : [];
  if (options.brokenVocabRef) {
    chunks[0]!.vocab_ref_ids = ['not-a-vocab-id'];
  }
  const activities = options.includeActivities
    ? [
        {
          id: sha256Hex(`activity:${slug}:listen-repeat`),
          slug: 'listen-repeat',
          type: 'listen_and_repeat' as const,
          title_vi: 'Nghe và lặp lại',
          chunk_ref_ids: options.duplicateActivityChunkRef
            ? [chunks[0]!.id, chunks[0]!.id]
            : [chunks[0]!.id],
          qa_ref_ids: [],
          instructions_vi: 'Nghe và lặp lại.',
        },
      ]
    : [];
  return {
    id: lessonId,
    slug,
    schema_version: schemaVersion as ContentLesson['schema_version'],
    title_en: 'Daily Stand-up',
    title_vi: 'Họp Đứng Hàng Ngày',
    blurb_vi: 'Học các cụm từ dùng trong buổi họp đứng hàng ngày.',
    level: options.invalidLevel
      ? ('Z9' as unknown as ContentLesson['level'])
      : 'A2',
    target_skills: options.invalidTargetSkills
      ? (['yodelling'] as unknown as ContentLesson['target_skills'])
      : options.invalidSkill
      ? (['reading', 'writing'] as unknown as ContentLesson['target_skills'])
      : (['speaking', 'listening'] as ContentLesson['target_skills']),
    estimated_duration_minutes: 20,
    prerequisite_lesson_slugs: [],
    chunks,
    grammar_patterns: grammar,
    vocabulary: vocab,
    activities,
    audio_assets: [],
    srs_items: srs,
    expected_errors: [],
  };
}

export function makeManifest(
  lesson: ContentLesson,
  options: {packageSlug?: string; includeExpectedSha?: string} = {},
): ContentPackageManifest {
  const packageSlug = options.packageSlug ?? 'daily-standup';
  const baseManifest = {
    schema_version: '0.1.0' as const,
    package_id: sha256Hex(`package:${packageSlug}`),
    slug: packageSlug,
    format: 'hybrid-zip' as const,
    lessons: [
      {
        lesson_id: lesson.id,
        lesson_slug: lesson.slug,
        file: `${lesson.slug}.lesson.json`,
      },
    ],
  };
  return options.includeExpectedSha
    ? ({
        ...baseManifest,
        expected_sha256: options.includeExpectedSha,
      } as unknown as ContentPackageManifest)
    : (baseManifest as ContentPackageManifest);
}

export function lessonFileName(lesson: ContentLesson): string {
  return `${lesson.slug}.lesson.json`;
}
