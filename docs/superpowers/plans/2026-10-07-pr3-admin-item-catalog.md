# PR 3 – Danh mục item trên admin-web (thay trang Vocabulary)

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1).
> Ngày lập: 2026-10-07. Repo: `LingoBites-Server` (thư mục `admin-web/` và một phần nhỏ server). Nhánh: `claude/optimistic-bell-mfgk44` (nối tiếp PR 1–2).
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md`, mục Admin-web 1. Dùng API của PR 1 (`/v1/admin/items`).

## 1. Mục tiêu và phạm vi

Người soạn nội dung tạo, sửa, publish và archive **item** ngay trên admin-web, đủ 5 loại: từ, cụm, mẫu câu, phát âm, nghe hiểu. Mỗi item có ví dụ, biến thể chấp nhận được và lỗi thường gặp. Riêng **mẫu câu** có trình soạn khung câu và chỗ trống, kèm xem trước các câu sinh ra.

| Trong PR 3 | Ngoài PR 3 |
|---|---|
| Trang danh sách item, trang tạo/sửa item | Tab Đặc tả / Item / Nhiệm vụ của bài, ma trận lặp lại (PR 4) |
| Component `ItemPicker` dùng chung (chọn item cho chỗ trống; PR 4 dùng lại) | Block editor `item_cards`, bỏ block `vocabulary`/`grammar` (PR 4) |
| Server: route `GET /v1/admin/items/:id/usage` (item đang dùng ở bài/nhiệm vụ nào) | Duyệt item AI hàng loạt (PR 7, khi pipeline AI sinh item) |
| **Xoá** trang Vocabulary trên admin-web và API ghi vocabulary phía server | API chọn vocabulary cho block editor, route xoá vocabulary (PR 4 / PR 7) |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| E1 | Xoá trang Vocabulary ngay ở PR 3? | **Có.** Sau PR 3 không tạo từ vựng mới được nữa. Block `vocabulary` vẫn chọn được từ đã có cho tới PR 4 (khi `item_cards` thay thế). DB đã reset nên không có từ vựng thật nào bị mất |
| E2 | Ngôn ngữ giao diện admin | **Giữ tiếng Anh** như toàn bộ admin-web hiện tại. Gợi ý cho người soạn (ví dụ "Cỡ đồ uống: small, medium, large") viết bằng tiếng Việt trong placeholder |
| E3 | Mã item | Tự **gợi ý mã** theo kind + text, giống quy tắc server; người soạn sửa được khi còn `draft`. Sau khi publish, ô mã bị khoá |
| E4 | Khi publish bị từ chối vì item tham chiếu chưa publish | Hiện danh sách item đó kèm nút **"Publish các item này"** (publish lần lượt rồi thử lại), thay vì chỉ báo lỗi |

## 3. Giao diện

### 3.1 Điều hướng
- Menu trái: **"Vocabulary" → "Items"** (`/items`), cùng nhóm với Media.
- Breadcrumb: `Admin › Items › <code>`.
- Server `adminCourseWeb.ts`: thêm `/admin/items`, `/admin/items/new`, `/admin/items/:id/edit` vào danh sách route SPA; bỏ 3 route `/admin/vocabularies*`.

### 3.2 `/items`: danh sách (`ItemListPage`)
- Bộ lọc: ô tìm (theo đầu chữ của text hoặc mã), **Kind** (5 loại, chọn nhiều), **Status** (draft / published / archived), **Audience**, **Source** (admin / ai).
- Bảng: Code, Kind (badge màu theo loại), Text (mẫu câu hiện `{slot}` tô màu), Meaning, Audience, Status, Updated, nút Edit.
- Phân trang: nút **"Load more"** theo `next_cursor`, 50 dòng một lần.
- Nút **"New item"** mở menu chọn loại → `/items/new?kind=pattern`.
- Lọc lưu trên URL (`?kind=pattern&status=draft`) để chia sẻ link.

### 3.3 `/items/new`, `/items/:id/edit`: tạo / sửa (`ItemEditPage`)
Một trang, chia các panel:

1. **General**
   - Kind: chỉ chọn được khi tạo mới.
   - Code: gợi ý tự động (E3), khoá khi không còn draft.
   - Text: với mẫu câu chính là khung câu.
   - Meaning (VI), IPA, Part of speech, Note (VI), Audience.
   - Audio, Image: dùng `MediaPicker` có sẵn.
   - Nút **Save**. Lần đầu tạo xong chuyển sang `/items/:id/edit`.
2. **Phần riêng theo loại** (`ItemPayloadEditor`)
   - **pattern**: `PatternFrameEditor`.
     - Ô khung câu tô màu `{slot}` khi gõ; báo ngay lỗi ngoặc lạc hoặc slot trùng.
     - Mỗi slot tự xuất hiện một dòng: nhãn tiếng Việt, danh sách giá trị nhập tay (dạng chip) và các item tham chiếu (chọn bằng `ItemPicker`, chỉ cho từ/cụm).
     - Thêm hoặc xoá `{slot}` trong khung thì dòng slot tương ứng tự thêm hoặc bỏ, nên không thể lệch với server.
     - **Preview**: danh sách câu do server trả (`preview`, ≤ 20 câu) sau khi lưu. Trước khi lưu thì hiện bản tạm tính phía client, chỉ dùng giá trị nhập tay.
   - **pronunciation**: Focus, Focus IPA, Tip (VI), các cặp tối thiểu (thêm/xoá dòng), item mục tiêu (`ItemPicker`).
   - **listening**: Question (EN/VI), audio câu hỏi (`MediaPicker`), đáp án dạng text và/hoặc item đáp án (`ItemPicker`).
   - **word/phrase**: không có phần riêng; nhắc quy tắc có/không có khoảng trắng.
3. **Examples**: danh sách dòng EN / VI / audio / audience, kéo đổi thứ tự bằng nút ↑↓ (`ReorderMoveButtons` có sẵn), tối đa 10. Lưu cả danh sách (`PUT …/examples`).
4. **Accepted variants** (chỉ hiện với pattern/word/phrase): dòng text + ghi chú. Với mẫu câu, báo ngay nếu variant dùng `{slot}` không có trong khung câu. Tối đa 20.
5. **Common errors**: dòng code (snake_case, gợi ý từ mô tả), mô tả (VI), phản hồi cho người học (VI), mức độ **Blocking / Tolerated**, ví dụ sai → ví dụ đúng. Tối đa 20.
6. **Lifecycle**
   - Trạng thái hiện tại; nút Publish / Archive / Restore theo đúng luật server (draft → published ↔ archived).
   - `ITEM_REF_INVALID` khi publish → danh sách item tham chiếu chưa publish + nút theo E4.
   - `ITEM_IN_USE` khi archive → danh sách bài đang dùng (có link sang bài).
7. **Used in** (route mới §4): các bài và nhiệm vụ đang dùng item, có link sang trang sửa bài.

Mỗi panel có nút Save riêng, vì server có route riêng cho từng phần. Khi đang có thay đổi chưa lưu mà rời trang, hiện cảnh báo (`beforeunload` + chặn điều hướng nội bộ).

Lỗi server hiển thị đúng chỗ: `ITEM_PAYLOAD_INVALID.details.issues[].path` được map vào ô tương ứng (ví dụ `payload.slots` → khung câu; `variants.1.text` → dòng variant thứ 2).

### 3.4 `ItemPicker` (component dùng chung)
- Ô tìm có gợi ý (debounce 250 ms), gọi `GET /v1/admin/items?q=…&kind=…`.
- Props: `kinds` (lọc loại), `excludeCodes`, `allowDraft` (mặc định true, item draft có nhãn "draft").
- Mỗi giá trị đã chọn là một chip hiển thị code + text, có nút xoá.
- Giá trị trả ra là **code** (đúng dạng `item_refs` của payload). PR 4 sẽ thêm chế độ trả về **id** cho `lesson_items` / `task_items`.

## 4. Thay đổi phía server (nhỏ)

1. **`GET /v1/admin/items/:id/usage`** →
   ```json
   { "lessons": [{ "lesson_id", "code", "title", "status", "unit_id", "role", "introduction" }],
     "tasks":   [{ "task_id", "kind", "title_vi", "lesson_id", "unit_id" }],
     "referenced_by": [{ "item_id", "code", "kind" }] }
   ```
   `referenced_by` liệt kê các item khác có `item_refs` trỏ tới item này (truy vấn jsonb trên `payload`).
2. **Xoá API ghi vocabulary** (E1):
   - Xoá `src/modules/vocabulary/controller/adminVocabularies.ts`, `model/adminVocabulary.ts`, `repository/postgresVocabularyAdminStore.ts`, `test/adminVocabularies.test.ts`.
   - Bỏ đăng ký route trong `server.ts`.
   - **Giữ lại** `GET /v1/admin/vocabularies` (selector cho block editor, nằm trong module lessonBlocks), `vocabularyLookup.ts`, `record.ts` và route xoá vocabulary trong `adminContentDelete` cho tới PR 4 / PR 7.
3. `adminCourseWeb.ts`: danh sách route SPA (§3.1).
4. `test/openApiDocument.test.ts`: cập nhật số path và operation.

## 5. Phía admin-web

### 5.1 API client (`src/api/client.ts`, `src/api/types.ts`)
- Kiểu dữ liệu: `AdminItemSummary`, `AdminItemDetail`, `ItemKind`, `ItemStatus`, `ItemAudience`, `ItemCreateBody`, `ItemPatchBody`, `ItemExampleInput`, `ItemVariantInput`, `ItemErrorInput`, `ItemListQuery`, `ItemUsage`, `PatternPayload`, `PronunciationPayload`, `ListeningPayload`.
- Hàm: `listItems(query, signal)`, `getItem(id)`, `getItemByCode(code)`, `createItem(body)`, `patchItem(id, body)`, `replaceItemExamples`, `replaceItemVariants`, `replaceItemErrors`, `getItemUsage(id)`.
- Xoá: `getVocabulary`, `createVocabulary`, `patchVocabulary` và kiểu đi kèm. **Giữ** `searchVocabularies` (block editor) và `deleteVocabulary` nếu còn nơi gọi.

### 5.2 Logic dùng chung với server (`src/utils/items/`)
- `itemCode.ts`: `normalizeItemKey`, `deriveItemCode`, `parseItemCode`. Bản sao thuần của server, kiểm bằng fixture `learning-item-keys.json` (copy từ `test/fixtures/`) và vài ca mẫu câu.
- `patternFrame.ts`: `parseFrame` và `expandPattern` (bản sao), dùng cho tô màu, đồng bộ slot và preview tạm.
- `itemErrors.ts`: map `details.issues[].path` → khoá field của form.
- Ghi chú đầu file: **"Bản sao của server; sửa ở cả hai nơi."** Có test so sánh trên cùng fixture để phát hiện lệch.

### 5.3 File tạo mới
```
admin-web/src/routes/ItemListPage.tsx (+ .test.tsx)
admin-web/src/routes/ItemEditPage.tsx (+ .test.tsx)
admin-web/src/components/items/ItemGeneralPanel.tsx
admin-web/src/components/items/ItemPayloadEditor.tsx
admin-web/src/components/items/PatternFrameEditor.tsx (+ .test.tsx)
admin-web/src/components/items/PronunciationFields.tsx
admin-web/src/components/items/ListeningFields.tsx
admin-web/src/components/items/ItemExamplesPanel.tsx
admin-web/src/components/items/ItemVariantsPanel.tsx
admin-web/src/components/items/ItemErrorsPanel.tsx
admin-web/src/components/items/ItemLifecyclePanel.tsx
admin-web/src/components/items/ItemUsagePanel.tsx
admin-web/src/components/items/ItemKindBadge.tsx
admin-web/src/components/ItemPicker.tsx (+ .test.tsx)
admin-web/src/hooks/useUnsavedChangesGuard.ts
admin-web/src/utils/items/{itemCode,patternFrame,itemErrors}.ts (+ .test.ts)
admin-web/src/test/fixtures/items/*.json, learning-item-keys.json   -- copy từ server test/fixtures
admin-web/e2e/items.spec.ts
```

### 5.4 File sửa
```
admin-web/src/App.tsx                      -- route /items*, bỏ /vocabularies*
admin-web/src/components/AdminShell.tsx    -- menu + breadcrumb
admin-web/src/api/client.ts, types.ts      -- §5.1
admin-web/src/styles/global.css            -- style chip, slot highlight, badge kind (dùng token có sẵn)
src/app/server.ts                          -- bỏ route vocabulary ghi; đăng ký usage (trong adminItems)
src/modules/items/{controller,repository,model}  -- route usage
src/modules/admin/service/adminCourseWeb.ts
test/adminItems.test.ts                    -- test route usage
test/openApiDocument.test.ts
```

### 5.5 File xoá (cần duyệt, E1)
```
admin-web/src/routes/VocabularyListPage.tsx
admin-web/src/routes/VocabularyEditPage.tsx
admin-web/src/routes/VocabularyEditPage.test.tsx
src/modules/vocabulary/controller/adminVocabularies.ts
src/modules/vocabulary/model/adminVocabulary.ts
src/modules/vocabulary/repository/postgresVocabularyAdminStore.ts
test/adminVocabularies.test.ts
```

**Dependency mới:** không. Dùng React, react-router và CSS sẵn có; không thêm thư viện form hay UI.

## 6. Kiểm thử

- **Vitest** (client mock, theo kiểu `VocabularyEditPage.test.tsx`):
  - `itemCode`/`patternFrame`: cùng fixture với server cho cùng kết quả.
  - `PatternFrameEditor`: gõ `{size}` thì có dòng slot; xoá `{size}` thì dòng biến mất; ngoặc lạc báo lỗi; chip giá trị.
  - `ItemEditPage`: tạo pattern (gửi đúng body), sửa, lỗi `ITEM_PAYLOAD_INVALID` hiện đúng ô; publish bị `ITEM_REF_INVALID` thì hiện nút E4; archive bị `ITEM_IN_USE` thì hiện danh sách bài; khoá ô mã sau publish.
  - `ItemListPage`: lọc lên URL; "Load more" dùng cursor.
  - `ItemPicker`: debounce, lọc kind, trả code.
- **Server**: `test/adminItems.test.ts` thêm route usage (bài, nhiệm vụ, `referenced_by`); `openApiDocument`; xoá `adminVocabularies.test.ts`, bỏ khỏi `test:db`.
- **Playwright** `e2e/items.spec.ts` (DB thật):
  1. Đăng nhập.
  2. Tạo word `milk-<ts>`, publish.
  3. Tạo pattern có slot tham chiếu word đó, kiểm preview có câu chứa "milk".
  4. Thêm variant và error.
  5. Publish.
  6. Archive, sau đó restore.
- Chạy: `yarn admin-web:test`, `yarn admin-web:typecheck`, `yarn lint`, `yarn format`, `yarn test`, `yarn test:db`, `yarn admin-web:e2e` (cần `yarn api:build`). Nếu môi trường làm việc không chạy được Playwright, sẽ báo lại.

## 7. Thứ tự commit

1. `feat(items): item usage route` (server + test).
2. `feat(admin-web): item API client and shared item helpers` (types, client, `utils/items` + test + fixture).
3. `feat(admin-web): ItemPicker and pattern frame editor`.
4. `feat(admin-web): item list and edit pages` (các panel, route, menu, SPA routes server).
5. `refactor: retire the vocabulary catalog pages and write API` (xoá theo §5.5, E1).
6. `test(admin-web): items e2e`.

## 8. Rủi ro

- **Logic bị nhân đôi** giữa server và admin-web (`itemCode`, `patternFrame`). Giảm thiểu bằng test trên cùng fixture và ghi chú đầu file. Server luôn là nơi kiểm cuối cùng.
- **Trang sửa item khá lớn** (7 panel). Mỗi panel là component riêng, lưu độc lập.
- Sau E1 không tạo được từ vựng mới cho block `vocabulary` cho tới PR 4. Chấp nhận được vì DB mới, chưa có nội dung thật.
- Playwright cần build server và DB thật. Đã chạy được trong môi trường hiện tại ở PR 1–2 (Postgres local); phần trình duyệt dùng Chromium cài sẵn.
