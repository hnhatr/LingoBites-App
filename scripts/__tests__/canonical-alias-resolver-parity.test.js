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

  it('declares all 5 canonical aliases identically in tsconfig paths', () => {
    const paths = tsconfig.compilerOptions.paths;
    canonicalAliases.forEach(alias => {
      expect(paths[alias]).toBeDefined();
      expect(paths['' + alias + '/*']).toBeDefined();
    });
  });

  it('declares all 5 canonical aliases in babel.config.js module-resolver', () => {
    const plugin = babelConfig.plugins.find(
      p => Array.isArray(p) && p[0] === 'module-resolver',
    );
    canonicalAliases.forEach(alias => {
      expect(plugin[1].alias[alias]).toBe(alias.replace(/^@/, './src/'));
    });
  });

  it('declares all 5 canonical aliases in jest.config.js moduleNameMapper', () => {
    const mappers = jestConfig.moduleNameMapper;
    canonicalAliases.forEach(alias => {
      expect(mappers['^' + alias + '$']).toBe(
        alias.replace(/^@/, '<rootDir>/src/'),
      );
      expect(mappers['^' + alias + '/(.*)$']).toBe(
        alias.replace(/^@/, '<rootDir>/src/') + '/$1',
      );
    });
  });

  it('resolves declared aliases that have an existing target', () => {
    const opts = ts.convertCompilerOptionsFromJson(
      tsconfig.compilerOptions,
      appRoot,
    ).options;
    const fromFile = path.join(srcRoot, 'app/navigation/AppNavigator.tsx');
    const samples = [
      {
        alias: '@app/navigation/rootStackRoutes',
        expected: 'src/app/navigation/rootStackRoutes.ts',
      },
      {alias: '@ui/theme', expected: 'src/ui/theme/index.ts'},
    ];
    samples.forEach(({alias, expected}) => {
      const res = ts.resolveModuleName(alias, fromFile, opts, ts.sys);
      expect(res.resolvedModule).toBeDefined();
      const rel = path
        .relative(appRoot, res.resolvedModule.resolvedFileName)
        .split(path.sep)
        .join('/');
      expect(rel).toBe(expected);
    });
  });
});
