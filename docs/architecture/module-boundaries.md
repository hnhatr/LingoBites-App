# Module dependency boundaries

This is the source-of-truth rule for the React Native app's `src/modules`,
`src/shared`, `src/components`, `src/contracts`, `src/app`, and supporting layers,
governed by Technical Design AD-004. The automated check is `yarn lint:boundaries`
and is also enforced as part of `yarn lint`.

## Canonical Aliases and Resolver Parity

Nine canonical aliases are synchronized identically across TypeScript (`tsconfig.json`),
Babel (`babel.config.js`), and Jest (`jest.config.js`):

- `@app` → `src/app`
- `@contracts` → `src/contracts`
- `@modules` → `src/modules`
- `@shared` → `src/shared`
- `@components` → `src/components`
- `@theme` → `src/theme`
- `@release` → `src/release`
- `@i18n` → `src/i18n`
- `@test-support` → `src/test-support`

The legacy `@/*` alias is retained during migration but will be eliminated in future cohorts.

## Target Dependency Matrix (AD-004)

```text
src/
├── app/{bootstrap,navigation,providers}/     # composition/lifecycle only
├── contracts/{navigation,release}/           # shell contracts; no feature runtime
├── modules/<feature>/                        # feature modules (17 names)
│   ├── index.ts                              # only cross-boundary entry
│   └── {api,data,domain,hooks,screens,components}/
├── shared/{api,db,auth,identity,localData,security,errors,types,utils}/
├── components/{*.tsx,layout,feedback}/       # reusable UI; first-level files public
├── theme/  release/  i18n/  assets/
└── test-support/                             # tests only
```

| Source Layer | May Import | Forbidden / Qualification |
|---|---|---|
| `app` | contracts; module Public; shared; components; theme/release/i18n | module Private; test-support |
| `contracts` | self; external type-only | app/modules/components/native runtime |
| `modules/<feature>` | `<feature>` Private/relative; other module Public; contracts/shared/components/theme/release/i18n | app; other module Private; test-support |
| `shared` | shared; i18n Public where current error text requires it | app/modules/components/test-support; domain behavior after owner cohort |
| `components` | components; shared types/utils; theme/release/i18n | app/modules/test-support |
| `theme` | theme; release Public | app/modules/components/test-support |
| `release`, `i18n` | self only plus external packages | app/modules/components/test-support |
| `test-support`, tests | any public surface; same-feature Private/fixtures | production may never import test-support/fixture |

- Each feature's root `index.ts` (accessed via canonical `@modules/<feature>` or relative sibling barrel) is its only public API. All other files below a feature—including `index.private.ts` or deep paths—are strictly Private implementation. Relative imports within the same feature are allowed.
- Cross-feature deep or private imports (e.g. `@modules/content/runtime/...`, `@modules/review/index.private`) are strictly forbidden.
- App composition must only import feature public surfaces via `@modules/<feature>`.
- Production code must never import `src/test-support`, test fixtures, or test files.

## Automated Checker and Baseline Exception Manifest

`scripts/check-module-boundaries.js` uses TypeScript AST parsing (`ts.createSourceFile`)
and module resolution (`ts.resolveModuleName`) to inspect static import/export and
literal require/import statements across production code. Non-literal/dynamic imports
are reported for manual review.

Baseline exceptions are stored in `scripts/module-boundary-exceptions.json`:
- Each entry defines `file`, `specifier`, `rule`, `owner`, and `expiry`.
- The Integration Owner is the sole future writer of this manifest.
- Existing exceptions in this foundation cohort cover pre-existing `feature-to-app`
  and `app-to-module-private` navigation imports expiring in TASK-003.
- Manifest entries enforce exact occurrence limits per `file::specifier::rule`: each entry permits exactly one violation occurrence. Surplus occurrences beyond the baseline allowance immediately fail the checker.
- Any violation not matching an active entry in the manifest immediately fails the
  checker ("zero new violations").
- Subsequent cohorts (TASK-003, Wave 4 domain ownership, etc.) ratchet the manifest
  down to zero.
