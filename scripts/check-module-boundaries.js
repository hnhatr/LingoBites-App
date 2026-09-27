#!/usr/bin/env node

/**
 * Enforce the source dependency direction documented in
 * docs/architecture/module-boundaries.md.
 *
 * This intentionally uses the import paths already understood by TypeScript
 * and Babel rather than adding an ESLint dependency for a small, project-local
 * rule. It checks production source only; tests may import private fixtures.
 */

const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(appRoot, 'src');
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];

const sharedModuleExceptions = new Map([
  ['src/shared/db/ContentPackageRepository.ts', ['@modules/content']],
  ['src/shared/db/ContentRuntimeRepository.ts', ['@modules/content']],
  [
    'src/shared/db/FlashcardRepository.ts',
    ['@modules/engagement', '@modules/review'],
  ],
  ['src/shared/db/types.ts', ['@modules/content']],
]);

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    if (!sourceExtensions.includes(path.extname(entry.name))) return [];
    if (/(__tests__|\.test\.|\.spec\.)/.test(entryPath)) return [];
    return [entryPath];
  });
}

function normalizeSourcePath(filePath) {
  return path.relative(appRoot, filePath).split(path.sep).join('/');
}

function resolveImport(fromFile, importPath) {
  if (importPath === '@shared' || importPath.startsWith('@shared/')) {
    return path.join(sourceRoot, 'shared', importPath.slice('@shared'.length));
  }
  if (importPath === '@modules' || importPath.startsWith('@modules/')) {
    return path.join(
      sourceRoot,
      'modules',
      importPath.slice('@modules'.length),
    );
  }
  if (importPath === '@components' || importPath.startsWith('@components/')) {
    return path.join(
      sourceRoot,
      'components',
      importPath.slice('@components'.length),
    );
  }
  if (importPath === '@' || importPath.startsWith('@/')) {
    return path.join(sourceRoot, importPath.slice(1));
  }
  if (!importPath.startsWith('.')) return null;
  return path.resolve(path.dirname(fromFile), importPath);
}

function sourceLayer(filePath) {
  const relative = path
    .relative(sourceRoot, filePath)
    .split(path.sep)
    .join('/');
  const [layer, feature] = relative.split('/');
  return {layer, feature};
}

function isSharedException(fromFile, importPath) {
  const allowed = sharedModuleExceptions.get(normalizeSourcePath(fromFile));
  return allowed?.includes(importPath) ?? false;
}

function violationsFor(fromFile, importPath, lineNumber) {
  const targetFile = resolveImport(fromFile, importPath);
  if (!targetFile) return [];

  const source = sourceLayer(fromFile);
  const target = sourceLayer(targetFile);
  if (!['modules', 'shared', 'components'].includes(target.layer)) return [];

  const violations = [];
  if (
    source.layer === 'shared' &&
    target.layer === 'modules' &&
    !isSharedException(fromFile, importPath)
  ) {
    violations.push('shared must not depend on feature modules');
  }
  if (
    source.layer === 'components' &&
    target.layer !== 'shared' &&
    target.layer !== 'components' &&
    target.layer !== 'theme'
  ) {
    violations.push('components must not depend on app or feature modules');
  }
  if (
    source.layer === 'modules' &&
    target.layer === 'modules' &&
    source.feature !== target.feature
  ) {
    const targetRelativePath = path
      .relative(sourceRoot, targetFile)
      .split(path.sep)
      .join('/');
    if (targetRelativePath.split('/').length !== 2) {
      violations.push(
        'cross-feature imports must use the target feature barrel (@modules/<feature>)',
      );
    }
  }
  return violations.map(rule => ({fromFile, importPath, lineNumber, rule}));
}

const importPattern =
  /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|(?:require)\(\s*['"]([^'"]+)['"]\s*\)/g;
const violations = [];
for (const filePath of walk(sourceRoot)) {
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const match of contents.matchAll(importPattern)) {
    const importPath = match[1] || match[2];
    const lineNumber = contents.slice(0, match.index).split('\n').length;
    violations.push(...violationsFor(filePath, importPath, lineNumber));
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${normalizeSourcePath(violation.fromFile)}:${
        violation.lineNumber
      } imports ${violation.importPath} — ${violation.rule}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log('Module boundary check passed.');
}
