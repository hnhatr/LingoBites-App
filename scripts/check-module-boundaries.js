#!/usr/bin/env node

/**
 * Enforce the source dependency direction documented in
 * docs/architecture/module-boundaries.md according to AD-004.
 *
 * Uses TypeScript AST and module resolution to check imports/exports.
 * Checks production source only; test code and test-support are excluded
 * from production build and tested separately.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(appRoot, 'src');
const defaultManifestPath = path.join(
  __dirname,
  'module-boundary-exceptions.json',
);

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const assetExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.json',
  '.ttf',
  '.otf',
  '.webp',
  '.mp3',
  '.wav',
];

function loadCompilerOptions(rootDir = appRoot) {
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return {};
  }
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Error reading tsconfig.json: ${configFile.error.messageText}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    rootDir,
  );
  return parsed.options;
}

function walkSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Exclude test folders and test-support from production scanning
      if (
        entry.name === '__tests__' ||
        entry.name === 'test-support' ||
        entry.name === 'test' ||
        entry.name === 'test-utils'
      ) {
        return [];
      }
      return walkSourceFiles(entryPath);
    }
    if (!sourceExtensions.includes(path.extname(entry.name))) return [];
    if (/(\.test\.|\.spec\.)/.test(entry.name)) return [];
    return [entryPath];
  });
}

function normalizePath(filePath) {
  return path.relative(appRoot, filePath).split(path.sep).join('/');
}

function sourceLayer(filePath, srcRoot = sourceRoot) {
  const relative = path.relative(srcRoot, filePath).split(path.sep).join('/');
  if (relative.startsWith('..')) {
    return {layer: 'external', feature: null, rel: relative};
  }
  const parts = relative.split('/');
  const layer = parts[0];
  const feature = layer === 'modules' ? parts[1] || null : null;
  return {layer, feature, rel: relative};
}

function findImportsInSource(filePath, content) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const literalImports = [];
  const nonLiteralImports = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          literalImports.push({
            specifier: node.moduleSpecifier.text,
            line,
            kind: ts.isImportDeclaration(node) ? 'import' : 'export',
          });
        } else {
          nonLiteralImports.push({
            expression: node.moduleSpecifier.getText(sourceFile),
            line,
            kind: 'non-literal-module-specifier',
          });
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const line =
        sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (
        node.moduleReference &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        literalImports.push({
          specifier: node.moduleReference.expression.text,
          line,
          kind: 'import-equals',
        });
      }
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          literalImports.push({
            specifier: arg.text,
            line,
            kind: isDynamicImport ? 'dynamic-import' : 'require',
          });
        } else if (arg) {
          nonLiteralImports.push({
            expression: arg.getText(sourceFile),
            line,
            kind: isDynamicImport
              ? 'non-literal-import'
              : 'non-literal-require',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {literalImports, nonLiteralImports};
}

function resolveSpecifier(
  specifier,
  containingFile,
  compilerOptions,
  _srcRoot = sourceRoot,
) {
  const ext = path.extname(specifier).toLowerCase();
  if (assetExtensions.includes(ext)) {
    return {resolvedFileName: specifier, isAsset: true};
  }

  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
  );
  if (result && result.resolvedModule) {
    return {
      resolvedFileName: result.resolvedModule.resolvedFileName,
      isExternal: Boolean(result.resolvedModule.isExternalLibraryImport),
      isAsset: false,
    };
  }

  // Handle fallback relative resolution if file exists
  if (specifier.startsWith('.')) {
    const resolvedPath = path.resolve(path.dirname(containingFile), specifier);
    const resolvedExt = path.extname(resolvedPath).toLowerCase();
    if (assetExtensions.includes(resolvedExt)) {
      return {resolvedFileName: resolvedPath, isAsset: true};
    }
  }

  return null;
}

function checkImportRules(
  fromFile,
  importItem,
  resolvedTarget,
  srcRoot = sourceRoot,
) {
  if (!resolvedTarget || resolvedTarget.isAsset || resolvedTarget.isExternal) {
    return [];
  }

  const targetFile = resolvedTarget.resolvedFileName;
  const source = sourceLayer(fromFile, srcRoot);
  const target = sourceLayer(targetFile, srcRoot);

  if (target.layer === 'external') {
    return [];
  }

  const violations = [];
  const specifier = importItem.specifier;
  const line = importItem.line;

  // Rule: production-to-test
  if (
    target.layer === 'test-support' ||
    /(__tests__|\.test\.|\.spec\.)/.test(targetFile)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'production-to-test',
      description: 'production code must not import test-support or test files',
    });
    return violations;
  }

  // Rule: shared-to-module
  if (source.layer === 'shared' && target.layer === 'modules') {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'shared-to-module',
      description: 'shared must not depend on feature modules',
    });
  }

  // Rule: shared-to-app
  if (source.layer === 'shared' && target.layer === 'app') {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'shared-to-app',
      description: 'shared must not depend on app composition',
    });
  }

  // Rule: components-to-module
  if (source.layer === 'components' && target.layer === 'modules') {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'components-to-module',
      description: 'components must not depend on feature modules',
    });
  }

  // Rule: components-to-app
  if (source.layer === 'components' && target.layer === 'app') {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'components-to-app',
      description: 'components must not depend on app composition',
    });
  }

  // Rule: cross-feature-private
  if (
    source.layer === 'modules' &&
    target.layer === 'modules' &&
    source.feature !== target.feature
  ) {
    const parts = target.rel.split('/');
    const isPublicBarrel =
      (parts.length === 3 && parts[2].startsWith('index.')) ||
      specifier === `@modules/${target.feature}`;
    if (!isPublicBarrel) {
      violations.push({
        file: normalizePath(fromFile),
        specifier,
        line,
        rule: 'cross-feature-private',
        description:
          'cross-feature imports must use the target feature barrel (@modules/<feature>)',
      });
    }
  }

  // Rule: feature-to-app
  if (source.layer === 'modules' && target.layer === 'app') {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'feature-to-app',
      description: 'feature modules must not depend on app composition',
    });
  }

  // Rule: app-to-module-private
  if (source.layer === 'app' && target.layer === 'modules') {
    const parts = target.rel.split('/');
    const isPublicBarrel =
      (parts.length === 3 && parts[2].startsWith('index.')) ||
      specifier === `@modules/${target.feature}`;
    if (!isPublicBarrel) {
      violations.push({
        file: normalizePath(fromFile),
        specifier,
        line,
        rule: 'app-to-module-private',
        description:
          'app composition must import feature public surface (@modules/<feature>)',
      });
    }
  }

  // Rule: theme-boundary
  if (
    source.layer === 'theme' &&
    ['modules', 'app', 'components'].includes(target.layer)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'theme-boundary',
      description: `theme must not depend on ${target.layer}`,
    });
  }

  // Rule: release-boundary
  if (
    source.layer === 'release' &&
    ['modules', 'app', 'components', 'shared', 'theme'].includes(target.layer)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'release-boundary',
      description: `release must not depend on ${target.layer}`,
    });
  }

  // Rule: i18n-boundary
  if (
    source.layer === 'i18n' &&
    ['modules', 'app', 'components', 'shared', 'theme'].includes(target.layer)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'i18n-boundary',
      description: `i18n must not depend on ${target.layer}`,
    });
  }

  // Rule: contracts-boundary
  if (
    source.layer === 'contracts' &&
    [
      'modules',
      'app',
      'components',
      'shared',
      'theme',
      'release',
      'i18n',
    ].includes(target.layer)
  ) {
    violations.push({
      file: normalizePath(fromFile),
      specifier,
      line,
      rule: 'contracts-boundary',
      description: `contracts must not depend on ${target.layer}`,
    });
  }

  return violations;
}

function loadExceptionManifest(manifestPath = defaultManifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return {exceptions: [], byKey: new Map()};
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  const exceptions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.exceptions)
    ? parsed.exceptions
    : [];

  const byKey = new Map();
  exceptions.forEach((entry, index) => {
    if (!entry.file || !entry.specifier || !entry.rule) {
      throw new Error(
        `Invalid manifest entry at index ${index}: missing file, specifier, or rule`,
      );
    }
    const key = `${entry.file}::${entry.specifier}::${entry.rule}`;
    byKey.set(key, entry);
  });

  return {exceptions, byKey, rawParsed: parsed};
}

function checkModuleBoundaries(options = {}) {
  const rootDir = options.rootDir || appRoot;
  const srcDir = options.sourceDir || path.join(rootDir, 'src');
  const manifestPath = options.manifestPath || defaultManifestPath;
  const compilerOptions =
    options.compilerOptions || loadCompilerOptions(rootDir);

  const manifest = loadExceptionManifest(manifestPath);
  const files = options.files || walkSourceFiles(srcDir);

  const detectedViolations = [];
  const manualReviewItems = [];
  const matchedExceptions = [];
  const newViolations = [];
  const expiredExceptions = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const {literalImports, nonLiteralImports} = findImportsInSource(
      filePath,
      content,
    );

    for (const nonLit of nonLiteralImports) {
      manualReviewItems.push({
        file: normalizePath(filePath),
        line: nonLit.line,
        expression: nonLit.expression,
        kind: nonLit.kind,
      });
    }

    for (const imp of literalImports) {
      const resolved = resolveSpecifier(
        imp.specifier,
        filePath,
        compilerOptions,
        srcDir,
      );
      const violations = checkImportRules(filePath, imp, resolved, srcDir);
      for (const violation of violations) {
        detectedViolations.push(violation);

        const key = `${violation.file}::${violation.specifier}::${violation.rule}`;
        const manifestEntry = manifest.byKey.get(key);

        if (manifestEntry) {
          // Check if expired (ISO date format YYYY-MM-DD)
          if (
            manifestEntry.expiry &&
            /^\d{4}-\d{2}-\d{2}/.test(manifestEntry.expiry)
          ) {
            const expiryDate = Date.parse(manifestEntry.expiry);
            if (!Number.isNaN(expiryDate) && Date.now() > expiryDate) {
              expiredExceptions.push({
                ...violation,
                owner: manifestEntry.owner,
                expiry: manifestEntry.expiry,
              });
              newViolations.push({
                ...violation,
                reason: `Exception expired at ${manifestEntry.expiry}`,
              });
              continue;
            }
          }
          matchedExceptions.push({
            ...violation,
            owner: manifestEntry.owner,
            expiry: manifestEntry.expiry,
          });
        } else {
          newViolations.push(violation);
        }
      }
    }
  }

  const passed = newViolations.length === 0;

  return {
    passed,
    detectedViolations,
    matchedExceptions,
    newViolations,
    expiredExceptions,
    manualReviewItems,
    manifestTotal: manifest.exceptions.length,
    manifestPath,
  };
}

function runCli() {
  const result = checkModuleBoundaries();

  if (result.manualReviewItems.length > 0) {
    console.log(
      `[MANUAL REVIEW] ${result.manualReviewItems.length} non-literal import(s) detected:`,
    );
    for (const item of result.manualReviewItems) {
      console.log(
        `  ${item.file}:${item.line} ${item.kind}: ${item.expression}`,
      );
    }
  }

  if (result.newViolations.length > 0) {
    console.error(
      `Module boundary check failed: ${result.newViolations.length} new violation(s) found!`,
    );
    for (const v of result.newViolations) {
      console.error(
        `${v.file}:${v.line} imports ${v.specifier} — [${v.rule}] ${
          v.description || v.reason || ''
        }`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Module boundary check passed with zero new violations. (${result.matchedExceptions.length} active baseline exceptions allowed via manifest).`,
  );
}

if (require.main === module) {
  runCli();
}

module.exports = {
  checkModuleBoundaries,
  findImportsInSource,
  resolveSpecifier,
  sourceLayer,
  loadCompilerOptions,
  loadExceptionManifest,
  normalizePath,
};
