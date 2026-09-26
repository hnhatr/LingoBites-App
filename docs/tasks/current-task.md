# Task: Phase 1 UI Handoff

## Selected Tags

- @impl-notes
- @subagent-tool-routing
- @feature
- @react-native-standard
- @typescript-standard
- @test-required
- @ui-match-design
- @no-unrelated-change

## Problem

Remaining screens use hard-coded StyleSheet colors. Phase 1 applies HTML handoff layout/components on top of the completed theme layer while preserving M2–M4 real services (AI, OCR, SQLite).

## Expected Behavior

Per `docs/superpowers/plans/2026-06-05-lingobites-ui.md`: extended tokens (if needed), handoff components, custom TabBar, stores, all listed screens migrated to `App*` + tokens, ESLint clean on `src/components` + `src/modules`.

## Scope

In scope: UI plan Tasks 0–10; D-002 (3 tabs, single-scroll lesson).

Out of scope: useProgressStore, Review CTA, Scan/Vocabulary tab, re-implementing theme/\*.

## Acceptance Criteria

- [x] Phase 0 gate verified
- [x] AppTheme extended for handoff presets (Task 1)
- [x] Handoff components + TabBar (Tasks 2–3)
- [x] Stores + services seam (Task 4)
- [x] Screens migrated; ESLint no color literals (Tasks 5–9)
- [x] Tests green; impl notes updated
- [x] Task 10 traceability/ship tracker

## Notes / Evidence

- Plan: `docs/superpowers/plans/2026-06-05-lingobites-ui.md`
- Spec: `docs/superpowers/specs/2026-06-05-lingobites-ui-design.md`
- M4 SQLite stays canonical for library persistence (not in-memory mock store)
