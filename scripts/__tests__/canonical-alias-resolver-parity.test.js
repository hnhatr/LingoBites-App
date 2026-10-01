const path = require('path');
const fs = require('fs');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '../..');
const srcRoot = path.join(appRoot, 'src');

describe('canonical alias resolver parity (TS / Babel / Jest)', () => {
  const tsconfig = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'tsconfig.json'), 'utf8'),
  );
  const babelConfig = require(path.join(appRoot, 'babel.config.js'));
  const jestConfig = require(path.join(appRoot, 'jest.config.js'));

  const canonicalAliases = ['@app', '@features', '@ui', '@core', '@test'];

  it('declares all 5 canonical aliases in tsconfig.json paths', () => {
    const paths = tsconfig.compilerOptions.paths;
    expect(paths).toBeDefined();

    canonicalAliases.forEach(alias => {
      const expectedDir = alias.replace(/^@/, 'src/');
      expect(paths[alias]).toBeDefined();
      expect(paths[alias]).toContain(expectedDir);
      expect(paths[`${alias}/*`]).toBeDefined();
      expect(paths[`${alias}/*`]).toContain(`${expectedDir}/*`);
    });
  });

  it('declares all 5 canonical aliases in babel.config.js module-resolver plugin', () => {
    const moduleResolverPlugin = babelConfig.plugins.find(
      p => Array.isArray(p) && p[0] === 'module-resolver',
    );
    expect(moduleResolverPlugin).toBeDefined();

    const aliases = moduleResolverPlugin[1].alias;
    expect(aliases).toBeDefined();

    canonicalAliases.forEach(alias => {
      const expectedTarget = alias.replace(/^@/, './src/');
      expect(aliases[alias]).toBe(expectedTarget);
    });
  });

  it('declares all 5 canonical aliases in jest.config.js moduleNameMapper', () => {
    const mappers = jestConfig.moduleNameMapper;
    expect(mappers).toBeDefined();

    canonicalAliases.forEach(alias => {
      const expectedExactKey = `^${alias}$`;
      const expectedWildcardKey = `^${alias}/(.*)$`;

      const expectedExactTarget = alias.replace(/^@/, '<rootDir>/src/');
      const expectedWildcardTarget =
        alias.replace(/^@/, '<rootDir>/src/') + '/$1';

      expect(mappers[expectedExactKey]).toBe(expectedExactTarget);
      expect(mappers[expectedWildcardKey]).toBe(expectedWildcardTarget);
    });
  });

  it('proves parity: TypeScript, Babel, and Jest resolve every alias to the identical filesystem target', () => {
    const moduleResolverPlugin = babelConfig.plugins.find(
      p => Array.isArray(p) && p[0] === 'module-resolver',
    );
    const babelAliases = moduleResolverPlugin[1].alias;
    const jestMappers = jestConfig.moduleNameMapper;

    canonicalAliases.forEach(alias => {
      const subpath = alias.replace(/^@/, '');

      const tsPath = tsconfig.compilerOptions.paths[alias][0];
      const tsResolvedDir = path.resolve(appRoot, tsPath);

      const babelPath = babelAliases[alias];
      const babelResolvedDir = path.resolve(appRoot, babelPath);

      const jestExactKey = `^${alias}$`;
      const jestPath = jestMappers[jestExactKey].replace('<rootDir>', appRoot);
      const jestResolvedDir = path.resolve(jestPath);

      expect(tsResolvedDir).toBe(babelResolvedDir);
      expect(babelResolvedDir).toBe(jestResolvedDir);
      expect(jestResolvedDir).toBe(path.join(srcRoot, subpath));
    });
  });

  it('proves that TypeScript resolution resolves existing barrels/files via canonical aliases', () => {
    const tsCompilerOptions = ts.convertCompilerOptionsFromJson(
      tsconfig.compilerOptions,
      appRoot,
    ).options;

    const fromFile = path.join(srcRoot, 'app/navigation/AppNavigator.tsx');

    const aliasSamples = [
      {
        alias: '@app/navigation/rootStackRoutes',
        expectedFile: 'src/app/navigation/rootStackRoutes.ts',
      },
      {
        alias: '@features/lesson/player',
        expectedFile: 'src/features/lesson/player/index.ts',
      },
      {
        alias: '@features/review',
        expectedFile: 'src/features/review/index.ts',
      },
      {
        alias: '@ui/components/AppButton',
        expectedFile: 'src/ui/components/AppButton.tsx',
      },
      {alias: '@ui/theme', expectedFile: 'src/ui/theme/index.ts'},
      {alias: '@core/db/database', expectedFile: 'src/core/db/database.ts'},
      {alias: '@core/release', expectedFile: 'src/core/release/index.ts'},
      {alias: '@core/i18n', expectedFile: 'src/core/i18n/index.ts'},
      {alias: '@test/support', expectedFile: 'src/test/support/index.ts'},
    ];

    aliasSamples.forEach(({alias, expectedFile}) => {
      const res = ts.resolveModuleName(
        alias,
        fromFile,
        tsCompilerOptions,
        ts.sys,
      );
      expect(res.resolvedModule).toBeDefined();
      const relative = path
        .relative(appRoot, res.resolvedModule.resolvedFileName)
        .split(path.sep)
        .join('/');
      expect(relative).toBe(expectedFile);
    });
  });
});
