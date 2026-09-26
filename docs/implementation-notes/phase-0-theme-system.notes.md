# Implementation Notes: Phase 0 Theme System

## Task Summary

Implement the centralized theme-driven UI layer for `this repo` per the superpowers theme plan (Tasks 0–16). Goal: semantic tokens, runtime theme switching with AsyncStorage persistence, registry as single source of truth, and migration of three core screens to `App*` components.

## Assumptions

- Proceeding with Phase 0 theme work is the intended next task (superpowers README execution order; no theme code exists yet).
- M5 brief lists full theme iteration as non-blocking polish; superpowers plan is the authoritative implementation guide for this work.
- `jest.setup.js` must be preserved alongside the AsyncStorage mock (plan replaces `jest.config.js` only — merge setup files, do not drop existing setup).
- Commits deferred until user requests (per user git rules); plan step commits noted but not executed automatically.

## Decisions

- Merged AsyncStorage Jest mock into existing `jest.setup.js` via `jest.mock()` instead of replacing `jest.config.js` setupFiles — monorepo hoists deps to root `node_modules`, and the plan's setupFiles-only approach did not mock the module.
- Preserved existing `jest.setup.js` mocks (react-native-config, image-picker, sqlite, navigation).
- Fixed `ThemeProvider.test.tsx` for React 19: ErrorBoundary for throw assertion; `await act()` for async provider mount + storage restore.

## Changes from Spec

- `LessonResultView` migration preserves M4 save/vocab/grammar/pronunciation behavior (plan draft omitted these; kept per M4 brief).
- `PasteTextScreen` keeps navigation + real `analyzeText` flow (plan draft used inline mock result).
- ESLint: `jest.mock()` in `jest.setup.js` instead of plan's `setupFiles`-only AsyncStorage mock (monorepo hoisting).

## Tradeoffs / Risks

- Native rebuild required after AsyncStorage install (`pod install` + rebuild) — not needed for Jest.
- Large plan (16 tasks); will execute incrementally with verification gates.
- ESLint color ban may surface violations on non-migrated screens — scope to plan's allowed paths.

## Files Changed

| File                                                      | Change                                          | Reason                                              |
| --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `package.json`                                            | Add `@react-native-async-storage/async-storage` | Theme persistence                                   |
| `jest.setup.js`                                           | AsyncStorage `jest.mock()`                      | Jest tests for storage/provider                     |
| `src/theme/types.ts`                                      | Create                                          | `AppTheme` token contract                           |
| `src/theme/tokens.ts`                                     | Create                                          | Shared spacing/radius/font scales                   |
| `src/theme/themes/*.ts`                                   | Create (3)                                      | default, dark, pastel-kids themes                   |
| `src/theme/themeRegistry.ts`                              | Create                                          | Single source of truth + release flags              |
| `src/theme/themeStorage.ts`                               | Create                                          | AsyncStorage get/save                               |
| `src/theme/useAppTheme.ts`                                | Create                                          | Context hook                                        |
| `src/theme/ThemeProvider.tsx`                             | Create                                          | Runtime theme + validation                          |
| `src/theme/index.ts`                                      | Create                                          | Public barrel                                       |
| `src/theme/__tests__/*`                                   | Create (3)                                      | Registry, storage, provider tests                   |
| `docs/tasks/current-task.md`                              | Create                                          | Task spec                                           |
| `src/components/*`                                        | Create (5) + tests (2)                          | AppText, AppButton, AppCard, AppScreen, ThemePicker |
| `src/modules/input/PasteTextScreen.tsx`                   | Migrate                                         | Tokens + App\*                                      |
| `src/modules/lesson/LessonResultView.tsx`                 | Migrate                                         | Tokens + App\* (M4 behavior kept)                   |
| `src/modules/settings/ProfileScreen.tsx`                  | Migrate                                         | Tokens + ThemePicker                                |
| `App.tsx`                                                 | Modify                                          | AppThemeProvider wraps navigator                    |
| `.eslintrc.js`                                            | Modify                                          | no-color-literals on components/modules             |
| `src/theme/__tests__/themes.render.test.tsx`              | Create                                          | Parametrized theme render                           |
| Screen tests (4 files)                                    | Modify                                          | Wrap with AppThemeProvider                          |
| `docs/01-ba/03-requirements/05-traceability-matrix.md`    | Update                                          | FR-THEME-001..015 ✅                                |
| `docs/implementation-notes/phase-0-theme-system.notes.md` | Create/update                                   | @impl-notes                                         |

## Tests / Verification

- `npx jest` — 73/73 pass
- `npx eslint src/components src/modules/input/PasteTextScreen.tsx src/modules/lesson/LessonResultView.tsx src/modules/settings/ProfileScreen.tsx` — 0 errors (9 inline-style warnings, expected)
- Migrated screens: no hex color literals (grep clean)
- `npx tsc --noEmit` — pre-existing errors in unrelated files; theme/components pass
- Not yet tested: native rebuild after AsyncStorage (`pod install`); manual TC-024 device theme switch

## Review Notes

- Confirm `ThemePicker` lands on `ProfileScreen` only (not `PasteTextScreen`).
- Confirm `pastel-kids` uses handoff teal/coral/gold palette per plan reconciliation.
- Monetization/entitlement explicitly out of scope (D-003).
