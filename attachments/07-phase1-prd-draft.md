# PRD — Phase 1 Core Slice (Draft, chờ Human Gate 3)

> **Trạng thái:** Draft tổng hợp sau Stage 1–6 của phiên BA [VIB-115](mention://issue/6edf1ca8-c90d-4dec-a9d9-57ab1811e412). Chưa phải file canonical — squad dev merge vào `docs/01-ba/04-product/07-phase1-prd.md` sau khi qua Human Gate 3. Format bám theo `04-phase0-prd.md`.
> **6-label:** mọi phát biểu mang 1 trong `FACT`/`ASSUMPTION`/`QUESTION`/`RISK`/`CONFLICT`/`DECISION`. Không nhãn = đã hội tụ thành FACT/DECISION qua Stage 3→6 (xem log ở cuối tài liệu nếu cần truy vết nhãn gốc).

## 1. Overview

**LingoBites P1 — Review & Retention (lát cắt lõi).** Sau khi P0 chứng minh core loop "scan → hiểu → lưu lesson", P1 lát cắt lõi giải quyết: **user lưu lessons rồi không quay lại ôn tập.** Ba tính năng liên kết chặt: **Flashcards** (lưu 1 từ vựng riêng khỏi lesson), **Spaced Repetition cơ bản** (lên lịch ôn theo trí nhớ), **Daily Review** (hàng đợi ôn hằng ngày). FACT — nguồn: Stage 1 problem statement, roadmap `06-roadmap-release-plan.md` §3.

## 2. Phase 1 Goals

```text
Lưu từ vựng riêng khỏi lesson → Vào lịch ôn tập SRS → Xuất hiện trong Daily Review khi đến hạn → Ôn và ghi nhận tiến độ
```

Mục tiêu đo được: tăng lesson reopen rate, tăng vocabulary review rate, cải thiện D7/D30 retention (theo roadmap §3 — chưa có target số cụ thể, xem §13 Launch Criteria).

## 3. Target User Problems

- Học xong 1 lesson, không có cách nào quay lại ôn đúng từ đã học mà không mở lại cả bài (Minh, Lan).
- Quá nhiều từ mới trong 1 bài, cần chọn lọc để ôn tập trọng tâm (An).
- Không có cơ chế nào nhắc/định hướng "hôm nay cần ôn gì" — retention rơi rụng sau khi học 1 lần.

FACT — nguồn: `02-personas-journey.md`, tổng hợp qua Stage 3 (VIB-117 §5).

## 4. Product Principles (kế thừa P0 + bổ sung P1)

1. Local-first, giống kiến trúc P0 — không thêm backend/login trong lát cắt lõi này (**DECISION**, hội tụ Stage 3–4, owner xác nhận: Technical & Risk Analyst; residual: không sync đa thiết bị, xem §11 NFR).
2. Không tạo "parallel vocab store" — flashcard tham chiếu `VocabularyItem` gốc, không copy nội dung (**DECISION**, trừ khi Gate 3 chọn Option C ở §9.1).
3. Ship sau feature flag `reviewSystem` (đã có sẵn trong registry, dependency `lessonSave`) — không ảnh hưởng P0 closed beta.
4. SRS/review không phụ thuộc `learning_level` của user (R3 — **đóng**, xác nhận Stage 4 VIB-121 MED-002).

## 5. In-Scope Features (lát cắt lõi P1)

| Feature ID | Feature                  | Priority | Mô tả                                                                                                               |
| ---------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| P1-F-01    | Flashcards               | Must     | Lưu 1 `VocabularyItem` thành flashcard, xem danh sách, xem chi tiết, lật thẻ front/back                             |
| P1-F-02    | Unsave/Delete flashcard  | Must     | Gỡ 1 flashcard riêng lẻ (soft delete), re-save khôi phục đúng schedule cũ                                           |
| P1-F-03    | Spaced Repetition cơ bản | Must     | Tính lịch ôn tiếp theo dựa trên phản hồi user (fixed interval, rating 2 outcome + skip) — xem §9.2 (đã chốt, DD-04) |
| P1-F-04    | Daily Review             | Must     | Hàng đợi thẻ due, snapshot cố định theo phiên, điều kiện hoàn thành phiên                                           |
| P1-F-05    | Due count indicator      | Should   | Hiển thị số thẻ due tại entry point (vị trí UI — xem §9.4 open decision)                                            |

**Ngoài scope P1 phiên này** (để lại phiên sau theo Gate 1): streak, quiz history, favorite lessons, search, level setting.

## 6. Main User Flow

```text
User mở lesson result / saved lesson đã có
→ Xem section Vocabulary
→ Tap "Lưu flashcard" trên 1 VocabularyItem
→ Hệ thống tạo flashcard (idempotent nếu đã lưu), due ngay lập tức
→ [Sau đó] User mở Daily Review
→ Hệ thống dựng snapshot cố định các thẻ due tại thời điểm mở phiên
→ User lật từng thẻ, tự đánh giá (rating hoặc skip)
→ Hệ thống cập nhật lịch ôn tiếp theo, không lặp lại thẻ trong cùng phiên
→ Khi mọi thẻ trong snapshot đã được xử lý → phiên hoàn thành, hiển thị summary
```

FACT — hội tụ Stage 4 (completion rule, VIB-120 CRIT-001 + VIB-121 xác nhận).

## 7. Functional Requirements (consolidated — chi tiết AC đầy đủ tại [VIB-122](mention://issue/190d0509-731b-4875-a49d-6bc3b2fda582) §2)

### Flashcards

| ID           | Requirement                                                                                  | Priority |
| ------------ | -------------------------------------------------------------------------------------------- | -------- |
| FR-FLASH-001 | Lưu 1 `VocabularyItem` từ lesson thành flashcard                                             | Must     |
| FR-FLASH-002 | Hiển thị trạng thái đã lưu/chưa lưu trên vocabulary item                                     | Must     |
| FR-FLASH-003 | Xem danh sách toàn bộ flashcard đã lưu                                                       | Must     |
| FR-FLASH-004 | Xem chi tiết + lật thẻ front/back                                                            | Must     |
| FR-FLASH-005 | Ngăn tạo flashcard trùng lặp cho cùng `VocabularyItem`                                       | Must     |
| FR-FLASH-006 | Nội dung flashcard lấy từ dữ liệu cục bộ, không gọi AI mới                                   | Must     |
| FR-FLASH-007 | Cho phép unsave (gỡ) 1 flashcard riêng lẻ                                                    | Must     |
| FR-FLASH-008 | Gỡ khỏi mọi daily review queue ngay lập tức, kể cả session đang mở, tính lại remaining/total | Must     |
| FR-FLASH-009 | Re-save khôi phục đúng schedule SRS cũ, không reset về thẻ mới                               | Must     |
| FR-FLASH-010 | Xác nhận trước khi unsave thẻ đã có lịch sử ôn tập                                           | Should   |

### Spaced Repetition

| ID         | Requirement                                                                                                              | Priority |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-SRS-001 | Khởi tạo trạng thái + due ngay lập tức cho thẻ mới                                                                       | Must     |
| FR-SRS-002 | Tính `due_at`/interval/state tiếp theo dựa trên phản hồi user — **thuật toán: fixed interval, xem §9.2 (đã chốt DD-04)** | Must     |
| FR-SRS-003 | Persist state/schedule bền vững qua session, cập nhật trong transaction nguyên tử                                        | Must     |

### Daily Review

| ID            | Requirement                                                                                       | Priority |
| ------------- | ------------------------------------------------------------------------------------------------- | -------- |
| FR-REVIEW-001 | Dựng snapshot cố định các thẻ `due_at <= now` khi bắt đầu phiên                                   | Must     |
| FR-REVIEW-002 | Cho phép rating hoặc skip từng thẻ trong phiên                                                    | Must     |
| FR-REVIEW-003 | Phiên hoàn thành khi mọi thẻ trong snapshot đã được xử lý (rating hoặc skip), không ngưỡng % đúng | Must     |
| FR-REVIEW-004 | Empty state phân biệt "chưa từng lưu thẻ" vs "đã ôn hết hôm nay"                                  | Must     |
| FR-REVIEW-005 | Hiển thị số đếm thẻ due tại entry point                                                           | Should   |

## 8. Business Rules (consolidated)

| ID            | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-FLASH-001  | Flashcard tham chiếu `VocabularyItem` + lesson gốc, không nhân bản nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| BR-FLASH-002  | Lưu trùng 1 `VocabularyItem` không tạo bản ghi thứ 2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-FLASH-003  | Phạm vi "card" P1 chỉ gồm `VocabularyItem` — không gồm grammar point/sentence pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| BR-FLASH-004  | Unsave = soft delete; gỡ khỏi mọi queue kể cả session đang mở ngay lập tức; lịch sử review giữ lại (không hiển thị P1)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BR-FLASH-005  | Re-save khôi phục đúng bản ghi cũ (schedule, lịch sử SRS), không tạo thẻ "new"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-SRS-002    | Card state/due date persist bền vững qua session (local-first)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BR-SRS-003    | SRS không dùng `learning_level` làm input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| BR-REVIEW-001 | 1 thẻ "due" khi `due_at <= now`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| BR-REVIEW-002 | 1 phiên hoàn thành khi mọi thẻ trong **snapshot cố định lúc bắt đầu phiên** đã nhận đúng 1 phản hồi (rating `remembered`/`forgot` hoặc skip tường minh); snapshot dựng theo **soft cap N thẻ/phiên (oldest-due-first), phần dư carry-over sang phiên sau** (D4, chốt Gate 1 — xem §9.3); mẫu số tiến độ (progress) là **kích thước snapshot đã cap**, không phải tổng số thẻ due trước cap; skip không đổi `due_at`; cả `remembered` và `forgot` đều cập nhật `due_at` theo lịch fixed-interval, không lặp lại thẻ trong session hiện tại, chỉ due lại ở phiên sau |
| BR-REVIEW-003 | Daily queue cap — **open decision §9.3**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 9. Open Decisions (chưa chốt tại Gate 2 — TranHoangNha approve chung nhưng không chọn cụ thể từng mục; giữ nguyên dạng option theo đúng thiết kế gate)

> **QUESTION cho tất cả 5 mục dưới đây — owner: TranHoangNha.** Gate 2 ([VIB-123](mention://issue/9983d234-0ae3-47c9-9f46-64092c92b31e)) approve tổng thể FR/AC nhưng comment duyệt chỉ ghi "Approve", không chọn phương án cụ thể cho từng mục. Theo đúng thiết kế gate ("approve có điều kiện... giữ dạng option trong PRD"), các mục này được giữ nguyên ở dạng option, KHÔNG tự chọn thay. AC theo từng phương án đã có sẵn tại VIB-122 §2.4 và §2.2 — kích hoạt ngay khi có quyết định, không cần phân tích lại.

### 9.1 CRIT-002 — Chính sách khi xóa lesson còn flashcard active

- **A (2 analyst đều nghiêng phương án này)** — Chặn xóa (`ON DELETE RESTRICT`), yêu cầu unsave hết trước.
- **B** — Cascade xóa flashcard + lịch sử liên quan.
- **C** — Snapshot nội dung tối thiểu vào flashcard (card sống độc lập) — vi phạm nguyên tắc §4.2 trừ khi Architect duyệt ngoại lệ có kiểm soát.
- **RISK liên quan:** `deleteLesson()` đã tồn tại thật ở `LessonRepository.ts:206` (không phải rủi ro tương lai — phát hiện tại Stage 4, VIB-120).

### 9.2 Q1 — Thuật toán SRS — **RESOLVED (DECISION)**

**Chốt: Option 3 — Fixed interval, rating 2 outcome (`remembered`/`forgot`) + skip.** Quyết định tại Human Gate 1 phiên Design (DD-04, [VIB-126](mention://issue/6e4c65c6-2242-47e3-a7bb-3182a14147e9), TranHoangNha duyệt 2026-08-16). Danh sách phương án dưới đây giữ nguyên làm hồ sơ lịch sử quyết định (gồm cả thuật ngữ SM-2 gốc của Option 1, giữ lại có chủ đích để truy vết vì sao Option 1 bị loại) — không sửa nội dung option, chỉ đóng trạng thái open decision:

- **Option 1** — SM-2 giản lược (4 mức Again/Hard/Good/Easy). Cá nhân hóa tốt nhất, chi phí test/migration cao nhất, có dấu hiệu vượt "cơ bản" theo wording gốc issue.
- **Option 2** — Leitner box. Cân bằng, dễ giải thích.
- **Option 3 (đã chọn)** — Fixed interval. Đơn giản nhất, khớp rõ nhất chữ "cơ bản".
- Technical & Risk Analyst tự hạ khuyến nghị Option 1 xuống "cần Product/Learning Specialist chọn", không đề xuất mặc định.

### 9.3 MED-006 — Daily queue cap

- **Option 1** — Không giới hạn, toàn bộ backlog quá hạn vào 1 queue.
- **Option 2** — Soft cap N thẻ/phiên (oldest-due-first), carry-over phần dư. Nếu chọn Option 2, câu chữ BR-REVIEW-002 cần cập nhật theo ("mọi thẻ due" → "mọi thẻ trong snapshot đã cap").

### 9.4 Q8 — Entry point UI

- Tab thứ 4 riêng / widget trên Home / mục con trong Lessons — **chưa có khuyến nghị từ BA** (ngoài phạm vi vai trò). **Lưu ý quan trọng:** nếu chọn tab thứ 4, đây là thay đổi cấu trúc navigation 3-tab P0 hiện tại — theo ràng buộc gốc của issue, bắt buộc TranHoangNha quyết định tường minh, không được để Design Team tự chọn thay. Khuyến nghị: quyết định mục này SỚM, trước khi giao input cho Design Team (VIB-114), vì nó ảnh hưởng toàn bộ layout màn hình liên quan.

### 9.5 MED-004 — PRD Limitation

- Đề xuất: xác nhận đưa mục sau vào §12 Limitations — "P1 chỉ hỗ trợ flashcard cấp vocabulary; nhu cầu 'reusable sentence patterns' của persona Lan (`02-personas-journey.md`) không được đáp ứng, ứng viên cho phiên P1 kế tiếp." Chưa có phản hồi tường minh — tạm đưa vào §12 vì có căn cứ rõ (VIB-119 MED-004, VIB-120 xác nhận), sẽ gỡ nếu TranHoangNha phản đối.

### 9.6 Q5 (kế thừa từ Gate 1) — Push notification/reminder cho Daily Review

- Chưa được trả lời tường minh ở Gate 1 (chỉ có "Approve" bare). Mặc định giả sử **không** nằm trong lát cắt lõi (roadmap gốc không liệt kê). Giữ QUESTION, owner TranHoangNha.

## 10. Data & Validation Rules (kế thừa VIB-118/VIB-121 SYS-01..07, đã revise Stage 4)

- `flashcards` — tham chiếu `lesson_id` + `vocabulary_item_id`, unique `(lesson_id, vocabulary_item_id)`, `archived_at` cho soft delete.
- `review_schedule` — `state ∈ {new, learning, review, relearning, suspended}`, `repetitions`/`interval_days` không âm, `due_at` UTC ISO-8601. Không có `ease_factor` — thuật toán đã chốt là fixed-interval, không phải SM-2 (xem §9.2, D3/DD-04).
- `review_sessions` + `review_session_items` — persist session identity + ordered card IDs để resume đúng qua crash (A-03, **DECISION** — bắt buộc, không phải tùy chọn).
- `review_events` — audit log, không lưu raw vocabulary/nội dung nhạy cảm.
- Mọi mutation rating phải atomic (1 SQLite transaction: schedule + event + session-item).
- Migration mới phải versioned, transaction-safe, idempotent (không dùng cách chạy lại toàn mảng SQL như hiện tại) — **RISK cao nhất của toàn bộ lát cắt (R2, Stage 3)**, cần Mobile Tech Lead review kỹ trước khi implement.

## 11. Non-Functional Requirements (bổ sung cho P1, xem đầy đủ tại VIB-122 §2.5)

| ID                | Requirement                                                                                                                                                                 | Target                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| NFR-REL-SESSION   | Resume đúng snapshot + vị trí sau crash/force-kill                                                                                                                          | Bắt buộc, không mất tiến độ                                                                   |
| NFR-PERF-01       | Due-count/list p95, rating transaction p95                                                                                                                                  | ≤200ms / ≤100ms trên fixture 10k cards (benchmark đề xuất, chưa phải NFR đã duyệt chính thức) |
| NFR-PRI-01        | `clearAllLocalData` xóa 100% dữ liệu P1 trong 1 transaction                                                                                                                 | Bắt buộc                                                                                      |
| NFR-SEC-01        | Không log raw vocabulary/nội dung vào telemetry                                                                                                                             | Bắt buộc                                                                                      |
| NFR-AVAIL-01      | Toàn bộ luồng flashcard/review hoạt động 100% offline                                                                                                                       | Bắt buộc                                                                                      |
| A-02 (limitation) | Local-only P1: mất toàn bộ flashcard/schedule/history nếu reinstall/mất máy, không backup/restore — **cần user-facing communication tường minh** (onboarding/settings copy) | Must ghi rõ cho user                                                                          |

## 12. Limitations (P1)

- Không hỗ trợ ôn tập grammar point hoặc sentence pattern — chỉ vocabulary (§9.5 MED-004, chờ xác nhận cuối).
- Không sync đa thiết bị / không backup / không đăng nhập.
- Không cá nhân hóa theo `learning_level`.
- Không giới hạn số lượng flashcard lưu trữ (chỉ có thể giới hạn workload/ngày tùy §9.3).
- Không có push notification/reminder trong lát cắt lõi này (§9.6).

## 13. Launch Criteria (đề xuất, chưa có target số chính thức)

- Toàn bộ FR **Must** ở §7 có Status ✅ trong traceability matrix (xem đề xuất §14 bên dưới).
- TC-FLASH/SRS/REV Must pass (xem VIB-122 §3, 30 test scenario).
- Migration mới pass fixture test (backup, restore, repeat-launch, interrupted-migration) trước khi bật flag `reviewSystem` cho bất kỳ user nào.
- Ship behind `reviewSystem` flag, default off, không block P0 closed beta.
