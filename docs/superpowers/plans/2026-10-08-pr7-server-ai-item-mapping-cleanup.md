# PR 7 – Server: map item AI vào danh mục, dọn mô hình cũ, bỏ versioning contract

> Trạng thái: **ĐÃ CODE**: G1–G8 đã duyệt; commit server `900f6d5` → `d898ea6` (xem §12 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-Server` (+ một phần nhỏ `admin-web`). Nhánh: `claude/optimistic-bell-mfgk44`.
> Đây là PR cuối của Stage 1 trong `2026-10-07-backward-design-curriculum-plan.md`, gồm mục Server 7–8 và lịch xoá ở §9 của plan PR 2 / §6.4 của plan PR 4.

## 1. Mục tiêu và phạm vi

Sau PR này:
- Pipeline AI tạo bài (YouTube, văn bản, OCR) và phân tích câu theo yêu cầu **ghi từ và cụm vào danh mục `items`** (`source=ai`, `status=draft`) rồi gắn vào bài qua `lesson_items`.
- Hệ thống không còn `learning_items`.
- Server bỏ hết phần của mô hình cũ còn sót: bảng `vocabularies`, `user_vocabulary_progress`, `items[]` trong snapshot, contract v2 và hai cờ snapshot.

| Trong PR 7 | Ngoài PR 7 |
|---|---|
| Service `aiItemMapping`: từ / cụm trong phân tích câu → tìm item theo `code`, chưa có thì tạo nháp `source=ai` | Map ngữ pháp từ phân tích câu thành mẫu câu (G2) |
| Gắn `lesson_items` cho bài tạo bằng pipeline (bài người học và bài admin) | Đưa `lesson_items` của bài người học vào snapshot (G1) |
| Gọi mapping ở 2 chỗ: lúc pipeline lưu bài, và sau khi phân tích một câu theo yêu cầu | Duyệt item AI hàng loạt trên admin (G4) |
| Route adopt (copy bài người học sang curriculum) copy cả `lesson_items` | Seed unit mẫu: **đã làm ở PR 2** (`5758f28`), PR này không đổi |
| **Xoá** `learning_items`, `rebuildLearningItems` (4 chỗ), module `learningItems`, script backfill | Player 6 bước, lượt làm (Stage 2) |
| **Xoá** bảng `vocabularies`, `user_vocabulary_progress`, thống kê vocab trên trang user (server + admin-web) | Thay đổi app (G1 giữ app nguyên) |
| **Xoá** `items[]` trong snapshot, `LESSON_CONTRACT_VERSION_ITEMS`, cờ `LESSON_SNAPSHOT_ITEMS_ENABLED` và `LESSON_SNAPSHOT_SPEC_ENABLED` | |
| Trang usage của item: bài người học chỉ hiện số lượng (G5) | |

**Đã có sẵn, không làm lại:**
- Seed unit mẫu "Gọi đồ uống" (PR 2).
- Bộ lọc `Source = AI` trên trang danh sách item của admin-web (PR 3).
- Snapshot chỉ trả `spec` / `lesson_items` / `tasks` cho bài `origin = admin` (`loadSpecParts`).

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Snapshot của bài người học có trả `lesson_items` không?** Nếu trả, app PR 6 sẽ chuyển hub bài tự tạo sang các hàng của bài curriculum: mất hàng Ngữ pháp, và từ của câu phân tích sau khi tải về không hiện cho tới khi tải lại bài. | **Không trả (giữ như hiện nay).** Server vẫn ghi `lesson_items` cho bài người học để có dữ liệu (cách dùng item, Stage 3 ôn theo item), còn snapshot vẫn trả `[]`. App giữ nguyên và tự suy item từ phân tích câu. Mã item app tự suy **trùng** với mã server tạo (cùng `normalizeItemKey`), nên flashcard đã lưu vẫn khớp. Khi nào muốn hiện ra thì làm một PR app riêng. |
| G2 | **Ngữ pháp trong phân tích câu** có map thành item `pattern` không? | **Không.** Phân tích ngữ pháp của AI là mô tả ("Present simple", "S + V"), không phải khung câu có chỗ trống và giá trị. Ép thành pattern sẽ tạo rác trong danh mục. Ngữ pháp vẫn nằm trong `sentence_analyses` và hiện như cũ ở bài tự tạo. Câu hỏi Q5 / Q7 của master plan về pattern do AI sinh để lại cho sau. |
| G3 | **Item đã có trong danh mục** (cùng `code`) thì xử lý thế nào? | **Dùng lại nguyên trạng.** Không sửa nghĩa, IPA hay trạng thái của item đã có (kể cả item `draft` / `archived`). Item **chưa có** thì tạo mới với: `kind` = word hoặc phrase theo mã, `text` = từ AI trả, `meaning_vi`, `ipa`, `part_of_speech`, `audience = all`, `payload = {}`, `source = ai`, `status = draft`. Dùng `INSERT … ON CONFLICT (code) DO NOTHING` rồi đọc lại, để hai request song song không đụng nhau. Từ không suy ra được mã (`deriveItemCode` trả null) thì bỏ qua. |
| G4 | **Vai trò khi gắn vào bài.** | Mọi item AI gắn với `role = extended`, `introduction = new`, `position` nối tiếp cuối danh sách; item đã có trong bài thì bỏ qua. Với **bài admin tạo bằng pipeline**, admin thấy các item này trong tab Item. Validator (PR 2) chặn publish khi bài tham chiếu item chưa publish, nên admin buộc phải duyệt (publish item) hoặc gỡ: "AI chỉ gợi ý, có người duyệt" (T3). **Không** làm duyệt hàng loạt trên admin: dùng bộ lọc `Source = AI` và publish từng item như hiện có. |
| G5 | **Riêng tư:** item AI có thể đến từ bài riêng của người học, và trang usage của item hiện tên bài đang dùng nó. | Route `GET /v1/admin/items/:id/usage` **chỉ liệt kê bài `origin = admin`**, cộng thêm số đếm `learner_lesson_count`. Admin-web hiện "Đang dùng trong N bài của người học", không có tên hay link. Bản thân item chỉ chứa từ và nghĩa, không có dữ liệu người dùng. |
| G6 | **Adopt** (copy bài người học thành bài curriculum). | Copy cả `lesson_items` của bài gốc sang bài mới, giữ thứ tự, vai trò `extended`. Bỏ lời gọi `rebuildLearningItems`. |
| G7 | **Danh sách xoá** (§6). Cần bạn duyệt rõ theo VibeGuard §2. | Xoá đúng danh sách ở §6. |
| G8 | **File môi trường và tài liệu.** `.env.example` và `README.md` đang ghi `LESSON_SNAPSHOT_ITEMS_ENABLED` / `LESSON_SNAPSHOT_SPEC_ENABLED`. CLAUDE.md của server yêu cầu xin phép trước khi sửa file môi trường. | **Xin phép xoá 2 dòng này trong `.env.example`** và 2 dòng trong bảng biến môi trường của `README.md`. Không đụng `.env` thật. `CREATION_ENRICH_ENABLED` giữ nguyên. |

## 3. Service `aiItemMapping` (mới)

File: `src/modules/items/service/aiItemMapping.ts`. Đặt trong module `items` vì nó ghi vào danh mục.

```ts
/** Vocabulary of stored analyses → catalog items (source=ai) + lesson_items. */
export async function mapAnalysesToCatalog(
  tx: Prisma.TransactionClient,
  input: {
    lessonId: string;
    analyses: ReadonlyArray<{ vocabulary: AnalysisVocabularyItem[] }>;
    now?: Date;
  },
): Promise<{ created: number; linked: number }>;
```

**Các bước:**
1. **Gom từ:** duyệt mọi `vocabulary` theo thứ tự câu. Bỏ mục có `word` hoặc `meaning` rỗng. Tính mã bằng `deriveItemCode(kind, word)`, trong đó `kind` = phrase nếu có khoảng trắng, ngược lại word (tính trên `normalizeItemKey(word)` của `items/model/itemCode.ts`). Trùng mã thì giữ mục đầu.
2. **Tạo item thiếu:** `INSERT INTO items (...) VALUES ... ON CONFLICT (code) DO NOTHING` theo lô, rồi `SELECT id, code FROM items WHERE code = ANY($codes)`.
3. **Gắn vào bài:** đọc `lesson_items` hiện có của bài, rồi thêm các item chưa có với `position` = max + 1, + 2, …
4. **Không ném lỗi nghiệp vụ.** Lỗi DB sẽ làm transaction của người gọi rollback, giống hành vi `rebuildLearningItems` hiện tại.
5. **Giới hạn:** tối đa 300 item mỗi lần gọi (hằng `AI_ITEMS_PER_CALL_MAX`) để chặn bài cực dài. Phần vượt thì bỏ và ghi `logger.warn` chỉ với số lượng, không log nội dung.

**Kiểm tra dữ liệu AI trước khi ghi:**
- Dùng lại `AnalysisVocabularyItemSchema` của contract.
- Mục vượt giới hạn cột thì bỏ, không cắt chữ: `text` ≤ `ITEM_TEXT_MAX` (500), `meaning_vi` ≤ `ITEM_MEANING_MAX`, `ipa` ≤ `ITEM_IPA_MAX` (255). `part_of_speech` dài quá 64 ký tự thì ghi null.
- `meaning_vi` bắt buộc khác rỗng.
- Mã không qua `parseItemCode` → bỏ.

## 4. Nơi gọi

| Chỗ | Trước | Sau |
|---|---|---|
| `creationRequestStore.materialize` (pipeline lưu bài) | `rebuildLearningItems(tx, lessonId)` sau khi ghi `sentence_analyses` | `mapAnalysesToCatalog(tx, {lessonId, analyses})`, trong cùng transaction (INV-008: bài và item cùng commit hoặc cùng rollback) |
| `SentenceAnalysisService.onAnalysisStored` (phân tích câu theo yêu cầu, `lessonSentences.ts`) | `LearningItemService.refreshAfterAnalysis(lessonId)` | `mapAnalysesToCatalog` cho đúng analysis vừa lưu, trong transaction riêng. **Best effort:** lỗi chỉ `logger.warn` và không làm hỏng response phân tích |
| `lessonSentenceStore` (sửa câu) | `rebuildLearningItems` | **Bỏ lời gọi.** Câu mới chưa có phân tích; khi được phân tích sẽ map lúc đó. Item cũ vẫn gắn với bài (xem Rủi ro) |
| `lessonContentTransaction` (sửa block) | `rebuildLearningItems` | **Bỏ lời gọi.** Item của bài admin do admin quản lý ở tab Item |
| `adminLessonMove` (adopt) | `rebuildLearningItems(tx, newId)` | Copy `lesson_items` của bài gốc (G6) |

## 5. Contract và snapshot

- `contract.ts`:
  - **xoá** `LESSON_CONTRACT_VERSION_ITEMS`, schema cho phép `1 | 2`, `LearningItemKindValues` và schema item v2;
  - snapshot luôn trả `contract_version: 1`.
- `postgresLessonDeliveryStore`:
  - **xoá** `loadItems` (đọc `learning_items`) và nhánh `itemsEnabled`;
  - `spec` / `lesson_items` / `tasks` luôn được trả (chỉ còn phụ thuộc `origin`, như hiện nay).
- `env.ts`: **xoá** `lessonSnapshotItemsEnabled` và `lessonSnapshotSpecEnabled`.
- **Fixture:**
  - **xoá** `valid-lesson-snapshot-with-items-response.json` và mục SHA của nó trong `fixtures.ts`;
  - `valid-lesson-snapshot-response.json` và `…-with-spec-response.json` **không đổi**, nên SHA pin bên app vẫn khớp và app không cần sửa.
- OpenAPI: cập nhật test đếm path / operation nếu thay đổi. Dự kiến không đổi route, chỉ đổi schema response.

## 6. Danh sách xoá (cần duyệt, G7)

**Server:**
- `src/modules/learningItems/**`, 5 file: `model/itemKey.ts`, `model/learningItem.ts`, `repository/learningItemStore.ts`, `service/deriveItems.ts`, `service/learningItemService.ts`.
- `src/modules/vocabulary/model/record.ts`. Không còn ai import; đây là file cuối của module `vocabulary`.
- `scripts/learning-items-backfill.ts` và 4 script `learning-items:backfill*` trong `package.json`.
- Test: `test/learningItems.test.ts`, `test/deriveLearningItems.test.ts`, `test/learningItemKey.test.ts`.
  - Các ca `items[]` / v2 trong `canonicalLessonContract.test.ts` và `canonicalLessonDelivery.test.ts` được sửa, không xoá cả file.
  - Các tham chiếu `vocabularies` trong `adminContentDelete`, `curriculum`, `lessonBlock*`, `legacySystemsRetired`, `resourceMigrationTestHelpers` được sửa theo.
- Fixture `valid-lesson-snapshot-with-items-response.json`.
- **Migration `005_retire_learning_items.sql`** (+ `.down.sql`): `DROP TABLE learning_items, user_vocabulary_progress, vocabularies`.
  - File `.down` tạo lại cấu trúc rỗng (không có dữ liệu), theo cách các migration 002–004 đã làm.
  - Prisma: xoá model `LearningItems`, `Vocabularies`, `UserVocabularyProgress` và các quan hệ trên `Lessons` / `Users`; chạy lại `prisma generate`.
- `adminUsersStore.ts`:
  - **xoá** `vocabulary_progress` khỏi thống kê user;
  - **xoá** danh sách `vocabulary` (join `vocabularies`) khỏi chi tiết user.

**Admin-web:**
- `UserTabs.tsx`: bảng Vocabulary.
- `UserDetailPage.tsx`: ô "Words tracked" và câu "N tracked words".
- `api/types.ts`: trường `vocabulary_progress`, `vocabulary` của user và kiểu `VocabularyStatus` nếu không còn ai dùng.
- Test tương ứng: `UserDetailPage.test.tsx`.
- **Giữ** `AnalysisVocabularyItem`: đây là từ trong phân tích câu, vẫn dùng ở `LessonSentencesSection`.

**Tài liệu (G8):** 2 dòng trong `.env.example`, 2 dòng trong `README.md`, và câu nhắc `LESSON_SNAPSHOT_SPEC_ENABLED=false` trong `docs/01-ba/02-technical/05-data-model.md`.

## 7. Admin-web: usage của item (G5)

- Server: `ItemUsage` thêm `learner_lesson_count: number`; `lessons[]` chỉ còn bài `origin = admin`.
- `ItemUsagePanel.tsx`: thêm dòng "Đang dùng trong N bài của người học" khi N > 0.
  - Nút xoá item vẫn bị chặn khi có bất kỳ `lesson_items` nào (FK `Restrict` sẵn có), và thông báo lỗi nêu cả số bài người học.
- Không đổi gì khác trên trang danh sách item: bộ lọc `Source` đã có, item AI đã có nhãn `ai`.

## 8. Kiểm thử

| Test | Nội dung |
|---|---|
| `test/aiItemMapping.test.ts` (mới, `test:db`) | - Tạo item `source=ai, status=draft` cho từ chưa có, và đúng kind word / phrase theo mã;<br>- dùng lại item admin đã có (không sửa nghĩa / trạng thái);<br>- trùng từ trong bài → một item, một dòng `lesson_items`;<br>- gọi lần hai không nhân đôi, `position` nối tiếp;<br>- từ không suy ra mã hoặc nghĩa rỗng bị bỏ qua;<br>- hai lời gọi song song cùng mã không lỗi (`ON CONFLICT`);<br>- vượt giới hạn 300 chỉ ghi 300. |
| `canonicalLessonCreation.test.ts`, `adminYoutubeLessonCreation.test.ts`, `creationReuse.test.ts` | Bài tạo xong có `lesson_items` khớp từ trong phân tích; bài admin tạo bằng pipeline có item `extended`; enrich tắt thì không có item. Transaction lỗi thì không còn item mồ côi được gắn bài. |
| Test phân tích theo yêu cầu (`lessonSentences` / `sentenceAnalysis`) | Phân tích một câu → item mới được gắn bài; mapping lỗi (giả lập) thì response phân tích vẫn 200. |
| `lessonSpecRoutes.test.ts` / validator | Bài admin có item AI `draft` → `spec-check` báo item chưa publish; publish item rồi thì hết lỗi đó. |
| `adminLessonMove` (adopt) | Bài mới có `lesson_items` giống bài gốc. |
| `canonicalLessonDelivery.test.ts`, `canonicalLessonContract.test.ts`, `lessonSpecSnapshot.test.ts` | Không còn `items` hay `contract_version: 2`; bài người học vẫn `lesson_items: []` dù DB có dòng (G1); SHA hai fixture còn lại không đổi. |
| Item usage | Bài người học chỉ có số đếm; bài admin vẫn có tên. |
| `databaseBaseline.test.ts` | Migration 005 lên / xuống; bảng đã bị bỏ không còn. |
| `openApiDocument.test.ts` | Cập nhật nếu số schema thay đổi. |
| admin-web Vitest | `UserDetailPage` không còn thống kê vocab; `ItemUsagePanel` hiện số bài người học. |
| Playwright `e2e/lesson-spec.spec.ts`, `items.spec.ts` | Chạy lại, dự kiến không đổi. |

**Kiểm tra cuối:**
- `yarn lint`, `yarn typecheck`, `yarn test`, `yarn test:db`;
- trong `admin-web`: `yarn lint`, `yarn test`, `yarn build`;
- Playwright nếu môi trường có Postgres, như các PR trước.

**Bên app:** chạy lại test contract (SHA) để xác nhận không cần sửa.

## 9. Thứ tự commit

1. `feat(items): map analysis vocabulary into the catalog as AI draft items`: §3 và test service.
2. `feat(lessons): link AI items when the pipeline stores a lesson or a sentence is analysed`: §4 (materialize, phân tích theo yêu cầu, adopt; bỏ 2 lời gọi rebuild còn lại) và test luồng.
3. `feat(items): learner lessons only counted in item usage`: §7 server + admin-web.
4. `refactor: retire learning_items and the vocabulary tables`: migration 005, Prisma, xoá module / script / test, thống kê user (server + admin-web).
5. `refactor(contract): drop snapshot items and contract v2 with their flags`: §5, fixture, env / README / docs (G8).
6. `docs: mark PR 7 plan as implemented`: plan, báo cáo phiên, cập nhật master plan (Stage 1 xong).

## 10. File tóm tắt

**Thêm:**
- `src/modules/items/service/aiItemMapping.ts`;
- `src/common/database/migrations/005_retire_learning_items.sql` + `.down.sql`;
- `test/aiItemMapping.test.ts`.

**Sửa:**
- `creationRequestStore.ts`, `lessonSentences.ts` (+ `sentenceAnalysisService.ts` nếu cần đổi kiểu callback), `lessonSentenceStore.ts`, `lessonContentTransaction.ts`, `adminLessonMove.ts`;
- `contract.ts`, `fixtures.ts`, `postgresLessonDeliveryStore.ts`, `env.ts`;
- `postgresItemStore.ts` + `adminItem.ts` (usage), `adminUsersStore.ts`;
- `prisma/schema.prisma` (+ `src/generated/prisma/**` sinh lại);
- admin-web `ItemUsagePanel.tsx`, `UserTabs.tsx`, `UserDetailPage.tsx`, `api/types.ts`;
- test liên quan;
- `.env.example`, `README.md`, `docs/01-ba/02-technical/05-data-model.md` (G8).

**Xoá:** như §6.

**Dependency mới:** không.

## 11. Rủi ro

- ⚠️ **Migration xoá bảng** `learning_items`, `vocabularies`, `user_vocabulary_progress`. Theo T1, DB được làm lại từ đầu và không có người dùng nên không mất dữ liệu thật. Môi trường dev đang chạy cần `migrate` lại.
- ⚠️ **Đổi API công khai:**
  - Snapshot không bao giờ có `items[]` và `contract_version: 2`. App PR 5 đã bỏ đọc hai thứ này.
  - Chi tiết user trên admin bỏ `vocabulary` / `vocabulary_progress`.
  - Usage của item đổi shape (thêm `learner_lesson_count`, lọc `lessons`).
- **Danh mục phình ra vì item AI `draft`:** mỗi bài YouTube có thể sinh vài chục từ mới. Đã giảm thiểu bằng trạng thái `draft` (không hiện cho người học ở bài curriculum), bộ lọc `Source` trên admin và giới hạn 300 mỗi lần.
- **Chất lượng item AI:** nghĩa hoặc IPA sai sẽ vào danh mục dưới dạng nháp. Bài curriculum chỉ dùng được sau khi admin publish (validator chặn), nên lỗi không tới người học bài curriculum.
- **`lesson_items` cũ sau khi sửa câu:** từ không còn trong câu vẫn gắn với bài. Với bài người học, dữ liệu này không lên snapshot (G1). Với bài admin, admin gỡ ở tab Item.
- **Chi phí AI:** không đổi. Mapping chỉ dùng kết quả enrich và phân tích sẵn có, không gọi AI thêm.

## 12. Kết quả code và điểm lệch so với plan

**Kiểm tra cuối (server):**
- `tsc` sạch.
- Unit 413 pass (707 test; phần cần DB tự skip).
- `test:db` 241/241 pass.
- `prisma migrate diff` (DB đã migrate → schema): rỗng.
- admin-web: lint / typecheck / prettier sạch, Vitest 123/123, Playwright 16/16.

**Bên app:** 3 fixture khoá SHA vẫn trùng byte với server; test contract của app 43/43.

**Điểm lệch so với plan:**
- **Thứ tự commit:**
  - Commit "bỏ contract v2" (§9 mục 5) làm **trước** commit xoá bảng (mục 4), vì phần giao bài còn đọc `learning_items` cho `items[]`.
  - Thêm một commit e2e (`d898ea6`).
- **`test/learningItems.test.ts` xoá sớm ở commit 2**, vì các nơi gọi `rebuildLearningItems` đã bỏ ở đó. Hai test thuần còn lại xoá ở commit 4.
- **Phân tích câu theo yêu cầu chỉ map cho bài `origin = learner`.** Plan chưa nói rõ điểm này. Nếu map cả bài curriculum thì một người học bấm phân tích là đã gắn được item AI nháp vào bài đã publish.
- **Bài admin tạo bằng pipeline:** thanh kiểm tra liệt kê các item AI nháp ("Publish X before publishing the lesson."), đúng G4. Hai test Playwright được sửa theo:
  - `lesson-spec` gỡ các item AI trước khi thêm pattern;
  - nút Publish so khớp chính xác (`exact: true`), vì giờ có thêm các nút "Publish X…".
- **`prisma/schema.prisma` sửa tay, không chạy `prisma format`**, để không căn lề lại các model không liên quan. Validate pass, diff với DB rỗng.
- **Trường `spec`, `lesson_items`, `tasks` trong schema snapshot vẫn để `optional`**, để fixture cũ không có các trường này vẫn parse được. Server luôn gửi đủ.
- **`test/adminContentDelete.test.ts`** (không nằm trong `test:db`):
  - Test "vocabulary and media deletes" đổi thành "media deletes" vì không còn vocabulary.
  - Test "admin hard deletes cascade…" **vẫn fail như trước PR này** (lỗi có sẵn từ PR 4, không thuộc phạm vi).
- **`yarn lint` của server vẫn báo 1 lỗi có sẵn** ở `test/ipa.test.ts:84` (`no-explicit-any`). Lỗi này có từ trước, file không đổi.
- **Fixture `test/fixtures/learning-item-keys.json` giữ nguyên tên.** Nó vẫn khoá quy tắc `normalizeItemKey`, dùng chung với app.
