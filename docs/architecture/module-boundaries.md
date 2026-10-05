# Module dependency boundaries

This is the source-of-truth rule for the React Native app's `src/` layering,
governed by Technical Design AD-004. The automated check is
`yarn lint:boundaries` (`scripts/check-module-boundaries.js`), which is also
enforced as part of `yarn lint`.

## Layers and dependency direction

`src/` is organised into five top-level directories:

```text
src/
├── app/       # composition/lifecycle only: App root, navigation, providers
├── features/  # feature modules; one folder per feature
├── ui/        # design system: components, icons, theme, assets
├── core/      # infrastructure: api, auth, db, contracts, release, i18n, ...
└── test/      # test support and cross-feature integration tests
```

Imports may only go **down** this list:

```text
app -> features -> ui -> core
```

| Source layer | May import | Forbidden |
|---|---|---|
| `app` | `features` (public), `ui`, `core` | feature private paths; `test` |
| `features` | own private files; other features via their public barrel; `ui`; `core` | `app`; other-feature private paths; `test` |
| `ui` | `ui`, `core` | `app`, `features`, `test` |
| `core` | `core` | `app`, `features`, `ui`, `test` |
| `test` | any public surface | production may never import `test` |

- Production code (anything outside `src/test`) must never import `test/`,
  test-support or test files.
- An "upward" import (for example `core -> features`, `ui -> app`) fails the
  checker with a `<source>-to-<target>` rule id.

## Features and public surfaces

Each feature lives at `src/features/<feature>/`:

- `index.ts` — the only public entry point for other layers/features.
- `screens/`, `components/`, `logic/` — created only when non-empty.

Every other file below a feature is private: cross-feature deep imports
(alias or relative) fail with the `cross-feature-private` rule. The `lesson`
feature is split into three public sub-parts:

```text
src/features/lesson/
├── index.ts             # export * from './library' | './player' | './packages'
├── library/index.ts     # public sub-part barrel
├── player/index.ts      # public sub-part barrel
└── packages/index.ts    # public sub-part barrel
```

Cross-feature and app imports of a lesson sub-part use
`@features/lesson/<part>`. Importing `@features/lesson/...` from inside a
sub-part is avoided to keep the runtime import graph acyclic.

`app` may additionally import a feature's explicit UI port
`features/<feature>/screens/*UiPort.ts(x)` (DEC-3).

## Canonical aliases and resolver parity

Five canonical aliases are synchronised identically across TypeScript
(`tsconfig.json`), Babel (`babel.config.js`) and Jest (`jest.config.js`):

- `@app` → `src/app`
- `@features` → `src/features`
- `@ui` → `src/ui`
- `@core` → `src/core`
- `@test` → `src/test`

Legacy aliases (`@/…`, `@modules`, `@shared`, `@components`, `@theme`,
`@release`, `@i18n`, `@contracts`, `@test-support`) and the LING-119 shims were
removed in the LING-121 restructure.

## Automated checker and baseline manifest

`scripts/check-module-boundaries.js` uses TypeScript AST parsing
(`ts.createSourceFile`) and module resolution (`ts.resolveModuleName`) to
inspect static import/export and literal `require`/`import` statements across
production code. Non-literal/dynamic imports are reported for manual review.

Rules enforced:

- upward imports between ranked layers (`core-to-features`, `core-to-app`,
  `core-to-ui`, `ui-to-features`, `ui-to-app`, `features-to-app`);
- `app-to-feature-private` — app must use a feature barrel or a `*UiPort`;
- `cross-feature-private` — cross-feature imports must use the target barrel;
- `production-to-test`.
- `feature-navigation-get-parent` — feature code must not call
  `.getParent(...)`; it navigates through `useAppNavigation()` intents
  (see [`navigation.md`](./navigation.md));
- `navigation-untyped-route` — no `navigate(<route> as any, ...)`.

Baseline exceptions are stored in `scripts/module-boundary-exceptions.json`.
After the LING-121 restructure the manifest is empty
(`{"exceptions": []}`): the checker enforces zero violations with no
exceptions. The Integration Owner is the sole future writer of this manifest.
Any violation not matching an active entry fails immediately
("zero new violations").
