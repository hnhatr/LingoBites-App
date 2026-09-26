# Superpowers — Implementation Roadmap (LingoBites)

> **BA canonical wins** on conflict: `docs/01-ba/DECISIONS.md`, milestone briefs, traceability matrix.
> Superpowers = design specs + step-by-step plans for agent execution. Ship status: [`p0-ship-tracker.md`](../01-ba/00-ship-trackers/p0-ship-tracker.md).

---

## Execution order (do not skip)

```text
Phase 0 — Theme foundation     [REQUIRED FIRST]
  spec:  specs/2026-06-05-theme-driven-architecture-design.md
  plan:  plans/2026-06-05-theme-system.md (Tasks 0–16)
  exit:  TC-024..030, FR-THEME-001..015 (see 03-theme-system.md)

Phase 1 — UI handoff             [AFTER Phase 0 complete] — automated gate ✅ (2026-06-05)
  spec:  specs/2026-06-05-lingobites-ui-design.md
  plan:  plans/2026-06-05-lingobites-ui.md (Tasks 0–10)
  exit:  UI spec §12 tests + ESLint clean; manual TC-024 on device ☐

Phase 2 — Environment (parallel) [Optional / when shipping builds]
  spec:  specs/2026-06-05-environment-setup-design.md
  plan:  plans/2026-06-05-environment-setup.md
  note:  Independent of theme/UI; needed for staging/production bundle IDs and env matrix.
```

**Milestone note (BA):** M0–M4 core loop may already be done. Theme (M5 polish) and UI handoff are
**recommended early** (MT-Theme) but **do not block** M1–M4 logic per `p0-ship-tracker` §8.

---

## Phase 0 — Theme (what to build)

| Deliverable                                                    | Owner doc              |
| -------------------------------------------------------------- | ---------------------- |
| `theme/` registry, Provider, AsyncStorage                      | theme plan Tasks 1–5   |
| `AppText`, `AppButton`, `AppCard`, `AppScreen`, `ThemePicker`  | theme plan Tasks 6–10  |
| Migrate `PasteTextScreen`, `LessonResultView`, `ProfileScreen` | theme plan Tasks 11–13 |
| `AppThemeProvider` on `AppNavigator`                           | theme plan Task 14     |

**Do not start Phase 1 until** theme plan Done criteria are all checked.

---

## Phase 1 — UI handoff (what to build)

| Deliverable                                                             | Owner doc         |
| ----------------------------------------------------------------------- | ----------------- |
| Extend `AppTheme` (typography presets, extra semantic colors if needed) | UI plan Task 1    |
| Component library (`WordCard`, `LessonCard`, `TabBar`, …)               | UI plan Tasks 2–3 |
| Zustand `useScanStore`, `useLibraryStore` + mock data                   | UI plan Task 4    |
| Navigation shell (3 tab, stacks)                                        | UI plan Task 5    |
| Screen polish: Home, Library, OCR review, lesson shells                 | UI plan Tasks 6–8 |
| Loading / empty / error states (handoff §9)                             | UI plan Task 9    |

**Do not re-implement:** `theme/`, `ThemeProvider`, registry, or `ThemePicker` placement (already Phase 0).

---

## File index

| Path                                                   | Type | Purpose                           |
| ------------------------------------------------------ | ---- | --------------------------------- |
| `specs/2026-06-05-theme-driven-architecture-design.md` | Spec | Theme architecture contract       |
| `plans/2026-06-05-theme-system.md`                     | Plan | Theme implementation (Tasks 0–16) |
| `specs/2026-06-05-lingobites-ui-design.md`             | Spec | Full mobile UI handoff scope      |
| `plans/2026-06-05-lingobites-ui.md`                    | Plan | UI implementation (after theme)   |
| `specs/2026-06-05-environment-setup-design.md`         | Spec | iOS/Android/API env matrix        |
| `plans/2026-06-05-environment-setup.md`                | Plan | Environment wiring                |

**BA mirrors:** `docs/01-ba/06-design/03-theme-system.md` (theme FR/TC), `04-html-handoff-to-code-spec.md` (visual tokens).

---

## Agent session checklist

1. Read `docs/01-ba/DECISIONS.md`.
2. Identify phase: theme **or** UI **or** env — **one phase per session** when possible.
3. Open the **plan** for that phase (not only the spec).
4. On completion: update `05-traceability-matrix.md` Status for touched FR rows.
5. Spec change → `11-spec-change-protocol.md` + `DECISIONS.md` (not plan-only edits for contract changes).

---

## Gaps / future plans

- UI plan is a **task skeleton** — expand with code snippets per task as implementation proceeds (same pattern as theme plan).
- `useProgressStore` / Review CTA: **out-of-P0** per UI spec §11.
- Post-P0: premium themes, `'system'` theme, `AppIcon`/`AppImage` — deferred per D-003.
