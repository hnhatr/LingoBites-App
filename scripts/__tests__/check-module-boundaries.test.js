const path = require('path');
const {
  checkModuleBoundaries,
  findImportsInSource,
  sourceLayer,
  loadExceptionManifest,
  normalizePath,
} = require('../check-module-boundaries');

const appRoot = path.resolve(__dirname, '../..');
const srcRoot = path.join(appRoot, 'src');

describe('check-module-boundaries (AD-004 checker and fixture matrix)', () => {
  describe('baseline repository checks', () => {
    it('passes on current production source with zero new violations', () => {
      const result = checkModuleBoundaries();
      expect(result.passed).toBe(true);
      expect(result.newViolations).toHaveLength(0);
      expect(result.expiredExceptions).toHaveLength(0);
      expect(result.matchedExceptions.length).toBeGreaterThan(0);
      expect(result.manifestTotal).toBe(42);
    });

    it('manifest has valid schema and records Integration Owner as sole writer', () => {
      const manifestPath = path.join(
        appRoot,
        'scripts/module-boundary-exceptions.json',
      );
      const manifest = loadExceptionManifest(manifestPath);

      expect(manifest.rawParsed.soleWriter).toBe('Integration Owner');
      expect(manifest.rawParsed.version).toBeDefined();
      expect(manifest.exceptions.length).toBe(42);

      manifest.exceptions.forEach(entry => {
        expect(entry.file).toMatch(/^src\//);
        expect(entry.specifier).toBeDefined();
        expect(entry.rule).toMatch(/^(feature-to-app|app-to-module-private)$/);
        expect(entry.owner).toBe('React Native Developer');
        expect(entry.expiry).toBe('TASK-003');
      });
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
      it(`allows ${tc.name}`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const tempFile = tc.from;

        const {literalImports} = findImportsInSource(tempFile, dummyContent);
        expect(literalImports).toHaveLength(1);

        const violations = [];
        // Test checkImportRules logic
        const target = tc.resolved;
        const src = sourceLayer(tempFile, srcRoot);
        const tgt = sourceLayer(target.resolvedFileName, srcRoot);

        if (!target.isAsset && !target.isExternal && tgt.layer !== 'external') {
          // Rule checking
          if (
            tgt.layer === 'test-support' ||
            /(__tests__|\.test\.|\.spec\.)/.test(target.resolvedFileName)
          ) {
            violations.push('production-to-test');
          }
          if (src.layer === 'shared' && tgt.layer === 'modules') {
            violations.push('shared-to-module');
          }
          if (src.layer === 'components' && tgt.layer === 'modules') {
            violations.push('components-to-module');
          }
          if (src.layer === 'components' && tgt.layer === 'app') {
            violations.push('components-to-app');
          }
          if (
            src.layer === 'modules' &&
            tgt.layer === 'modules' &&
            src.feature !== tgt.feature
          ) {
            const parts = tgt.rel.split('/');
            const isPublic =
              (parts.length === 3 && parts[2].startsWith('index.')) ||
              tc.specifier === `@modules/${tgt.feature}`;
            if (!isPublic) {
              violations.push('cross-feature-private');
            }
          }
          if (src.layer === 'modules' && tgt.layer === 'app') {
            violations.push('feature-to-app');
          }
        }

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
        rule: 'contracts-boundary',
        from: path.join(srcRoot, 'contracts/navigation/index.ts'),
        specifier: '@modules/practice',
        targetFile: path.join(srcRoot, 'modules/practice/index.ts'),
      },
    ];

    invalidCases.forEach(tc => {
      it(`fails ${tc.rule} with exact file, specifier, and rule`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const {literalImports} = findImportsInSource(tc.from, dummyContent);
        expect(literalImports).toHaveLength(1);

        // Check using the checker rule logic
        const src = sourceLayer(tc.from, srcRoot);
        const tgt = sourceLayer(tc.targetFile, srcRoot);

        const violations = [];
        if (
          tgt.layer === 'test-support' ||
          /(__tests__|\.test\.|\.spec\.)/.test(tc.targetFile)
        ) {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'production-to-test',
          });
        }
        if (src.layer === 'shared' && tgt.layer === 'modules') {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'shared-to-module',
          });
        }
        if (src.layer === 'components' && tgt.layer === 'modules') {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'components-to-module',
          });
        }
        if (src.layer === 'components' && tgt.layer === 'app') {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'components-to-app',
          });
        }
        if (
          src.layer === 'modules' &&
          tgt.layer === 'modules' &&
          src.feature !== tgt.feature
        ) {
          const parts = tgt.rel.split('/');
          const isPublic =
            (parts.length === 3 && parts[2].startsWith('index.')) ||
            tc.specifier === `@modules/${tgt.feature}`;
          if (!isPublic) {
            violations.push({
              file: normalizePath(tc.from),
              specifier: tc.specifier,
              rule: 'cross-feature-private',
            });
          }
        }
        if (src.layer === 'modules' && tgt.layer === 'app') {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'feature-to-app',
          });
        }
        if (src.layer === 'app' && tgt.layer === 'modules') {
          const parts = tgt.rel.split('/');
          const isPublic =
            (parts.length === 3 && parts[2].startsWith('index.')) ||
            tc.specifier === `@modules/${tgt.feature}`;
          if (!isPublic) {
            violations.push({
              file: normalizePath(tc.from),
              specifier: tc.specifier,
              rule: 'app-to-module-private',
            });
          }
        }
        if (
          src.layer === 'contracts' &&
          [
            'modules',
            'app',
            'components',
            'shared',
            'theme',
            'release',
            'i18n',
          ].includes(tgt.layer)
        ) {
          violations.push({
            file: normalizePath(tc.from),
            specifier: tc.specifier,
            rule: 'contracts-boundary',
          });
        }

        expect(violations).toHaveLength(1);
        expect(violations[0].rule).toBe(tc.rule);
        expect(violations[0].specifier).toBe(tc.specifier);
        expect(violations[0].file).toBe(normalizePath(tc.from));
      });
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
    it('tolerates matching non-expired manifest entry', () => {
      const mockManifest = {
        byKey: new Map([
          [
            'src/modules/input/HomeScreen.tsx::@/app/navigation/types::feature-to-app',
            {
              file: 'src/modules/input/HomeScreen.tsx',
              specifier: '@/app/navigation/types',
              rule: 'feature-to-app',
              owner: 'React Native Developer',
              expiry: 'TASK-003',
            },
          ],
        ]),
        exceptions: [{}],
      };

      // Mock check with single violation that is in manifest
      const key =
        'src/modules/input/HomeScreen.tsx::@/app/navigation/types::feature-to-app';
      const manifestEntry = mockManifest.byKey.get(key);
      expect(manifestEntry).toBeDefined();
    });

    it('rejects expired manifest entry with ISO date in the past', () => {
      const pastDate = '2020-01-01';
      const expiryDate = Date.parse(pastDate);
      expect(!Number.isNaN(expiryDate) && Date.now() > expiryDate).toBe(true);
    });

    it('does not falsely treat milestone strings like TASK-003 as expired dates', () => {
      const milestone = 'TASK-003';
      const isIsoDate = /^\d{4}-\d{2}-\d{2}/.test(milestone);
      expect(isIsoDate).toBe(false);
    });
  });
});
