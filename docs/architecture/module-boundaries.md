# Module dependency boundaries

This is the source-of-truth rule for the React Native app's `src/modules`,
`src/shared`, and `src/components` directories. The automated check is
`yarn lint:boundaries` and is also part of `yarn lint`.

## Direction and public APIs

The dependency direction is:

```text
app/navigation, store, data, services
        ↓
feature modules (`src/modules/<feature>`)
        ↓
shared infrastructure (`src/shared`) and reusable UI (`src/components`)
```

- `modules/<feature>` owns feature behavior. A feature may import shared
  infrastructure and components, and may use another feature only through its
  barrel: `@modules/<feature>`. A cross-feature deep import such as
  `@modules/content/runtime/contentAudioPlayer` is a violation.
- Each feature's `index.ts` is its public API. Files below a feature are
  private implementation unless exported by that barrel. Relative imports
  within the same feature are allowed.
- `shared` owns cross-cutting infrastructure and contracts. It must not gain
  new dependencies on feature modules.
- `components` owns reusable UI. Components must not depend on feature modules
  or app orchestration. Existing component paths are the public component
  surface because this repository intentionally has no components barrel.
- `app/navigation`, `store`, `data`, and `services` are composition/application
  code and may consume public feature APIs, shared modules, and components.
- Tests are excluded from the production boundary scan so they can use private
  fixtures and setup helpers. Production code remains subject to the rules.

## Existing scoped exceptions

An existing shared repository/type edge is retained as an explicit exception
until its contract can be moved without introducing a speculative layer:

- `src/shared/db/FlashcardRepository.ts` → `@modules/review`

The checker allowlists these exact source/import pairs. Any new `shared` →
`modules` edge fails lint and must either be removed or be approved as a
similarly narrow, documented exception.
