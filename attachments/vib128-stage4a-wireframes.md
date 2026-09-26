# Stage 4a — Wireframes, State Matrix, Responsive Rules

## P1 Flashcards / SRS / Daily Review

> Issue: [VIB-128](mention://issue/4faef63a-6c8a-45ac-b241-e6fdf85453a8). Builds on Stage 1 ([VIB-125](mention://issue/fa472275-4099-4dfe-a898-9dc298129bbf)) and Stage 3 ([VIB-127](mention://issue/7e4baeed-e7cc-446d-aad1-59b865d6b981), attachment `vib127-stage3-ia-flows.md`).
> Labels: `FACT` / `ASSUMPTION` / `QUESTION` / `RISK` / `CONFLICT` / `DECISION`. Unlabeled prose is structural description.
> Scope: wireframes + state matrix + responsive rules only. UI spec / design-system gap list / HTML handoff / motion spec are Stage 6 (not produced here).
> Codebase verified directly at commit `f719a97`: `src/components/*`, `src/modules/lesson/*`, `src/modules/input/HomeScreen.tsx`, `src/theme/tokens.ts`, `src/theme/themes/default.ts`.

---

## 1. Resolving items carried forward from Stage 3 (VIB-127 §8)

Per the VIB-128 brief, these are not silently resolved — each is answered explicitly below.

### 1.1 DA-IA-01 — SCR-02 entry point (already confirmed by Design Lead)

No further action. Wireframed on this basis: new header `IconButton` on `LessonsHistoryScreen`, next to the existing "Cài đặt" `IconButton` (`LessonsHistoryScreen.tsx:89-94`). See §4.2.

### 1.2 Q-FLOW-03 — SCR-09 "Xem flashcard" CTA destination

`DECISION`: the CTA opens **SCR-02 filtered to the lesson** (`lessonId` param), not a deep-link into the lesson's vocabulary section.

Rationale: SCR-02 already must disambiguate same-word-different-lesson (E2) with a per-row lesson-source indicator, so a `lessonId` filter is a trivial extension of a query SCR-02 already needs, not new UI. A deep-link into the lesson's vocabulary section would show _all_ vocabulary (saved and unsaved) rather than flashcard-specific state (review history, saved date) — the exact information the user needs to decide what to unsave before the delete can proceed. Filtering the existing list is the better reuse story and keeps a single "manage saved flashcards" surface.

Implementation note for engineering: SCR-02 gains an optional `lessonId` filter param. When present: header shows the lesson title as context (e.g. "Flashcard · {lesson title}") and a text affordance to clear the filter ("Xem tất cả"). See §4.2 wireframe, filtered variant.

### 1.3 Q-FLOW-01 — D4 soft-cap carry-over state

`DECISION` (state locked; exact copy stays open for Stage 4b): a **non-dismissible banner** pinned below the header on SCR-05, shown only when the session's due snapshot was trimmed to the cap. Same information echoed as a summary line on SCR-07. See §4.3 (SCR-05, capped variant) and §4.5 (SCR-07). Copy placeholder: `"Còn lại {M} thẻ, mai ôn tiếp"` — Stage 4b owns final Vietnamese wording per BR-REVIEW-003.

### 1.4 §4.4 — Session → Summary navigation stack

`DECISION`: confirmed as proposed by Stage 3 — `navigation.replace('SessionSummary', …)`, not `.push`. Back gesture/button from SCR-07 returns to Home, never back into a spent session. No override.

### 1.5 RISK — rating-write failure (no Error state planned)

`DECISION`: SCR-05 gets a **non-blocking inline retry** on atomic rating-write failure, reusing the existing `ErrorCard` component (`src/components/ErrorCard.tsx` — already supports `message` + `onRetry` + `retryLabel`, exactly this shape) positioned inline above the rating control, without navigating away from the card. Rating buttons enter **Disabled** state while a retry is in flight, preventing a double-submit against the atomic transaction (FR-SRS-003). This resolves the risk with an existing component — no new gap. See §4.3 (SCR-05, error variant).

### 1.6 DA-IA-02 — should local-write failures be silent?

`DECISION`: keep silent for save/unsave (SCR-01a/b, SCR-03) — consistent with existing `deleteLesson` swallow-and-return-false precedent (`LessonRepository.ts:216`) and NFR-AVAIL-01 (no network/write wait shown to the user). This is **not** the same case as §1.5: rating writes are the one flow with an explicit atomicity requirement (FR-SRS-003) and a user-visible consequence (lost rating), which is why that one path gets an explicit Error state and the simple toggle writes do not.

### 1.7 SCR-08 / SCR-09 modal pattern

`DECISION`: both reuse the existing native `Alert.alert(title, message, buttons)` pattern already used in `ProfileScreen.tsx:39` (clear-data confirmation) — not a new themed modal. `Alert.alert` supports a title, a message, and multiple buttons on both platforms, which covers SCR-08's confirm/cancel and SCR-09's "Xem flashcard"/"Đóng" exactly. This removes one of the two components Stage 1 flagged as a possible gap; only the flip-card and rating control remain genuine gaps (§3).

---

## 2. Component reuse & modification map

| Screen    | Component(s)                                                      | Status                                                                                                                         |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SCR-01a   | `WordCard`                                                        | **Modify** — add optional `saved?: boolean` + `onToggleSave?: () => void`. See §4.1.                                           |
| SCR-01b   | `IconButton` (existing, unwired, `WordDetailScreen.tsx:34`)       | **Reuse as-is** — wire `onPress`.                                                                                              |
| SCR-02    | `IconButton` (header), `ListRow` or `LibraryLessonCard`-style row | **Reuse** — see §4.2 for which.                                                                                                |
| SCR-03    | New flip component                                                | **Gap** (Stage 6) — see §3.                                                                                                    |
| SCR-04    | `SectionHeader`, `Medallion`-style badge                          | **Reuse** — new widget card composed from existing primitives (`AppCard`, `AppText`, `MaterialIcon`), no new component.        |
| SCR-05    | New rating control, `ErrorCard`, `ActivityIndicator`              | Rating control = **Gap** (Stage 6). `ErrorCard` = **Reuse as-is** (§1.5).                                                      |
| SCR-06a/b | `Medallion`, `AppText`, `AppButton`                               | **Reuse as-is** — same pattern as `HomeScreen`'s empty-recent-lessons block and `LessonsHistoryScreen`'s `ListEmptyComponent`. |
| SCR-07    | `AppCard`, `AppButton`, `AppText`                                 | **Reuse as-is**.                                                                                                               |
| SCR-08    | `Alert.alert`                                                     | **Reuse as-is** (§1.7).                                                                                                        |
| SCR-09    | `Alert.alert`                                                     | **Reuse as-is** (§1.7).                                                                                                        |

---

## 3. Design-system gaps (flagged, not designed here — Stage 6 owns final spec)

Per role constraint, these are genuine gaps, not bespoke one-offs invented at this stage:

- **Flip-card component** (SCR-03, and reused inside SCR-05 session loop) — front/back reveal, no existing equivalent (`QuizOption` is single-state select, `WordCard` is static).
- **Rating control** (SCR-05) — needs exactly 2 primary actions ("remembered" / "not remembered", D3 = fixed interval, 2-outcome per Stage 3 §4.2) plus a lower-emphasis "Bỏ qua" (skip) affordance. Per NFR-ACC-004 the two rating states must be distinguishable by icon/label, not color alone (draft: `check_circle` "Nhớ" / `refresh` "Chưa nhớ" — **not** "Again", per Q-FLOW-02).
- **New icons**: `check_circle`, `refresh` (or equivalent) are not yet in `HANDOFF_ICONS` (`src/components/icons/iconRegistry.ts`) — flag for the icon subset step before Stage 6 HTML handoff.
- **Capped-queue banner**: visually this can likely extend `ErrorCard`'s shape (surface + icon + text, no retry button) rather than a wholly new component — Stage 6 to confirm whether a variant prop on `ErrorCard` or a new lightweight `Banner` component is cleaner.

---

## 4. Wireframes

### 4.1 SCR-01a/b — Save / unsave affordance

Inline on the vocabulary section of `LessonResultScreen` / `SavedLessonDetailScreen` (no dedicated screen). `WordCard` gains a saved-state bookmark icon, positioned like the existing `cefr_level` `Chip` absolute-corner pattern already used in `WordDetailScreen.tsx:46-51`.

```text
┌─────────────────────────────┐
│ offer                  🔖   │  ← WordCard + new saved-state IconButton
│ đề nghị; ưu đãi              │     (outline = unsaved, filled = saved)
│ "We are offering a discount" │
└─────────────────────────────┘
```

- **Normal** (unsaved): `🔖` outline, tone `ghost`.
- **Success** (saved): `🔖` filled, tone `accent` — updates immediately on tap, no spinner (offline-first, NFR-AVAIL-01).
- Idempotent tap on an already-saved word is a no-op (BR-FLASH-002) — UI stays in Success state, nothing visibly changes.
- No Loading, no Error state (§1.6).

SCR-01b (`WordDetailScreen`) is identical in state behavior — only the existing unwired `bookmark` `IconButton` at `WordDetailScreen.tsx:34` gets an `onPress` and a `saved`-driven `filled` prop. No wireframe change to that screen's layout.

### 4.2 SCR-02 — Flashcard List

Entry: new header `IconButton` on `LessonsHistoryScreen`, positioned to the left of the existing "Cài đặt" button.

```text
┌─────────────────────────────┐
│ ← Flashcard            ⚙️   │  ← header, back + existing settings icon
│                             │
│ ┌─────────────────────────┐ │
│ │ offer            A2  🔖 │ │  ← row: word · cefr · saved icon (filled)
│ │ Từ "Special Discount…"  │ │  ← lesson-source indicator (E2)
│ ├─────────────────────────┤ │
│ │ discount         A2  🔖 │ │
│ │ Từ "Special Discount…"  │ │
│ ├─────────────────────────┤ │
│ │ offer            A2  🔖 │ │  ← same word, different lesson (E2):
│ │ Từ "Restaurant Menu"    │ │     renders as a separate row
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Filtered variant** (entered via SCR-09's "Xem flashcard" CTA, §1.2):

```text
┌─────────────────────────────┐
│ ← Flashcard · Special…  ⚙️  │  ← lesson title as context in header
│   Xem tất cả                │  ← text link, clears the lessonId filter
│ ┌─────────────────────────┐ │
│ │ offer            A2  🔖 │ │  ← only this lesson's saved cards
│ ├─────────────────────────┤ │
│ │ discount         A2  🔖 │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- **Normal**: list of rows, `ListRow`-derived layout (adds `cefr` `Chip` + saved icon, since bare `ListRow` only supports label/value — this is a usage variant, not a new component).
- **Loading**: brief local-DB read — reuse the same `ActivityIndicator` pattern as `SavedLessonDetailScreen.tsx:76-84`.
- **Empty** (unfiltered, count == 0): `Medallion` + copy distinct from SCR-06a's daily-review framing (different context: "you haven't saved any words yet" vs. "nothing due today"). Draft copy — Stage 4b: `"Bạn chưa lưu flashcard nào."`
- **Empty** (filtered, this lesson has 0 saved cards — reachable only if cards were unsaved after the SCR-09 guard already ran): same empty pattern, scoped copy.
- No Error state (offline-first, NFR-AVAIL-01).

### 4.3 SCR-05 — Daily Review Session (+ SCR-03 flip, shared interaction)

Modal-like push (`gestureEnabled: false`), mirrors `AnalyzingScreen`'s non-dismissible pattern during the session.

**Normal — front:**

```text
┌─────────────────────────────┐
│ ×              Thẻ 2/8      │  ← close (confirms exit — see note), progress
│                             │
│                             │
│      ┌───────────────┐      │
│      │               │      │
│      │    offer      │      │  ← flip card, front (word only)
│      │               │      │
│      │   (chạm để    │      │
│      │    lật thẻ)   │      │
│      └───────────────┘      │
│                             │
│         Bỏ qua              │  ← low-emphasis text action (skip)
└─────────────────────────────┘
```

**Normal — back (after flip), rating control revealed:**

```text
┌─────────────────────────────┐
│ ×              Thẻ 2/8      │
│      ┌───────────────┐      │
│      │ offer          │      │
│      │ đề nghị; ưu đãi│      │  ← back: meaning + example
│      │ "We are        │      │
│      │  offering…"    │      │
│      └───────────────┘      │
│ ┌───────────┐ ┌───────────┐ │
│ │ ✓ Nhớ     │ │ ↻ Chưa nhớ│ │  ← rating control (gap, §3)
│ └───────────┘ └───────────┘ │
│         Bỏ qua              │
└─────────────────────────────┘
```

**Capped-queue variant** (D4 trim applied — banner per §1.3, persistent for the session):

```text
┌─────────────────────────────┐
│ ×              Thẻ 2/20      │
│ ⓘ Còn lại 12 thẻ, mai ôn    │  ← non-dismissible banner
│   tiếp                      │
│      ┌───────────────┐      │
│      │    offer      │      │
│      └───────────────┘      │
└─────────────────────────────┘
```

**Rating-write failure** (§1.5 — non-blocking, inline, retains current card):

```text
┌─────────────────────────────┐
│ ×              Thẻ 2/8      │
│      ┌───────────────┐      │
│      │ offer          │      │
│      │ đề nghị; ưu đãi│      │
│      └───────────────┘      │
│ ┌─────────────────────────┐ │
│ │ Không lưu được đánh giá.│ │  ← ErrorCard, reused as-is
│ │      [ Thử lại ]        │ │
│ └─────────────────────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │ ✓ Nhớ     │ │ ↻ Chưa nhớ│ │  ← Disabled while retrying
│ └───────────┘ └───────────┘ │
└─────────────────────────────┘
```

- **Normal**: card N of total shown, front/back flip (shared with SCR-03's flip interaction).
- **Loading**: session start (building the frozen snapshot) and resume-after-crash (§4.3 of Stage 3, E5/A-03) — both use the same brief full-screen spinner; no separate "resuming…" screen (per Stage 3 §4.3, a distinct resume screen isn't warranted).
- **Disabled**: rating buttons mid-transition after a tap, and during retry after a write failure — prevents double-submit on the atomic transaction.
- **Other**: capped-queue banner (§1.3).
- **Error**: rating-write failure, non-blocking inline (§1.5).
- Live-unsave mid-session (E6, Stage 3 §5 exception): remaining-card counter is reactive, not frozen — if the removed card was the last one, session auto-transitions to SCR-07 with no dangling empty screen. No new wireframe state; this is a counter-recompute behavior on the existing Normal state.
- **`×` (close) button**: not specified by Stage 3 as a distinct exit flow. `ASSUMPTION`: tapping `×` mid-session exits without penalty (unrated cards keep their current `due_at`, same as Skip) — since the session snapshot isn't a commitment device, just a working set. No confirmation dialog needed (unlike SCR-09, there's no destructive consequence). Flag to Design Lead if this needs an explicit confirm-to-exit instead.

### 4.4 SCR-04 — Daily Review Entry (Home widget)

`DECISION`: placed after the primary input CTAs (camera / upload / paste) and **before** "Bài học gần đây" — rationale: review is a returning-user habit-forming action that deserves top-of-scroll placement alongside the primary CTAs, while "recent lessons" remains a browsing section further down. Composed from existing primitives (`AppCard`, `AppText`, `MaterialIcon`), no new component.

```text
┌─────────────────────────────┐
│ LingoBites              ⚙️  │
│                             │
│ Hôm nay bạn muốn học từ đâu?│
│ [ 📷 Chụp ảnh học ngay ]    │
│ [🖼 Upload] [✍️ Dán text]   │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔁 Ôn tập hôm nay    8  │ │  ← NEW widget: label + due count
│ └─────────────────────────┘ │
│                             │
│ Bài học gần đây             │
│ …                           │
└─────────────────────────────┘
```

- **Normal** (due-count badge, FR-REVIEW-005 = Should): count > 0 → tap navigates to SCR-05.
- **Empty, never saved** (flashcards.count == 0): tap routes to SCR-06a instead of a session.
- **Empty, done for today** (due == 0, flashcards.count > 0): tap routes to SCR-06b.
- Widget itself has no independent Loading/Error state — the count read is a local DB query, same offline-first treatment as the rest of Home.

### 4.5 SCR-06a / SCR-06b — Empty states (E4, must be visually distinct)

Reuses `Medallion` + `AppText` + `AppButton`, same shape as `HomeScreen`'s empty-recent-lessons block (`HomeScreen.tsx:204-208`) and `LessonsHistoryScreen`'s `ListEmptyComponent`.

```text
SCR-06a — never saved            SCR-06b — done for today
┌─────────────────────────────┐  ┌─────────────────────────────┐
│           📚                │  │           ✅                │
│  Bạn chưa lưu từ vựng nào.  │  │  Đã ôn hết hôm nay!         │
│  Lưu từ khi đọc bài học để  │  │  Quay lại vào ngày mai để   │
│  bắt đầu ôn tập.            │  │  ôn thêm nhé.               │
│                             │  │                             │
│  [ Xem bài học ]            │  │  (no CTA — return tomorrow) │
└─────────────────────────────┘  └─────────────────────────────┘
```

- Distinct `Medallion` label/icon and distinct copy per E4 — confirmed not reusing one generic empty state.
- SCR-06a's CTA routes to `LessonsHistoryScreen` (nearest place to find vocabulary to save). SCR-06b intentionally has no CTA — the correct action is literally "come back tomorrow."
- Both render in-place of the SCR-05 push (tapping the SCR-04 widget shows these instead of navigating into a session), consistent with Stage 3 §4.1.

### 4.6 SCR-07 — Session Summary

Replaces SCR-05 in the stack (`navigation.replace`, §1.4).

```text
┌─────────────────────────────┐
│           🎉                │
│      Hoàn thành phiên ôn!   │
│                             │
│   8 thẻ đã ôn · 6 nhớ       │
│                             │
│  ⓘ Còn lại 12 thẻ, mai ôn   │  ← only shown if D4 trim applied (§1.3)
│    tiếp                     │
│                             │
│      [      Xong      ]     │  ← navigates to Home (not .goBack)
└─────────────────────────────┘
```

- **Success** is the only state (Stage 3 §4.2: completion has no correctness threshold, FR-REVIEW-003).
- **Other**: capped-queue summary line, shown conditionally — same trigger as SCR-05's banner.

### 4.7 SCR-08 — Unsave confirmation

Native `Alert.alert` (§1.7), only shown for cards with review history (FR-FLASH-010, Should):

- Title: `"Bỏ lưu flashcard?"`
- Message (draft, Stage 4b to finalize): `"Thẻ này đã có lịch sử ôn tập. Bỏ lưu sẽ xoá khỏi danh sách ôn tập."`
- Buttons: `Huỷ` (cancel, dismiss) / `Bỏ lưu` (confirm → soft delete, `archived_at` set, BR-FLASH-004).
- Cards with **no** review history skip this dialog entirely — soft-deleted immediately on unsave tap.

### 4.8 SCR-09 — Lesson delete guard

Native `Alert.alert` (§1.7), triggered from the existing `handleDelete()` at `SavedLessonDetailScreen.tsx:66` when the lesson has ≥1 active (non-archived) flashcard — a **new precondition check** ahead of the existing `deleteLesson()` call, per Stage 3's flagged RISK (`SavedLessonDetailScreen.tsx:66-74` currently has no flashcard-awareness).

- Title: `"Không thể xoá bài học"`
- Message (draft): `"Bài học này còn {N} flashcard đang lưu. Xoá flashcard trước khi xoá bài học."`
- Buttons: `Đóng` (dismiss, stay on `SavedLessonDetailScreen`) / `Xem flashcard` (navigates to SCR-02 filtered by `lessonId`, §1.2).
- Lessons with 0 active flashcards: existing behavior unchanged, no dialog.

---

## 5. State matrix (full — expands Stage 1/3 skeletons)

| Screen    | Normal                                             | Loading                           | Empty                                                 | Error                                            | Success                                  | Disabled                                      | Other                                          |
| --------- | -------------------------------------------------- | --------------------------------- | ----------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| SCR-01a/b | Unsaved (outline icon)                             | —                                 | —                                                     | —                                                | Saved (filled icon)                      | —                                             | —                                              |
| SCR-02    | List of rows (unfiltered or lesson-filtered, §4.2) | Brief local-DB read               | No flashcards saved (own copy, distinct from SCR-06a) | —                                                | —                                        | —                                             | Filtered-by-lesson variant                     |
| SCR-03    | Front / back flip                                  | —                                 | —                                                     | —                                                | Unsave → SCR-08 or immediate soft-delete | —                                             | —                                              |
| SCR-04    | Due count > 0, badge                               | —                                 | Due = 0 → routes to 06a/06b                           | —                                                | —                                        | —                                             | —                                              |
| SCR-05    | Card N of total, front/back                        | Session start; resume-after-crash | → routes to 06a/06b before session starts             | Rating-write failure, inline non-blocking (§1.5) | —                                        | Rating buttons mid-transition or during retry | Capped-queue banner (§1.3)                     |
| SCR-06a   | shown (empty = the state)                          | —                                 | is the state                                          | —                                                | —                                        | —                                             | —                                              |
| SCR-06b   | shown (empty = the state)                          | —                                 | is the state                                          | —                                                | —                                        | —                                             | —                                              |
| SCR-07    | shown                                              | —                                 | —                                                     | —                                                | is the state (always)                    | —                                             | Capped-queue summary line, conditional         |
| SCR-08    | shown (native Alert)                               | —                                 | —                                                     | —                                                | Confirm → closes, soft delete            | Cancel → dismiss                              | Skipped entirely if card has no review history |
| SCR-09    | shown (native Alert)                               | —                                 | —                                                     | —                                                | —                                        | —                                             | Only shown if lesson has ≥1 active flashcard   |

Permission-denied: N/A across all P1 screens (`FACT`, inherited from Stage 3 §7 — P1 uses the P0 anonymous-user model, no new roles).

---

## 6. Responsive rules

`FACT`: the app is phone-only today — no tablet layout, no `Dimensions`-based breakpoints, no landscape handling anywhere in `src/theme/` or existing screens (confirmed by direct search — no matches for `breakpoint`/`responsive`/`Dimensions` in `src/theme/`, `src/components/`, or `docs/01-ba/06-design/`). P1 does not introduce a first responsive/tablet layer; it follows the existing phone-only model.

Rules that apply to all new P1 screens, consistent with existing screens:

- **Safe area**: every screen wraps in `AppScreen` (`SafeAreaView`), same as all existing screens — SCR-02/03/04/05/06a/06b/07 all use it.
- **Min touch target**: 48dp minimum height on interactive rows/buttons, matching `ListRow` (`minHeight: 48`) and `QuizOption` (`minHeight: 48`). The flip card and rating buttons (Stage 6 gap) must meet this floor.
- **Small-screen height** (e.g. iPhone SE, ~568pt tall): SCR-05's flip card must not assume a fixed viewport-relative height — size it to content with `flex`/`minHeight`, not a hardcoded pixel height, so the rating control + skip action remain visible without scrolling on the smallest supported device. Flag to Stage 6 as a layout constraint on the new flip component.
- **Dynamic Type / font scaling**: no existing screen disables font scaling (no `allowFontScaling={false}` found in the reviewed screens) — P1 screens should not introduce that override either. Long due-count labels, capped-queue banner text, and rating button labels must tolerate 1–2 lines at larger scale factors without clipping (`numberOfLines` + `AppText`'s existing wrapping behavior is sufficient; no truncation on these short strings).
- **Orientation**: no rotation lock/handling exists elsewhere in the app; P1 does not add one. Out of scope for this stage — if this becomes a requirement, it needs a Gate-level decision, not a Stage 4a default.
- **Tablet / large-screen**: explicitly out of scope, consistent with the rest of the app. Not a gap — a scope boundary inherited from the existing product, restated here so Stage 6/7 don't invent tablet-specific specs.

---

## 7. Traceability (additions to Stage 3 §9)

| Requirement              | Screen(s)        | Resolution in this stage                                                                 |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| FR-FLASH-001/002/005/006 | SCR-01a, SCR-01b | `WordCard` saved-state prop (§2, §4.1)                                                   |
| FR-FLASH-003/004         | SCR-02, SCR-03   | List row + flip gap flagged (§3, §4.2)                                                   |
| FR-FLASH-007/008/009/010 | SCR-03, SCR-08   | Native `Alert.alert`, no new modal (§1.7, §4.7)                                          |
| FR-SRS-001/002/003       | SCR-05           | Rating control gap flagged; rating-write failure now has an Error state (§1.5, §3, §4.3) |
| FR-REVIEW-001..003       | SCR-05, SCR-07   | Capped-queue state locked (§1.3), nav-stack confirmed (§1.4)                             |
| FR-REVIEW-004 (E4)       | SCR-06a, SCR-06b | Distinct empty states wireframed (§4.5)                                                  |
| FR-REVIEW-005            | SCR-04           | Widget placement decided (§4.4)                                                          |
| CRIT-002 / E1            | SCR-09           | Native `Alert.alert`, CTA destination resolved (§1.2, §1.7, §4.8)                        |
| E2                       | SCR-02           | Lesson-source indicator per row (§4.2)                                                   |
| E6                       | SCR-05, SCR-03   | Reactive counter, auto-transition to SCR-07 (§4.3)                                       |

---

## 8. Open items for Stage 5 (Human Gate 2) / Stage 6

| ID        | Item                                                                                                 | Owner                        |
| --------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| —         | SCR-05 `×` (exit mid-session) behavior — assumed no-penalty, no confirm dialog (§4.3)                | Design Lead / Gate 2 confirm |
| —         | Flip-card component, rating control, new icons (`check_circle`/`refresh`), capped-queue banner shape | Stage 6 gap list             |
| Q-FLOW-01 | Exact Vietnamese wording for capped-queue banner/summary                                             | Stage 4b (Content Designer)  |
| —         | Rating button copy ("Nhớ" / "Chưa nhớ" are drafts, not final)                                        | Stage 4b (Content Designer)  |

None of these block Gate 2 review of the wireframe structure/states themselves — they're copy and Stage-6-component-spec refinements.

---

**Self-status:** Per Design Team Sub-issue Status Rule, VIB-128 is self-closed to `done` on submission.
