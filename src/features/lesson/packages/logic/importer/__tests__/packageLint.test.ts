/**
 * Unit tests for the content-package lint rules (SETE-107 / M2).
 *
 * These tests pin the runtime lint contract: the same rule ids and messages
 * the Node lint tool emits must be produced here so the importer's pre-insert
 * check matches the build-time gate.
 */

import {
  lintContentPackage,
  validateLessonShape,
  validateManifestShape,
  RUNTIME_CONTENT_SCHEMA_VERSION,
} from '../packageLint';
import {
  lessonFileName,
  makeLesson,
  makeManifest,
} from '../_fixtures/testLesson';

describe('packageLint', () => {
  it('accepts a valid manifest + lesson pair', () => {
    const lesson = makeLesson({includeGrammar: true, includeVocab: true});
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a missing required lesson field (LNT-002)', () => {
    const lesson = makeLesson();
    const broken = {...lesson, title_en: ''};
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [broken]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-002'))).toBe(true);
  });

  it('rejects chunk count outside 8-12 (LNT-003)', () => {
    // Bypass the factory guard by mutating the chunk array directly.
    const lesson = makeLesson();
    const broken = {
      ...lesson,
      chunks: lesson.chunks.slice(0, 7),
    } as typeof lesson;
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [broken]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-003'))).toBe(true);
  });

  it('rejects grammar with no speaking/listening tie (LNT-004)', () => {
    const lesson = makeLesson({
      includeGrammar: true,
      emptyGrammarActions: true,
    });
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-004'))).toBe(true);
  });

  it('rejects chunks missing explanation_vi (LNT-005)', () => {
    const lesson = makeLesson({missingExplanationVi: true});
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-005'))).toBe(true);
  });

  it('rejects SRS items with invalid item_type (LNT-006)', () => {
    const lesson = makeLesson({includeSrs: true, invalidSrsType: true});
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-006'))).toBe(true);
  });

  it('rejects a target_skills list with no speaking or listening (LNT-009)', () => {
    const lesson = makeLesson({invalidSkill: true});
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-009'))).toBe(true);
  });

  it('rejects activities with no chunk_ref_ids (LNT-012)', () => {
    const lesson = makeLesson({includeActivities: true});
    const broken = {
      ...lesson,
      activities: [
        {
          ...lesson.activities![0],
          chunk_ref_ids: [],
        },
      ],
    } as typeof lesson;
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [broken]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-012'))).toBe(true);
  });

  it('rejects chunks whose audio_ref_ids do not resolve (LNT-013)', () => {
    const lesson = makeLesson({brokenAudioRef: true});
    const manifest = makeManifest(lesson);
    const result = lintContentPackage(manifest, [lesson]);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('LNT-013'))).toBe(true);
  });
});

describe('validateManifestShape / validateLessonShape', () => {
  it('rejects a non-object manifest payload', () => {
    const r = validateManifestShape('not an object');
    expect(r.ok).toBe(false);
  });

  it('rejects a manifest with the wrong schema_version', () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    const r = validateManifestShape({...manifest, schema_version: '9.9.9'});
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('schema_version');
  });

  it('rejects a lesson whose target_skills is empty', () => {
    const lesson = makeLesson();
    const r = validateLessonShape({...lesson, target_skills: []});
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('target_skills');
  });

  it('accepts the canonical daily-standup lesson shape', () => {
    const lesson = makeLesson();
    const r = validateLessonShape(lesson);
    expect(r.ok).toBe(true);
  });

  it('exposes the runtime schema version constant', () => {
    expect(RUNTIME_CONTENT_SCHEMA_VERSION).toBe('0.1.0');
  });

  it('returns the manifest and referenced lesson files on success', () => {
    const lesson = makeLesson();
    const manifest = makeManifest(lesson);
    const r = validateManifestShape(manifest);
    expect(r.ok).toBe(true);
    expect(r.referencedLessonFiles).toEqual([lessonFileName(lesson)]);
  });
});
