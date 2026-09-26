#!/usr/bin/env node
/**
 * content-lint — validate a hybrid ZIP content package folder.
 *
 * Usage:
 *   yarn lint:content [--package-dir <path>]
 *   node tools/content-lint/lint.mjs --package-dir tools/content-lint/packages/daily-standup
 *
 * Exit codes:
 *   0 — all rules passed
 *   1 — one or more rules failed
 */

import fs from 'fs';
import path from 'path';
import {createHash} from 'crypto';
import {fileURLToPath} from 'url';

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const pkgDirIdx = args.indexOf('--package-dir');
const packageDir =
  pkgDirIdx !== -1 && args[pkgDirIdx + 1]
    ? path.resolve(args[pkgDirIdx + 1])
    : path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'packages',
        'daily-standup',
      );

// ---------------------------------------------------------------------------
// Deterministic ID helper (mirrors schema/index.ts)
// ---------------------------------------------------------------------------
function makeContentId(seed) {
  return createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Minimal Zod-free validators
// (The lint tool is a Node script run outside the RN bundler; we use plain JS
//  validation so it has zero build-step dependencies beyond Node built-ins.)
// ---------------------------------------------------------------------------

const VALID_SCHEMA_VERSION = '0.1.0';
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

// ---------------------------------------------------------------------------
// Rule runner
// ---------------------------------------------------------------------------
const results = [];
let pass = true;

function rule(id, description, fn) {
  try {
    const errors = fn();
    if (!errors || errors.length === 0) {
      results.push({id, description, status: 'PASS', errors: []});
    } else {
      pass = false;
      results.push({id, description, status: 'FAIL', errors});
    }
  } catch (e) {
    pass = false;
    results.push({id, description, status: 'ERROR', errors: [e.message]});
  }
}

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------
const manifestPath = path.join(packageDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`ERROR: manifest.json not found at ${manifestPath}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Load all lesson files referenced in manifest
const lessons = [];
for (const entry of manifest.lessons ?? []) {
  const lessonPath = path.join(packageDir, entry.file);
  if (!fs.existsSync(lessonPath)) {
    console.error(`ERROR: lesson file not found: ${lessonPath}`);
    process.exit(1);
  }
  lessons.push({
    entry,
    lesson: JSON.parse(fs.readFileSync(lessonPath, 'utf8')),
  });
}

// ---------------------------------------------------------------------------
// LNT-001: manifest required fields
// ---------------------------------------------------------------------------
rule('LNT-001', 'manifest.json has all required fields', () => {
  const errors = [];
  const required = [
    'schema_version',
    'package_id',
    'slug',
    'format',
    'lessons',
  ];
  for (const f of required) {
    if (
      manifest[f] === undefined ||
      manifest[f] === null ||
      manifest[f] === ''
    ) {
      errors.push(`manifest.json: missing or empty required field "${f}"`);
    }
  }
  if (manifest.schema_version !== VALID_SCHEMA_VERSION) {
    errors.push(
      `manifest.json: schema_version must be "${VALID_SCHEMA_VERSION}", got "${manifest.schema_version}"`,
    );
  }
  if (manifest.format !== 'hybrid-zip') {
    errors.push(
      `manifest.json: format must be "hybrid-zip", got "${manifest.format}"`,
    );
  }
  if (!Array.isArray(manifest.lessons) || manifest.lessons.length === 0) {
    errors.push('manifest.json: lessons[] must have at least one entry');
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-002: lesson required fields
// ---------------------------------------------------------------------------
rule('LNT-002', 'Each lesson JSON has all required top-level fields', () => {
  const errors = [];
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
  for (const {entry, lesson} of lessons) {
    for (const f of required) {
      if (lesson[f] === undefined || lesson[f] === null || lesson[f] === '') {
        errors.push(`${entry.file}: missing or empty required field "${f}"`);
      }
    }
    if (lesson.schema_version !== VALID_SCHEMA_VERSION) {
      errors.push(
        `${entry.file}: schema_version must be "${VALID_SCHEMA_VERSION}", got "${lesson.schema_version}"`,
      );
    }
    if (!VALID_LEVELS.includes(lesson.level)) {
      errors.push(
        `${entry.file}: level "${lesson.level}" is not a valid CEFR level`,
      );
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-003: chunk count 8-12
// ---------------------------------------------------------------------------
rule('LNT-003', 'Each lesson has 8-12 chunks', () => {
  const errors = [];
  for (const {entry, lesson} of lessons) {
    const count = Array.isArray(lesson.chunks) ? lesson.chunks.length : 0;
    if (count < 8 || count > 12) {
      errors.push(`${entry.file}: chunk count must be 8-12, got ${count}`);
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-004: grammar tied to speaking or listening
// ---------------------------------------------------------------------------
rule(
  'LNT-004',
  'Every grammar_pattern.tied_to_actions includes "speaking" or "listening"',
  () => {
    const errors = [];
    for (const {entry, lesson} of lessons) {
      for (const gp of lesson.grammar_patterns ?? []) {
        const actions = gp.tied_to_actions ?? [];
        if (!actions.includes('speaking') && !actions.includes('listening')) {
          errors.push(
            `${entry.file}: grammar_pattern "${
              gp.id ?? gp.slug
            }" tied_to_actions must include "speaking" or "listening"`,
          );
        }
      }
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// LNT-005: Vietnamese explanation present per chunk
// ---------------------------------------------------------------------------
rule('LNT-005', 'Every chunk has a non-empty explanation_vi', () => {
  const errors = [];
  for (const {entry, lesson} of lessons) {
    for (const chunk of lesson.chunks ?? []) {
      if (!chunk.explanation_vi || chunk.explanation_vi.trim() === '') {
        errors.push(
          `${entry.file}: chunk "${
            chunk.id ?? chunk.slug ?? chunk.order
          }" is missing explanation_vi`,
        );
      }
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-006: SRS declarations reference valid item types
// ---------------------------------------------------------------------------
rule('LNT-006', 'SRS item_types are valid', () => {
  const errors = [];
  for (const {entry, lesson} of lessons) {
    for (const srs of lesson.srs_items ?? []) {
      if (!VALID_SRS_TYPES.includes(srs.item_type)) {
        errors.push(
          `${entry.file}: srs_item "${
            srs.id ?? srs.slug
          }" has invalid item_type "${srs.item_type}"`,
        );
      }
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-007: audio asset stubs have id + url + checksum
// ---------------------------------------------------------------------------
rule('LNT-007', 'Audio assets have id, url, and checksum', () => {
  const errors = [];
  for (const {entry, lesson} of lessons) {
    for (const audio of lesson.audio_assets ?? []) {
      if (!audio.id) {
        errors.push(`${entry.file}: audio asset missing "id"`);
      }
      if (!audio.url) {
        errors.push(
          `${entry.file}: audio asset "${audio.id ?? '?'}" missing "url"`,
        );
      }
      if (!audio.checksum) {
        errors.push(
          `${entry.file}: audio asset "${audio.id ?? '?'}" missing "checksum"`,
        );
      } else if (!CHECKSUM_RE.test(audio.checksum)) {
        errors.push(
          `${entry.file}: audio asset "${
            audio.id ?? '?'
          }" checksum must match sha256:<hex64> or sha256:placeholder, got "${
            audio.checksum
          }"`,
        );
      }
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-008: Content IDs are deterministic (no random/timestamp components)
//   Verify that lesson IDs and chunk IDs match the makeContentId convention.
//   We re-compute and compare — if they match, they are deterministic.
// ---------------------------------------------------------------------------
rule(
  'LNT-008',
  'Content IDs are deterministic (re-compute matches stored ID)',
  () => {
    const errors = [];
    for (const {entry, lesson} of lessons) {
      const expectedLessonId = makeContentId(`lesson:${lesson.slug}`);
      if (lesson.id !== expectedLessonId) {
        errors.push(
          `${entry.file}: lesson.id "${lesson.id}" does not match expected deterministic ID "${expectedLessonId}" (seed: "lesson:${lesson.slug}")`,
        );
      }
      for (const chunk of lesson.chunks ?? []) {
        const expectedChunkId = makeContentId(
          `chunk:${lesson.slug}:${chunk.slug}`,
        );
        if (chunk.id !== expectedChunkId) {
          errors.push(
            `${entry.file}: chunk "${chunk.slug}" id "${chunk.id}" does not match expected "${expectedChunkId}"`,
          );
        }
      }
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// LNT-009: target_skills must include speaking or listening (content focus)
// ---------------------------------------------------------------------------
rule(
  'LNT-009',
  'Lesson target_skills includes "speaking" or "listening"',
  () => {
    const errors = [];
    for (const {entry, lesson} of lessons) {
      const skills = lesson.target_skills ?? [];
      if (!skills.includes('speaking') && !skills.includes('listening')) {
        errors.push(
          `${entry.file}: target_skills must include "speaking" or "listening"`,
        );
      }
      for (const s of skills) {
        if (!VALID_SKILLS.includes(s)) {
          errors.push(
            `${entry.file}: target_skills contains invalid skill "${s}"`,
          );
        }
      }
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// LNT-010: manifest package_id matches deterministic convention
// ---------------------------------------------------------------------------
rule(
  'LNT-010',
  'manifest.package_id matches deterministic sha256("package:" + slug)',
  () => {
    const errors = [];
    const expected = makeContentId(`package:${manifest.slug}`);
    if (manifest.package_id !== expected) {
      errors.push(
        `manifest.json: package_id "${manifest.package_id}" does not match expected "${expected}" (seed: "package:${manifest.slug}")`,
      );
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// LNT-011: SRS items have required fields
// ---------------------------------------------------------------------------
rule('LNT-011', 'SRS items have id, slug, source_ref_id, front, back', () => {
  const errors = [];
  for (const {entry, lesson} of lessons) {
    for (const srs of lesson.srs_items ?? []) {
      for (const f of ['id', 'slug', 'source_ref_id', 'front', 'back']) {
        if (!srs[f] || srs[f].trim() === '') {
          errors.push(
            `${entry.file}: srs_item "${
              srs.slug ?? srs.id ?? '?'
            }" missing required field "${f}"`,
          );
        }
      }
    }
  }
  return errors;
});

// ---------------------------------------------------------------------------
// LNT-014: Progression graph prerequisites resolve and graph is acyclic
// ---------------------------------------------------------------------------
rule(
  'LNT-014',
  'Progression graph prerequisites resolve and graph is acyclic',
  () => {
    const errors = [];
    const lessonSlugs = new Set(lessons.map(l => l.lesson.slug));
    const graph = new Map();
    for (const {entry, lesson} of lessons) {
      const prereqs = lesson.prerequisite_lesson_slugs ?? [];
      graph.set(lesson.slug, prereqs);
      for (const p of prereqs) {
        if (!lessonSlugs.has(p)) {
          errors.push(
            `${entry.file}: prerequisite_lesson_slug "${p}" does not exist in package`,
          );
        }
      }
    }
    const visited = new Set();
    const recStack = new Set();
    function hasCycle(node) {
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
          `Progression graph contains a cycle involving lesson "${slug}"`,
        );
        break;
      }
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// LNT-015: Weekly and stage checks are valid and stage checks use unseen prompts
// ---------------------------------------------------------------------------
rule(
  'LNT-015',
  'Weekly and stage checks are valid and stage checks use unseen prompts',
  () => {
    const errors = [];
    const lessonSlugs = new Set(lessons.map(l => l.lesson.slug));
    for (const check of manifest.checks ?? []) {
      for (const slug of check.covered_lesson_slugs ?? []) {
        if (!lessonSlugs.has(slug)) {
          errors.push(
            `manifest.json check "${check.slug}": covered_lesson_slug "${slug}" does not exist`,
          );
        }
      }
      if (check.type === 'stage_check') {
        for (const item of check.items ?? []) {
          if (!item.unseen_prompt_en && !item.unseen_prompt_vi) {
            errors.push(
              `manifest.json stage check "${check.slug}" item "${item.slug}" missing unseen prompt`,
            );
          }
        }
      }
    }
    return errors;
  },
);

// ---------------------------------------------------------------------------
// Print results
// ---------------------------------------------------------------------------
const PAD = 10;
const width = 60;
console.log('\n' + '─'.repeat(width));
console.log(' LingoBites Content Lint');
console.log(' Package: ' + packageDir);
console.log('─'.repeat(width));

for (const r of results) {
  const statusStr =
    r.status === 'PASS'
      ? '✅ PASS'
      : r.status === 'FAIL'
      ? '❌ FAIL'
      : '⚠️  ERROR';
  console.log(`\n[${r.id}] ${r.description}`);
  console.log(`  ${statusStr}`);
  for (const e of r.errors) {
    console.log(`  → ${e}`);
  }
}

console.log('\n' + '─'.repeat(width));
const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status !== 'PASS').length;
console.log(
  ` Total: ${results.length} rules  |  ${passCount} passed  |  ${failCount} failed`,
);
console.log('─'.repeat(width) + '\n');

if (!pass) {
  process.exit(1);
}
process.exit(0);
