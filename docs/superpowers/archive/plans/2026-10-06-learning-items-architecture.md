# Kế hoạch: kiến trúc lại hệ thống bài học quanh `learning_items`

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1). Chưa có dòng code nào được sửa.
> Ngày lập: 2026-10-06. Phạm vi: `LingoBites-Server` + `LingoBites-App`.
> Thay thế Phase 2/5 của `2026-10-05-practice-quiz-revival.md` (xem §6).

## 1. Quyết định đã chốt

| # | Quyết định |
|---|---|
| Q1 | Có bảng server `learning_items` (không chỉ key tất định). |
| Q2 | Thêm bước **enrich** vào pipeline tạo bài: một lời gọi AI batch cho cả bài. Lỗi enrich **không** làm hỏng việc tạo bài (soft-fail, bài vẫn dùng được, items bổ sung dần qua phân tích câu). |
| Q3 | **Một thẻ flashcard / một lemma, xuyên bài** (lesson chỉ là "nguồn"). Làm trước; sau đó rà lại UI/UX flashcard đã có và cập nhật. |
| Q4 | Thay `practice_*_v5` / `practice_attempts` bằng `activity_attempts` chung; engine đặt ở `core/learning`. |
| Q5 | Dọn code chết (§5). |

## 2. Mô hình đích

```
SERVER
  learning_items            (lesson_id, kind, item_key) UNIQUE
     kind: word | phrase | grammar
     item_key: chuẩn hoá (lowercase, trim, gộp khoảng trắng) — danh tính xuyên bài
     payload jsonb: word → {word, meaning_vi, ipa, pos}
                    grammar → {name, name_vi, formula, description}
     source: admin | ai · vocabulary_id? (catalog) · sentence_ids jsonb · position
  Nguồn ghi vào learning_items (cùng một hàm derive, idempotent):
     (a) vocabulary/grammar block của admin   (b) enrich lúc tạo bài
     (c) mỗi analysis sinh ra on-demand       (d) script backfill bài cũ
  Snapshot v2: lesson.items[]  (blocks chỉ còn trình bày)

APP
  core/learning:  LearningItem · buildItems(snapshot) · generators (seed tất định) · grader
  flashcards:     1 thẻ / (kind:item_key); bảng flashcard_sources(card_id, lesson_id, sentence)
  grammar_bookmarks: cùng khoá item_key
  activity_attempts (SQLite + sync collection): review | practice | game | shadowing
```

Danh tính xuyên bài = `kind:item_key` (không chứa lesson_id). `learning_items.id` chỉ là khoá dòng theo bài.

## 3. Các PR, theo thứ tự

> Lệnh kiểm tra — Server: `yarn lint && yarn typecheck && yarn test` (+ `yarn test:db` cần Postgres). App: `yarn lint && yarn typecheck && yarn test <pattern>`.

### PR-1 · App · Nới contract + sửa lệch dữ liệu (không migration) — **làm trước**
Lý do thứ tự: `LessonSnapshotSchema` ở server là `.strict()` và app mirror cũng strict → thêm `items` ở server khi app cũ chưa chấp nhận sẽ bị "cập nhật app". App phải phát hành trước.
- `src/core/schemas/lesson.ts`: chấp nhận `items` tuỳ chọn (optional) ở snapshot; type block `data` theo từng `type` thay vì `record<unknown>`.
- `lessonHubContent.ts` `vocabularyFromBlock`: đọc `pronunciation`→ipa, dùng `item.id` (catalog) làm key thay vì `${block.id}-${index}`; test.
- Dọn code chết phía App (xem §5).
- Rủi ro: thấp. Không đổi DB.

### PR-2 · Server · Dọn code chết + đổi tên module
- Gỡ aggregate path (§5), đổi `modules/lessonGeneration` → `modules/lessonText`, cập nhật import + `test:db` list.
- Gỡ route `/v1/vocabularies/:id/seen|progress`, `/v1/me/review` và test liên quan (§5). **Chưa DROP bảng** (xem §7).

### PR-3 · Server · `learning_items` (migration 029) + derive + backfill
- `src/common/database/migrations/029_learning_items.sql` + `.down.sql`; cập nhật `prisma/schema.prisma` (model `LearningItems`, quan hệ `Lessons`, FK `ON DELETE CASCADE`, CHECK `kind`, UNIQUE `(lesson_id, kind, item_key)`, index `(kind, item_key)`).
- Module mới `src/modules/learningItems/{model,repository,service}`: `normalizeItemKey()`, `deriveItemsFromBlocks()`, `deriveItemsFromAnalysis()`, `upsertItems()` (idempotent, không đổi `id` khi trùng khoá).
- Nối vào: `lessonBlockService` / `lessonContentTransaction` (mọi lần ghi block), `SentenceAnalysisService.generate` sau `finalize`.
- `scripts/learning-items-backfill.ts` (`--dry-run` mặc định, `--apply`) cho bài hiện có.
- Test DB: migration up/down, idempotent, xoá bài cascade, trùng khoá.
- ⚠️ **Migration production** — chạy staging trước; backfill chạy sau khi deploy.

### PR-4 · Server · Snapshot v2 + enrich
- `canonicalLesson/model/contract.ts`: `LESSON_CONTRACT_VERSION = 2`, `LessonItemSchema`; `LessonSnapshotSchema.items`; fixtures + digest pin (`fixtures.js`).
- `postgresLessonDeliveryStore.loadCanonicalSnapshot` đọc items (lọc `sentence_ids` về các câu hiện hành).
- `creationEnrich.ts` (mới, cạnh `creationTranslation.ts`): 1 prompt batch (chia lô ≤20 câu) → trả `vocabulary[]`, `grammar[]` theo câu, cùng schema với analysis; ghi vào `sentence_analyses` (ready) + `learning_items` trong transaction `materialize`. Mock provider deterministic cho test.
- Pipeline: soft-fail + metric log (`enrich_failed`), không log nội dung.
- ⚠️ **Đổi contract công khai** (cần PR-1 đã phát hành) và **tăng chi phí AI mỗi bài** — thêm env `CREATION_ENRICH_ENABLED` để tắt khẩn cấp.

### PR-5 · Server · Sync collection `activity_attempts`
- `sync/model/sync.ts` thêm vào `SyncCollectionSchema`; `sync/repository/store.ts` (khuôn `speaking_attempts`); test `syncActivityAttempts.test.ts`. Không cần migration nếu store lưu payload tổng quát (xác minh khi làm).

### PR-6 · App · Schema v5: flashcard theo lemma + `core/learning`
- `src/core/db/schemaV5.ts` (+ down) theo khuôn `schemaV4.ts`; nâng `APP_SCHEMA_VERSION`:
  - `flashcards`: thêm `item_key`, đổi UNIQUE sang `item_key` (tạo bảng mới, copy, đổi tên — SQLite không drop được constraint).
  - Backfill `item_key` từ `word`; **gộp trùng**: giữ thẻ có `interval_days` cao nhất, tombstone các thẻ còn lại (đi qua sync như xoá thường); lịch sử `review_sessions` giữ nguyên.
  - `flashcard_sources(card_id, lesson_id, sentence_text)`; `grammar_bookmarks` thêm `item_key`.
  - `activity_attempts`.
  - Thêm bảng mới vào `localDataWipe.ts` + test account isolation.
- `src/core/learning/`: `LearningItem`, `buildItems(snapshot)` (đọc `items[]`; bản tải cũ không có `items` thì fallback `collectLessonVocabulary`), `itemKey.ts` dùng chung quy tắc chuẩn hoá với server (test chéo bằng fixture).
- `FlashcardRepository.saveFlashcard` nhận `{kind, itemKey}`; `useLessonSavedItems` tra theo `item_key` (từ đã lưu ở bài khác hiện "Đã lưu").
- Test real-sqlite: v4→v5, idempotent, gộp trùng, wipe.
- ⚠️ **Migration dữ liệu người dùng trên máy** — backup bảng cũ (`flashcards_v4_backup`) giữ 1 bản phát hành.

### PR-7 · App · Rà soát & cập nhật UI/UX flashcard
Việc đầu tiên: đọc lại `DailyReviewScreen`, `VocabularyTabContent/RowCard`, `GrammarTabContent/RowCard`, `SaveItemButton`, `LibraryEmptyState` đối chiếu `docs/design`, rồi chụp màn hình thật (iOS/Android, theme sáng/tối, cỡ chữ lớn). Dự kiến thay đổi (xác nhận lại sau rà soát):
- Thẻ hiển thị "Từ N bài" + danh sách bài nguồn; bấm mở đúng bài/câu.
- Nút lưu ở bài khác hiện trạng thái "Đã lưu" đồng nhất.
- Mặt thẻ Ôn tập: ví dụ lấy từ câu nguồn mới nhất; trạng thái trống/giải thích rõ.
- Màn chi tiết thẻ (tuỳ chọn, đang bấm vào chỉ mở bài).
Báo cáo trước/sau kèm ảnh trước khi merge.

### PR-8 · App · Activity engine + Quiz (thay Phase 1–4 của #173)
- `core/learning/generators/*` (port generator/validator/grader tất định từ `9e61936^` phía server và `f295665^` phía app, viết lại cho `LearningItem`): `meaning_choice`, `cloze_choice`, `translation_choice`.
- `features/practice` (UI, route, `openPractice`, điểm vào) như kế hoạch #173 §4.5–4.7 nhưng ghi `activity_attempts` thay `practice_sessions_v5`; sync qua PR-5.
- "Lưu từ sai" → `saveFlashcard`; XP qua `gamification_events`.

### PR-9 · Game & liên quan (sau)
`wordMatch`, `fillBlank`, `sentenceOrder` dùng cùng engine; `speaking_mode` thay khớp từ khoá trong `speakingModes.ts`; `lesson_progress` thêm `position` (câu đang học) cho "Học tiếp".

## 4. Thứ tự phụ thuộc

```
PR-1 ─┬─► PR-4 ─► (PR-6 dùng items[])
PR-2 ─┤
PR-3 ─┘         PR-5 ─► PR-8
PR-6 ─► PR-7 ─► PR-8 ─► PR-9
```
PR-1, PR-2, PR-3, PR-5 độc lập nhau, làm song song được. PR-4 chỉ triển khai sau khi PR-1 đã nằm trong bản app đang chạy.

## 5. Danh sách xoá code (đã được duyệt "làm luôn")

Mỗi mục: `grep` xác nhận không còn caller ngoài test rồi mới xoá.

| Repo | Xoá | PR |
|---|---|---|
| Server | `getLessonAggregate`, `learnerLessonMapper.ts`, `LearnerLesson*` trong `learnerDto.ts`, `apiContracts.ts` (aggregate), test tương ứng | PR-2 |
| Server | Route `/v1/vocabularies/:id/seen`, `/v1/vocabularies/:id/progress`, `GET /v1/me/review`, store + schema + test (module `learning`, `review/reviewHistoryStore` nếu chỉ phục vụ route này) | PR-2 |
| Server | Đổi tên `modules/lessonGeneration` → `modules/lessonText` | PR-2 |
| App | `src/core/api/practiceClient.ts` + test | PR-1 |
| App | `features/sync/logic/api/practiceEventsClient.ts`, nhánh `practice` trong `outboxSync.ts`, `PRACTICE_EVENT_TYPE`/`PracticeEventPayload` trong `core/db/types.ts`, test characterization liên quan | PR-1 |
| App | Hàm không có endpoint trong `learningProgressClient.ts`; `learningReviewClient.ts` nếu không còn caller (F9 đã giữ local SRS) | PR-1 |

**Không xoá** ở đợt này: bảng `user_vocabulary_progress` (xem §7), `/v1/ai/analyses` legacy (chưa nằm trong danh sách duyệt).

## 6. Thay đổi so với kế hoạch #173
- Bỏ `practice_sessions_v5`/`practice_answers_v5` → dùng `activity_attempts` (PR-6). Resume giữa chừng: lưu `in_progress` trong cùng bảng với `questions_json`.
- Bỏ Phase 5 `practice_attempts` → PR-5.
- Generator/validator/grader vẫn port như kế hoạch cũ; nguồn dữ liệu đổi từ `collectLessonVocabulary` sang `LearningItem[]`.

## 7. Rủi ro & lưu ý

| Rủi ro | Giảm thiểu |
|---|---|
| Migration `029` và backfill trên production | Staging trước; backfill idempotent, `--dry-run` mặc định; down-migration |
| Snapshot v2 làm app cũ báo "cập nhật" | PR-1 phát hành trước; bật PR-4 sau khi đa số người dùng đã cập nhật (hoặc giữ cờ server) |
| Chi phí AI tăng (enrich) | Env tắt khẩn cấp; batch 1 lời gọi/20 câu; soft-fail; analysis on-demand thành cache hit nên không gọi lại |
| Gộp thẻ flashcard làm mất tiến độ ôn | Giữ thẻ `interval_days` cao nhất; backup bảng v4; test với dữ liệu giả lập nhiều thẻ trùng |
| Chuẩn hoá `item_key` lệch giữa server và app | Một bộ fixture dùng chung, test ở cả hai repo |
| DROP `user_vocabulary_progress` mất dữ liệu | **Không** DROP trong đợt này; để migration riêng sau khi xuất/kiểm dữ liệu |
| Log lộ nội dung học | Chỉ log id, số lượng, mã lỗi |

**Dependency mới:** không.
**Thay đổi cần chú ý:** migration server 029; schema SQLite v5; contract snapshot v2; xoá route công khai (§5).

## 8. Ước lượng

| PR | Khối lượng |
|---|---|
| 1 | ~1.5 ngày |
| 2 | ~1 ngày |
| 3 | ~2.5 ngày |
| 4 | ~2.5 ngày |
| 5 | ~1 ngày |
| 6 | ~3 ngày |
| 7 | ~2 ngày (+ vòng chỉnh sau khi anh/chị xem ảnh) |
| 8 | ~4 ngày |
| 9 | tách riêng |
