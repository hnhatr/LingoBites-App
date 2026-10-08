# PR 4 – Soạn bài theo đặc tả trên admin-web (tab Đặc tả / Item / Nhiệm vụ / Hoạt động, ma trận lặp lại)

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1).
> Ngày lập: 2026-10-08. Repo: `LingoBites-Server` (thư mục `admin-web/`, cộng phần xoá block cũ ở server). Nhánh: `claude/optimistic-bell-mfgk44` (nối tiếp PR 1–3).
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md`, mục Admin-web 2–5. Dùng API của PR 2 (`/spec`, `/prerequisites`, `/items`, `/spec-check`, `/tasks`, `/item-map`) và `ItemPicker` của PR 3.

## 1. Mục tiêu và phạm vi

Sau PR này, người soạn nội dung **soạn trọn một bài theo chiều thiết kế ngược ngay trên admin-web**: Đặc tả → Item → Nhiệm vụ & tiêu chí → Hoạt động 6 bước, rồi publish. Thanh kiểm tra luôn cho biết bài còn thiếu gì. Unit mẫu "Gọi đồ uống" (đang được seed bằng script) phải soạn lại được hoàn toàn bằng tay trên admin.

| Trong PR 4 | Ngoài PR 4 |
|---|---|
| `LessonEditPage` chia tab: **Tổng quan / Đặc tả / Item / Nhiệm vụ / Hoạt động** | Editor riêng cho từng `activityKind`, nút "Sinh nháp từ mẫu câu" (PR 9, Stage 2) |
| Thanh kiểm tra đặc tả (`spec-check`), khoá nút Publish khi còn vi phạm | Preview chạy thử 6 bước như player (PR 9) |
| Block: chọn `step`, `skill`, `duration_sec`; block mới **`item_cards`**; `activity` có `item_refs`, `task_id` | Cảnh báo tỷ lệ 70/25/5 (PR 8–9) |
| Unit: can-do, đối tượng, **nhiệm vụ tổng hợp**, cảnh báo unit, **ma trận lặp lại item × bài** | Ma trận cấp **level** (§2 F3) |
| Course / Level: trường đối tượng (`audience`) | Map item từ pipeline AI, xoá `learning_items` / `vocabularies` (PR 7) |
| **Xoá block `vocabulary` và `grammar`** ở admin-web **và server** (§6) | |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| F1 | Bố cục trang sửa bài | **Tab** đặt trên URL (`/lessons/:id/edit?tab=spec`), để gửi link đúng tab. **Thanh kiểm tra** nằm cố định phía trên các tab, hiện ở mọi tab. Tab "Tổng quan" giữ các phần hiện có: vị trí, nguồn, metadata, câu, vùng nguy hiểm |
| F2 | Xoá block `vocabulary` / `grammar` ở mức nào | **Xoá hẳn ở cả admin-web lẫn server** trong PR này, theo lịch xoá ở §9 của plan PR 2. Bao gồm: migration `004` bỏ bảng `lesson_block_vocabularies` và hai giá trị khỏi CHECK; route chọn vocabulary và route gắn vocabulary cho block; route admin xoá vocabulary (không còn UI nào gọi); nhánh block trong `deriveItems`. Cần sửa và **pin lại SHA của 2 fixture snapshot** có block `vocabulary`. **Giữ** bảng `vocabularies`, `user_vocabulary_progress` và thống kê vocab trên trang user cho tới PR 7 |
| F3 | Ma trận lặp lại ở cấp nào | **Chỉ cấp unit** (server đã có `GET /units/:id/item-map`). Cấp level để sau, khi có nhu cầu thật; khi đó chỉ cần thêm một route server |
| F4 | Gợi ý tự động ở tab Item | Hai loại gợi ý, **chỉ gợi ý, người soạn bấm "Thêm"**: (a) item đã là `new` ở bài khác cùng unit → đề xuất `recycled`; (b) item của bài tiên quyết mà khung câu của bài này tham chiếu tới (qua `slots.item_refs`) → đề xuất `prerequisite`. Tính phía client từ `item-map` của unit và `spec` của bài tiên quyết, **không thêm route server** |
| F5 | Nút Publish khi còn vi phạm | **Khoá**, kèm dòng "Còn N điều kiện chưa đạt". Admin-web vẫn xử lý `409 LESSON_SPEC_INVALID` (trường hợp dữ liệu đổi ở tab khác chưa tải lại) |
| F6 | Block cũ chưa có `step` | Gom vào nhóm **"Chưa xếp bước"** ở đầu tab Hoạt động, nổi bật màu cảnh báo. Không tự gán bước, vì đoán sai còn tệ hơn để trống |

## 3. Giao diện

### 3.1 Trang sửa bài `/lessons/:id/edit`

```
┌ Breadcrumb · Tiêu đề bài · [Preview] ───────────────────────────────┐
│ Thanh kiểm tra:  ✔ Mã bài  ✔ Can-do  ✖ Task độc lập  ✖ Bước 5 trống │
│                  ⚠ 2 cảnh báo  [Kiểm tra lại]     [Publish 🔒]       │
├ [Tổng quan] [Đặc tả] [Item 4] [Nhiệm vụ 2] [Hoạt động 9] ───────────┤
│ … nội dung tab …                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Bài learner** (`origin = learner`): không có các tab đặc tả. Trang giữ nguyên như hiện nay (`UserLessonPanel`), vì server không kiểm tra đặc tả với bài này.
- Số trên tab là số item, task và block, lấy từ `GET /spec` và danh sách block.
- Mỗi lần lưu ở bất kỳ tab nào xong thì **chạy lại `spec-check`**, để thanh kiểm tra luôn đúng.

#### Thanh kiểm tra (`SpecCheckBar`)
- Gọi `GET /lessons/:id/spec-check`. Mỗi vi phạm hiện thành một dòng tiếng Việt **có link tới tab và ô liên quan**. Ví dụ `INDEPENDENT_TASK_MISSING` → tab Nhiệm vụ; `STEP_EMPTY` (bước 3) → tab Hoạt động, cuộn tới nhóm Bước 3.
- Bảng ánh xạ `rule → { nhãn, tab, anchor }` nằm ở `utils/spec/specRules.ts`, có test phủ **mọi** rule server đang trả. Rule lạ thì vẫn hiện, dùng `message` của server.
- Cảnh báo (`warnings`) gập lại mặc định, màu vàng, không ảnh hưởng nút Publish.
- Publish / Archive dời từ `CurriculumLifecycleControls` lên thanh này (component cũ vẫn dùng cho course / level / unit).

### 3.2 Tab **Đặc tả** (`LessonSpecTab`)
| Trường | Control | Ghi chú |
|---|---|---|
| Mã bài | ô text, tự viết hoa | Gợi ý theo vị trí: `<level>-<unit>-L<NN>`; báo trùng khi server trả conflict |
| Đối tượng | select `all / kids / adults` | |
| Can-do | 1–2 dòng | Placeholder "Tự gọi một đồ uống kèm cỡ…". Cảnh báo `CAN_DO_NOT_OBSERVABLE` hiện ngay dưới dòng |
| Tình huống | 4 ô: người nói, người nghe, nơi chốn, mục đích | |
| Thời lượng (phút) | số | Trường `estimatedMinutes` đã có; dời từ form metadata sang đây |
| Bài tiên quyết | danh sách chọn bài **cùng course** (`listAllLessons({ courseId })`), sắp thứ tự ↑↓, tối đa 10 | Lỗi `PREREQUISITE_INVALID` hiện theo `reason`: vòng lặp, khác course, chính nó |

Hai nút lưu: **Lưu đặc tả** (`PATCH /lessons/:id`) và **Lưu bài tiên quyết** (`PUT /prerequisites`), vì đây là hai route khác nhau, cùng kiểu với trang item ở PR 3.

### 3.3 Tab **Item** (`LessonItemsTab`)
- Bảng: thứ tự (↑↓), item (badge kind + text, link sang trang item), **Vai trò** (bắt buộc / mở rộng), **Xuất hiện** (mới / lặp lại / tiên quyết), trạng thái item (badge `draft` màu vàng: chưa publish thì bài không publish được), nút bỏ.
- Thêm item bằng `ItemPicker` ở **chế độ trả về item đầy đủ** (thêm prop `valueMode: 'code' | 'item'` cho component của PR 3). Không cho chọn item `archived`.
- **Gợi ý (F4)**: khung "Gợi ý" phía trên bảng, mỗi dòng là item + lý do ("đã dạy mới ở L01", "nằm trong khung câu, thuộc bài tiên quyết L01") + nút **Thêm**.
- Bỏ một item đang được task hoặc block `item_cards` dùng → server trả `409 LESSON_ITEM_IN_USE`; admin hiện danh sách task/block đang giữ item đó.
- Nút **"Publish các item draft"**: dùng lại helper E4 của PR 3 cho các item `draft` trong bảng.
- Lưu cả bảng một lần (`PUT /lessons/:id/items`).

### 3.4 Tab **Nhiệm vụ** (`LessonTasksTab`)
- Danh sách task theo thứ tự, mỗi task là một thẻ gập/mở: badge kind (`guided` / `variation` / `independent`), tiêu đề, chế độ trả lời, số item, số tiêu chí bắt buộc.
- Nút **"Thêm nhiệm vụ"** → chọn kind → `POST /lessons/:id/tasks` (server tự tạo 4 tiêu chí mặc định theo D4).
- **Thẻ task mở ra** (`TaskEditor`), dùng lại cho nhiệm vụ tổng hợp của unit:
  1. **Chung:** tiêu đề (VI), đề bài (VI), tình huống đã đổi chi tiết (4 ô như tab Đặc tả, có nút "Chép từ đặc tả bài" rồi sửa), chế độ trả lời `speak / write / choose`. → `PATCH /tasks/:id`.
  2. **Gợi ý theo mức:** tối đa 3 dòng, mỗi dòng chọn loại `replay / keyword / model` + nội dung VI (EN tuỳ chọn). Task `independent` có gợi ý thì hiện cảnh báo `INDEPENDENT_TASK_HAS_HINTS` ngay tại chỗ. Lưu cùng nút ở mục 1.
  3. **Item trọng tâm:** checkbox trên danh sách item của bài (không tìm toàn danh mục, vì server chỉ nhận item thuộc bài). → `PUT /tasks/:id/items`.
  4. **Tiêu chí:** bảng 4 dòng cố định (`purpose`, `content`, `clarity`, `independence`): bắt buộc (checkbox), ngưỡng 0–1 (để trống được), ghi chú VI. → `PUT /tasks/:id/criteria`.
  5. **Đáp án chấp nhận** (chỉ đọc): `accepted_answers` từ `GET /tasks/:id`, tối đa 50 câu. Có dòng giải thích "Sinh từ khung câu và biến thể của item trọng tâm; sửa ở trang item".
  6. Xoá task: hỏi xác nhận. `409 TASK_IN_USE` → liệt kê block đang trỏ tới task, có link sang tab Hoạt động.

### 3.5 Tab **Hoạt động** (`LessonBlocksSection` sửa lại)
- Block được **gom theo bước**, mỗi nhóm có tên và nút "Thêm block vào bước này":
  1. Ôn liên quan · 2. Nghe & hiểu mẫu · 3. Luyện có hướng dẫn · 4. Luyện biến đổi · 5. Vận dụng độc lập.
  Bước 6 (Xem kết quả) là màn hệ thống nên chỉ hiện một dòng chú thích, không có nút thêm.
- Nhóm **"Chưa xếp bước"** (F6) ở trên cùng nếu có.
- Trong mỗi nhóm vẫn sắp thứ tự ↑↓ như hiện nay. Đổi bước của block = sửa trường `step` trong dialog, block chuyển nhóm.
- Mỗi dòng block hiện thêm `skill` và thời lượng. Cuối tab có **tổng thời lượng theo bước và theo kỹ năng** (chỉ hiển thị; cảnh báo 70/25/5 là việc của Stage 2).
- **`BlockEditorDialog`** thêm 3 trường chung: Bước (bắt buộc với bài admin), Kỹ năng, Thời lượng (giây).
- Block mới **`item_cards`**: chọn item **trong danh sách item của bài** (checkbox + sắp thứ tự), tối đa 30.
- Block **`activity`**: thêm "Item luyện" (`item_refs`, chọn trong item của bài) và "Nhiệm vụ" (`task_id`, select các task của bài). Block bước 5 mà chưa chọn task `independent` thì nhắc ngay trong dialog.
- Lỗi `400 BLOCK_REF_INVALID` khi lưu (item không thuộc bài, task lạ) hiện đúng ô.
- Bỏ khỏi danh sách loại block: `vocabulary`, `grammar` (§6).

### 3.6 `LessonPreviewPage`
- Hiện block **theo nhóm bước** (tiêu đề bước), thêm render `item_cards` (thẻ item: text, nghĩa, IPA, audio, ảnh) và khung câu tô màu `{slot}` (dùng `FrameText` của PR 3).
- Bỏ render `vocabulary` / `grammar`.

### 3.7 Trang Unit `/units/:id/edit`
- Form metadata thêm **Đối tượng** và **Can-do** (0–3 dòng).
- Panel **Cảnh báo unit**: `GET /units/:id/spec-check` (`UNIT_CAN_DO_MISSING`, `SUMMATIVE_TASK_MISSING`, `ITEM_SINGLE_USE`).
- Panel **Nhiệm vụ tổng hợp**: danh sách + "Thêm" (`POST /units/:id/tasks`), mở bằng cùng `TaskEditor`. Mục "Item trọng tâm" chọn từ **hợp các item của các bài trong unit** (lấy từ `item-map`).
- Panel **Ma trận lặp lại** (`UnitItemMatrix`):
  - Dòng = item (badge kind + text), cột = bài theo thứ tự trong unit (mã bài).
  - Ô: `N` (mới), `L` (lặp lại), `T` (tiên quyết), chữ đậm nếu bắt buộc, nhạt nếu mở rộng; ô trống nếu bài không dùng item.
  - Cờ ở đầu dòng: **"Chỉ 1 lần"** (item bắt buộc chỉ xuất hiện ở 1 bài), **"Chưa được dạy"** (đánh dấu lặp lại / tiên quyết nhưng không có bài nào trong unit dạy `new`).
  - Lọc: chỉ dòng có cờ; theo kind. Bấm vào ô → mở tab Item của bài đó.
  - Bảng cuộn ngang trên màn hẹp, cột item cố định.

### 3.8 Course / Level
- `CourseMetadataForm`, `LevelMetadataForm`: thêm select **Đối tượng**. Không thêm gì khác.

## 4. Phía admin-web

### 4.1 API client (`src/api/client.ts`, `src/api/types.ts`)
- **Kiểu:**
  - `Audience`, `Situation`, `LessonSpec`, `LessonPrerequisite`, `LessonItemRow`;
  - `SpecViolation`, `SpecWarning`, `SpecCheckResult`;
  - `TaskKind`, `ResponseMode`, `HintLevel`, `TaskCriterion`, `AdminTask`, `AdminTaskDetail`, `TaskCreateBody`, `TaskPatchBody`;
  - `UnitItemMap`;
  - các trường mới trên `CurriculumLessonRecord` (`code`, `audience`, `canDo`, `situation`), unit (`audience`, `canDo`), course và level (`audience`), `LessonBlockView` (`step`, `skill`, `duration_sec`), `ItemCardsBlockData`.
- **Hàm:** `getLessonSpec`, `getLessonSpecCheck`, `replaceLessonPrerequisites`, `replaceLessonItems`, `createLessonTask`, `createUnitTask`, `listUnitTasks`, `getTask`, `patchTask`, `deleteTask`, `replaceTaskItems`, `replaceTaskCriteria`, `getUnitItemMap`, `getUnitSpecCheck`.
- **Xoá:** `replaceLessonBlockVocabularies`, `searchVocabularies`, `VocabularyCatalogItem`, `CatalogSelectorQuery` nếu không còn nơi dùng.
- `ApiClientError`: thêm category cho `LESSON_SPEC_INVALID`, `LESSON_ITEM_IN_USE`, `TASK_IN_USE`, `PREREQUISITE_INVALID`, `BLOCK_REF_INVALID`.

### 4.2 Logic thuần (`src/utils/spec/`)
- `specRules.ts`: rule → nhãn tiếng Việt, tab và anchor (§3.1).
- `lessonCode.ts`: gợi ý mã bài theo vị trí; regex giống server.
- `itemSuggestions.ts`: gợi ý F4 từ `item-map` của unit, spec của bài tiên quyết và payload pattern của bài này.
- `itemMatrix.ts`: dựng ma trận và cờ "Chỉ 1 lần" / "Chưa được dạy" từ `item-map`. Cờ phải ra cùng kết quả với cảnh báo `ITEM_SINGLE_USE` của server (test trên cùng dữ liệu unit mẫu).
- `blockSteps.ts`: tên bước, gom block theo bước, tổng thời lượng theo bước và kỹ năng.

### 4.3 File tạo mới
```
admin-web/src/components/lesson/LessonTabs.tsx
admin-web/src/components/lesson/SpecCheckBar.tsx (+ .test.tsx)
admin-web/src/components/lesson/LessonSpecTab.tsx (+ .test.tsx)
admin-web/src/components/lesson/SituationFields.tsx
admin-web/src/components/lesson/CanDoFields.tsx
admin-web/src/components/lesson/PrerequisitesEditor.tsx
admin-web/src/components/lesson/LessonItemsTab.tsx (+ .test.tsx)
admin-web/src/components/lesson/LessonTasksTab.tsx (+ .test.tsx)
admin-web/src/components/tasks/TaskEditor.tsx (+ .test.tsx)
admin-web/src/components/tasks/HintLevelsEditor.tsx
admin-web/src/components/tasks/CriteriaEditor.tsx
admin-web/src/components/units/UnitSummativeTasksPanel.tsx
admin-web/src/components/units/UnitSpecWarnings.tsx
admin-web/src/components/units/UnitItemMatrix.tsx (+ .test.tsx)
admin-web/src/components/blocks/ItemCardsField.tsx
admin-web/src/utils/spec/{specRules,lessonCode,itemSuggestions,itemMatrix,blockSteps}.ts (+ .test.ts)
admin-web/e2e/lesson-spec.spec.ts
```

### 4.4 File sửa
```
admin-web/src/routes/LessonEditPage.tsx          -- tab + SpecCheckBar; bài learner giữ nguyên
admin-web/src/routes/LessonPreviewPage.tsx       -- nhóm theo bước
admin-web/src/routes/UnitEditPage.tsx            -- 3 panel mới
admin-web/src/components/LessonBlocksSection.tsx -- nhóm theo bước, bỏ nhánh vocabulary khi copy block
admin-web/src/components/LessonPreviewBlock.tsx  -- item_cards; bỏ vocabulary/grammar
admin-web/src/components/LessonMetadataForm.tsx  -- dời estimatedMinutes sang tab Đặc tả
admin-web/src/components/UnitMetadataForm.tsx, CourseMetadataForm.tsx, LevelMetadataForm.tsx -- audience, can-do
admin-web/src/components/ItemPicker.tsx          -- valueMode 'item'
admin-web/src/components/blocks/{blockModel,BlockFields,BlockEditorDialog}.ts(x) -- step/skill/duration, item_cards, activity refs; bỏ vocabulary/grammar
admin-web/src/components/blocks/blockModel.test.ts
admin-web/src/api/{client,types}.ts
admin-web/src/styles/global.css                  -- tab, thanh kiểm tra, ma trận (dùng token có sẵn)
admin-web/e2e/ling11-acceptance.spec.ts          -- AC-020 publish bài giờ cần đủ đặc tả (dùng seed hoặc helper)
```

**Dependency mới:** không. Tab, bảng, ma trận đều làm bằng React + CSS sẵn có.

## 5. Phía server

PR này **không thêm route mới**. Ngoài phần xoá (§6), server chỉ có một chỉnh nhỏ:

1. `GET /lessons/:id/spec`: `SpecItemSummary` đã có `status` nhưng **thiếu `payload`**, mà gợi ý F4 (b) cần payload của pattern để đọc `slots.item_refs`. Thêm `payload` vào `SpecItemSummarySchema`. Đây là thêm trường, không thêm route. `GET /units/:id/item-map` đã đủ `code`, `position` và `status` của bài.
2. `test/lessonSpecRoutes.test.ts`: kiểm tra `payload` có trong response.

## 6. Xoá block `vocabulary` / `grammar` (cần duyệt, F2)

### 6.1 Migration `004_retire_vocabulary_blocks.sql` (kèm `.down.sql`)
```sql
DELETE FROM lesson_blocks WHERE type IN ('vocabulary','grammar');   -- DB mới, thực tế không có dòng nào
DROP TABLE lesson_block_vocabularies;
ALTER TABLE lesson_blocks DROP CONSTRAINT lesson_blocks_type_check,
  ADD CONSTRAINT lesson_blocks_type_check CHECK (type IN
    ('text','example','media','context','activity','item_cards'));
```
`.down.sql` tạo lại bảng và CHECK cũ (không khôi phục dữ liệu). Cập nhật `prisma/schema.prisma` bằng tay (bỏ model `LessonBlockVocabularies` và quan hệ), kiểm `prisma migrate diff` rỗng.

### 6.2 Server: xoá hoặc sửa
| File | Việc |
|---|---|
| `lessonBlocks/model/{blockType,blockData,apiContracts,views,errors}.ts` | Bỏ `vocabulary`, `grammar`, `VOCABULARY_REQUIRED` và kiểu đi kèm |
| `lessonBlocks/repository/postgresLessonBlockStore.ts` | Bỏ đọc/ghi `lesson_block_vocabularies` |
| `lessonBlocks/service/lessonContentValidator.ts` | Bỏ case 2 loại block |
| `lessonBlocks/controller/lessonBlocks.ts` | **Xoá** `GET /v1/admin/vocabularies` và `PUT /lessons/:lessonId/blocks/:blockId/vocabularies` |
| `admin/controller/adminContentDelete.ts`, `repository/adminContentDeleteStore.ts` | **Xoá** `DELETE /v1/admin/vocabularies/:id` (không còn UI gọi) và `counts.vocabularies` |
| `admin/controller/adminLessonMove.ts` | Bỏ copy link vocabulary khi `adopt` |
| `lessonDelivery/repository/postgresLessonDeliveryStore.ts` | Bỏ nhánh `vocabulary` |
| `canonicalLesson/model/contract.ts` | Bỏ 2 giá trị khỏi `CanonicalLessonBlockTypeValues` |
| `learningItems/service/deriveItems.ts` | Bỏ nhánh block `vocabulary` / `grammar`; `learning_items` của bài admin từ nay chỉ lấy từ câu (bảng này bị xoá hẳn ở PR 7) |
| `vocabulary/service/vocabularyLookup.ts` | Xoá nếu không còn nơi gọi sau các bước trên |
| `canonicalLesson/model/fixtures/valid-lesson-snapshot{,-with-items}-response.json` | Thay block `vocabulary`/`grammar` bằng `item_cards` hoặc bỏ; **pin lại SHA** trong `fixtures.ts` (không chạy prettier trên thư mục này) |
| `test/*` | Sửa hoặc bỏ ca test vocabulary/grammar block trong khoảng 15 file test (`lessonBlock*`, `lessonContentValidator`, `canonical*`, `deriveLearningItems`, `adminContentDelete`, `vocabularyLookup`, `openApiDocument`, `databaseBaseline`…) |

### 6.3 Admin-web: xoá
- `VocabularyField` trong `BlockFields.tsx`; nhánh `vocabulary`/`grammar` trong `blockModel.ts`, `BlockEditorDialog.tsx`, `LessonBlocksSection.tsx`, `LessonPreviewBlock.tsx`.
- Kiểu `GrammarExample`, `VocabularyCatalogItem`, hàm client ở §4.1.
- **Giữ:** biến thể text `grammar` của block `text` (chỉ là kiểu hiển thị khung ghi chú) và bảng vocabulary trên trang user (`UserTabs`, dọn ở PR 7).

### 6.4 Còn lại sau PR 4 (dọn ở PR 7)
`vocabularies`, `user_vocabulary_progress`, `learning_items`, `rebuildLearningItems`, `items[]` trong snapshot, thống kê vocab trang user, versioning contract.

## 7. Kiểm thử

- **Vitest** (client mock, kiểu đang dùng ở PR 3):
  - `specRules`: mọi rule server có nhãn và tab (đối chiếu danh sách rule export từ server, copy sang fixture).
  - `itemSuggestions`, `itemMatrix`, `blockSteps`, `lessonCode`: hàm thuần, chạy trên dữ liệu unit mẫu.
  - `SpecCheckBar`: vi phạm có link đúng tab; Publish khoá khi có vi phạm, mở khi hết; `409 LESSON_SPEC_INVALID` vẫn hiện danh sách.
  - `LessonSpecTab`: lưu gửi đúng body camelCase; lỗi `PREREQUISITE_INVALID` theo `reason`.
  - `LessonItemsTab`: thêm từ picker, đổi vai trò, gợi ý → Thêm; `LESSON_ITEM_IN_USE` hiện danh sách.
  - `TaskEditor`: tạo task, gợi ý tối đa 3 mức, tiêu chí 4 dòng, item trọng tâm, `TASK_IN_USE`.
  - `UnitItemMatrix`: cờ "Chỉ 1 lần", "Chưa được dạy".
  - `blockModel.test.ts`: `item_cards`, activity refs, step/skill/duration; không còn vocabulary/grammar.
- **Server:** toàn bộ `yarn test` và `yarn test:db` sau khi xoá; test migration `004` trong `databaseBaseline`; `openApiDocument` cập nhật số path/operation; fixture pin lại SHA.
- **Playwright** `e2e/lesson-spec.spec.ts` (DB thật), chính là bài kiểm tra "soạn unit mẫu trên admin":
  1. Tạo item word + pattern (dùng lại bước của `items.spec.ts`), publish.
  2. Tạo course → level → unit (can-do) → bài.
  3. Tab Đặc tả: mã, can-do, tình huống. Thanh kiểm tra giảm dần số vi phạm.
  4. Tab Item: thêm pattern (bắt buộc, mới).
  5. Tab Nhiệm vụ: task `independent`, chọn item trọng tâm, thấy đáp án chấp nhận.
  6. Tab Hoạt động: block bước 2–5, bước 5 là activity trỏ tới task.
  7. Nút Publish mở khoá → publish thành công.
  8. Trang unit: ma trận có dòng pattern ở bài vừa tạo, cờ "Chỉ 1 lần".
- `ling11-acceptance.spec.ts` AC-020 đang publish bài chỉ có block text: sửa để bài có đủ đặc tả (qua API trong bước chuẩn bị), giữ ý nghĩa test "vi phạm block được tô đỏ".
- Lệnh: `yarn admin-web:test`, `yarn admin-web:typecheck`, `yarn lint`, `yarn format`, `yarn test`, `yarn test:db` (2 lần, DB mới), `prisma migrate diff`, Playwright.

## 8. Thứ tự commit

1. `feat(admin-web): lesson spec, task and unit map API client` — kiểu, hàm client, `utils/spec/*` + test, `ItemPicker` chế độ `item`. Server: bổ sung trường (§5) nếu cần.
2. `feat(admin-web): lesson editor tabs and spec check bar` — `LessonTabs`, `SpecCheckBar`, tab Đặc tả, khoá Publish.
3. `feat(admin-web): lesson items tab with suggestions`.
4. `feat(admin-web): lesson tasks tab and task editor`.
5. `feat(admin-web): block steps, skills, durations and item cards` — tab Hoạt động, dialog, preview.
6. `feat(admin-web): unit can-do, summative tasks and item matrix; audience on course and level`.
7. `refactor: retire vocabulary and grammar blocks` — §6, server + admin-web + migration 004 + fixture.
8. `test(admin-web): lesson spec e2e`.

Commit 1–6 chỉ **thêm**; block `vocabulary`/`grammar` vẫn chạy cho tới commit 7.

## 9. Rủi ro

- ⚠️ **Xoá API công khai** (F2): 3 route vocabulary và 2 loại block. App bản hiện tại không còn nhận block `vocabulary`/`grammar` trong snapshot; vì DB đã reset và seed chỉ dùng `item_cards`, thực tế không có bài nào chứa chúng. App sửa contract ở PR 5.
- ⚠️ **Fixture snapshot được pin SHA** bị sửa: App đang giữ bản copy cũ, sẽ đồng bộ ở PR 5. Cần nhớ không chạy prettier trên thư mục fixture.
- **`learning_items` của bài admin trở thành rỗng** sau khi bỏ nhánh block trong `deriveItems`. Không ảnh hưởng gì vì app PR 5 đọc `lesson_items`; bảng bị xoá ở PR 7.
- **Trang sửa bài lớn hơn nhiều** (5 tab, khoảng 15 component mới). Giảm thiểu: mỗi tab là component riêng, tự tải và tự lưu; `LessonEditPage` chỉ giữ tab và thanh kiểm tra.
- **Thanh kiểm tra có thể lệch** khi hai người cùng sửa một bài. Server vẫn chặn khi publish (409), nên không publish nhầm được.
- **Lặp logic với server** ở `lessonCode` và cờ ma trận. Giảm thiểu bằng test trên cùng dữ liệu unit mẫu, server vẫn là nơi kiểm cuối.
- Khối lượng: 8 commit. Có thể tách **PR 4a** (commit 1–5: soạn bài) và **PR 4b** (commit 6–8: unit, xoá block cũ, e2e) nếu muốn review nhỏ hơn.
