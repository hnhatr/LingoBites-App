# Code conventions

English conventions for the LingoBites-App React Native codebase, written
for LING-137 (see `docs/implementation-notes/LING-137-code-review.md` for
the measured evidence). Every rule below codifies a convention the code
already follows — nothing here invents a new requirement. Each rule states
its enforcement: a tool plus rule id, or "review only". Items the codebase
does not yet satisfy, but must not be renamed or rewritten for unrelated
reasons, are listed as **grandfathered**. The layering authority remains
`docs/architecture/module-boundaries.md` (AD-004); this document does not
override it.

## 1. Prettier

- Format all `ts/tsx/js/json` files with Prettier 2.8.8 and the checked-in
  `.prettierrc.js`. Enforcement: `yarn format:check` (Prettier `--check`).
- Never change `.prettierrc.js`, `.prettierignore`, or the Prettier version
  to make a diff pass — reformat the code instead. Enforcement: review only
  (protected by the LING-137 BR-006 contract).

## 2. ESLint

- `yarn lint` (ESLint plus the boundary and budget checks) must pass with
  zero errors on every head. Enforcement: ESLint (all `error` rules) and CI.
- Warning totals must never exceed `WARNING_BUDGET` in
  `scripts/check-eslint-warning-budget.js`; when a cleanup removes
  warnings, lower the matching budget entries to the real counts in the
  same PR — never raise an entry, never add a rule.
  Enforcement: `yarn lint:budget` (`eslint-comments`, budget script).
- Residual warnings (`no-bitwise`, `has-accessibility-hint`,
  `react-native/no-inline-styles`, the kept `no-void` and
  `react/no-unstable-nested-components`) are documented in the code review
  report with per-file justifications; do not silence them with new
  inline disables. Enforcement: review only.

## 3. Naming

- Component and screen files are PascalCase `.tsx` (e.g.
  `SpeakingRoomScreen.tsx`); hook modules are camelCase with the `use*`
  prefix (e.g. `useYouTubeLessonScreenController.tsx`); test files are
  kebab-case `*.test.ts(x)`. Enforcement: review only.
- Custom hooks always use the `use*` prefix so the hooks lint recognizes
  them. Enforcement: review only (`react-hooks/rules-of-hooks` applies to
  `use*` functions).
- Never rename a file or an exported identifier as drive-by cleanup, and
  never translate an existing comment. Enforcement: review only
  (LING-137 BR-004 contract; diff audits must show no `R` entries).
- Grandfathered: none — the three kebab-case integration tests under
  `src/test/integration/` and the single camelCase hook file above are
  the convention, not exceptions.

## 4. File ordering

- Import order inside `src/**` follows the `simple-import-sort/imports`
  groups: side-effect, `node:`, external, `@app`, `@features`, `@ui`,
  `@core`, `@test`, other aliases, relative. Keep `App.tsx` line 1 as
  `import './src/core/i18n';` (i18n must initialize before components),
  keep side-effect imports in place, and keep `import type` statements
  type-only. Enforcement: ESLint `simple-import-sort/imports` (error,
  autofixable with `eslint src --fix`; a second `--fix` pass must be a
  no-op).
- Cross-module imports (another layer or another feature) use the
  canonical alias (`@app`, `@features`, `@ui`, `@core`, `@test`);
  intra-module imports stay relative. Inside a lesson sub-part, never
  route through a `@features/lesson/...` barrel — import the sibling
  file directly to keep the runtime graph acyclic. Enforcement:
  `yarn lint:boundaries` for layer/barrel violations;
  `simple-import-sort/imports` for ordering; relative-vs-alias choice is
  review only.
- One public barrel `index.ts` per feature, plus the three lesson
  sub-part barrels (`library`, `player`, `packages`); `app` additionally
  imports a feature's `*UiPort` where one exists. Enforcement:
  `yarn lint:boundaries` (`app-to-feature-private`,
  `cross-feature-private`).
- Grandfathered: the four BR-005 paths carry
  `simple-import-sort/imports: off` and stay byte-identical unless their
  owning contract changes — the adversarial db test, practice
  `validator.test.ts`, vendored `validator.ts`, generated
  `bundledPackageData.ts`.

## 5. Component ordering

- Call hooks unconditionally in the same order on every render, before
  any early return. Enforcement: ESLint `react-hooks/rules-of-hooks`
  (error).
- Declare each file's `StyleSheet.create` block once, at the bottom of
  the file, after the component. Enforcement: review only.
- Keep render output a pure function of props, state, theme and hooks;
  do not compute side effects during render. Enforcement: review only.

## 6. JSX

- Use fragment shorthand `<></>` for grouping without a host view, and
  reserve prop spreading for navigator/test plumbing where the callee
  owns the prop contract. Enforcement: review only.
- Never define a component inside another component's render body — the
  single existing case (`AppNavigator.tsx:276`,
  `tabBar={props => <TabBar {...props} />}`) is grandfathered because
  hoisting it would change navigation rendering. Enforcement: ESLint
  `react/no-unstable-nested-components` (warning, budgeted at 1).
- Every interactive element keeps its `accessibilityLabel`; add
  `accessibilityHint` text for new interactive elements, but do not
  rewrite existing a11y strings as drive-by cleanup. Enforcement:
  ESLint `react-native-a11y/has-accessibility-hint` (warning, budgeted;
  existing findings deferred) and the `has-valid-accessibility-*`
  rules (warnings, budgeted at 0).
- Grandfathered: the 84 budgeted `has-accessibility-hint` findings
  listed in the code review report.

## 7. StyleSheet

- Static style objects live in a same-file `StyleSheet.create` entry;
  inline `style={{...}}` is reserved for styles that read props, state,
  theme or insets. When converting, keep exactly the keys and literal
  values and keep the entry's position in any style array (override
  precedence must not change). Enforcement: ESLint
  `react-native/no-inline-styles` (warning, budgeted) for the residual;
  conversion equivalence is review only.
- No color literals in `src/ui/components/**`, `src/ui/icons/**` and
  `src/features/**` — use theme tokens. Enforcement: ESLint
  `react-native/no-color-literals` (error, 0 violations).
- Grandfathered: the 64 budgeted dynamic inline styles listed in the
  code review report.

## 8. TypeScript

- `tsc --noEmit` (`yarn typecheck`) must pass; the project compiles
  under `"strict": true` (via `@react-native/typescript-config`).
  Enforcement: `yarn typecheck` and CI.
- Prefer precise types over `any`; prefer narrowing or an explicit
  `undefined` return over a non-null assertion. Neither `any` nor `!`
  is machine-enforced in this codebase, so new uses are review only —
  keep them minimal and local.
- Keep `import type` statements type-only (Babel erases them); never
  convert one to a value import during reorder. Enforcement: review only
  (ordering enforced by `simple-import-sort/imports`).
- No shadowing, no `= undefined` initializers. Enforcement: ESLint
  `@typescript-eslint/no-shadow` and `no-undef-init` (warnings budgeted
  at 0).

## 9. Hooks

- Respect the rules of hooks (unconditional, top-level calls) and list
  every reactive value a callback or effect reads in its dependency
  array. Enforcement: ESLint `react-hooks/rules-of-hooks` and
  `react-hooks/exhaustive-deps` (both error, 0 violations).
- Do not add `void` expressions: in an arrow body, `void p()` returns
  `undefined` while a bare `p()` returns its Promise (e.g. an effect
  cleanup must never return a Promise). The one grandfathered use
  (EC-005, in the former `UnifiedLessonGenerationScreen.tsx`) left with
  that file in LING-149; no `void` remains in `src/`. Enforcement:
  ESLint `no-void` (warning, budget still 1); return-equivalence is
  review only.

## 10. Import ordering

(Same rule as "File ordering" topic 4 — stated once, referenced here so
each of the 12 topics has its section.)

- Import order inside `src/**` follows the `simple-import-sort/imports`
  groups: side-effect, `node:`, external, `@app`, `@features`, `@ui`,
  `@core`, `@test`, other aliases, relative. Enforcement: ESLint
  `simple-import-sort/imports` (error, autofixable).
- Cross-module imports use the canonical alias; intra-module imports
  stay relative; never route inside a lesson sub-part through a
  `@features/lesson/...` barrel. Enforcement: `yarn lint:boundaries`
  plus review only for the alias-vs-relative choice.
- Grandfathered: the four BR-005 `simple-import-sort/imports: off`
  paths (see topic 4), and the 90 files / 105 occurrences of
  intra-module `../../../` imports listed in the code review report,
  which stay relative per the intra-module rule.

## 11. Comments

- Write new comments in English; never translate the existing
  Vietnamese comments. Enforcement: review only (LING-137 BR-004
  contract).
- Keep `TODO`/`FIXME`/`HACK`/`XXX` tags rare and actionable; only 10
  such lines remain. Enforcement: review only
  (`jest/no-disabled-tests` covers disabled tests, budgeted at 0 —
  it does not cover prose TODOs).
- Do not add `eslint-disable` comments to silence a budgeted warning;
  fix the code or document the residual in the review report instead.
  Enforcement: ESLint `eslint-comments/no-unused-disable` (warning,
  budgeted at 0).

## 12. Platform

- Branch per platform with the explicit `Platform.OS` / `Platform.select`
  API; never fork files with `.ios.` / `.android.` extensions (none
  exist today). Enforcement: review only.
- Keep platform branches narrow and co-located with the component that
  needs them (27 references in 11 files today). Enforcement: review only.
