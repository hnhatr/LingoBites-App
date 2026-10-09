# PR 15 – Server: đạt bài, đạt unit, ghi nhớ item

> Trạng thái: **CHỜ DUYỆT**. Chưa code.
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server` (+ nhãn / thông báo lỗi nhỏ ở `admin-web`, + 1 commit chỉ chép fixture sang `LingoBites-App`). Nhánh: `claude/funny-archimedes-gmioda`.
> Thuộc Giai đoạn 1 (`2026-10-09-phase1-stage3-plan.md` §7). Cần trước: PR 12 (đã code). Không cần key OpenAI.

## 1. Mục tiêu và phạm vi

Sau PR này server biết, cho từng người học:
1. **Đạt bài** (`lesson_outcomes.passed_at`): xong phần luyện **và** bước 5 đạt độc lập.
2. **Mở nhiệm vụ tổng hợp** và **đạt unit** (`unit_outcomes`).
3. **Lịch ôn từng item** 1–3–7–14–30 ngày (`item_memory`), lên / lùi một mức theo kết quả ôn.
4. Ba thứ trên về app qua sync (collection chỉ đọc, cùng cơ chế `evaluations` của PR 12).

| Trong PR 15 | Ngoài PR 15 |
|---|---|
| `passed_at` + `passed_by`; bảng `unit_outcomes`, `item_memory` (migration 008) | UI bước 6, tiến độ unit, màn ôn, Today (**PR 16**) |
| Tính lại khi: push lượt làm, push lượt ôn, ghi kết quả chấm | Giới hạn 20 item ôn / ngày khi **hiện** (B8 → app, PR 16) |
| Collections chỉ đọc `lesson_outcomes`, `unit_outcomes`, `item_memory` | Tự đánh giá nhiệm vụ tổng hợp (PR 16, xem P5) |
| Luật publish unit thiếu nhiệm vụ tổng hợp (B10, xem P6) | Admin chỉnh khoảng ôn (PR 17) |
| Fixture pull mới (+ chép sang app) | Backfill dữ liệu cũ (P8) |

## 2. Quyết định cần xác nhận

Các ô "Chốt" còn trống (T3, B1–B10, Q7) dùng đề xuất của file ghi nhớ. Bảng dưới là các chỗ đề xuất đó chưa nói đủ để code.

| # | Câu hỏi | Đề xuất |
|---|---|---|
| P1 | Lượt nào làm **đạt bài**? | Bước 5 (task `independent`) có một trong hai:<br>- `evaluations` `pass_independent`, `substitute = false` → `passed_by = service`;<br>- lượt `activity_attempts` `kind = lesson`, step 5, `pass_independent`, `assessed_by` = `self` (B3) hoặc `rule` (task `choose`) → `passed_by = self` / `rule`.<br>`pass_with_support` (B2), viết thay nói (A13), `unscorable`, `fail`: không tính. Thứ tự không quan trọng: đạt bước 5 trước rồi mới xong phần luyện thì `passed_at` đặt lúc xong phần luyện. |
| P2 | `passed_at` có đổi không? | Đặt **một lần, không lùi, không xoá** (như `practice_completed_at`). Đã đạt bằng tự đánh giá, sau đó máy chấm đạt: giữ `passed_at`, đổi `passed_by` sang `service` (nguồn đáng tin hơn, cho báo cáo B3). |
| P3 | **Mở nhiệm vụ tổng hợp** (B4) và **đạt unit** (B5) | Chỉ tính bài **đã publish** của unit:<br>- mở: mọi bài đó có `practice_completed_at`;<br>- đạt unit: mọi bài đó có `passed_at` **và** có `evaluations` `pass_independent`, `substitute = false` cho task `summative` của unit.<br>Unit không có bài publish nào: không mở, không đạt. Cả hai thời điểm đặt một lần, không lùi (admin thêm bài sau không làm mất "đạt unit"). |
| P4 | Lịch ôn (T3, B6, B7, Q7) | - **Vào lịch**: khi bài admin có `practice_completed_at`, mọi item `required` của bài vào `item_memory` mức 0, hạn = +1 ngày. Item đã có thì giữ nguyên (không reset).<br>- **Mức**: 0..4 ↔ 1, 3, 7, 14, 30 ngày.<br>- **Ôn**: lượt `activity_attempts` `kind = review` có `item_key` = mã item. ⚠️ App hiện **chưa gửi** lượt `review` nào (ôn flashcard đi qua `review_events`, luyện tập gửi `kind = practice`); màn ôn theo item của PR 16 sẽ gửi. Lượt `practice` không đổi lịch ôn. Chỉ lượt **đến hạn** (`occurred_at ≥ due_at`) mới đổi lịch, nên một hạn chỉ đổi một lần, ôn sớm không tính.<br>- Đúng (`correct`) → lên 1 mức (tối đa 4); sai (`incorrect`) → lùi 1 mức (tối thiểu 0); `skipped` → bỏ qua. Hạn mới = lúc ôn + khoảng của mức mới.<br>- **Ổn định**: đúng 2 lần liền ở mức có khoảng ≥ 7 ngày (mức 2 trở lên) → `stable_at`, đặt một lần.<br>- Item `extended`, bài người học tự tạo: không vào lịch. Quên item **không** đụng `passed_at`. |
| P5 | Nhiệm vụ tổng hợp không có máy chấm nói (flag `speechEvaluation` tắt) | PR 15 chỉ tính kết quả từ `evaluations`. Khi chưa bật chấm nói, người học **chưa đạt unit được** (viết thay nói không tính). Cách tự đánh giá nhiệm vụ tổng hợp quyết ở PR 16. ⚠️ Nếu muốn đạt unit được ngay khi chưa bật flag: cho viết thay nói **tính** ở nhiệm vụ tổng hợp. Mình đề xuất **không**, giữ đúng A13. |
| P6 | **B10** chặn publish unit thiếu nhiệm vụ tổng hợp | ⚠️ Luật B10 nguyên văn làm hỏng luồng hiện tại: admin publish unit **rỗng** trước rồi mới thêm bài (e2e `ling11-acceptance` làm đúng như vậy), còn task tổng hợp chỉ tạo được khi unit đã có item của bài. **Đề xuất:** unit **chưa có bài nào** vẫn publish được; unit đã có bài mà thiếu task `summative` → **422 `UNIT_SPEC_INVALID`** (vi phạm `SUMMATIVE_TASK_MISSING`). Spec-check của unit báo vi phạm ở trường hợp thứ hai, cảnh báo ở trường hợp đầu. Unit đang publish không bị gỡ. |
| P7 | Collections pull | `lesson_outcomes` (entity = lesson id), `unit_outcomes` (unit id), `item_memory` (mã item). Chỉ server ghi; push vào → 400 `SYNC_COLLECTION_READ_ONLY`. Mỗi lần một dòng **đổi**, ghi lại record (cùng transaction); không đổi thì không ghi (tránh tăng revision vô ích). |
| P8 | Dữ liệu trước PR 15 | Không backfill. Staging sẽ `db:reset` (Giai đoạn 0); production chưa có lượt làm bài 6 bước. |

## 3. Migration `008_learning_outcomes.sql` (+ `.down.sql`)

```sql
ALTER TABLE lesson_outcomes
  ADD COLUMN passed_by varchar(8),          -- service | self | rule
  ADD CONSTRAINT lesson_outcomes_passed_by_check
    CHECK (passed_by IS NULL OR passed_by IN ('service', 'self', 'rule')),
  ADD CONSTRAINT lesson_outcomes_passed_check
    CHECK ((passed_at IS NULL) = (passed_by IS NULL));

CREATE TABLE unit_outcomes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  summative_unlocked_at timestamptz,
  passed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE item_memory (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage BETWEEN 0 AND 4),
  due_at timestamptz NOT NULL,
  streak smallint NOT NULL DEFAULT 0,       -- đúng liền ở mức ≥ 2
  last_result varchar(10),                  -- correct | incorrect
  last_reviewed_at timestamptz,
  stable_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX item_memory_user_due_idx ON item_memory (user_id, due_at);
```

Prisma: thêm `passedBy`, model `UnitOutcomes`, `ItemMemory` (+ quan hệ ngược ở `Users`, `Units`, `Items`). Gộp tài khoản: chuyển `unit_outcomes`, `item_memory` (và `lesson_outcomes`, hiện PR 8 còn sót) theo khoá tự nhiên, cùng chỗ PR 12 đã thêm `evaluations`.

## 4. Tính toán (`src/modules/curriculum/outcomes/`)

Một service duy nhất `learningOutcomes.ts`, mọi hàm chạy **trong transaction của người gọi**:

| Hàm | Gọi từ | Việc |
|---|---|---|
| `recordLessonAttempts(tx, userId, lessonIds)` (có sẵn, mở rộng) | push `activity_attempts` `kind = lesson` | phần luyện (như cũ) → `enrolItems` khi vừa xong → `settleLessonPass` → `settleUnit` |
| `recordReviewAttempts(tx, userId, reviews)` (mới) | push `activity_attempts` `kind = review` có `item_key` | `item_memory` theo P4 |
| `recordEvaluation(tx, userId, evaluation)` (mới) | `PostgresEvaluationStore.record` (PR 12) | `settleLessonPass` (bước 5) hoặc `settleUnit` (tổng hợp) |
| `settleLessonPass` | nội bộ | P1, P2 |
| `settleUnit` | nội bộ | P3 |
| `enrolItems` | nội bộ | P4 "vào lịch" |

Hàm thuần, test không cần DB: `nextMemory(state, result, now)` (P4), `REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30]`.

Mỗi lần một dòng `lesson_outcomes` / `unit_outcomes` / `item_memory` đổi → `writeServerRecord` (PR 12) với payload:

```ts
lesson_outcomes: { lesson_id, practice_completed_at, passed_at, passed_by }
unit_outcomes:   { unit_id, summative_unlocked_at, passed_at }
item_memory:     { item_code, stage, due_at, stable_at, last_result, last_reviewed_at }
```

`item_memory` dùng **mã item** làm entity (app định danh item theo mã, như `flashcards`).

## 5. Publish unit (P6)

- `postgresUnitStore.publish` chạy spec-check unit trong transaction. Unit có ≥ 1 bài (chưa archive) mà `summativeTaskCount = 0` → `UnitSpecInvalidError` → 422 `UNIT_SPEC_INVALID` (body giống `LESSON_SPEC_INVALID`).
- `checkUnitSpec`: `SUMMATIVE_TASK_MISSING` thành **vi phạm** khi unit có bài; vẫn là cảnh báo khi unit rỗng. Input thêm `lessonCount`.
- admin-web: `UnitEditPage` hiện thông báo lỗi 422 (dùng nhãn rule sẵn có trong `specRules.ts`); test Vitest cho thông báo đó.
- Seed unit mẫu đã có task tổng hợp → không đổi. Kiểm lại test `curriculum.test.ts` (publish unit rỗng → vẫn 200).

## 6. Fixture

- `valid-sync-learning-outcomes-pull-response.json`: mỗi collection một record (bài đạt bằng máy chấm, unit đã mở tổng hợp chưa đạt, item mức 2). Khoá SHA ở `fixtures.ts`, test parse bằng schema mới; **chép sang app** (1 commit chỉ fixture + SHA).

## 7. Kiểm thử

| Test | Nội dung |
|---|---|
| `itemMemory.test.ts` (thuần) | lên / lùi một mức, chặn ở 0 và 4, hạn mới, `skipped` bỏ qua, ổn định sau 2 lần đúng ở mức ≥ 2, sai thì `streak` về 0 |
| `learningOutcomes.test.ts` (`test:db`, trên unit mẫu) | - L03: xong phần luyện + câu viết đạt → `passed_at`, `passed_by = service`;<br>- đạt bước 5 trước, xong phần luyện sau → `passed_at` lúc xong phần luyện;<br>- `pass_with_support`, viết thay nói, `unscorable`, `fail` → không đạt;<br>- tự đánh giá đạt → `passed_by = self`; máy chấm đạt sau → `service`, `passed_at` không đổi;<br>- đủ 3 bài xong phần luyện → mở tổng hợp; đủ 3 bài đạt + tổng hợp đạt → đạt unit;<br>- xong phần luyện → item `required` vào lịch, `extended` không;<br>- ôn sai **không** xoá `passed_at` (điều kiện "Xong khi");<br>- ôn chưa đến hạn không đổi lịch; push lặp không đổi thời điểm;<br>- pull thấy 3 collection, revision tăng đúng; push vào chúng → 400;<br>- xoá user cascade |
| `unitPublish` (mở rộng `curriculum.test.ts` hoặc test mới) | unit rỗng publish được; unit có bài, thiếu tổng hợp → 422; có tổng hợp → 200 |
| `specValidator` | `SUMMATIVE_TASK_MISSING` vi phạm / cảnh báo theo `lessonCount` |
| `databaseBaseline.test.ts` | 008 lên / xuống; down của 003 / 002 hạ 008 trước |
| `accountMerge.test.ts` | chuyển `unit_outcomes`, `item_memory`, `lesson_outcomes` |
| Contract (2 repo) | fixture mới parse + SHA |
| admin-web | thông báo lỗi publish unit; Playwright `ling11-acceptance` vẫn xanh (publish unit rỗng) |

**Kiểm cuối:** server `tsc`, unit, `test:db`, `prisma migrate diff` rỗng, lint / format; admin-web lint / typecheck / Vitest / Playwright; app `jest src/core/schemas`.

## 8. Thứ tự commit

1. `feat(outcomes): learning outcome tables (migration 008)`.
2. `feat(outcomes): item memory schedule` (hàm thuần + test).
3. `feat(outcomes): lesson pass, unit outcome and review scheduling` (§4, nối vào push và `record`).
4. `feat(sync): read-only learning outcome collections` (+ gộp tài khoản).
5. `feat(units): a unit with lessons needs its summative task to publish` (§5 + admin-web).
6. `test(contract): learning outcomes pull fixture` (server) + app chép fixture.
7. `docs: mark PR 15 plan as implemented`.

## 9. File tóm tắt

**Thêm (server):** `migrations/008_learning_outcomes.sql` + `.down.sql`; `curriculum/outcomes/model/itemMemory.ts`, `curriculum/outcomes/repository/learningOutcomes.ts`; fixture pull; test ở §7.

**Sửa (server):** `prisma/schema.prisma`; `outcomes/repository/lessonOutcomes.ts`; `sync/model/sync.ts` (3 collection chỉ đọc); `sync/repository/store.ts` (gọi `recordReviewAttempts`); `evaluation/repository/postgresEvaluationStore.ts` (gọi `recordEvaluation`); `spec/service/specValidator.ts`, `spec/repository/postgresLessonSpecStore.ts`; `units/repository/postgresUnitStore.ts`, `units/controller/units.ts`; `admin/repository/adminStore.ts`; `canonicalLesson/model/fixtures.ts`; `package.json` (`test:db`).

**Sửa (admin-web):** `routes/UnitEditPage.tsx` (+ test). **Sửa (app):** 1 fixture + SHA.

**Xoá:** không. **Dependency mới:** không.

## 10. Rủi ro

- ⚠️ **Migration 008**: thêm 2 bảng, thêm 1 cột + 2 ràng buộc vào `lesson_outcomes` (bảng hiện có; giá trị cũ đều null nên ràng buộc qua).
- ⚠️ **Đổi API công khai:** publish unit có thể trả 422 mới (P6); 3 collection pull mới (app cũ bỏ qua).
- **Chi phí push:** mỗi lượt ôn đến hạn tốn 1–2 truy vấn trong transaction push; `settleUnit` đọc các bài của unit. Batch nhỏ (≤ 100) nên chấp nhận được; có index `(user_id, due_at)`.
- **Tự đánh giá tính là đạt bài (B3)** dễ "đạt ảo". Đã ghi `passed_by` để báo cáo tách ra; máy chấm đạt sau sẽ nâng nguồn.
- **P5**: khi chưa bật chấm nói, chưa ai đạt unit được. Đây là hệ quả của A13, cần team biết.
