const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  checkModuleBoundaries,
  checkImportRules,
  isPublicFeatureBarrel,
  findImportsInSource,
  loadExceptionManifest,
  normalizePath,
} = require('../check-module-boundaries');

const appRoot = path.resolve(__dirname, '../..');
const srcRoot = path.join(appRoot, 'src');

/** Staged legacy shims (Integration Owner manifest; TASK-008 / TASK-012 expiry). */
const LEGACY_SHIM_ALLOWANCES = [
  {
    file: 'src/shared/db/PracticeRepository.ts',
    specifier: '../../modules/practice/data/PracticeRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-008',
  },
  {
    file: 'src/shared/api/practiceEventsClient.ts',
    specifier: '../../modules/practice/api/practiceEventsClient',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-008',
  },
  {
    file: 'src/shared/db/AudioAssetRepository.ts',
    specifier: '../../modules/audio/data/AudioAssetRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-012',
  },
  {
    file: 'src/shared/db/SpeakingRepository.ts',
    specifier: '../../modules/speaking/data/SpeakingRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-012',
  },
  {
    file: 'src/shared/api/recordingClient.ts',
    specifier: '../../modules/speaking/api/recordingClient',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-012',
  },
  {
    file: 'src/shared/db/ContentPackageRepository.ts',
    specifier: '../../modules/content/data/ContentPackageRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-013',
  },
  {
    file: 'src/shared/db/ContentLessonStateRepository.ts',
    specifier: '../../modules/content/data/ContentLessonStateRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-013',
  },
  {
    file: 'src/shared/db/ContentRuntimeRepository.ts',
    specifier: '../../modules/content/data/ContentRuntimeRepository',
    rule: 'shared-to-module',
    owner: 'React Native Developer',
    expiry: 'TASK-013',
  },
];

function expectManifestMatchesLegacyShimDelta(manifest) {
  expect(manifest.exceptions).toHaveLength(LEGACY_SHIM_ALLOWANCES.length);
  for (const expected of LEGACY_SHIM_ALLOWANCES) {
    expect(manifest.exceptions).toContainEqual(expected);
  }
  expect(manifest.allowanceByKey.size).toBe(LEGACY_SHIM_ALLOWANCES.length);
}

describe('check-module-boundaries (AD-004 checker and fixture matrix)', () => {
  describe('baseline repository checks', () => {
    it('passes on current production source with zero new violations', () => {
      const result = checkModuleBoundaries();
      expect(result.passed).toBe(true);
      expect(result.newViolations).toHaveLength(0);
      expect(result.expiredExceptions).toHaveLength(0);
      expect(result.matchedExceptions).toHaveLength(
        LEGACY_SHIM_ALLOWANCES.length,
      );
      expect(result.manifestTotal).toBe(LEGACY_SHIM_ALLOWANCES.length);
    });

    it('manifest has valid schema, sole writer, and exact legacy shim allowances', () => {
      const manifestPath = path.join(
        appRoot,
        'scripts/module-boundary-exceptions.json',
      );
      const manifest = loadExceptionManifest(manifestPath);

      expect(manifest.rawParsed.soleWriter).toBe('Integration Owner');
      expect(manifest.rawParsed.version).toBeDefined();
      expectManifestMatchesLegacyShimDelta(manifest);
    });

    it('rejects a new shared-to-module violation beyond the staged practice shim allowances', () => {
      const practiceRepoShim = path.join(
        srcRoot,
        'shared/db/PracticeRepository.ts',
      );
      const original = fs.readFileSync(practiceRepoShim, 'utf8');
      const extraImport = `import {x} from '../../modules/practice/sessionEngine';\n${original}`;

      const result = checkModuleBoundaries({
        files: [practiceRepoShim],
        fileContents: {[practiceRepoShim]: extraImport},
      });

      expect(result.passed).toBe(false);
      expect(
        result.newViolations.some(
          v =>
            v.file === 'src/shared/db/PracticeRepository.ts' &&
            v.specifier === '../../modules/practice/sessionEngine' &&
            v.rule === 'shared-to-module',
        ),
      ).toBe(true);
    });
  });

  describe('fixture matrix: valid imports', () => {
    const validCases = [
      {
        name: 'relative import within the same feature module',
        from: path.join(srcRoot, 'modules/review/DailyReviewScreen.tsx'),
        specifier: './ReviewSession',
        resolved: {
          resolvedFileName: path.join(
            srcRoot,
            'modules/review/ReviewSession.tsx',
          ),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'cross-feature import via public feature barrel',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '@modules/engagement',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'modules/engagement/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'cross-feature import via relative sibling barrel (../analytics)',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '../analytics',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'modules/analytics/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing shared',
        from: path.join(srcRoot, 'modules/practice/PracticeScreen.tsx'),
        specifier: '@shared/db/database',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'shared/db/database.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing components',
        from: path.join(srcRoot, 'modules/today/TodayScreen.tsx'),
        specifier: '@components/Button',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'components/Button.tsx'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing contracts',
        from: path.join(srcRoot, 'modules/practice/PracticeScreen.tsx'),
        specifier: '@contracts/navigation',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'contracts/navigation/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing theme',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '@theme',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'theme/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing release',
        from: path.join(srcRoot, 'modules/engagement/EngagementBootstrap.tsx'),
        specifier: '@release',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'release/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'feature module importing i18n',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '@i18n',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'i18n/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'app importing contracts',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@contracts/navigation',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'contracts/navigation/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'app importing module public barrel',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@modules/account',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'modules/account/index.ts'),
          isExternal: false,
          isAsset: false,
        },
      },
      {
        name: 'static asset import (png/json)',
        from: path.join(srcRoot, 'components/Card.tsx'),
        specifier: './icon.png',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'components/icon.png'),
          isExternal: false,
          isAsset: true,
        },
      },
      {
        name: 'external native library import',
        from: path.join(srcRoot, 'modules/audio/AudioPlayer.ts'),
        specifier: 'react-native',
        resolved: {
          resolvedFileName: path.join(
            appRoot,
            'node_modules/react-native/index.js',
          ),
          isExternal: true,
          isAsset: false,
        },
      },
    ];

    validCases.forEach(tc => {
      it(`allows ${tc.name} via production checkImportRules`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const tempFile = tc.from;

        const {literalImports} = findImportsInSource(tempFile, dummyContent);
        expect(literalImports).toHaveLength(1);

        // Execute production checkImportRules directly
        const violations = checkImportRules(
          tempFile,
          literalImports[0],
          tc.resolved,
          srcRoot,
        );

        expect(violations).toEqual([]);
      });
    });
  });

  describe('fixture matrix: invalid imports failing with file, specifier, and rule', () => {
    const invalidCases = [
      {
        rule: 'cross-feature-private',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '@modules/review/DailyReviewScreen',
        targetFile: path.join(srcRoot, 'modules/review/DailyReviewScreen.tsx'),
      },
      {
        rule: 'cross-feature-private',
        from: path.join(srcRoot, 'modules/input/HomeScreen.tsx'),
        specifier: '@modules/review/index.private',
        targetFile: path.join(srcRoot, 'modules/review/index.private.ts'),
      },
      {
        rule: 'shared-to-module',
        from: path.join(srcRoot, 'shared/db/database.ts'),
        specifier: '@modules/practice',
        targetFile: path.join(srcRoot, 'modules/practice/index.ts'),
      },
      {
        rule: 'components-to-module',
        from: path.join(srcRoot, 'components/Card.tsx'),
        specifier: '@modules/practice',
        targetFile: path.join(srcRoot, 'modules/practice/index.ts'),
      },
      {
        rule: 'components-to-app',
        from: path.join(srcRoot, 'components/Card.tsx'),
        specifier: '@/app/navigation/types',
        targetFile: path.join(srcRoot, 'app/navigation/types.ts'),
      },
      {
        rule: 'production-to-test',
        from: path.join(srcRoot, 'modules/practice/PracticeScreen.tsx'),
        specifier: '@test-support/invariants',
        targetFile: path.join(srcRoot, 'test-support/invariants.ts'),
      },
      {
        rule: 'feature-to-app',
        from: path.join(srcRoot, 'modules/practice/NewFeatureScreen.tsx'),
        specifier: '@/app/navigation/types',
        targetFile: path.join(srcRoot, 'app/navigation/types.ts'),
      },
      {
        rule: 'app-to-module-private',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@modules/practice/practiceQuestion',
        targetFile: path.join(srcRoot, 'modules/practice/practiceQuestion.ts'),
      },
      {
        rule: 'app-to-module-private',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@modules/practice/index.private',
        targetFile: path.join(srcRoot, 'modules/practice/index.private.ts'),
      },
      {
        rule: 'contracts-boundary',
        from: path.join(srcRoot, 'contracts/navigation/index.ts'),
        specifier: '@modules/practice',
        targetFile: path.join(srcRoot, 'modules/practice/index.ts'),
      },
    ];

    invalidCases.forEach(tc => {
      it(`fails ${tc.rule} for ${tc.specifier} via production checkImportRules`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const {literalImports} = findImportsInSource(tc.from, dummyContent);
        expect(literalImports).toHaveLength(1);

        const resolved = {
          resolvedFileName: tc.targetFile,
          isExternal: false,
          isAsset: false,
        };

        // Execute production checkImportRules directly
        const violations = checkImportRules(
          tc.from,
          literalImports[0],
          resolved,
          srcRoot,
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].rule).toBe(tc.rule);
        expect(violations[0].specifier).toBe(tc.specifier);
        expect(violations[0].file).toBe(normalizePath(tc.from));
      });
    });
  });

  describe('CR-001 regression: cross-feature Private index.private.ts enforcement', () => {
    it('isPublicFeatureBarrel distinguishes index.ts from index.private.ts', () => {
      // Valid public barrel
      expect(
        isPublicFeatureBarrel(
          {layer: 'modules', feature: 'review', rel: 'modules/review/index.ts'},
          '@modules/review',
        ),
      ).toBe(true);

      // Sibling relative import to barrel
      expect(
        isPublicFeatureBarrel(
          {layer: 'modules', feature: 'review', rel: 'modules/review/index.ts'},
          '../review',
        ),
      ).toBe(true);

      // index.private.ts is strictly Private regardless of specifier
      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'review',
            rel: 'modules/review/index.private.ts',
          },
          '@modules/review/index.private',
        ),
      ).toBe(false);

      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'review',
            rel: 'modules/review/index.private.ts',
          },
          '@modules/review',
        ),
      ).toBe(false);

      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'review',
            rel: 'modules/review/index.private.ts',
          },
          '../review/index.private',
        ),
      ).toBe(false);

      // Nested index files are also Private
      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'review',
            rel: 'modules/review/sub/index.ts',
          },
          '@modules/review',
        ),
      ).toBe(false);

      // TASK-012 speaking split public surfaces
      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'speaking',
            rel: 'modules/speaking/speakingQueryPort.ts',
          },
          '@modules/speaking/speakingQueryPort',
        ),
      ).toBe(true);
      expect(
        isPublicFeatureBarrel(
          {
            layer: 'modules',
            feature: 'speaking',
            rel: 'modules/speaking/speakingUiPort.ts',
          },
          '@modules/speaking/speakingUiPort',
        ),
      ).toBe(true);
    });

    it('rejects cross-feature import of index.private.ts in checkModuleBoundaries production runner', () => {
      const privateTargetFile = path.join(
        srcRoot,
        'modules/review/index.private.ts',
      );
      fs.writeFileSync(privateTargetFile, 'export const secret = 1;\n');

      const testFile = path.join(srcRoot, 'modules/input/HomeScreen.tsx');
      const original = fs.readFileSync(testFile, 'utf8');
      const modified = `import { secret } from '@modules/review/index.private';\n${original}`;

      try {
        const result = checkModuleBoundaries({
          files: [testFile],
          fileContents: {[testFile]: modified},
        });

        expect(result.passed).toBe(false);
        const privateViolation = result.newViolations.find(
          v => v.specifier === '@modules/review/index.private',
        );
        expect(privateViolation).toBeDefined();
        expect(privateViolation.rule).toBe('cross-feature-private');
      } finally {
        if (fs.existsSync(privateTargetFile)) {
          fs.unlinkSync(privateTargetFile);
        }
      }
    });
  });

  describe('CR-002 regression: manifest exact occurrence allowance and surplus rejection', () => {
    it('manifest tracks occurrence allowances per file/specifier/rule', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-allowance-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '1.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/modules/ocr/OCRReviewScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
            {
              file: 'src/modules/ocr/OCRReviewScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
          ],
        }),
      );

      const manifest = loadExceptionManifest(tempManifestPath);
      expect(manifest.exceptions).toHaveLength(2);
      expect(manifest.allowanceByKey.size).toBe(1);

      const key =
        'src/modules/ocr/OCRReviewScreen.tsx::@/app/navigation/types::feature-to-app';
      expect(manifest.allowanceByKey.get(key)).toHaveLength(2);

      fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('consumes exactly 2 allowances for OCRReviewScreen and rejects 3rd occurrence in production checker', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-ocr-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '1.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/modules/ocr/OCRReviewScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
            {
              file: 'src/modules/ocr/OCRReviewScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
          ],
        }),
      );

      const ocrFile = path.join(srcRoot, 'modules/ocr/OCRReviewScreen.tsx');
      const twoImports = `import type {A} from '@/app/navigation/types';\nimport type {B} from '@/app/navigation/types';\nexport const x = 1;\n`;

      const baselineResult = checkModuleBoundaries({
        files: [ocrFile],
        fileContents: {[ocrFile]: twoImports},
        manifestPath: tempManifestPath,
      });
      expect(baselineResult.passed).toBe(true);
      expect(baselineResult.newViolations).toHaveLength(0);
      const matched = baselineResult.matchedExceptions.filter(
        v =>
          v.file === 'src/modules/ocr/OCRReviewScreen.tsx' &&
          v.specifier === '@/app/navigation/types',
      );
      expect(matched).toHaveLength(2);

      // Now add a 3rd import of the same specifier
      const threeImports = `import type { ExtraType } from '@/app/navigation/types';\n${twoImports}`;
      const surplusResult = checkModuleBoundaries({
        files: [ocrFile],
        fileContents: {[ocrFile]: threeImports},
        manifestPath: tempManifestPath,
      });

      expect(surplusResult.passed).toBe(false);

      // First 2 occurrences are matched as exceptions
      const matchedWithSurplus = surplusResult.matchedExceptions.filter(
        v =>
          v.file === 'src/modules/ocr/OCRReviewScreen.tsx' &&
          v.specifier === '@/app/navigation/types',
      );
      expect(matchedWithSurplus).toHaveLength(2);

      // 3rd occurrence is rejected as surplus violation
      const surplusViolations = surplusResult.newViolations.filter(
        v =>
          v.file === 'src/modules/ocr/OCRReviewScreen.tsx' &&
          v.specifier === '@/app/navigation/types',
      );
      expect(surplusViolations).toHaveLength(1);
      expect(surplusViolations[0].rule).toBe('feature-to-app');
      expect(surplusViolations[0].reason).toContain(
        'Surplus occurrence exceeding manifest allowance (2 allowed)',
      );

      fs.rmSync(tempDir, {recursive: true, force: true});
    });
  });

  describe('AST extraction & non-literal imports', () => {
    it('captures static imports, exports, and literal requires', () => {
      const code = `
        import { foo } from '@shared/db';
        export { bar } from './bar';
        const baz = require('@components/Button');
      `;
      const {literalImports, nonLiteralImports} = findImportsInSource(
        'src/test.ts',
        code,
      );
      expect(literalImports).toHaveLength(3);
      expect(nonLiteralImports).toHaveLength(0);
      expect(literalImports.map(i => i.specifier)).toEqual([
        '@shared/db',
        './bar',
        '@components/Button',
      ]);
    });

    it('flags dynamic and non-literal require/import for manual review without crashing', () => {
      const code = `
        const dynamicPath = './dynamic/' + name;
        const mod = require(dynamicPath);
        import(someFunc());
      `;
      const {literalImports, nonLiteralImports} = findImportsInSource(
        'src/dynamic.ts',
        code,
      );
      expect(literalImports).toHaveLength(0);
      expect(nonLiteralImports).toHaveLength(2);
      expect(nonLiteralImports[0].kind).toBe('non-literal-require');
      expect(nonLiteralImports[1].kind).toBe('non-literal-import');
    });
  });

  describe('manifest exception handling and expiry', () => {
    it('tolerates matching non-expired manifest entry with TASK-003 milestone', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-milestone-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '1.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/modules/input/HomeScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
          ],
        }),
      );

      const manifest = loadExceptionManifest(tempManifestPath);
      const key =
        'src/modules/input/HomeScreen.tsx::@/app/navigation/types::feature-to-app';
      const entries = manifest.allowanceByKey.get(key);
      expect(entries).toBeDefined();
      expect(entries[0].expiry).toBe('TASK-003');

      const isIsoDate = /^\d{4}-\d{2}-\d{2}/.test(entries[0].expiry);
      expect(isIsoDate).toBe(false);

      fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('rejects expired manifest entry with ISO date in the past via production checker', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-expiry-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      const testFile = path.join(srcRoot, 'modules/input/HomeScreen.tsx');

      // Create manifest with expired entry
      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '1.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/modules/input/HomeScreen.tsx',
              specifier: '@/app/navigation/tabBarMetrics',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: '2020-01-01',
            },
          ],
        }),
      );

      const result = checkModuleBoundaries({
        files: [testFile],
        fileContents: {
          [testFile]:
            "import {useFloatingTabBarClearance} from '@/app/navigation/tabBarMetrics';\n",
        },
        manifestPath: tempManifestPath,
      });

      expect(result.passed).toBe(false);
      expect(result.expiredExceptions.length).toBeGreaterThanOrEqual(1);
      const expired = result.expiredExceptions.find(
        e => e.specifier === '@/app/navigation/tabBarMetrics',
      );
      expect(expired).toBeDefined();
      expect(expired.expiry).toBe('2020-01-01');

      fs.rmSync(tempDir, {recursive: true, force: true});
    });
  });
});
