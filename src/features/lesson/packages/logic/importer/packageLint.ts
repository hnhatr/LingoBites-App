/**
 * Runtime content-package lint.
 *
 * Port of the M1 Node lint tool (`tools/content-lint/lint.mjs`) so the
 * importer can run the same rules on an extracted ZIP before inserting into
 * SQLite. Two implementations, one set of rules; they are intentionally
 * duplicated rather than shared because the lint tool must run as a
 * standalone Node script outside the RN bundler, while this module is
 * bundled for RN and so must not pull in `node:crypto` or `zod`.
 *
 * Every rule id here MUST match the corresponding id in the Node lint tool
 * so an offline lint report is interchangeable with a build-time lint report.
 */

import type {
  AudioAsset,
  ContentVocabItem,
  GrammarPattern,
  Lesson,
  Manifest,
  SrsItem,
} from '../schema';

export const RUNTIME_CONTENT_SCHEMA_VERSION = '0.1.0';

const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VALID_SKILLS = ['speaking', 'listening', 'reading', 'writing'];
const VALID_SRS_TYPES = ['vocabulary', 'grammar', 'dialogue_turn', 'qa'];
const VALID_ACTIVITY_TYPES = [
  'listen_and_repeat',
  'role_play',
  'fill_blank',
  'multiple_choice',
  'translation',
  'speaking_drill',
];
const CHECKSUM_RE = /^sha256:([a-f0-9]{64}|placeholder)$/;

export type ContentLintResult = {
  ok: boolean;
  errors: string[];
};

type LintRule = {
  id: string;
  description: string;
  run: (manifest: Manifest, lessons: Lesson[]) => string[];
};

const rules: LintRule[] = [
  {
    id: 'LNT-001',
    description: 'manifest.json has all required fields',
    run: manifest => {
      const errors: string[] = [];
      const required = [
        'schema_version',
        'package_id',
        'slug',
        'format',
        'lessons',
      ];
      for (const f of required) {
        if (!manifest[f as keyof Manifest]) {
          errors.push(`[LNT-001] manifest.json: missing required field "${f}"`);
        }
      }
      if (manifest.schema_version !== RUNTIME_CONTENT_SCHEMA_VERSION) {
        errors.push(
          `[LNT-001] manifest.json: schema_version must be "${RUNTIME_CONTENT_SCHEMA_VERSION}", got "${manifest.schema_version}"`,
        );
      }
      if (manifest.format !== 'hybrid-zip') {
        errors.push(
          `[LNT-001] manifest.json: format must be "hybrid-zip", got "${manifest.format}"`,
        );
      }
      if (!Array.isArray(manifest.lessons) || manifest.lessons.length === 0) {
        errors.push(
          '[LNT-001] manifest.json: lessons[] must have at least one entry',
        );
      }
      return errors;
    },
  },
  {
    id: 'LNT-002',
    description: 'Each lesson JSON has all required top-level fields',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      const required = [
        'id',
        'slug',
        'schema_version',
        'title_en',
        'title_vi',
        'blurb_vi',
        'level',
        'target_skills',
        'estimated_duration_minutes',
        'chunks',
      ];
      for (const lesson of lessons) {
        for (const f of required) {
          if (
            (lesson as unknown as Record<string, unknown>)[f] === undefined ||
            (lesson as unknown as Record<string, unknown>)[f] === null ||
            (lesson as unknown as Record<string, unknown>)[f] === ''
          ) {
            errors.push(
              `[LNT-002] lesson "${lesson.id}": missing required field "${f}"`,
            );
          }
        }
        if (lesson.schema_version !== RUNTIME_CONTENT_SCHEMA_VERSION) {
          errors.push(
            `[LNT-002] lesson "${lesson.id}": schema_version must be "${RUNTIME_CONTENT_SCHEMA_VERSION}", got "${lesson.schema_version}"`,
          );
        }
        if (!VALID_LEVELS.includes(lesson.level)) {
          errors.push(
            `[LNT-002] lesson "${lesson.id}": level "${lesson.level}" is not a valid CEFR level`,
          );
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-003',
    description: 'Each lesson has 8-12 chunks',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        const count = Array.isArray(lesson.chunks) ? lesson.chunks.length : 0;
        if (count < 8 || count > 12) {
          errors.push(
            `[LNT-003] lesson "${lesson.id}": chunk count must be 8-12, got ${count}`,
          );
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-004',
    description:
      'Every grammar_pattern.tied_to_actions includes "speaking" or "listening"',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const gp of lesson.grammar_patterns ?? ([] as GrammarPattern[])) {
          const actions = gp.tied_to_actions ?? [];
          if (!actions.includes('speaking') && !actions.includes('listening')) {
            errors.push(
              `[LNT-004] lesson "${lesson.id}": grammar_pattern "${
                gp.id ?? gp.slug
              }" tied_to_actions must include "speaking" or "listening"`,
            );
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-005',
    description: 'Every chunk has a non-empty explanation_vi',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const chunk of lesson.chunks ?? []) {
          if (!chunk.explanation_vi || chunk.explanation_vi.trim() === '') {
            errors.push(
              `[LNT-005] lesson "${lesson.id}": chunk "${
                chunk.id ?? chunk.slug ?? chunk.order
              }" is missing explanation_vi`,
            );
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-006',
    description: 'SRS item_types are valid',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const srs of lesson.srs_items ?? ([] as SrsItem[])) {
          if (!VALID_SRS_TYPES.includes(srs.item_type)) {
            errors.push(
              `[LNT-006] lesson "${lesson.id}": srs_item "${
                srs.id ?? srs.slug
              }" has invalid item_type "${srs.item_type}"`,
            );
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-007',
    description: 'Audio assets have id, url, and checksum',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const audio of lesson.audio_assets ?? ([] as AudioAsset[])) {
          if (!audio.id) {
            errors.push(
              `[LNT-007] lesson "${lesson.id}": audio asset missing "id"`,
            );
          }
          if (!audio.url) {
            errors.push(
              `[LNT-007] lesson "${lesson.id}": audio asset "${
                audio.id ?? '?'
              }" missing "url"`,
            );
          }
          if (!audio.checksum) {
            errors.push(
              `[LNT-007] lesson "${lesson.id}": audio asset "${
                audio.id ?? '?'
              }" missing "checksum"`,
            );
          } else if (!CHECKSUM_RE.test(audio.checksum)) {
            errors.push(
              `[LNT-007] lesson "${lesson.id}": audio asset "${
                audio.id ?? '?'
              }" checksum must match sha256:<hex64> or sha256:placeholder, got "${
                audio.checksum
              }"`,
            );
          }
        }
      }
      return errors;
    },
  },
  // LNT-008 (deterministic ID recomputation) is not portable because the
  // recompute requires sha256. The Node lint tool enforces it; the importer
  // relies on the fact that any package shipped was linted there first. The
  // runtime rules below still cover the schema/cross-ref checks that protect
  // against an import bypassing the build-time lint.
  {
    id: 'LNT-009',
    description: 'Lesson target_skills includes "speaking" or "listening"',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        const skills = lesson.target_skills ?? [];
        if (!skills.includes('speaking') && !skills.includes('listening')) {
          errors.push(
            `[LNT-009] lesson "${lesson.id}": target_skills must include "speaking" or "listening"`,
          );
        }
        for (const s of skills) {
          if (!VALID_SKILLS.includes(s)) {
            errors.push(
              `[LNT-009] lesson "${lesson.id}": target_skills contains invalid skill "${s}"`,
            );
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-011',
    description: 'SRS items have id, slug, source_ref_id, front, back',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const srs of lesson.srs_items ?? ([] as SrsItem[])) {
          for (const f of ['id', 'slug', 'source_ref_id', 'front', 'back']) {
            const v = (srs as unknown as Record<string, unknown>)[f];
            if (!v || (typeof v === 'string' && v.trim() === '')) {
              errors.push(
                `[LNT-011] lesson "${lesson.id}": srs_item "${
                  srs.slug ?? srs.id ?? '?'
                }" missing required field "${f}"`,
              );
            }
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-012',
    description: 'Every activity has at least one chunk_ref_id',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        for (const activity of lesson.activities ?? []) {
          if (
            !Array.isArray(activity.chunk_ref_ids) ||
            activity.chunk_ref_ids.length === 0
          ) {
            errors.push(
              `[LNT-012] lesson "${lesson.id}": activity "${
                activity.id ?? activity.slug
              }" must reference at least one chunk`,
            );
          }
          if (activity.type && !VALID_ACTIVITY_TYPES.includes(activity.type)) {
            errors.push(
              `[LNT-012] lesson "${lesson.id}": activity "${
                activity.id ?? activity.slug
              }" has invalid type "${activity.type}"`,
            );
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-013',
    description:
      'Vocab/audio/grammar/srs cross-refs in chunks point to declared ids',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      for (const lesson of lessons) {
        const vocabIds = new Set(
          (lesson.vocabulary ?? ([] as ContentVocabItem[])).map(v => v.id),
        );
        const audioIds = new Set(
          (lesson.audio_assets ?? ([] as AudioAsset[])).map(a => a.id),
        );
        for (const chunk of lesson.chunks ?? []) {
          for (const ref of chunk.vocab_ref_ids ?? []) {
            if (!vocabIds.has(ref)) {
              errors.push(
                `[LNT-013] lesson "${lesson.id}": chunk "${
                  chunk.id ?? chunk.slug
                }" vocab_ref_id "${ref}" not declared in vocabulary[]`,
              );
            }
          }
          for (const ref of chunk.audio_ref_ids ?? []) {
            if (!audioIds.has(ref)) {
              errors.push(
                `[LNT-013] lesson "${lesson.id}": chunk "${
                  chunk.id ?? chunk.slug
                }" audio_ref_id "${ref}" not declared in audio_assets[]`,
              );
            }
          }
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-014',
    description: 'Progression graph prerequisites resolve and graph is acyclic',
    run: (_manifest, lessons) => {
      const errors: string[] = [];
      const lessonSlugs = new Set(lessons.map(l => l.slug));
      const graph = new Map<string, string[]>();
      for (const lesson of lessons) {
        const prereqs = lesson.prerequisite_lesson_slugs ?? [];
        graph.set(lesson.slug, prereqs);
        for (const p of prereqs) {
          if (!lessonSlugs.has(p)) {
            errors.push(
              `[LNT-014] lesson "${lesson.id}": prerequisite_lesson_slug "${p}" does not exist in package`,
            );
          }
        }
      }
      const visited = new Set<string>();
      const recStack = new Set<string>();
      function hasCycle(node: string): boolean {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        recStack.add(node);
        for (const neighbor of graph.get(node) ?? []) {
          if (hasCycle(neighbor)) return true;
        }
        recStack.delete(node);
        return false;
      }
      for (const slug of graph.keys()) {
        if (hasCycle(slug)) {
          errors.push(
            `[LNT-014] Progression graph contains a cycle involving lesson "${slug}"`,
          );
          break;
        }
      }
      return errors;
    },
  },
  {
    id: 'LNT-015',
    description:
      'Weekly and stage checks are valid and stage checks use unseen prompts',
    run: (manifest, lessons) => {
      const errors: string[] = [];
      const lessonSlugs = new Set(lessons.map(l => l.slug));
      for (const check of manifest.checks ?? []) {
        for (const slug of check.covered_lesson_slugs ?? []) {
          if (!lessonSlugs.has(slug)) {
            errors.push(
              `[LNT-015] manifest.json check "${check.slug}": covered_lesson_slug "${slug}" does not exist`,
            );
          }
        }
        if (check.type === 'stage_check') {
          for (const item of check.items ?? []) {
            if (!item.unseen_prompt_en && !item.unseen_prompt_vi) {
              errors.push(
                `[LNT-015] manifest.json stage check "${check.slug}" item "${item.slug}" missing unseen prompt`,
              );
            }
          }
        }
      }
      return errors;
    },
  },
];

export function lintContentPackage(
  manifest: Manifest,
  lessons: Lesson[],
): ContentLintResult {
  const errors: string[] = [];
  for (const rule of rules) {
    errors.push(...rule.run(manifest, lessons));
  }
  return {ok: errors.length === 0, errors};
}

/**
 * Manually validate the shape of a `manifest.json` payload before treating
 * it as a `Manifest`. Cheaper than running the full lint when we just need
 * to know which lesson files to load.
 */
export function validateManifestShape(raw: unknown): {
  ok: boolean;
  errors: string[];
  manifest?: Manifest;
  referencedLessonFiles?: string[];
} {
  if (typeof raw !== 'object' || raw === null) {
    return {ok: false, errors: ['manifest: must be a JSON object']};
  }
  const record = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schema_version !== RUNTIME_CONTENT_SCHEMA_VERSION) {
    errors.push(
      `manifest.schema_version must be "${RUNTIME_CONTENT_SCHEMA_VERSION}"`,
    );
  }
  if (typeof record.package_id !== 'string' || record.package_id.length < 1) {
    errors.push('manifest.package_id must be a non-empty string');
  }
  if (typeof record.slug !== 'string' || record.slug.length < 1) {
    errors.push('manifest.slug must be a non-empty string');
  }
  if (record.format !== 'hybrid-zip') {
    errors.push('manifest.format must be "hybrid-zip"');
  }
  if (!Array.isArray(record.lessons) || record.lessons.length === 0) {
    errors.push('manifest.lessons must be a non-empty array');
  }
  const referenced: string[] = [];
  if (Array.isArray(record.lessons)) {
    for (const [i, entry] of record.lessons.entries()) {
      if (typeof entry !== 'object' || entry === null) {
        errors.push(`manifest.lessons[${i}] must be an object`);
        continue;
      }
      const e = entry as Record<string, unknown>;
      if (typeof e.lesson_id !== 'string' || e.lesson_id.length < 1) {
        errors.push(`manifest.lessons[${i}].lesson_id must be a string`);
      }
      if (typeof e.lesson_slug !== 'string' || e.lesson_slug.length < 1) {
        errors.push(`manifest.lessons[${i}].lesson_slug must be a string`);
      }
      if (typeof e.file !== 'string' || e.file.length < 1) {
        errors.push(`manifest.lessons[${i}].file must be a string`);
      } else {
        referenced.push(e.file);
      }
    }
  }
  if (errors.length > 0) {
    return {ok: false, errors};
  }
  return {
    ok: true,
    errors: [],
    manifest: raw as Manifest,
    referencedLessonFiles: referenced,
  };
}

/**
 * Manually validate a single lesson JSON payload against the M1 lesson shape
 * (the subset of fields the importer actually reads or stores). Cheap enough
 * to run before the full lint; missing fields short-circuit with a clear
 * error pointing at the lesson id + file.
 */
export function validateLessonShape(raw: unknown): {
  ok: boolean;
  errors: string[];
  lesson?: Lesson;
} {
  if (typeof raw !== 'object' || raw === null) {
    return {ok: false, errors: ['lesson: must be a JSON object']};
  }
  const lesson = raw as Record<string, unknown>;
  const errors: string[] = [];
  const requireStr = (field: string) => {
    if (
      typeof lesson[field] !== 'string' ||
      (lesson[field] as string).length < 1
    ) {
      errors.push(`lesson.${field} must be a non-empty string`);
    }
  };
  const requireInt = (field: string, min = 1) => {
    if (
      typeof lesson[field] !== 'number' ||
      !Number.isFinite(lesson[field] as number) ||
      (lesson[field] as number) < min
    ) {
      errors.push(`lesson.${field} must be a number >= ${min}`);
    }
  };
  requireStr('id');
  requireStr('slug');
  if (lesson.schema_version !== RUNTIME_CONTENT_SCHEMA_VERSION) {
    errors.push(
      `lesson.schema_version must be "${RUNTIME_CONTENT_SCHEMA_VERSION}"`,
    );
  }
  requireStr('title_en');
  requireStr('title_vi');
  requireStr('blurb_vi');
  if (
    typeof lesson.level !== 'string' ||
    !VALID_LEVELS.includes(lesson.level)
  ) {
    errors.push(
      `lesson.level must be one of ${VALID_LEVELS.join(', ')}, got "${
        lesson.level as string
      }"`,
    );
  }
  if (
    !Array.isArray(lesson.target_skills) ||
    lesson.target_skills.length === 0
  ) {
    errors.push('lesson.target_skills must be a non-empty array');
  } else {
    for (const [i, s] of lesson.target_skills.entries()) {
      if (typeof s !== 'string' || !VALID_SKILLS.includes(s)) {
        errors.push(
          `lesson.target_skills[${i}] must be one of ${VALID_SKILLS.join(
            ', ',
          )}`,
        );
      }
    }
  }
  requireInt('estimated_duration_minutes');
  if (!Array.isArray(lesson.chunks)) {
    errors.push('lesson.chunks must be an array');
  }
  if (errors.length > 0) {
    return {ok: false, errors};
  }
  return {ok: true, errors: [], lesson: raw as Lesson};
}
