# PR 5 – App: contract bài học mới, SQLite baseline, `core/learning` theo item

> Trạng thái: **ĐÃ CODE** — G1–G5 đã duyệt; commit `8874f35`, `5092a6c` (xem §12 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-App` (React Native CLI 0.85, `react-native-quick-sqlite`, Jest). Nhánh: `claude/optimistic-bell-mfgk44`.
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md`, mục App 1–3. Đọc snapshot theo fixture của PR 2 (đã sửa ở PR 4).

## 1. Mục tiêu và phạm vi

Sau PR này, app **mở được bài học từ server hiện tại**. Hiện app không mở được vì snapshot đã thêm `spec`, `lesson_items`, `tasks` và trường bước của block, trong khi app parse `.strict()`. Song song, phần dữ liệu cục bộ được dựng lại trên **item của danh mục** thay vì từ vựng suy ra theo lemma. PR này chỉ đổi lớp dữ liệu và logic; giao diện mới thuộc PR 6.

| Trong PR 5 | Ngoài PR 5 |
|---|---|
| Contract snapshot và catalog viết lại theo server: `spec`, `lesson_items`, `tasks`, block có `step`/`skill`/`duration_sec`, block `item_cards`; catalog có `code`, `can_do` | UI hub mới, `LessonPatternSection`, mặt thẻ mẫu câu, nhãn "Bài tự tạo" (PR 6) |
| Bỏ versioning v1/v2 và `items[]` (learning items cũ) khỏi contract | Player 6 bước, lượt làm theo task (PR 10–11) |
| SQLite: một **schema khởi tạo** duy nhất thay chuỗi v1–v6; máy đang có DB cũ thì xoá làm lại | Xoá `items[]`/versioning phía server (PR 7) |
| Flashcard định danh bằng **mã item** (`item_code`), bỏ cơ chế gộp thẻ theo lemma | Lịch ôn theo `item_memory` (Stage 3) |
| `core/learning`: item 5 loại từ `lesson_items`; bản sao `itemCode`, `patternFrame` của server; bài tạo từ YouTube/văn bản vẫn lấy từ phân tích câu | |
| Giữ UI hiện tại **chạy được** trên dữ liệu mới (chỉnh tối thiểu) | |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | Contract nhận phiên bản nào? | **Chỉ `contract_version: 1`** với shape mới. Bỏ v2 và `items[]`: server đã tắt `items[]` mặc định (`LESSON_SNAPSHOT_ITEMS_ENABLED=false`) và sẽ xoá hẳn ở PR 7. Snapshot vẫn `.strict()`, để lệch contract là lỗi ngay chứ không âm thầm |
| G2 | Máy đang có DB phiên bản cũ (v1–v6) | Tăng `user_version` lên **7 = baseline**. Mở app thấy phiên bản nằm trong 1–6 thì **xoá toàn bộ bảng rồi tạo lại**, gồm cả bài đã tải và flashcard. Đúng tiền đề T1: chưa có người dùng thật |
| G3 | Định danh flashcard | **Theo mã item** (`item_code`, ví dụ `word:milk`, `pattern:can-i-have`), duy nhất trong các thẻ còn sống. Lưu thêm `item_id` (uuid danh mục) khi biết. Plan tổng nói "theo `item_id`", nhưng bài tự tạo (YouTube, văn bản) chưa có item danh mục cho tới PR 7. Mã item của server được sinh bằng cùng quy tắc chuẩn hoá với `normalizeItemKey` của app, nên từ của bài tự tạo hôm nay (`word:coffee`) sẽ **trùng mã** với item danh mục sau PR 7, không cần migration nào nữa |
| G4 | Bảng `grammar_bookmarks` | **Giữ** trong baseline, vì `LessonGrammarSection` hiện tại vẫn dùng. PR 6 thay bằng `LessonPatternSection` và quyết định bỏ hay giữ bảng |
| G5 | Ngữ pháp từ phân tích câu (bài tự tạo) | **Không** đưa vào learning item ở PR 5, vì nó không phải khung câu. Phần ngữ pháp trong hub vẫn đọc phân tích câu như hiện nay. PR 7 map sang danh mục |

## 3. Contract (`src/core/schemas/lesson.ts`)

### 3.1 Snapshot
- `LessonSnapshotResponseSchema = { contract_version: z.literal(1), lesson }`. Xoá `LESSON_CONTRACT_SUPPORTED_VERSIONS`, `LessonContractVersionSchema` dạng union, `LessonItemSchema`, `LessonItemKindValues`.
- `CanonicalLessonBlockTypeValues = ['text','example','media','context','activity','item_cards']`.
- `LessonBlockSchema` thêm `step: 1..6 | null`, `skill: 'speak'|'listen'|'write' | null`, `duration_sec: int | null`. `data` vẫn là `record` (dữ liệu từng `activityKind` thuộc Stage 2). Thêm helper `itemCardIds(block)` đọc `data.item_ids` an toàn.
- `LessonSnapshotSchema` thêm:
  - `spec: LessonSpecSchema | null`, gồm `code`, `audience`, `can_do[]`, `situation | null`, `estimated_minutes`, `prerequisites[]`;
  - `lesson_items: LessonItemEntrySchema[]`, mỗi phần tử `{ role, introduction, position, item }`. `item` là `CatalogItemSchema`: `id`, `code`, `kind` (5 loại), `text`, `meaning_vi`, `ipa`, `part_of_speech`, `note_vi`, `audience`, `audio`, `image` (media đã resolve URL), `payload` (kiểm theo kind), `examples`, `variants`, `errors`. Các trường đúng như fixture `valid-lesson-snapshot-with-spec-response.json` của server;
  - `tasks: LessonTaskSchema[]`: `id`, `kind`, `title_vi`, `prompt_vi`, `situation`, `response_mode`, `hint_levels`, `item_codes`, `criteria`, `position`.
- `payload` theo kind dùng chung zod với server (bản sao, §4.1): pattern `{ frame, slots }`, pronunciation, listening; word/phrase `{}`.

### 3.2 Catalog
- `LessonCatalogItemSchema` thêm `code?: string | null`, `can_do?: string[]`. Đây là các trường server chỉ gửi khi `include=card_meta`; client đã luôn gửi tham số này.

### 3.3 Fixture
Copy **nguyên byte** từ server `src/modules/canonicalLesson/model/fixtures/` vào `src/core/schemas/__tests__/fixtures/`:
- `valid-lesson-snapshot-response.json`: bản đã pin lại ở PR 4, block `grammar` thay bằng `example`;
- `valid-lesson-snapshot-with-spec-response.json`: mới, là bài L01 của unit mẫu "Gọi đồ uống";
- `valid-lesson-catalog-response.json`.

Test (`lesson.contract.test.ts`) kiểm SHA256 của từng fixture bằng **cùng giá trị pin** với server, đặt trong `fixtures.ts`. Fixture lệch với server là test fail. `LESSON_CONTRACT_FIXTURE_REVISION = 'backward-design-pr5'`.

Test:
- snapshot có spec parse được;
- block type cũ (`vocabulary`, `grammar`) bị từ chối;
- `items[]` bị từ chối (strict);
- `contract_version: 2` bị từ chối;
- payload sai kind bị từ chối.

## 4. `src/core/learning/`

### 4.1 File mới (bản sao thuần của server, có ghi chú "sửa ở cả hai nơi")
- `itemCode.ts`: `ItemKind` (5 loại), `deriveItemCode`, `parseItemCode`. `normalizeItemKey` giữ ở `itemKey.ts`, không đổi tên export (theo code conventions).
- `patternFrame.ts`: `parseFrame`, `expandPattern`. PR 6 dùng cho khung câu chạm-để-đổi và đáp án.
- `itemPayload.ts`: zod payload theo kind (§3.1).
- Fixture copy từ server `test/fixtures/items/*.json` (5 kind) cùng `learning-item-keys.json`. Test chạy các hàm trên cùng dữ liệu với server.

### 4.2 `items.ts` (viết lại)
- `LearningItem` thành union theo 5 kind. Trường chung:
  - `code`, `itemId | null`, `kind`, `text`, `meaningVi`, `ipa`;
  - `role` (`required` | `extended` | `null`), `introduction` (`new` | `recycled` | `prerequisite` | `null`);
  - `sentenceIds`, `source: 'catalog' | 'analysis'`.
- `learningItemsFromSnapshot(snapshot, analyses?)`:
  - Bài **có `lesson_items`** (bài curriculum) dùng chính danh sách đó, đúng thứ tự `position`.
  - Bài **không có** (bài tự tạo) lấy word/phrase từ phân tích câu, như nhánh fallback hiện nay. Mã item là `deriveItemCode`, nên trùng quy tắc với server (G3).
  - Bỏ nhánh đọc block `vocabulary` và đọc `items[]` v2.
- `sentenceIdsContaining` giữ nguyên.

### 4.3 `practice.ts`
Giữ nguyên thuật toán. `buildPracticeSource` lấy item kind `word` | `phrase` từ `learningItemsFromSnapshot`. Pattern, pronunciation và listening chưa có câu hỏi, sẽ thêm ở Stage 2. Test hiện có (407 dòng) chỉ sửa phần dựng dữ liệu đầu vào; kết quả phải giữ nguyên (cùng seed cho cùng câu hỏi).

## 5. SQLite (`src/core/db/`)

### 5.1 Schema khởi tạo
`migrations.ts` được viết lại. Giữ tên file và export `runMigrations`, `APP_SCHEMA_VERSION` để không phải đổi chỗ import.
- `APP_SCHEMA_VERSION = 7`, `BASELINE_STATEMENTS` tạo toàn bộ bảng đang dùng, với shape cuối cùng của v6:
  - `app_settings`, `review_schedule`, `review_sessions`, `sync_outbox`, `audio_assets`, `gamification_events`, `speaking_recordings`, `error_events`;
  - `grammar_bookmarks` (G4), `lesson_downloads`, `lesson_progress`, `speaking_attempts`, `activity_attempts`, `lesson_bookmarks`, `flashcard_sources`.
- **`flashcards` mới:**

  ```sql
  CREATE TABLE flashcards (
    id TEXT PRIMARY KEY,
    item_code TEXT NOT NULL,           -- G3: word:milk, pattern:can-i-have
    item_id TEXT,                      -- uuid danh mục khi biết
    kind TEXT NOT NULL,                -- word|phrase|pattern|pronunciation|listening
    text TEXT NOT NULL,                -- thay word; với pattern là khung câu
    meaning_vi TEXT, ipa TEXT, part_of_speech TEXT,
    example TEXT, example_translation TEXT, source_sentence TEXT,
    is_saved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0, tombstone INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX idx_flashcards_item_code_live ON flashcards(item_code) WHERE tombstone = 0;
  ```

  Bỏ các cột `lesson_id`, `vocabulary_id`, `phrase_from_text`, `word_type`, `pronunciation_guide_vi`, `cefr_level` và ràng buộc `UNIQUE(lesson_id, vocabulary_id)`. Bài nào sinh ra thẻ được ghi ở `flashcard_sources`, như v5.
- `runMigrations(db)`:
  - `user_version = 0` (máy mới): tạo baseline.
  - `user_version` 1–6: **xoá mọi bảng của app** (danh sách lấy từ `sqlite_master`, trừ bảng hệ thống), xoá thư mục media đã tải bằng `localDataWipe`, tạo baseline, rồi ghi log một sự kiện "local schema reset". Đây là G2.
  - `user_version = 7`: không làm gì.
  - Phiên bản lớn hơn 7: giữ lỗi như cách hiện nay xử lý DB mới hơn app.
- `localDataWipe.ts`: danh sách bảng lấy từ một nguồn duy nhất, `BASELINE_TABLES`.

### 5.2 Xoá (cần duyệt)
```
src/core/db/schemaV4.ts
src/core/db/schemaV5.ts                       (merge thẻ theo lemma, bảng backup v4)
src/core/db/schemaV6.ts
src/core/db/__tests__/schemaV4.real-sqlite.test.ts
src/core/db/__tests__/schemaV5.real-sqlite.test.ts
src/core/db/__tests__/schemaV6.real-sqlite.test.ts
src/core/db/__tests__/adversarial/adv-ling172-schema-v2-cutover-real-sqlite.adversarial.test.ts
src/core/db/__tests__/adversarial/adv-ling176-schema-v3-cutover-real-sqlite.adversarial.test.ts
src/core/db/__tests__/adversarial/adv-ling235-schema-v4-real-sqlite.adversarial.test.ts
```
Phần migration legacy và v2/v3 trong `migrations.ts` cũng bị bỏ khi viết lại file này. Hai test adversarial `adv-ling108-*` (thay tài khoản) **giữ**, chỉ sửa phần seed nếu đụng cột cũ của flashcards. `docs/architecture/schema-v5-learning-items-migration.md` **giữ**, thêm dòng đầu "Đã thay bằng baseline v7 (PR 5)".

### 5.3 Test mới
`schemaBaseline.real-sqlite.test.ts`:
- máy mới ra đúng bảng và index;
- DB v6 có dữ liệu thì bị xoá và tạo lại sạch, `user_version = 7`;
- chạy lại hai lần không đổi gì;
- index `idx_flashcards_item_code_live` chặn hai thẻ sống cùng mã nhưng cho phép thẻ đã tombstone.

## 6. Flashcard theo mã item (`src/features/review/logic/FlashcardRepository.ts`)

- `saveFlashcard(input)` nhận `{ item: LearningItem, lessonId, sourceSentence? }`:
  - Tìm thẻ sống theo `item_code`. Có thì thêm dòng `flashcard_sources` và cập nhật `item_id` nếu trước đó null.
  - Không có thì tạo thẻ, lịch ôn và nguồn trong một transaction.
  - **Bỏ** nhánh fallback `(lesson_id, vocabulary_id)` và mọi logic gộp theo lemma.
- Các hàm khác (`listFlashcards`, `getDueFlashcards`, `recordFlashcardRating`…) giữ chữ ký. Riêng kiểu trả về đổi `word` thành `text`, kèm `kind`.
- `useLessonSavedItems.ts` gọi `saveFlashcard` bằng `LearningItem` thay vì entry từ vựng.
- **Sync:** payload của collection `flashcards` đổi theo cột mới. Server lưu payload dạng JSON tự do (`SyncPayloadSchema = record`), nên **không cần sửa server**. `pullWorker` upsert theo cột của bảng, nên chỉ cần kiểm tra lại bằng test. `activity_attempts.item_key` giữ tên trường (server đã có) nhưng giá trị là mã item.

## 7. Giữ UI hiện tại chạy được (chỉnh tối thiểu, UI mới ở PR 6)

| File | Chỉnh |
|---|---|
| `features/lesson/player/logic/lessonHubContent.ts` | `collectLessonVocabulary` lấy word/phrase từ `learningItemsFromSnapshot` thay vì block `vocabulary`. `collectLessonGrammar` chỉ còn đọc phân tích câu (G5). Shape trả về giữ nguyên |
| `CanonicalBlockView.tsx` | Bỏ case `grammar`. Block `item_cards` tạm hiện danh sách text và nghĩa của item, tra trong `lesson_items`; PR 6 làm thẻ đẹp |
| `CanonicalLessonPlayerScreen.tsx` | Bỏ nhánh section `vocabulary`/`grammar` dựa trên block |
| `useLessonSavedItems.ts`, `ReviewCardFaces.tsx`, `DailyReviewScreen.tsx` | Đọc `text` thay cho `word`. Mặt thẻ giữ nguyên |
| `useLibrarySegments.ts`, `usePracticeSession.ts` | Theo kiểu `LearningItem` mới |
| `test/support/canonicalDownloadSeed.ts` và các test seed | Seed snapshot theo fixture mới |

Không thêm màn hình, không đổi bố cục.

## 8. Kiểm thử
- `yarn typecheck`, `yarn lint` (không tăng warning budget, qua `check-module-boundaries`), `yarn format:check`, `yarn test`, `yarn test:adversarial`.
- Test mới hoặc sửa:
  - contract (§3.3);
  - `itemCode`/`patternFrame`/`itemPayload` trên fixture của server;
  - `items.test.ts`: bài curriculum lấy `lesson_items` đúng thứ tự và kind, bài tự tạo lấy từ phân tích câu, mã item trùng với `deriveItemCode`;
  - `practice.test.ts` (đầu vào mới, kết quả giữ nguyên);
  - schema baseline (§5.3);
  - `FlashcardRepository`: lưu cùng mã từ hai bài thì ra 1 thẻ và 2 nguồn; item không có `item_id` sau đó được bổ sung id;
  - `canonicalDownloadRepository`: lưu và đọc snapshot có spec;
  - `PracticeScreen.real-sqlite.test.tsx` chạy trên seed mới.
- **Chạy tay (nếu môi trường cho phép):** server local có seed unit mẫu (`yarn seed:sample-unit`), gọi `fetchLessonSnapshot` qua test tích hợp với snapshot thật của bài L01 để chắc parse được. Không chạy được simulator iOS/Android trong môi trường này; mình sẽ ghi rõ phần chưa kiểm được.

## 9. Thứ tự commit
1. `feat(schemas): lesson contract with spec, lesson items, tasks and block steps` (schema, fixture và SHA, test contract, client catalog).
2. `feat(learning): catalog item kinds, item codes and pattern frames` (`itemCode`, `patternFrame`, `itemPayload`, `items.ts`, `practice.ts`, test).
3. `refactor(db): single baseline schema v7 with a local reset` (`migrations.ts` mới, xoá theo §5.2, test baseline, `localDataWipe`).
4. `feat(review): flashcards keyed by item code` (repository, saved items, sync payload, test).
5. `fix(lesson): keep the current hub and player on the new snapshot` (§7, sửa seed và test UI).

Commit 1–2 chưa đụng DB. Commit 3–4 phải đi cùng nhau mới chạy đúng; nếu cần, mình gộp thành một commit.

## 10. File tóm tắt
- **Tạo mới:**
  - `src/core/learning/{itemCode,patternFrame,itemPayload}.ts` (+ test, fixture);
  - `src/core/schemas/fixtures.ts`;
  - `src/core/schemas/__tests__/fixtures/valid-lesson-snapshot-with-spec-response.json`;
  - `src/core/db/__tests__/schemaBaseline.real-sqlite.test.ts`.
- **Sửa:**
  - `src/core/schemas/lesson.ts`;
  - `src/core/learning/{items,practice,index}.ts`;
  - `src/core/db/{migrations,localDataWipe,types}.ts`;
  - `src/features/review/logic/FlashcardRepository.ts`;
  - `src/features/lesson/player/{logic,components,screens}/…` (§7);
  - `src/features/lesson/library/logic/useLibrarySegments.ts`;
  - `src/features/practice/logic/usePracticeSession.ts`;
  - `src/features/review/{components/ReviewCardFaces,screens/DailyReviewScreen}.tsx`;
  - các test và seed liên quan.
- **Xoá:** §5.2 (cần duyệt).
- **Dependency mới:** không.

## 11. Rủi ro
- ⚠️ **Xoá dữ liệu cục bộ** (G2) trên mọi máy đang chạy bản dev: mất bài đã tải, flashcard, lịch ôn và tiến độ chưa sync. Chấp nhận theo T1. Server cũng đã reset nên không còn gì để sync về.
- ⚠️ **Contract strict:** server bật lại `LESSON_SNAPSHOT_ITEMS_ENABLED=true` thì app sẽ không mở được bài (G1). Cờ này bị xoá ở PR 7; trong lúc chờ, **không bật** nó.
- **Giai đoạn chuyển tiếp UI:** từ PR 5 tới PR 6, hub bài curriculum hiện từ và cụm theo `lesson_items` nhưng chưa có mẫu câu, thẻ `item_cards` chỉ là danh sách đơn giản, và phần ngữ pháp chỉ còn từ phân tích câu. Chức năng không hỏng, chỉ chưa đẹp.
- **Logic nhân đôi** giữa server và app (`itemCode`, `patternFrame`, `itemPayload`). Giảm thiểu bằng test trên cùng fixture, SHA pin và ghi chú đầu file.
- **Khối lượng:** đụng khoảng 25 file và xoá 9 file. Có thể tách **PR 5a** (commit 1–2, không đụng DB) và **PR 5b** (commit 3–5).

## 12. Kết quả code và điểm lệch so với plan

Kiểm tra cuối: `tsc` sạch, lint 0 lỗi (budget 178/281, không nâng), `format:check` sạch, Jest 292 suite / 2113 test pass (3 skip). Chưa chạy trên simulator/thiết bị.

- **Gộp commit:** commit 1–2 và phần UI tối thiểu của commit 5 gộp thành `8874f35` vì tách riêng thì `tsc` đỏ. Commit 3–4 (SQLite + flashcard) là `5092a6c`.
- **Cột `flashcards` giữ tên cũ** (`word`, `item_key`, `vocabulary_id`, `lesson_id`) thay vì đổi sang `text`/`item_code`, để không phải viết lại mock SQLite đọc tham số theo vị trí. `item_key` giờ chứa mã item của danh mục, `NOT NULL`, với index unique trên thẻ còn sống (`tombstone = 0`). Thêm `item_id` và `kind`. Bỏ `UNIQUE(lesson_id, vocabulary_id)` và đường tìm dự phòng theo cặp đó.
- **Kiểm tra payload item** nằm trong `core/learning/itemPayload.ts`; contract vẫn để payload là `record`, giống server.
- **`spec`, `lesson_items`, `tasks` là tuỳ chọn** trong schema app, khớp với cờ `LESSON_SNAPSHOT_SPEC_ENABLED` của server.
- **Reset cũng áp dụng cho bản cài chưa có version** (`user_version = 0` nhưng đã có bảng): mọi bảng bị xoá rồi dựng baseline v7 trong một transaction.
- **Test characterization/adversarial nâng cấp** (audio cache, engagement, speaking) giờ seed dữ liệu cũ trên baseline thay vì schema 403bc52.
- **Assertion `content_packages` trong test today** chuyển sang `schemaBaseline.real-sqlite.test.ts`, vì mock không mô phỏng được bảng đã xoá.
- **Thư mục media của bài đã tải** không bị xoá chủ động khi reset; chỉ bảng `lesson_downloads` bị xoá. File media cũ có thể còn trên máy dev (mồ côi); chưa có bước dọn.
- **`localDataWipe`** dùng danh sách bảng tường minh (`flashcard_sources`, `activity_attempts`, `lesson_bookmarks`) thay cho `SCHEMA_V5/V6_TABLES`.
- **Lưu từ hub** gửi mã item nhưng chưa có `item_id`; `item_id` được điền sau (`COALESCE`) khi lưu từ luyện tập.
- **Thêm adapter pull cho `flashcards`:** bản ghi thiếu `item_key` được suy ra từ `word`; không suy ra được thì bỏ qua, để không làm kẹt phân trang. Có test `pullWorker.flashcards.real-sqlite.test.ts`.
- **Fixture contract** (`src/core/schemas/__tests__/fixtures/`) được loại khỏi Prettier để giữ đúng từng byte theo SHA pin của server.
