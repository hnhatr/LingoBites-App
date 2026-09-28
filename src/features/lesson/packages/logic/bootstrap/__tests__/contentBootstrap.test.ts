import {
  bootstrapContentPackage,
  getBundledPackageZipBytes,
} from '../contentBootstrap';
import {buildStoredZip} from '@features/lesson/packages/logic/importer/_fixtures/testZip';
import {
  makeManifest,
  makeLesson,
} from '@features/lesson/packages/logic/importer/_fixtures/testLesson';
import {
  getActivePackage,
  listPackages,
} from '@features/lesson/packages/logic/data/ContentPackageRepository';
import {
  listActivePackageLessons,
  listContentReviewItems,
  insertContentReviewItems,
} from '@features/lesson/packages/logic/data/ContentRuntimeRepository';
import {sha256Hex} from '@features/lesson/packages/logic/importer/packageChecksum';

describe('contentBootstrap (SETE-114 / M9)', () => {
  it('installs bundled package on fresh install when active package is absent', async () => {
    const result = await bootstrapContentPackage();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('installed');
      expect(result.lessonCount).toBe(16);
    }

    const active = getActivePackage();
    expect(active).not.toBeNull();
    expect(active?.slug).toBe('daily-standup');
    expect(active?.isActive).toBe(true);

    const lessons = listActivePackageLessons();
    expect(lessons).toHaveLength(16);
  });

  it('is idempotent on repeated launches and does not duplicate package or lesson rows', async () => {
    const res1 = await bootstrapContentPackage();
    expect(res1.ok).toBe(true);

    const packagesBefore = listPackages();
    const lessonsBefore = listActivePackageLessons();

    const res2 = await bootstrapContentPackage();
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.status).toBe('already_active');
    }

    const packagesAfter = listPackages();
    const lessonsAfter = listActivePackageLessons();

    expect(packagesAfter.length).toBe(packagesBefore.length);
    expect(lessonsAfter.length).toBe(lessonsBefore.length);
  });

  it('handles bundled package upgrade and preserves existing learner progress', async () => {
    // 1. Initial bootstrap
    const initRes = await bootstrapContentPackage();
    expect(initRes.ok).toBe(true);
    const activeV1 = getActivePackage()!;

    // Seed some progress on lesson 1
    const lessonsV1 = listActivePackageLessons();
    expect(lessonsV1.length).toBeGreaterThan(0);
    const srsItem = {
      id: 'srs-seed-1',
      slug: 'srs-seed-1',
      item_type: 'vocabulary' as const,
      source_ref_id: 'chunk-1',
      front: 'Hi',
      back: 'Xin chào',
    };
    insertContentReviewItems(
      lessonsV1[0].id,
      activeV1.id,
      [srsItem],
      new Date().toISOString(),
    );
    const progressBefore = listContentReviewItems();
    expect(progressBefore.length).toBe(1);

    // 2. Build a modified v2 package zip
    const lessonV2 = makeLesson({
      slug: 'self-introduction',
    });
    const manifestV2 = makeManifest(lessonV2, {
      packageSlug: 'daily-standup',
    });
    const v2Zip = buildStoredZip([
      ['manifest.json', new TextEncoder().encode(JSON.stringify(manifestV2))],
      [
        'self-introduction.lesson.json',
        new TextEncoder().encode(JSON.stringify(lessonV2)),
      ],
    ]);
    const v2Sha = sha256Hex(v2Zip);

    // 3. Run bootstrap with upgraded bundle
    const upgradeRes = await bootstrapContentPackage({
      bundledZipBytes: v2Zip,
      bundledSha256: v2Sha,
    });

    expect(upgradeRes.ok).toBe(true);
    if (upgradeRes.ok) {
      expect(upgradeRes.status).toBe('upgraded');
    }

    const activeV2 = getActivePackage()!;
    expect(activeV2.id).not.toBe(activeV1.id);
    expect(activeV2.isActive).toBe(true);

    // Verify progress tied to review items persists
    const progressAfter = listContentReviewItems();
    expect(progressAfter.length).toBe(1);

    // Verify packages table has 2 packages, 1 active and 1 deactivated
    const pkgs = listPackages();
    expect(pkgs).toHaveLength(2);
    const inactive = pkgs.find(p => !p.isActive);
    expect(inactive?.id).toBe(activeV1.id);
    expect(inactive?.deactivatedAt).not.toBeNull();
  });

  it('keeps previous active package usable if upgraded bundled content is corrupt/invalid', async () => {
    // 1. Initial bootstrap
    const initRes = await bootstrapContentPackage();
    expect(initRes.ok).toBe(true);
    const activeV1 = getActivePackage()!;

    // 2. Run bootstrap with corrupt zip bytes
    const corruptBytes = new TextEncoder().encode(
      'not a valid zip file at all',
    );
    const corruptSha = sha256Hex(corruptBytes);

    const failRes = await bootstrapContentPackage({
      bundledZipBytes: corruptBytes,
      bundledSha256: corruptSha,
    });

    expect(failRes.ok).toBe(false);
    if (!failRes.ok) {
      expect(failRes.status).toBe('failed');
      expect(failRes.previousActivePackageId).toBe(activeV1.id);
    }

    // Active package remains intact
    const activeStill = getActivePackage()!;
    expect(activeStill.id).toBe(activeV1.id);
    expect(activeStill.isActive).toBe(true);

    const lessonsStill = listActivePackageLessons();
    expect(lessonsStill).toHaveLength(16);
  });

  it('runs offline without network dependencies', async () => {
    const bytes = getBundledPackageZipBytes();
    expect(bytes.length).toBeGreaterThan(1000);

    const res = await bootstrapContentPackage();
    expect(res.ok).toBe(true);
  });
});
