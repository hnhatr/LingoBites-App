const path = require('path');

const {
  checkModuleBoundaries,
  findImportsInSource,
  loadExceptionManifest,
} = require('../check-module-boundaries');

const appRoot = path.resolve(__dirname, '../..');

describe('check-module-boundaries (legacy checker baseline)', () => {
  it('passes on current production source with zero new violations', () => {
    const result = checkModuleBoundaries();
    expect(result.passed).toBe(true);
    expect(result.newViolations).toHaveLength(0);
  });

  it('exposes a readable exception manifest', () => {
    const manifest = loadExceptionManifest(
      path.join(appRoot, 'scripts/module-boundary-exceptions.json'),
    );
    expect(manifest.rawParsed).toBeDefined();
  });

  it('captures static imports, exports, and literal requires', () => {
    const code =
      "import {foo} from '@shared/db';\n" +
      "export {bar} from './bar';\n" +
      "const baz = require('@components/Button');\n";
    const {literalImports, nonLiteralImports} = findImportsInSource(
      'src/test.ts',
      code,
    );
    expect(literalImports).toHaveLength(3);
    expect(nonLiteralImports).toHaveLength(0);
  });

  it('flags dynamic and non-literal require/import for manual review', () => {
    const code =
      "const dynamicPath = './dynamic/' + name;\n" +
      'const mod = require(dynamicPath);\n' +
      'import(someFunc());\n';
    const {literalImports, nonLiteralImports} = findImportsInSource(
      'src/dynamic.ts',
      code,
    );
    expect(literalImports).toHaveLength(0);
    expect(nonLiteralImports).toHaveLength(2);
  });
});
