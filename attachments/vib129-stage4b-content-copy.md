# Stage 4b — Content Copy Deck and Error Message Matrix

## P1 Flashcards / SRS / Daily Review

> Issue: VIB-129. Inputs: VIB-125, VIB-127, VIB-128, Gate 1 decisions, `design-team-input-package.md`, and `07-phase1-prd-draft.md`.
> Primary UI locale: Vietnamese. Labels used below: `FACT`, `ASSUMPTION`, `QUESTION`, `RISK`, `CONFLICT`, `DECISION`.

## 1. Voice and terminology decisions

| ID    | Label      | Decision                                                                                      | Rationale                                                                                                                                  |
| ----- | ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CT-01 | `DECISION` | Use **flashcard** in visible UI; do not alternate with “thẻ ghi nhớ” or “thẻ từ”.             | “Flashcard” is compact and already established in the approved product/design language.                                                    |
| CT-02 | `DECISION` | Use **Lưu flashcard** / **Bỏ lưu** for the reversible save state. Do not use “Xóa flashcard”. | The record is soft-deleted and can later restore its schedule/history; “Bỏ lưu” describes the action without promising permanent deletion. |
| CT-03 | `DECISION` | Name the daily feature **Ôn tập hôm nay**.                                                    | Short, action-oriented, and suitable for the Home widget and screen title.                                                                 |
| CT-04 | `DECISION` | Use **Nhớ** / **Chưa nhớ** for the two fixed-interval outcomes; use **Bỏ qua** for no rating. | Matches Gate 1 D3. Avoids the stale SM-2 term “Again” and clearly distinguishes rating from skip.                                          |
| CT-05 | `DECISION` | Use **bài học** for lesson and **từ vựng** when guiding users to content they can save.       | Matches current Vietnamese product language.                                                                                               |
| CT-06 | `DECISION` | Address the user implicitly; avoid “Bạn” when the sentence remains clear.                     | Keeps mobile strings concise and friendly. Empty-state body text may use “bạn” when it improves warmth.                                    |
| CT-07 | `DECISION` | Use sentence case. Button labels describe the immediate action.                               | Improves consistency and scanability.                                                                                                      |

`CONFLICT` Q-FLOW-02 is resolved for UI copy: BR-REVIEW-002 still says “Again → relearning,” but Gate 1 D3 supersedes that interaction with fixed interval. No visible string uses “Again”, “Hard”, “Good”, or “Easy”. The PRD business-rule wording still needs canonical correction by its owner; this deck does not alter policy.

## 2. Copy deck by screen and state

Variables use ICU-style braces. Count-sensitive strings require locale-aware plural handling; see §5.

### SCR-01a / SCR-01b — Save and unsave affordance

| Element/state                              | UI copy                         | Accessibility label / note    |
| ------------------------------------------ | ------------------------------- | ----------------------------- |
| Unsaved icon                               | No visible label in compact row | `Lưu flashcard`               |
| Saved icon                                 | No visible label in compact row | `Đã lưu. Nhấn để bỏ lưu`      |
| Optional visible action, wide layout       | `Lưu flashcard`                 | Same as visible text          |
| Optional visible saved action, wide layout | `Đã lưu`                        | Action hint: `Nhấn để bỏ lưu` |

`FACT`: save/unsave writes on these screens have no visible loading or error state in the approved Stage 4a matrix.

### SCR-02 — Flashcard List

| Element/state                 | UI copy                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| Screen title, unfiltered      | `Flashcard`                                                     |
| Header action from Lessons    | Accessibility label: `Mở danh sách flashcard`                   |
| Row source label              | `Từ bài: {lessonTitle}`                                         |
| Filtered title                | `Flashcard · {lessonTitle}`                                     |
| Clear filter                  | `Xem tất cả`                                                    |
| Loading accessibility label   | `Đang tải flashcard`                                            |
| Empty title, unfiltered       | `Chưa có flashcard`                                             |
| Empty body, unfiltered        | `Lưu từ vựng trong một bài học để xem lại tại đây.`             |
| Empty CTA, unfiltered         | `Xem bài học`                                                   |
| Empty title, filtered         | `Không còn flashcard trong bài này`                             |
| Empty body, filtered          | `Bạn có thể quay lại bài học hoặc xem tất cả flashcard đã lưu.` |
| Empty primary CTA, filtered   | `Xem tất cả`                                                    |
| Empty secondary CTA, filtered | `Quay lại bài học`                                              |

`DECISION`: the list empty state is deliberately list-management copy. It is not reused for SCR-06a, whose context is starting Daily Review.

### SCR-03 — Flashcard Detail / Flip Card

| Element/state | UI copy                 | Accessibility label / note          |
| ------------- | ----------------------- | ----------------------------------- |
| Screen title  | `Flashcard`             | —                                   |
| Front helper  | `Chạm để xem nghĩa`     | Card action: `Lật thẻ để xem nghĩa` |
| Back helper   | `Chạm để xem từ`        | Card action: `Lật thẻ để xem từ`    |
| Source        | `Từ bài: {lessonTitle}` | —                                   |
| Unsave action | `Bỏ lưu`                | `Bỏ lưu flashcard`                  |

### SCR-04 — Home widget / Daily Review entry

| State       | Title            | Supporting copy                  | CTA / accessibility label                            |
| ----------- | ---------------- | -------------------------------- | ---------------------------------------------------- |
| Due > 0     | `Ôn tập hôm nay` | `{count} flashcard đang chờ ôn`  | `Bắt đầu ôn`                                         |
| Never saved | `Ôn tập hôm nay` | `Lưu từ vựng để bắt đầu ôn tập.` | `Khám phá flashcard`                                 |
| Done today  | `Ôn tập hôm nay` | `Hôm nay đã ôn xong.`            | Accessibility label: `Xem trạng thái ôn tập hôm nay` |

### SCR-05 — Daily Review Session

| Element/state                    | UI copy                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Screen title                     | `Ôn tập hôm nay`                                                                              |
| Progress                         | `{current}/{total}`                                                                           |
| Front helper                     | `Chạm để xem nghĩa`                                                                           |
| Back helper                      | `Bạn nhớ từ này không?`                                                                       |
| Positive rating                  | `Nhớ`                                                                                         |
| Negative rating                  | `Chưa nhớ`                                                                                    |
| Skip                             | `Bỏ qua`                                                                                      |
| Close button accessibility label | `Thoát phiên ôn tập`                                                                          |
| Initial loading                  | `Đang chuẩn bị phiên ôn tập…`                                                                 |
| Resume loading                   | `Đang tiếp tục phiên ôn tập…`                                                                 |
| Carry-over banner                | `Hôm nay ôn {sessionCount} thẻ. {remainingCount} thẻ còn lại sẽ được để dành cho lần ôn sau.` |
| Rating-save error                | `Chưa lưu được lựa chọn. Thử lại để tiếp tục.`                                                |
| Retry action                     | `Thử lại`                                                                                     |

`DECISION` Q-FLOW-01: use “lần ôn sau,” not “ngày mai.” The fixed-interval schedule and soft-cap rule establish carry-over, but the supplied requirements do not guarantee that every remaining card will next be presented exactly tomorrow. This wording remains reassuring without promising unsupported timing.

`ASSUMPTION`: Stage 4a treats the close action as a no-penalty exit with no confirmation. The label above describes only navigation and does not claim how unrated cards are scheduled.

### SCR-06a — Daily Review empty: never saved

| Element | UI copy                                                                 |
| ------- | ----------------------------------------------------------------------- |
| Eyebrow | `Bắt đầu với flashcard`                                                 |
| Title   | `Chưa có từ nào để ôn`                                                  |
| Body    | `Lưu từ vựng trong bài học. Flashcard đầu tiên sẽ sẵn sàng để ôn ngay.` |
| CTA     | `Xem bài học`                                                           |

### SCR-06b — Daily Review empty: done for today

| Element | UI copy                                                                     |
| ------- | --------------------------------------------------------------------------- |
| Eyebrow | `Hoàn thành hôm nay`                                                        |
| Title   | `Đã ôn hết rồi!`                                                            |
| Body    | `Hôm nay không còn flashcard nào đang chờ. Hẹn gặp lại ở lần ôn tiếp theo.` |
| CTA     | None                                                                        |

`FACT`: SCR-06a and SCR-06b use genuinely different titles, bodies, and next actions, satisfying E4 / AC-REV-007.

### SCR-07 — Session Summary

| Element/state                | UI copy                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Eyebrow                      | `Hoàn thành`                                                         |
| Title                        | `Ôn tập xong!`                                                       |
| Summary                      | `Đã ôn {reviewedCount} flashcard`                                    |
| Remembered count             | `{rememberedCount} nhớ`                                              |
| Not remembered count         | `{notRememberedCount} chưa nhớ`                                      |
| Skipped count, when > 0      | `{skippedCount} bỏ qua`                                              |
| Carry-over line, when capped | `{remainingCount} flashcard còn lại sẽ được để dành cho lần ôn sau.` |
| Primary CTA                  | `Xong`                                                               |

`FACT`: completion language does not imply a pass score or correctness threshold; the session completes after every card in the capped snapshot receives one response.

### SCR-08 — Confirm unsave when review history exists

| Element | UI copy                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Title   | `Bỏ lưu flashcard?`                                                                                                        |
| Message | `Flashcard sẽ biến mất khỏi danh sách và phiên ôn hiện tại. Nếu lưu lại sau này, lịch ôn và tiến độ cũ sẽ được khôi phục.` |
| Cancel  | `Giữ lại`                                                                                                                  |
| Confirm | `Bỏ lưu`                                                                                                                   |

`DECISION`: disclose preserved history because it prevents “delete means permanent loss” confusion and accurately reflects BR-FLASH-004/005.

### SCR-09 — Lesson delete guard

| Element        | UI copy                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| Title          | `Chưa thể xoá bài học`                                                                        |
| Message, one   | `Bài học này còn 1 flashcard đang lưu. Bỏ lưu flashcard đó trước khi xoá bài học.`            |
| Message, other | `Bài học này còn {count} flashcard đang lưu. Bỏ lưu các flashcard này trước khi xoá bài học.` |
| Dismiss        | `Để sau`                                                                                      |
| Recovery CTA   | `Xem flashcard`                                                                               |

`DECISION`: “Chưa thể” is a temporary, recoverable condition; “Để sau” is less ambiguous than “Đóng”. The recovery CTA opens SCR-02 filtered by lesson, as fixed in Stage 4a.

## 3. Local-only data disclosure (A-02)

`FACT`: P1 data is stored only on the current device. There is no account sync, backup, restore, or multi-device support; reinstalling the app or losing the device can remove flashcards, schedules, and review history.

`DECISION`: use two placements so the limitation is visible at the moment it becomes relevant and remains discoverable later.

### First-save disclosure — one-time bottom sheet/dialog

- Title: `Flashcard được lưu trên thiết bị này`
- Body: `Flashcard và tiến độ ôn tập hiện chưa được đồng bộ hoặc sao lưu. Dữ liệu có thể mất nếu gỡ cài đặt ứng dụng hoặc đổi, mất thiết bị.`
- Primary CTA: `Đã hiểu`
- Secondary CTA: `Huỷ lưu`

Show immediately before committing the user's first flashcard save. Do not show again after acknowledgement.

### Settings / About note — persistent

- Row label: `Dữ liệu flashcard`
- Summary: `Chỉ lưu trên thiết bị này`
- Detail title: `Dữ liệu flashcard`
- Detail body: `Flashcard, lịch ôn và tiến độ hiện chỉ được lưu trên thiết bị này. Ứng dụng chưa hỗ trợ đồng bộ, sao lưu hoặc khôi phục. Dữ liệu có thể mất nếu gỡ cài đặt ứng dụng hoặc đổi, mất thiết bị.`
- Dismiss action: `Đã hiểu`

`RISK`: a first-save disclosure requires an acknowledgement state. Engineering must persist that acknowledgement locally; otherwise repeated prompts would add friction. If product declines the one-time prompt, the persistent Settings note alone does not fully satisfy “explicit at point of use” communication and should be reviewed at Gate 2.

## 4. Error-message matrix

| ID              | Trigger                                                       | Message                                                                                          | Recovery                                                                                             | Technical detail (logging only)                                                             |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ERR-REV-01      | Atomic rating write fails on SCR-05                           | `Chưa lưu được lựa chọn. Thử lại để tiếp tục.`                                                   | Keep the current card and selected response; disable rating controls during retry; button `Thử lại`. | Log session ID, card ID, attempted outcome, transaction error code. Never log card content. |
| ERR-REV-02      | Retry also fails                                              | Same message; do not escalate tone after repeated attempts.                                      | Keep `Thử lại`; user may exit and resume later.                                                      | Add retry count and last error code.                                                        |
| GUARD-LESSON-01 | User tries to delete a lesson with one active flashcard       | `Bài học này còn 1 flashcard đang lưu. Bỏ lưu flashcard đó trước khi xoá bài học.`               | `Xem flashcard` opens the lesson-filtered list; `Để sau` dismisses.                                  | Log lesson ID and active-card count.                                                        |
| GUARD-LESSON-02 | User tries to delete a lesson with multiple active flashcards | `Bài học này còn {count} flashcard đang lưu. Bỏ lưu các flashcard này trước khi xoá bài học.`    | Same as above.                                                                                       | Log lesson ID and active-card count.                                                        |
| INFO-CAP-01     | Due snapshot exceeds the per-session soft cap                 | `Hôm nay ôn {sessionCount} thẻ. {remainingCount} thẻ còn lại sẽ được để dành cho lần ôn sau.`    | Informational, no action. Repeat shortened form on SCR-07.                                           | Log cap, original due count, selected count; this is not an error.                          |
| EMPTY-01        | Flashcard list contains no saved cards                        | `Chưa có flashcard` / `Lưu từ vựng trong một bài học để xem lại tại đây.`                        | `Xem bài học`.                                                                                       | No error log.                                                                               |
| EMPTY-02        | Daily Review opened and user has never saved a flashcard      | `Chưa có từ nào để ôn` / `Lưu từ vựng trong bài học. Flashcard đầu tiên sẽ sẵn sàng để ôn ngay.` | `Xem bài học`.                                                                                       | No error log.                                                                               |
| EMPTY-03        | Daily Review opened with saved cards but none due             | `Đã ôn hết rồi!` / `Hôm nay không còn flashcard nào đang chờ. Hẹn gặp lại ở lần ôn tiếp theo.`   | No action required.                                                                                  | No error log.                                                                               |

`DECISION`: save/unsave failures outside the atomic rating flow receive no user-visible copy, matching the Stage 4a state matrix. This deck does not invent error states that the approved interaction model excludes.

## 5. Localization and accessibility notes

- `DECISION`: externalize every string; do not concatenate counts, lesson titles, or progress values into Vietnamese fragments.
- `DECISION`: provide singular/other variants for the lesson-delete guard. Vietnamese nouns do not inflect, but pronouns do (`đó` / `các ... này`) and should not be assembled mechanically.
- `DECISION`: format `{current}/{total}` and numeric counts with locale-aware digits. Keep the slash expression accessible as `Thẻ {current} trên {total}`.
- `RISK`: `{lessonTitle}` is user/content-generated and can be long. The filtered header may wrap to two lines; do not truncate the recovery context before the lesson title is distinguishable.
- `RISK`: “Chưa nhớ” and carry-over strings are longer than adjacent controls. Rating buttons and banners must support two lines at larger Dynamic Type sizes without clipping.
- `DECISION`: rating outcomes require text plus icon; color alone must never communicate the choice. Suggested spoken labels: `Nhớ từ này` and `Chưa nhớ từ này`.
- `DECISION`: ellipsis `…` appears only in live loading messages. Do not use three periods.
- `RISK`: “flashcard” is a borrowed term. If later research shows low comprehension for a target segment, test “thẻ từ” as a product-wide terminology change; do not mix both terms within P1.
- `ASSUMPTION`: Vietnamese is the shipped UI language for this handoff. English examples in requirements are semantic references, not strings to ship.

## 6. Open items and ownership

| Label      | Item                                                                                                                                                       | Owner / gate                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `QUESTION` | Confirm the one-time first-save disclosure pattern and whether `Huỷ lưu` is supported by the implementation flow.                                          | Design Lead / Gate 2                      |
| `QUESTION` | Confirm whether SCR-05's close action exits immediately without penalty, as assumed by Stage 4a. No confirmation copy is supplied unless behavior changes. | Design Lead / Gate 2                      |
| `CONFLICT` | Canonical BR-REVIEW-002 still contains SM-2 “Again” wording after fixed-interval D3 approval.                                                              | Product/BA owner to correct canonical PRD |
| `RISK`     | If the product guarantees carry-over specifically to tomorrow, the approved business rule must say so before copy changes from “lần ôn sau” to “ngày mai”. | Product Owner                             |

## 7. Coverage check

`FACT`: all user-visible states in the Stage 4a state matrix now have final copy or an explicit “no visible copy” decision: save toggle, list normal/loading/empty/filtered, flip states, Home widget states, review normal/loading/disabled/error/capped, both Daily Review empty states, summary, unsave confirmation, lesson-delete guard, and A-02 disclosure.

No critical placeholder copy remains in the P1 Flashcards/SRS/Daily Review handoff.
