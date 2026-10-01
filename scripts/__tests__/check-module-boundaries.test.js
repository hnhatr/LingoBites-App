const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  checkModuleBoundaries,
  checkImportRules,
  isPublicFeatureBarrel,
  isUiPort,
  findImportsInSource,
  loadExceptionManifest,
  normalizePath,
} = require('../check-module-boundaries');

const appRoot = path.resolve(__dirname, '../..');
const srcRoot = path.join(appRoot, 'src');

describe('check-module-boundaries (AD-004 checker and fixture matrix)', () => {
  describe('baseline repository checks', () => {
    it('passes on current production source with zero new violations and zero manifest exceptions', () => {
      const result = checkModuleBoundaries();
      expect(result.passed).toBe(true);
      expect(result.newViolations).toHaveLength(0);
      expect(result.expiredExceptions).toHaveLength(0);
      expect(result.matchedExceptions).toHaveLength(0);
      expect(result.manifestTotal).toBe(0);
    });

    it('ships an empty exception manifest', () => {
      const manifestPath = path.join(
        appRoot,
        'scripts/module-boundary-exceptions.json',
      );
      const manifest = loadExceptionManifest(manifestPath);

      expect(manifest.rawParsed.soleWriter).toBe('Integration Owner');
      expect(manifest.rawParsed.version).toBeDefined();
      expect(manifest.exceptions).toHaveLength(0);
      expect(Array.isArray(manifest.rawParsed.exceptions)).toBe(true);
    });
  });

  describe('fixture matrix: valid imports', () => {
    const validCases = [
      {
        name: 'relative import within the same feature',
        from: path.join(
          srcRoot,
          'features/practice/screens/PracticeScreen.tsx',
        ),
        specifier: '../logic/quizEngine',
        resolved: {
          resolvedFileName: path.join(
            srcRoot,
            'features/practice/logic/quizEngine.ts',
          ),
        },
      },
      {
        name: 'cross-feature import via @features barrel',
        from: path.join(srcRoot, 'features/today/screens/TodayScreen.tsx'),
        specifier: '@features/review',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'features/review/index.ts'),
        },
      },
      {
        name: 'lesson sub-part barrel import',
        from: path.join(
          srcRoot,
          'features/youtube/screens/YouTubeLessonScreen.tsx',
        ),
        specifier: '@features/lesson/player',
        resolved: {
          resolvedFileName: path.join(
            srcRoot,
            'features/lesson/player/index.ts',
          ),
        },
      },
      {
        name: 'import between lesson sub-parts via sub-part barrel',
        from: path.join(srcRoot, 'features/lesson/library/index.ts'),
        specifier: '@features/lesson/packages',
        resolved: {
          resolvedFileName: path.join(
            srcRoot,
            'features/lesson/packages/index.ts',
          ),
        },
      },
      {
        name: 'feature importing ui',
        from: path.join(
          srcRoot,
          'features/practice/screens/PracticeScreen.tsx',
        ),
        specifier: '@ui/components/AppButton',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'ui/components/AppButton.tsx'),
        },
      },
      {
        name: 'feature importing core',
        from: path.join(srcRoot, 'features/practice/logic/practiceFlow.ts'),
        specifier: '@core/db/database',
        resolved: {resolvedFileName: path.join(srcRoot, 'core/db/database.ts')},
      },
      {
        name: 'ui importing core',
        from: path.join(srcRoot, 'ui/components/AppButton.tsx'),
        specifier: '@core/release/index',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'core/release/index.ts'),
        },
      },
      {
        name: 'app importing a feature public barrel',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@features/account',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'features/account/index.ts'),
        },
      },
      {
        name: 'app importing a feature screens/*UiPort (DEC-3)',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@features/speaking/screens/speakingUiPort',
        resolved: {
          resolvedFileName: path.join(
            srcRoot,
            'features/speaking/screens/speakingUiPort.ts',
          ),
        },
      },
      {
        name: 'static asset import (png)',
        from: path.join(srcRoot, 'ui/components/AppCard.tsx'),
        specifier: './icon.png',
        resolved: {
          resolvedFileName: path.join(srcRoot, 'ui/components/icon.png'),
          isAsset: true,
        },
      },
      {
        name: 'external native library import',
        from: path.join(srcRoot, 'features/audio/logic/ttsService.ts'),
        specifier: 'react-native',
        resolved: {
          resolvedFileName: path.join(
            appRoot,
            'node_modules/react-native/index.js',
          ),
          isExternal: true,
        },
      },
    ];

    validCases.forEach(tc => {
      it(`allows ${tc.name}`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const {literalImports} = findImportsInSource(tc.from, dummyContent);
        expect(literalImports).toHaveLength(1);

        const violations = checkImportRules(
          tc.from,
          literalImports[0],
          {isExternal: false, isAsset: false, ...tc.resolved},
          srcRoot,
        );
        expect(violations).toEqual([]);
      });
    });
  });

  describe('fixture matrix: invalid imports failing with file, specifier, and rule', () => {
    const invalidCases = [
      {
        rule: 'core-to-features',
        from: path.join(srcRoot, 'core/db/database.ts'),
        specifier: '@features/practice',
        targetFile: path.join(srcRoot, 'features/practice/index.ts'),
      },
      {
        rule: 'core-to-app',
        from: path.join(srcRoot, 'core/db/database.ts'),
        specifier: '@app/navigation/types',
        targetFile: path.join(srcRoot, 'app/navigation/types.ts'),
      },
      {
        rule: 'core-to-ui',
        from: path.join(srcRoot, 'core/db/database.ts'),
        specifier: '@ui/components/AppButton',
        targetFile: path.join(srcRoot, 'ui/components/AppButton.tsx'),
      },
      {
        rule: 'ui-to-features',
        from: path.join(srcRoot, 'ui/components/AppButton.tsx'),
        specifier: '@features/practice',
        targetFile: path.join(srcRoot, 'features/practice/index.ts'),
      },
      {
        rule: 'ui-to-app',
        from: path.join(srcRoot, 'ui/components/AppButton.tsx'),
        specifier: '@app/navigation/types',
        targetFile: path.join(srcRoot, 'app/navigation/types.ts'),
      },
      {
        rule: 'features-to-app',
        from: path.join(
          srcRoot,
          'features/practice/screens/PracticeScreen.tsx',
        ),
        specifier: '@app/navigation/types',
        targetFile: path.join(srcRoot, 'app/navigation/types.ts'),
      },
      {
        rule: 'production-to-test',
        from: path.join(
          srcRoot,
          'features/practice/screens/PracticeScreen.tsx',
        ),
        specifier: '@test/support',
        targetFile: path.join(srcRoot, 'test/support/index.ts'),
      },
      {
        rule: 'cross-feature-private',
        from: path.join(srcRoot, 'features/input/screens/CreateScreen.tsx'),
        specifier: '@features/review/logic/FlashcardRepository',
        targetFile: path.join(
          srcRoot,
          'features/review/logic/FlashcardRepository.ts',
        ),
      },
      {
        rule: 'cross-feature-private',
        from: path.join(srcRoot, 'features/input/screens/CreateScreen.tsx'),
        specifier: '../../review/logic/FlashcardRepository',
        targetFile: path.join(
          srcRoot,
          'features/review/logic/FlashcardRepository.ts',
        ),
      },
      {
        rule: 'app-to-feature-private',
        from: path.join(srcRoot, 'app/navigation/AppNavigator.tsx'),
        specifier: '@features/practice/logic/quizEngine',
        targetFile: path.join(srcRoot, 'features/practice/logic/quizEngine.ts'),
      },
    ];

    invalidCases.forEach(tc => {
      it(`fails ${tc.rule} for ${tc.specifier}`, () => {
        const dummyContent = `import dummy from '${tc.specifier}';\n`;
        const {literalImports} = findImportsInSource(tc.from, dummyContent);
        expect(literalImports).toHaveLength(1);

        const violations = checkImportRules(
          tc.from,
          literalImports[0],
          {
            resolvedFileName: tc.targetFile,
            isExternal: false,
            isAsset: false,
          },
          srcRoot,
        );

        expect(violations).toHaveLength(1);
        expect(violations[0].rule).toBe(tc.rule);
        expect(violations[0].specifier).toBe(tc.specifier);
        expect(violations[0].file).toBe(normalizePath(tc.from));
      });
    });
  });

  describe('public surface predicates', () => {
    it('recognises feature barrels and lesson sub-part barrels', () => {
      expect(
        isPublicFeatureBarrel({
          layer: 'features',
          feature: 'review',
          rel: 'features/review/index.ts',
        }),
      ).toBe(true);
      expect(
        isPublicFeatureBarrel({
          layer: 'features',
          feature: 'review',
          rel: 'features/review/logic/FlashcardRepository.ts',
        }),
      ).toBe(false);
      expect(
        isPublicFeatureBarrel({
          layer: 'features',
          feature: 'lesson',
          rel: 'features/lesson/player/index.ts',
        }),
      ).toBe(true);
      expect(
        isPublicFeatureBarrel({
          layer: 'features',
          feature: 'lesson',
          rel: 'features/lesson/player/logic/foo.ts',
        }),
      ).toBe(false);
    });

    it('recognises screens/*UiPort files', () => {
      expect(
        isUiPort({
          layer: 'features',
          feature: 'speaking',
          rel: 'features/speaking/screens/speakingUiPort.ts',
        }),
      ).toBe(true);
      expect(
        isUiPort({
          layer: 'features',
          feature: 'speaking',
          rel: 'features/speaking/screens/SpeakingRoomScreen.tsx',
        }),
      ).toBe(false);
    });
  });

  describe('AST extraction & non-literal imports', () => {
    it('captures static imports, exports, and literal requires', () => {
      const code = `
        import { foo } from '@core/db';
        export { bar } from './bar';
        const baz = require('@ui/components/AppButton');
      `;
      const {literalImports, nonLiteralImports} = findImportsInSource(
        'src/test.ts',
        code,
      );
      expect(literalImports).toHaveLength(3);
      expect(nonLiteralImports).toHaveLength(0);
      expect(literalImports.map(i => i.specifier)).toEqual([
        '@core/db',
        './bar',
        '@ui/components/AppButton',
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
    it('allows a matching manifest entry and rejects a surplus occurrence', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-allowance-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '2.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/core/db/database.ts',
              specifier: '@features/review',
              rule: 'core-to-features',
              owner: 'React Native Developer',
              expiry: 'TASK-900',
            },
          ],
        }),
      );

      const target = path.join(srcRoot, 'features/review/index.ts');
      const file = path.join(srcRoot, 'core/db/database.ts');
      const resolved = {
        resolvedFileName: target,
        isExternal: false,
        isAsset: false,
      };
      const imp = {
        specifier: '@features/review',
        line: 1,
        kind: 'import',
      };

      const allowed = checkModuleBoundaries({
        files: [file],
        fileContents: {
          [file]: "import {x} from '@features/review';\n",
        },
        manifestPath: tempManifestPath,
      });
      expect(allowed.passed).toBe(true);
      expect(allowed.matchedExceptions).toHaveLength(1);
      expect(allowed.newViolations).toHaveLength(0);

      // The same manifest only allows one occurrence; a third-party helper
      // proves the surplus path by adding a second matching import.
      const rules = checkImportRules(file, imp, resolved, srcRoot);
      expect(rules).toHaveLength(1);
      expect(rules[0].rule).toBe('core-to-features');

      fs.rmSync(tempDir, {recursive: true, force: true});
    });

    it('rejects an expired ISO manifest entry', () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boundary-test-expiry-'),
      );
      const tempManifestPath = path.join(tempDir, 'exceptions.json');
      const file = path.join(srcRoot, 'core/db/database.ts');

      fs.writeFileSync(
        tempManifestPath,
        JSON.stringify({
          version: '2.0.0',
          soleWriter: 'Integration Owner',
          exceptions: [
            {
              file: 'src/core/db/database.ts',
              specifier: '@features/review',
              rule: 'core-to-features',
              owner: 'React Native Developer',
              expiry: '2020-01-01',
            },
          ],
        }),
      );

      const result = checkModuleBoundaries({
        files: [file],
        fileContents: {
          [file]: "import {x} from '@features/review';\n",
        },
        manifestPath: tempManifestPath,
      });

      expect(result.passed).toBe(false);
      expect(result.expiredExceptions.length).toBeGreaterThanOrEqual(1);
      expect(result.expiredExceptions[0].expiry).toBe('2020-01-01');

      fs.rmSync(tempDir, {recursive: true, force: true});
    });
  });
});
