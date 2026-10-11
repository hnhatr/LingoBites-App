# LingoBites Mobile UI — Implementation Plan (skeleton)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.
> Expand each task with failing tests + code snippets before implementation (follow theme plan style).

**Goal:** Implement the Phase 0 mobile UI shell from the HTML handoff — token-driven components, 3-tab navigation, mock domain state — **on top of** the completed theme layer. Preserve D-002 (3 tabs, single-scroll lesson, native image picker).

**Prerequisites (hard gate):**

- [ ] `plans/2026-06-05-theme-system.md` Done criteria **all** checked (Tasks 0–16).
- [ ] `AppThemeProvider` wraps `AppNavigator`; `ThemePicker` on `ProfileScreen` only.
- [ ] `PasteTextScreen`, `LessonResultView`, `ProfileScreen` already use `App*` + tokens.

**Do not re-implement:** `theme/*`, registry, Provider, base `AppText`/`AppButton`/`AppCard`/`AppScreen`/`ThemePicker`.

**Source specs:**

- `docs/superpowers/specs/2026-06-05-lingobites-ui-design.md` (authoritative UI scope)
- `docs/01-ba/06-design/04-html-handoff-to-code-spec.md` §7 (visual tokens)
- `docs/01-ba/06-design/01-user-flow-screen-spec.md` §13 (empty/error copy)
- `docs/01-ba/01-schema/01-ai-output-v1.ts` (lesson content — no invented fields)

**Tech stack:** React Native CLI, React Navigation v6, Zustand, existing `validateAIOutput()`, theme from Phase 0.

---

## File structure (create / modify)

**Create:**

- `src/types/async.ts` — `Async<T>` union (UI spec §6)
- `src/types/lesson.ts` — library card view types
- `src/data/mockLessons.ts`, `mockLibrary.ts`
- `src/store/useScanStore.ts`, `useLibraryStore.ts`
- `src/services/ai.ts` — mock wrapper (TODO real API at seam)
- `src/components/` — handoff components not in theme plan (see Task 2)
- `src/app/navigation/TabBar.tsx` — custom tab bar (token-driven)

**Modify (token migration / layout):**

- `src/modules/input/HomeScreen.tsx`
- `src/modules/input/ImageCaptureScreen.tsx`
- `src/modules/input/PasteTextScreen.tsx` — layout polish only (tokens already Phase 0)
- `src/modules/ocr/OCRReviewScreen.tsx`
- `src/modules/lesson/LessonResultScreen.tsx`
- `src/modules/lesson/LessonResultView.tsx` — compose new subcomponents
- `src/modules/lesson/LessonsHistoryScreen.tsx`
- `src/modules/lesson/SavedLessonDetailScreen.tsx`
- `src/modules/settings/PrivacyNoteScreen.tsx`
- `src/app/navigation/AppNavigator.tsx`, `types.ts`

**Tests:**

- `src/store/__tests__/useScanStore.test.ts`
- `src/components/__tests__/` — smoke per new component
- Extend existing screen tests with `AppThemeProvider` where missing

---

## Task 0: Verify Phase 0 theme gate

- [ ] Run `npx jest` + `npx tsc --noEmit` in `` (theme plan green).
- [ ] Confirm `ThemePicker` is **not** on `PasteTextScreen`.
- [ ] **STOP** if theme Tasks 0–16 incomplete — return to `plans/2026-06-05-theme-system.md`.

---

## Task 1: Extend `AppTheme` for handoff fidelity (if needed)

> Only add tokens required by UI spec §8 that screens/components cannot map to existing contract.
> Update **all three** themes (`default`, `dark`, `pastel-kids`). Follow BR-THEME-004.

- [ ] Audit UI spec §8 vs current `AppTheme` — list gaps (e.g. typography presets + line-height, `gutter`, surface tiers, accent roles).
- [ ] Extend `src/theme/types.ts` + each theme file + `AppText` variants (or `typography.presets` helper).
- [ ] Parametrized theme render test still passes (TC-027).
- [ ] Commit: `feat(theme): extend AppTheme for UI handoff presets`

---

## Task 2: Shared UI components (handoff §4)

Build token-driven; no hard-coded colors. Defer `AppIcon` / image binaries.

- [ ] `SectionHeader`, `ListRow`, `Chip`, `Medallion`
- [ ] `TextField`, `IconButton` (text/icon placeholder OK)
- [ ] `AppHeader`, `BottomActionBar`, `ImagePlaceholder`, `ScanFrame`
- [ ] `WordCard`, `ChunkRow`, `QuizOption`, `LessonCard`
- [ ] Smoke test each under `AppThemeProvider` × `themeList`
- [ ] Commit per component group or one `feat(components): handoff UI building blocks`

**Out of scope:** `ProgressTrack`, `StatTile` (UI spec §11).

---

## Task 3: Custom `TabBar` + navigation types

- [ ] `TabBar.tsx` — Home · Lessons · Profile only (D-002); tokens only.
- [ ] Update `AppNavigator.tsx` / `types.ts` — stacks per UI spec §7.
- [ ] Pinned footer pattern: `View(flex:1) → AppHeader → ScrollView → BottomActionBar` where applicable.
- [ ] Navigation smoke test or manual checklist.
- [ ] Commit: `feat(nav): token-driven 3-tab shell`

---

## Task 4: Domain state + mock data

- [ ] `types/async.ts` — `idle | loading | success | empty | error`
- [ ] `data/mockLessons.ts` — valid `AIOutput` fixtures passing `validateAIOutput()`
- [ ] `useScanStore` — `scanFromText`, `scanFromImage` (mock), `reset`, `Async<AIOutput>` job
- [ ] `useLibraryStore` — seeded lessons, `save`/`remove`/`search` (in-memory; TODO SQLite M4)
- [ ] `services/ai.ts` — wraps mock with delay; `// TODO(M2)` real client seam
- [ ] Store unit tests (UI spec §12)
- [ ] **No** `useThemeStore`, **no** `useProgressStore`
- [ ] Commit: `feat(store): mock scan and library state`

---

## Task 5: Home + input flow screens

- [ ] `HomeScreen` — CTAs to PasteText / image picker; handoff layout; empty states §9
- [ ] `PasteTextScreen` — wire `useScanStore` or keep direct analyze per current M2 path; loading/error/disabled §9
- [ ] `ImageCaptureScreen` — native picker entry; TODO blur overlay
- [ ] Route to `LessonResultScreen` on success (single scroll)
- [ ] Commit: `feat(input): handoff home and paste flow`

---

## Task 6: OCR review + lesson result shell

- [ ] `OCRReviewScreen` — confirm text before AI; tokens + canonical copy §13
- [ ] `LessonResultScreen` — hosts `LessonResultView`; `AppHeader` + scroll layout
- [ ] `LessonResultView` — compose `WordCard`, `ChunkRow`, `QuizOption`; §14 section order unchanged
- [ ] Save lesson: disabled placeholder until M4 (or wire M4 `LessonRepository` if already shipped)
- [ ] Commit: `feat(lesson): handoff result and OCR review UI`

---

## Task 7: Library (Lessons tab)

- [ ] `LessonsHistoryScreen` — `LessonCard` list; empty state §9
- [ ] `SavedLessonDetailScreen` — reopen **without** AI call (M4 rule)
- [ ] Search/filter via `useLibraryStore`
- [ ] Commit: `feat(lesson): library list and detail`

---

## Task 8: Settings polish

- [ ] `PrivacyNoteScreen` — migrate to `App*` (Profile already Phase 0)
- [ ] Profile body — keep stub areas per UI spec; do not add Review/streak UI
- [ ] Commit: `refactor(settings): token-driven privacy note`

---

## Task 9: UI states, a11y, ESLint pass

- [ ] Loading skeletons, coral error cards, disabled 38% opacity — use `theme.states.disabledOpacity` on `pastel-kids`; align other themes if needed
- [ ] `accessibilityLabel` on icon-only controls; reduce-motion guard where animated
- [ ] `npx eslint src/components src/modules` — no color literals
- [ ] `npx jest` + `npx tsc --noEmit` green
- [ ] Commit: `chore(mobile): UI handoff states and lint pass`

---

## Task 10: Traceability + docs

- [x] Update `docs/01-ba/03-requirements/05-traceability-matrix.md` for any new/ touched FR rows
- [x] Note completion in `docs/01-ba/00-ship-trackers/p0-ship-tracker.md` if UI handoff closes a gate
- [ ] Commit: `docs: traceability for UI handoff iteration`

---

## Done criteria

- [x] Phase 0 theme gate verified (Task 0).
- [x] 3-tab nav only; no Scan/Vocabulary tab (D-002).
- [x] Lesson result remains **single scroll** §14; no hub screens.
- [x] All screens in File structure use `useAppTheme()` / `App*` — no hard-coded colors (ESLint).
- [x] Mock lessons pass `validateAIOutput()` before render.
- [x] `useProgressStore` / Review CTA **not** built (UI spec §11).
- [x] TODO markers at OCR/AI/SQLite/fonts/icons/TTS seams (UI spec §11) — `services/ai.ts` seam; M4 SQLite kept.
- [x] UI spec §12 tests implemented and passing.
- [x] `npx jest` pass (81/81). `npx tsc --noEmit` — pre-existing errors in unrelated files only.
- [ ] Manual TC-024 on device (theme switch all screens) — see ship tracker §7b.

---

## After this plan

- Real services: follow milestone briefs (M2 AI, M3 OCR, M4 SQLite) — replace mock seams only.
- Environment matrix: `plans/2026-06-05-environment-setup.md` when preparing TestFlight/Play builds.
- Expand this skeleton into full code-per-task (like theme plan) as each task starts.
