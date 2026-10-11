# PR 16 – App: kết quả bài, tiến độ unit, nhiệm vụ tổng hợp, ôn theo item

> Trạng thái: **ĐÃ DUYỆT** (2026-10-09) → **ĐÃ CODE** (2026-10-09). Xem §9 cho kết quả và các điểm lệch so với plan.
> Nền: `claude/funny-archimedes-gmioda` (cả hai repo, đã có PR 12–15). Plan giai đoạn: `2026-10-09-phase1-stage3-plan.md` §8.
> Repo: chủ yếu `LingoBites-App`; **một route nhỏ ở `LingoBites-Server`** (G3) vì app chưa có cách lấy nhiệm vụ tổng hợp của unit.

---

## 1. Phạm vi

| Có trong PR 16 | Không có (để sau) |
|---|---|
| Bảng cục bộ `lesson_outcomes`, `unit_outcomes`, `item_memory` (SQLite **v10**) và pull applier | Admin (PR 17) |
| Bước 6: "Đạt bài" / "Đã xong phần luyện" / "Đang chờ kết quả chấm" | XP mới theo C7 (C7 chưa chốt → giữ cách tính hiện tại) |
| Tiến độ unit "đã học x/y · đã đạt z/y", huy hiệu "đạt unit" | Đổi thuật toán ôn của flashcard tự lưu (không thuộc bài học) |
| Màn nhiệm vụ tổng hợp: mở khi B4 thỏa, chấm như bước 5 với đích `unit_id + task_id` | Thông báo đẩy cho lịch ôn item |
| Ôn theo item: đọc `item_memory`, ≤ 20 item/ngày, quá hạn lâu nhất trước (B8) | |
| Today: ôn đến hạn → bài đang học dở → bài tiếp theo (B9) | |
| 2.7: bài pull về có `practice_completed_at` → `lesson_progress` cục bộ thành `completed` | |
| Server: `GET /v1/units/:unitId/summative-task` | |

---

## 2. Quyết định cần xác nhận

Các ô B4, B8, B9 trong Bảng chốt còn trống → dùng đề xuất của bảng.

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | Lưu kết quả server ở đâu trên máy? | Ba bảng mới (v10), khóa chính `(owner_user_id, id)` như `task_answers`. Applier trong `pullWorker` giống `applyEvaluationRecord`: parse đúng schema của `outcomePayloads.ts`, sai thì bỏ qua và ghi log (không ghi nội dung). Tombstone → xóa dòng. Dữ liệu server **luôn thắng**. |
| G2 | Offline thì "đạt bài" tính thế nào? | Theo đúng luật PR 15: đã xong phần luyện (bước 2–4, `lesson_progress`) **và** bước 5 có kết quả `pass_independent` cục bộ (evaluation trong `task_answers`, **không** phải viết thay nói) hoặc tự đánh giá đạt (`assessed_by = self`). Chỉ để hiện ngay; không ghi vào bảng `lesson_outcomes` (bảng đó chỉ chứa dữ liệu server). |
| G3 | App lấy nhiệm vụ tổng hợp ở đâu? | ⚠️ **Route public mới** ở server: `GET /v1/units/:unitId/summative-task` → `{ task: LessonTask | null }` (cùng dạng `LessonTaskSchema` của snapshot: đề, tình huống, `response_mode`, gợi ý, item, tiêu chí; **không** trả câu chấp nhận). Chỉ unit đã publish có tổ tiên đã publish; unit không có task → `task: null`. Không đụng `GET /v1/units/:unitId/lessons` (không đổi contract cũ). OpenAPI tăng 1 path. |
| G4 | Khi nào mở nhiệm vụ tổng hợp (B4)? | `unit_outcomes.summative_unlocked_at` có giá trị. Offline: mọi bài của unit đã xong phần luyện cục bộ. Chưa mở → nút khóa với dòng "Xong phần luyện của mọi bài để mở". |
| G5 | Lượt làm nhiệm vụ tổng hợp ghi vào đâu? | Chỉ `task_answers` + `evaluations` (đích `{unit_id, task_id}`), **không** ghi `activity_attempts` (schema `kind = lesson` bắt buộc `lesson_id/block_id`). Server tính "đạt unit" (PR 15, B5): mọi bài đã đạt **và** nhiệm vụ tổng hợp `pass_independent` do máy chấm. Viết thay nói chấm được nhưng **không** làm đạt unit (P5) — màn hiện rõ điều này. |
| G6 | Màn tổng hợp dựng thế nào? | Dùng lại `IndependentTaskView` (PR 14), tổng quát hóa đích chấm: nhận `target: EvaluationTarget` thay vì tự dựng `{lesson_id, block_id}`. Bước 5 vẫn chạy như cũ (test PR 14 giữ nguyên). Nhiệm vụ tổng hợp **không có gợi ý** (A2: không gợi ý). |
| G7 | Item ôn lấy nội dung ở đâu? | `item_memory` chỉ có `item_code`. Nội dung (chữ tiếng Anh, nghĩa, ví dụ) lấy từ `lesson_items` của các snapshot đã tải (`lesson_downloads.snapshot_json`). Item không còn snapshot trên máy → bỏ qua, hiện "x item cần tải lại bài để ôn". |
| G8 | Chọn item hôm nay (B8) | `due_at ≤ now`, sắp theo `due_at` tăng dần (quá hạn lâu nhất trước), tối đa **20 item/ngày** theo ngày Việt Nam (đếm lượt `kind = review` đã làm hôm nay). Quá 20 thì dời sang hôm sau. |
| G9 | Một lượt ôn item | Thẻ: hiện item → người học nhớ nghĩa → lật thẻ → "Nhớ" / "Chưa nhớ". Mỗi lần bấm ghi `activity_attempts` `kind = review`, `activity = item_recall`, `item_key = item_code`, `result = correct / incorrect`, `lesson_id = null`. Server dời `item_memory` (PR 15). Máy cập nhật **lạc quan** dòng `item_memory` cục bộ bằng bản chép luật `nextMemory` (±1 bậc, chỉ khi đến hạn) để số "đến hạn" giảm ngay; pull sau ghi đè. |
| G10 | Trùng với flashcard đã lưu? | Flashcard có `item_key` nằm trong `item_memory` → **bỏ khỏi danh sách đến hạn của flashcard** (`getDueFlashcards`), lịch của item thắng; không ôn hai lần. Flashcard không thuộc bài học giữ `review_schedule` như cũ. `StepReview` (bước 6, đang dùng `getDueFlashcardsByItemKeys`) đổi sang đọc item đến hạn của **bài này** từ `item_memory`, dùng cùng thẻ G9; giữ hàm cũ cho chỗ khác (không xóa). |
| G11 | Today (B9) | Thứ tự thẻ: (1) ôn đến hạn = item (G8) + flashcard còn lại; (2) bài đang học dở; (3) bài tiếp theo. Số đếm ôn gộp hai nguồn, bấm vào mở màn ôn item trước, xong mới sang flashcard. |
| G12 | 2.7 – học trên máy khác | Applier `lesson_outcomes`: có `practice_completed_at` mà `lesson_progress` cục bộ chưa `completed` → nâng lên `completed` (không bao giờ hạ). |
| G13 | Nhãn bước 6 | `passed_at` (server hoặc G2) → "Đạt bài"; xong phần luyện mà bước 5 còn `pending` → "Đang chờ kết quả chấm"; còn lại → "Đã xong phần luyện" + nút "Làm lại bước 5" (A14: không bỏ hẳn bước 5). Bỏ qua bước 5 vẫn dừng ở "Đã xong phần luyện". |
| G14 | XP (C7) | Giữ nguyên. C7 chốt thì làm PR riêng. |

---

## 3. Thiết kế

### 3.1 SQLite v10 (⚠️ nâng schema)

`APP_SCHEMA_VERSION` 9 → 10, thêm bước `UPGRADE_STEPS[9]`, chỉ **thêm bảng**, không sửa / xóa bảng cũ:

```sql
CREATE TABLE IF NOT EXISTS lesson_outcomes (
  owner_user_id TEXT NOT NULL, lesson_id TEXT NOT NULL,
  practice_completed_at TEXT, passed_at TEXT, passed_by TEXT,
  updated_at TEXT NOT NULL, PRIMARY KEY (owner_user_id, lesson_id));
CREATE TABLE IF NOT EXISTS unit_outcomes (
  owner_user_id TEXT NOT NULL, unit_id TEXT NOT NULL,
  summative_unlocked_at TEXT, passed_at TEXT,
  updated_at TEXT NOT NULL, PRIMARY KEY (owner_user_id, unit_id));
CREATE TABLE IF NOT EXISTS item_memory (
  owner_user_id TEXT NOT NULL, item_code TEXT NOT NULL,
  stage INTEGER NOT NULL, due_at TEXT NOT NULL, stable_at TEXT,
  last_result TEXT, last_reviewed_at TEXT,
  updated_at TEXT NOT NULL, PRIMARY KEY (owner_user_id, item_code));
CREATE INDEX IF NOT EXISTS idx_item_memory_due ON item_memory (owner_user_id, due_at);
```

Xóa dữ liệu tài khoản / đăng xuất: thêm ba bảng vào danh sách bảng bị xóa sẵn có (cùng chỗ `task_answers`).

### 3.2 Applier

`src/core/sync/learningOutcomes.ts`: `applyLessonOutcomeRecord`, `applyUnitOutcomeRecord`, `applyItemMemoryRecord`, nối vào `pullWorker` ở hai chỗ đang gọi `applyEvaluationRecord`. Schema payload ở `src/core/schemas/learningOutcomes.ts`, kiểm bằng fixture `valid-sync-learning-outcomes-pull-response.json` đã chép ở PR 15.

### 3.3 Logic đọc

- `src/features/lesson/flow/logic/lessonOutcome.ts`: `readLessonOutcome(lessonId)` → `{label: 'passed' | 'awaiting_result' | 'practice_done' | 'in_progress', passedBy}` (G2, G13).
- `src/features/course/logic/unitProgress.ts`: thêm `passed` vào `UnitProgress` và `readUnitOutcome(unitId)` (G4).
- `src/features/review/logic/itemReview.ts`: `listDueItems(now, limit)`, `reviewsDoneToday(now)`, `recordItemReview(itemCode, result)` (G8, G9), `itemContentFromSnapshots(codes)` (G7), `nextMemory` chép từ server (có test đối chiếu cùng bộ ca với `itemMemory.test.ts` của server).

### 3.4 Màn hình

- `StepResult.tsx`: nhãn G13 (giữ < 200 dòng; tách `LessonOutcomeBadge.tsx` nếu cần).
- `UnitProgressBar` / `UnitLessonsScreen`: "đã học / đã đạt", nút nhiệm vụ tổng hợp (khóa / mở / đã đạt).
- `SummativeTaskScreen.tsx` (feature `course`): tải task qua `courseClient.fetchUnitSummativeTask`, cache trong `app_settings` theo unit để mở offline; render `IndependentTaskView` với `target = {unit_id, task_id}`.
- `ItemReviewScreen.tsx` (feature `review`): thẻ G9, cuối phiên hiện "x nhớ / y chưa nhớ" và lần ôn tới.
- `TodayScreen` + `todayAdapter`: thứ tự G11.

Import chéo feature chỉ qua `index.ts` (luật module boundary). Chuỗi mới ở `vi.json` và `en.json`.

### 3.5 Server (G3)

`src/modules/curriculum/tasks/controller/tasks.ts`: thêm route public; store thêm `findPublicSummativeTask(unitId)` (điều kiện publish như `listPublicByUnit`). Không migration. Cập nhật đếm OpenAPI (143/174 → 144/175).

---

## 4. File

**App – tạo:** `src/core/schemas/learningOutcomes.ts`, `src/core/sync/learningOutcomes.ts`, `src/features/lesson/flow/logic/lessonOutcome.ts`, `src/features/review/logic/itemReview.ts`, `src/features/review/screens/ItemReviewScreen.tsx`, `src/features/course/screens/SummativeTaskScreen.tsx`, test tương ứng trong `__tests__/`.

**App – sửa:** `src/core/db/migrations.ts`, `src/features/sync/logic/pullWorker.ts`, chỗ xóa dữ liệu tài khoản, `src/features/review/logic/FlashcardRepository.ts` (G10), `src/features/review/index.ts`, `src/features/lesson/flow/components/{StepResult,StepReview,IndependentTaskView}.tsx`, `src/features/course/logic/{unitProgress,courseClient}.ts`, `UnitProgressBar`, `UnitLessonsScreen`, `src/features/today/logic/todayAdapter.ts`, `TodayScreen.tsx`, navigation types, `src/core/i18n/{vi,en}.json`, plan giai đoạn + `2026-10-08-remaining-work-plan.md` §6.

**Server – sửa:** `tasks` controller / model / repository, test route, đếm OpenAPI. Thêm fixture `valid-unit-summative-task-response.json`, chép sang app.

**Không thêm thư viện.** Không xóa file.

---

## 5. Kiểm thử

| Phần | Test |
|---|---|
| v10 | `openRealSqlite`: nâng từ v9 giữ dữ liệu cũ, tạo đủ ba bảng; cài mới ra v10 |
| Applier | payload đúng / sai / tombstone; server ghi đè dữ liệu lạc quan; 2.7 nâng `lesson_progress`, không hạ |
| Đạt bài | bảng ca G2/G13: server có `passed_at`; offline pass_independent; viết thay nói → chưa đạt; pending; bỏ qua bước 5 |
| Unit | mở / khóa theo `summative_unlocked_at` và fallback; đếm đã học / đã đạt |
| Ôn item | chọn ≤ 20, quá hạn lâu nhất trước, đếm theo ngày VN; ghi đúng payload `kind = review`; `nextMemory` cùng ca với server; item thiếu snapshot bị bỏ qua |
| Flashcard | card có item trong `item_memory` không còn "đến hạn"; card ngoài bài giữ lịch cũ |
| Màn | StepResult nhãn; SummativeTaskScreen (khóa, mở, gửi đúng đích, viết thay nói không đạt unit); ItemReviewScreen; Today thứ tự B9 |
| Contract | fixture summative-task parse được ở app; schema payload khớp fixture PR 15 |
| Server | `test:db` route: unit chưa publish → 404, không task → `task: null`, không lộ câu chấp nhận; OpenAPI |

Cổng kiểm (§10 plan giai đoạn): app `yarn tsc`, `yarn lint` (≤ 178/281 warning), `yarn format:check`, `yarn test`; server `yarn tsc`, `yarn lint`, `yarn test`, `yarn test:db`.

---

## 6. Thứ tự commit

Server (làm trước, vì app cần fixture):
1. `feat(curriculum): public summative task of a unit` (+ fixture, test, OpenAPI).

App:
1. `test(contract): copy summative task fixture` + schema `learningOutcomes`.
2. `feat(sync): local learning outcomes (schema v10) and pull appliers` (gồm 2.7).
3. `feat(lesson): step 6 shows lesson pass` + unit progress "đã đạt".
4. `feat(review): item review from item_memory` + bỏ trùng flashcard + `StepReview`.
5. `feat(today): due reviews first`.
6. `feat(course): unit summative task screen` (+ tổng quát hóa `IndependentTaskView`).
7. `style/docs`: lint, format, đánh dấu plan ĐÃ CODE, tick §6.

---

## 7. Rủi ro

- ⚠️ **Nâng SQLite v10**: chỉ thêm bảng, có test nâng từ v9; không có bước hạ (như các bản trước).
- ⚠️ **Route public mới** ở server (G3): chỉ đọc, chỉ dữ liệu đã publish, không trả câu chấp nhận.
- Ôn trùng hai nguồn (item / flashcard): G10 chặn bằng `item_key`; flashcard tạo trước khi có `item_key` (dữ liệu cũ, `item_key = null`) vẫn có thể trùng — chấp nhận, ghi chú.
- Cập nhật lạc quan `item_memory` có thể lệch server (ví dụ ôn trên hai máy cùng ngày) → pull ghi đè, chỉ lệch tạm.
- Snapshot bị xóa → không ôn được item (G7); hiện thông báo thay vì lỗi.
- Chưa thử trên máy thật (như PR 14); điều kiện "Xong khi" của Stage 3 cần team chạy unit mẫu trọn vòng.

---

## 8. Bước tiếp theo

1. Bạn duyệt plan (đặc biệt **G3** route mới, **G9–G10** cách ôn item và bỏ trùng flashcard, **G11** Today).
2. Duyệt xong: code theo §6, server trước rồi app, trên `claude/funny-archimedes-gmioda`.

---

## 9. Kết quả code và điểm lệch so với plan

### 9.1 Commit

| Repo | Commit | Nội dung |
|---|---|---|
| Server | `7e4b414` | `GET /v1/units/:unitId/summative-task` + fixture `valid-unit-summative-task-response.json` + test |
| App | `cfff69c9` | Schema `learningOutcomes`, `UnitSummativeTaskSchema`, chép fixture, test contract |
| App | `7be7a210` | SQLite v10 (3 bảng), applier pull, 2.7 |
| App | `8a2251a1` | Bước 6 "Đạt bài", tiến độ unit "đạt z", trạng thái nhiệm vụ tổng hợp |
| App | `d4f758cb` | Ôn theo item (màn `ItemReview`), bỏ trùng flashcard, bước 1 dùng lịch item |
| App | `39a43565` | Today theo B9 |
| App | `01347c4e` | Màn nhiệm vụ tổng hợp |

### 9.2 Kiểm tra

| Repo | Kết quả |
|---|---|
| Server | `tsc` sạch; `yarn test` 480 pass; `yarn test:db` 270/270 (trước 245); OpenAPI 144 path / 175 operation. `yarn lint` còn 1 lỗi có sẵn (`test/ipa.test.ts:84`) |
| App | `tsc` sạch; Jest 2279 pass (trước 2198); lint 178/281 (không tăng); `format:check` chỉ còn cảnh báo có sẵn ở `package.json` |

### 9.3 Điểm lệch so với plan

1. **G1 – không có cột `owner_user_id`.** Ba bảng mới khóa theo `lesson_id` / `unit_id` / `item_code`. Lý do: dữ liệu học của máy bị xóa hết khi đổi tài khoản (AD-007, `localDataWipe.ts` đã thêm 3 bảng), giống `task_answers`.
2. **G6 – không tổng quát hóa `IndependentTaskView`.** View đó gắn chặt với block, snapshot và phần tự đánh giá của bước 5. Sửa nó dễ làm vỡ PR 14. Thay vào đó có `SummativeTaskView` riêng, dùng lại các phần chấm của PR 14: `taskEvaluation`, `useSelfCheckRecorder`, `RecorderControls`, `EvaluationFeedback`, `EvaluationConsentPrompt`.
   - `EvaluationConsentPrompt` có thêm prop tùy chọn `declineLabel`, để nhiệm vụ tổng hợp ghi "Viết thay nói" thay cho "Tự đánh giá".
   - Bản ghi nói của unit tối đa 90 giây, theo giới hạn của server.
3. **Nhiệm vụ tổng hợp không có tự đánh giá.** Khi chưa chấm được giọng nói (flag tắt, chưa đồng ý, máy không ghi âm được), bài nói chuyển sang viết thay nói. Bài vẫn được chấm nhưng **không** làm đạt unit, và màn có ghi rõ điều này.
4. **Số "đã đạt" ở tiến độ unit chỉ lấy dòng của server.** Không tính cục bộ từng bài, vì cần đọc snapshot và lượt làm của từng bài. Bước 6 vẫn có fallback cục bộ G2 như plan.
5. **`nextItemMemory` trên máy không tính `stable_at`.** Máy không biết chuỗi đúng liên tiếp. Bậc và hạn ôn vẫn tính đúng luật; `stable_at` đến từ lần pull sau.
6. **Today:**
   - Thẻ "Học tiếp" được hiện cả khi đang ở chế độ củng cố (REQ-14 chỉ chặn bài **mới**), ước tính 10 phút.
   - Nếu bài đang học dở cũng là "bài tiếp theo" thì chỉ hiện một thẻ.
   - Checklist ở Home chưa đánh dấu xong bước ôn khi chỉ ôn item, vì màn ôn item không ghi sự kiện `review_session_completed`. Để PR sau nếu cần.
7. **Giới hạn 20 item/ngày** đếm lượt `item_recall` trong `activity_attempts` trên máy, tính theo ngày giờ Việt Nam.
8. **Route server trả nhiệm vụ tổng hợp đầu tiên theo `position`.** Server tính đạt unit khi có bất kỳ nhiệm vụ tổng hợp nào đạt.
9. **Đổi interface trong app.** `AppNavigation` có thêm `openItemReview()`; root stack có thêm route `ItemReview` và `UnitSummativeTask`.
10. **Dọn một lỗi của PR 14.** `pullWorker` có hai nhánh `evaluations` trùng nhau; đã bỏ một nhánh.

### 9.4 Cần test tay trên máy thật

- Unit mẫu "Gọi đồ uống" đi trọn vòng:
  1. Học bước 1–4.
  2. Bước 5 được chấm, bước 6 hiện "Đạt bài" kèm "Sẽ được xác nhận khi đồng bộ"; sau khi đồng bộ, dòng xác nhận mất.
  3. Mở nhiệm vụ tổng hợp, làm và đạt. Tiến độ unit hiện "đạt z".
  4. Hôm sau, Today có "Ôn từ đã học". Ôn xong, lịch dời.
- `json_each` trong `react-native-quick-sqlite` trên máy thật: test Jest chạy trên SQLite của Node.
- Học trên máy A, mở máy B: bài hiện là đã hoàn thành (2.7).

