# Implementation Notes: Phase 1 UI Handoff

## Task Summary

Apply HTML handoff UI on completed theme layer: components, TabBar, screen migrations, ESLint pass. Preserve real M2–M4 services.

## Assumptions

- M4 `LessonRepository` remains persistence source; `useLibraryStore` holds UI search/filter only.
- `useScanStore` models async job state; screens may keep direct service calls at seams with TODO markers.
- Typography presets added to `AppTheme`; full surface tier palette deferred unless a component needs it.

## Decisions

- `useLibraryStore` is search/filter UI only; `LessonRepository` (M4) remains persistence source.
- `services/ai.ts` wraps existing `analyzeText` — real M2 path preserved, not mock-only.
- Extended `AppTheme` with `typography.presets`, `gutter`, `surfaceMuted`, `secondary`, `secondaryContainer`.
- Custom `TabBar` with Vietnamese labels (Trang chủ / Bài học / Hồ sơ).

## Changes from Spec

- UI spec assumed mock-only services; app keeps real AI/OCR/SQLite (M2–M4 shipped).
- `useScanStore` implemented + tested; screens still call services directly at navigation seams (store ready for consolidation).

## Tradeoffs / Risks

- Large surface area; unmigrated screens block full-module ESLint until Task 9 complete.

## Files Changed

| File                                                             | Change  | Reason                              |
| ---------------------------------------------------------------- | ------- | ----------------------------------- |
| `src/theme/types.ts`, `tokens.ts`, `themes/*`                    | Extend  | Handoff presets + semantic colors   |
| `src/components/*` (15+)                                         | Create  | Handoff building blocks + ErrorCard |
| `src/app/navigation/TabBar.tsx`                                  | Create  | Token-driven 3-tab bar              |
| `src/types/*`, `src/store/*`, `src/services/ai.ts`, `src/data/*` | Create  | Async types, stores, AI seam, mocks |
| `src/modules/**` (10 screens)                                    | Migrate | Tokens + App\* + handoff components |
| Screen/component tests                                           | Update  | AppThemeProvider wrappers           |

## Tests / Verification

- `npx jest` — 81/81 pass
- `npx eslint src/components src/modules` — 0 errors (52 inline-style/no-void warnings)
- No hex color literals in `src/modules` (grep clean)

## Review Notes

- Task 10: traceability §3 UI handoff table + ship tracker §7b added (2026-06-05).
- Only remaining UI/theme gate: **manual TC-024** on device (ThemePicker → all tabs/screens).
- Product §2 FR Must rows unchanged — UI handoff does not substitute TC-001..023 device QA.
