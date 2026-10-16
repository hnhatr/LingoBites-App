# Kế hoạch P6: khoá "Oxford 3000 + IELTS", kho mẫu câu, bản đồ thì, ôn bậc 3, F7 · F8 · F9

> Trạng thái: **ĐÃ DUYỆT 2026-10-15. S1 → S5, S5b đã code** (Server, nhánh `claude/eloquent-fermi-dkh3wj`); các bước còn lại chưa code. Lập ngày 2026-10-15, dựa trên code thật của LingoBites-App và LingoBites-Server lúc đó.
> Thiết kế: [`vocab-pattern-tense-path.md`](../../design/vocab-pattern-tense-path.md) · Plan tổng: [`vocab-pattern-tense-p2-p7-plan.md`](../../design/vocab-pattern-tense-p2-p7-plan.md) (mục P6).
> Repo: **Server** (server + `admin-web`) và **App**.

## 0. Quyết định

| Câu hỏi | Quyết định | Nguồn |
|---|---|---|
| Khoá "Oxford 3000 + IELTS" | **Khoá riêng**, không gộp vào "Tiếng Anh giao tiếp" | Đã chốt 2026-10-15 |
| Mốc bậc 3 | **stage ≥ 4** (sau lần chờ 14 ngày; từ đó 30 ngày hỏi một lần). Sai thì xuống stage 3, quay về bậc 2 | Đã chốt 2026-10-15 |
| Số hiệu F | Dùng cách đánh số trong plan P6: **F7** viết đoạn cuối tuần, **F8** bắt từ trong bài tự tạo, **F9** tiến độ. Sửa bảng §6 của thiết kế cho khớp | Đã chốt 2026-10-15 |
| "x / 3.000" hay "x / 5.000" | Không ghi cứng. Server trả **tổng số từ đã publish theo từng cấp**; App hiện "x / tổng" theo cấp và tổng chung | Đã chốt 2026-10-15 |
| Khoá mới | **Miễn phí** (không bật `isLocked`) | Đã chốt 2026-10-15 |
| Sinh trước câu tổ hợp cho bài | Phạm vi: **mẫu câu × thì × tình huống** của bài. Dữ liệu staging chỉ để test, nên lúc đầu chỉ sinh **1–2 bộ** để kiểm luồng | Đã chốt 2026-10-15 |
| Thứ tự thì theo cấp | Theo đề xuất ở §9 câu 4 | Đã chốt 2026-10-15 |

Các câu ở §9 đã chốt (xem bảng trên).

## 1. Kết quả sau P6

Người học:
1. Mở **Kho mẫu câu** (lọc theo chức năng, cấp, kỳ thi), xem ví dụ, bấm "Luyện câu tổ hợp" hoặc "Thêm vào ôn".
2. Mở **Bản đồ thì** (lưới 3 × 4, tô màu theo mức nhớ), chạm vào ô để xem công thức, dấu hiệu, thì hay nhầm, nút "Luyện câu".
3. Item ở stage 4 được ôn bằng **dạng viết bậc 3**: sắp xếp từ thành câu EN, hoặc đổi chủ ngữ rồi gõ động từ đã chia. Câu lấy từ các bộ câu đã mở, chấm offline.
4. Trong bài tự tạo, từ có trong danh sách Oxford hiện **nhãn cấp** và nút **"Thêm vào lộ trình"** (F8).
5. **Báo cáo tiến độ** có thêm phần từ đã nhớ theo cấp, mẫu câu theo chức năng, lưới thì (F9).
6. Khi viết **nhiệm vụ cuối unit**, thấy danh sách từ / mẫu / thì bắt buộc, được đánh dấu ngay khi dùng (F7).

Admin:
7. Có khoá **"Oxford 3000 + IELTS"** (A1 · A2 · B1 · B2), dựng unit bằng công cụ **"Tạo unit từ chủ đề"**, theo đợt.

## 2. Hiện trạng liên quan (đã kiểm trong code)

| Có sẵn | Ở đâu | Dùng cho |
|---|---|---|
| Lịch ôn 5 stage `[1, 3, 7, 14, 30]`, `stable_at` | Server `curriculum/outcomes/model/itemMemory.ts`; App `core/schemas/learningOutcomes.ts` | Bậc 3, F9 |
| Bậc 1 / 2 theo `RECALL_FROM_STAGE = 2` | App `features/review/screens/ItemReviewScreen.tsx` | Thêm mốc bậc 3 |
| Bộ câu lưu trên máy, token có vai trò `subject / aux / verb / item / other` | App `combo_sets_local`, `features/combo/logic/comboSetRepository.ts` | Bậc 3 |
| `catalog_items` (cột `source`) | App `core/db/catalogItems.ts` | Lưu mẫu câu / thì / từ thêm lẻ, **không cần tăng schema SQLite** |
| Tag `function:*`, `exam:*`, `topic:*`, `cefr_level` trên `items` | Server `019_vocab_import.sql` | Kho mẫu câu, F9, tạo unit |
| `enrolPackItems` (ghi `item_memory`) | Server `curriculum/outcomes/repository/learningOutcomes.ts` | "Thêm vào ôn", F8 |
| Chặn `grammar` theo `X-App-Version` (`appVersionAtLeast`, `GRAMMAR_MIN_APP_VERSION`) | Server `common/middleware/legacyClient.ts` | API mới trả item `grammar` |
| `inflect.ts`, `detectTense.ts`, `patternFrame.ts` | Server `modules/grammar/`, `modules/items/model/` | F7, F8 |
| Nhiệm vụ cuối unit có `item_codes` và chế độ viết | Server `curriculum/tasks/`; App `SummativeTaskView.tsx` | F7 |
| Bài học có `situation_id`, `cefr_level`, focus items; composer 6 bước | Server `curriculum/spec/`, `curriculum/composer/` | Tạo unit |
| Sinh trước câu tổ hợp theo item (worker, tạm dừng / chạy tiếp) | Server `combo/service/comboPrewarm.ts`, `/v1/admin/combo/prewarm` | Tạo unit |
| Nhiều khoá, khoá có `isLocked` + quyền vào học | Server `curriculum/courses/`; App `CourseListContent` | Khoá riêng |

**Ràng buộc quan trọng:** `AnalysisVocabularyItemSchema`, `LessonAnalysisSchema` và `LessonTaskSchema` trên App đều là `.strict()`. Thêm trường vào các object này sẽ làm **App bản cũ không đọc được bài**. Vì vậy F7 và F8 dùng **API mới riêng**, không sửa các object đó.

## 3. Server: API cho người học

Tất cả là API **mới**, chỉ thêm, không đổi API cũ. App cũ không gọi nên không bị ảnh hưởng.

### 3.1 Kho mẫu câu và thì
| Method | Path | Trả về |
|---|---|---|
| GET | `/v1/library/patterns` | Danh sách `{item: CatalogItem, cefr_level, tags[]}` của **mọi** mẫu câu `published`, kèm `functions[]` / `exams[]` (tag có dùng, kèm `label_vi`) để App dựng bộ lọc. App lọc trên máy (số mẫu ít, cần xem offline), nên không có tham số lọc |
| GET | `/v1/library/tenses` | Các item `grammar` `published` dạng `CatalogItem`, kèm `time`, `aspect` (từ payload) để xếp lưới. App dưới `GRAMMAR_MIN_APP_VERSION` nhận danh sách rỗng |

### 3.2 Thêm item lẻ vào lộ trình (dùng chung cho "Thêm vào ôn" và F8)
| Method | Path | Ghi chú |
|---|---|---|
| POST | `/v1/items/learn` `{item_codes[1–20]}` | Item phải `published`, loại `word / phrase / pattern` (`grammar` chỉ với App đủ mới). Có mã không dùng được thì `422 ITEMS_NOT_AVAILABLE` kèm `details.codes`, không ghi gì. Gọi lại `enrolPackItems` (stage 0; item đã có lịch thì giữ nguyên). Trả `{enrolled, already_scheduled, items: CatalogItem[]}` để App lưu vào `catalog_items` |

### 3.3 F8: tra từ trong bài tự tạo
| Method | Path | Ghi chú |
|---|---|---|
| POST | `/v1/items/lookup` `{words: [{word, pos?}] 1–30}` | Với mỗi từ (bỏ hoa thường, dấu câu ở đầu/cuối, `'s`): đoán các dạng gốc (bỏ `-s / -es / -ies / -ed / -ied / -ing`, phụ âm đôi, bảng động từ bất quy tắc, danh từ số nhiều bất quy tắc), rồi chỉ nhận item khi **chính dạng của item** cho lại đúng từ đó: viết y hệt, động từ qua `formsOf`, danh từ qua `pluralOf`. Cụm từ: biến đổi ở từ đầu (`looked after` → `look after`). Loại từ của Oxford (`n., v.`) và của AI (`noun`, `phrasal verb`) được quy về cùng nhóm; cùng nhóm xếp trước, rồi viết y hệt xếp trước. Chỉ item `published`, loại `word / phrase`. Trả `{word, matches: [{code, kind, text, cefr_level, meaning_vi, part_of_speech}] ≤ 3}` |

Tra lúc đọc (không lưu vào bản phân tích), nên dùng được cho cả các bài đã tạo trước đây. Từ nhiều nghĩa (`bank-money` / `bank-river`) trả nhiều kết quả; App cho người học chọn.

### 3.4 F9: tiến độ
| Method | Path | Trả về |
|---|---|---|
| GET | `/v1/me/vocab-progress` | `words: [{cefr_level, total, learning, stable}]` (A1 → C1, chỉ cấp có từ; `total` = số item `word / phrase` đã publish của cấp), `patterns: [{function, label_vi, total, learning, stable}]` (một mẫu có nhiều chức năng được đếm ở mỗi chức năng), `pattern_summary: {total, learning, stable}` (mỗi mẫu đếm một lần), `tenses: [{code, text, time, aspect, stage \| null, stable}]` (App cũ nhận rỗng, như 3.1) |

"Đã nhớ" = `item_memory.stable_at IS NOT NULL`; "đang học" = có `item_memory` nhưng chưa ổn định.

### 3.5 F7: danh sách bắt buộc của nhiệm vụ cuối unit
| Method | Path | Trả về |
|---|---|---|
| GET | `/v1/units/:unitId/summative-task/checklist` | Cần đăng nhập; chỉ unit đã publish (cả cấp và khoá), không thì `404 UNIT_NOT_FOUND`. Trả `{task_id \| null, items}`, mỗi item trong nhiệm vụ cuối unit (theo thứ tự): `{code, kind, text, meaning_vi, match}`. `match` là `{type: 'forms', forms[]}` cho từ / cụm từ (dạng biến đổi của từ đầu: động từ, số nhiều), `{type: 'fixed_parts', parts[]}` cho mẫu câu (các phần cố định của khung, đúng thứ tự), `{type: 'tense'}` cho thì. Item phát âm / nghe bị bỏ qua. So khớp trên máy: so theo nguyên từ (tách theo dấu câu, giữ `'`) |
| POST | `/v1/units/:unitId/summative-task/coverage` `{text ≤ 5000}` | Cần đăng nhập. Kiểm lại toàn bộ bằng cùng luật, thêm thì: `detectTense` cho từng câu (tách theo `. ! ? ;` và xuống dòng), chỉ nhận kết quả `confidence ≥ 0.9`. Trả `{task_id, items: [{code, used}]}`. Không lưu, không gọi AI. Giới hạn: mỗi câu chỉ đọc **một** động từ chính, và câu đảo ngữ (`Not only did we see…`) có thể đọc sai thì |

### File Server (dự kiến)
| File | Việc |
|---|---|
| `src/modules/library/` 🆕 (`controller/libraryRoutes.ts`, `service/libraryService.ts`) ✅ S1 | 3.1, 3.2. Dùng lại `WordPackItemSchema` (export từ `wordPackRoutes.ts`) |
| `src/modules/items/service/itemLookup.ts` 🆕, `controller/itemLookupRoutes.ts` 🆕 ✅ S2 | 3.3 |
| `src/modules/grammar/inflect.ts` 🔧 ✅ S2 | Thêm `pluralOf` (số nhiều của danh từ, kèm bảng bất quy tắc); việc đoán dạng gốc nằm trong `itemLookup.ts` |
| `src/modules/curriculum/outcomes/service/vocabProgress.ts` 🆕, `outcomes/controller/vocabProgressRoutes.ts` 🆕 ✅ S3 | 3.4 |
| `src/modules/curriculum/tasks/model/summativeChecklist.ts` 🆕 (luật thuần), `tasks/service/summativeChecklist.ts` 🆕, `tasks/controller/summativeChecklistRoutes.ts` 🆕 ✅ S4 | 3.5 |
| `src/app/server.ts` 🔧 | Đăng ký route |

## 4. Server + admin-web: khoá học và "Tạo unit từ chủ đề"

### 4.1 Dựng khoá
Admin tạo khoá **"Oxford 3000 + IELTS"** và 4 cấp A1 · A2 · B1 · B2 bằng trang có sẵn (`CourseCreatePage`, `LevelCreatePage`). **Không cần code.** Khoá `draft` cho tới khi đủ unit.

### 4.2 Migration nhỏ ⚠️
`033_unit_topic_tag.sql` (+ `.down.sql`), cập nhật `prisma/schema.prisma`:
```sql
ALTER TABLE units
    ADD COLUMN topic_tag varchar(64),                                   -- null được
    ADD CONSTRAINT units_topic_tag_fkey
        FOREIGN KEY (topic_tag) REFERENCES tags(code) ON DELETE SET NULL,
    ADD CONSTRAINT units_topic_tag_check
        CHECK (topic_tag IS NULL OR topic_tag LIKE 'topic:%');          -- chỉ tag chủ đề
CREATE INDEX units_topic_tag_idx ON units (topic_tag) WHERE topic_tag IS NOT NULL;
```
Chỉ thêm cột null được, không đụng dữ liệu cũ. Dùng để biết unit thuộc chủ đề nào, để không đề xuất trùng chủ đề và để đếm độ phủ.

### 4.3 Đề xuất unit (không gọi AI)
`POST /v1/admin/levels/:id/unit-proposals` `{topic_tag}` → trả bản nháp, **chưa ghi gì**:
- **Từ:** item `word / phrase` `published`, cùng cấp, có tag chủ đề, **chưa dùng ở unit khác của cùng khoá**. Lấy tối đa 48 từ, chia 4 bài × ~12. Thiếu từ thì báo số còn thiếu.
- **Mẫu câu:** mỗi bài 1 mẫu, cấp ≤ cấp unit, ưu tiên chức năng chưa dùng trong cấp.
- **Thì:** mỗi bài 1 thì, đi theo **thứ tự thì của cấp** (bảng cấu hình trong code, admin đổi được trong bản nháp).
- **Tình huống:** 1–2 tình huống `combo_enabled`, có `situation_tags` khớp chủ đề, cấp phù hợp.
- **Nhiệm vụ cuối unit:** viết đoạn ngắn, `item_codes` = tất cả mẫu + thì + 6 từ tiêu biểu của unit.

### 4.4 Tạo unit
`POST /v1/admin/levels/:id/units/from-proposal` `{proposal}` (bản admin đã sửa), trong 1 transaction:
1. Tạo unit (`topic_tag`), 4 bài `draft` với focus items, `situation_id`, `cefr_level`.
2. Tạo nhiệm vụ cuối unit.
3. Sau transaction: tạo **1 job sinh trước câu tổ hợp** cho các tổ hợp (mẫu câu của bài × thì của bài × tình huống của bài); trên staging chỉ sinh 1–2 bộ để thử.

**Đổi so với bản đầu (chốt 2026-10-16):** công cụ chỉ dựng **khung bài, không gọi AI**. Composer có sẵn không dùng được: nó dựng bài mới từ 1–8 câu của một bài nguồn và tự chọn item, không nhận danh sách từ. Mỗi bài nhận focus items = ~12 từ + 1 mẫu + **1 thì** (đều `required`; thì vào bài nhờ S5b). Nội dung 6 bước admin soạn trên trang bài có sẵn, rồi publish như hiện nay. Thiết kế lưu thì: [`vocab-pattern-tense-lesson-tense.md`](../../design/vocab-pattern-tense-lesson-tense.md).

### 4.5 Độ phủ
`GET /v1/admin/courses/:id/coverage`: theo từng cấp, số từ đã dùng / tổng, chủ đề đã có unit, mẫu câu và thì đã dùng. Giúp dựng ~60–65 unit theo đợt mà không trùng.

### File Server + admin-web (dự kiến)
| File | Việc |
|---|---|
| `src/common/database/migrations/033_unit_topic_tag.sql` 🆕, `.down.sql` 🆕, `prisma/schema.prisma` 🔧 ✅ S5 | 4.2. Test down của 002 và 019 gỡ 033 trước (033 tham chiếu `tags`) |
| `src/modules/curriculum/unitBuilder/` 🆕 (`model/tenseOrder.ts`, `service/proposeUnit.ts`, `service/createUnitFromProposal.ts`, `service/courseCoverage.ts`, `controller/unitBuilderRoutes.ts`) | 4.3 – 4.5 |
| `src/modules/combo/service/comboPrewarm.ts` 🔧 | Nhận danh sách tổ hợp cụ thể (không chỉ "mọi tổ hợp của item") |
| `admin-web/src/routes/UnitBuilderPage.tsx` 🆕 | Chọn chủ đề → xem đề xuất → sửa (đổi từ, mẫu, thì, tình huống) → tạo. Hiện ước tính số lần gọi AI (4 lần dựng bài + số bộ câu sinh trước) |
| `admin-web/src/routes/CurriculumPage.tsx` 🔧 | Nút "Tạo unit từ chủ đề" ở mỗi cấp; khung độ phủ của khoá |
| `admin-web/src/api/` 🔧 | Client cho các route trên |

## 5. App

### 5.1 Kho mẫu câu và bản đồ thì
| File | Việc |
|---|---|
| `src/features/library/` 🆕 (`logic/libraryClient.ts`, `logic/libraryRepository.ts`, `screens/PatternLibraryScreen.tsx`, `screens/PatternDetailScreen.tsx`, `screens/TenseMapScreen.tsx`, `screens/TenseDetailScreen.tsx`) | Tải danh sách, lưu vào `catalog_items` với `source = 'library'` để mở offline. Lọc chức năng / cấp / kỳ thi trên máy |
| `TenseMapScreen` | Lưới 3 × 4 (+ be going to). Màu ô theo `item_memory.stage`: chưa học · stage 0–1 · 2–3 · 4 / đã ổn định |
| `PatternDetailScreen`, `TenseDetailScreen` | Ví dụ, công thức, dấu hiệu, thì hay nhầm (đọc payload `grammar` có sẵn); nút **"Luyện câu tổ hợp"** mở `ComboSetupScreen` có sẵn; nút **"Thêm vào ôn"** gọi `/v1/items/learn` |
| `src/app/navigation/AppNavigator.tsx` 🔧 + navigation types | Route mới |
| Thư viện 🔧 | Lối vào "Kho mẫu câu", "Bản đồ thì" |
| `src/core/i18n/vi.json`, `en.json` 🔧 | Chuỗi mới |

### 5.2 Ôn bậc 3 dạng viết
| File | Việc |
|---|---|
| `features/review/logic/applyExercise.ts` 🆕 | Từ item → chọn câu trong các bộ đã mở (`item_code` khớp, hoặc `grammar_code` khớp với item `grammar`) → dựng 1 trong 2 dạng; không có câu phù hợp thì trả `null` |
| `features/combo/logic/comboSetRepository.ts` 🔧 | Thêm hàm đọc câu theo item / theo thì |
| `features/review/components/WordOrderCard.tsx` 🆕 | Câu VI → chạm từng token EN (đã xáo) để xếp câu. Chấm: đúng thứ tự token, bỏ qua dấu câu và hoa thường |
| `features/review/components/SwapSubjectCard.tsx` 🆕 | Hiện câu mẫu A (nhóm chủ ngữ X). Câu B cùng bộ, cùng thể, khác nhóm chủ ngữ, để trống token `aux + verb`, kèm nghĩa VI của B. Người học gõ phần trống. Chấm: so token, không phân biệt hoa thường, coi `hasn't` = `has not`… |
| `features/review/screens/ItemReviewScreen.tsx` 🔧 | `APPLY_FROM_STAGE = 4`. Stage ≥ 4 và có bài bậc 3 → hỏi bậc 3 (xen kẽ 2 dạng); không có → bậc 2 như cũ. Ghi kết quả như cũ (`kind = review`, `item_recall`), **không đổi Server** |

### 5.3 F8: "Thêm vào lộ trình" trong bài tự tạo
| File | Việc |
|---|---|
| `features/lesson/player/logic/itemLookupClient.ts` 🆕 | Gọi `/v1/items/lookup` khi mở phần phân tích của một câu (có mạng); cache theo câu trong phiên |
| `features/lesson/player/components/SentenceAnalysisPanel.tsx` 🔧 | Từ khớp được: nhãn cấp (A1…C1) + nút "Thêm vào lộ trình" (hoặc "Đã trong lộ trình" nếu đã có `item_memory`). Nhiều nghĩa → sheet chọn nghĩa. Offline: không hiện nút |
| Dùng lại `libraryClient` (5.1) | Gọi `/v1/items/learn`, lưu item vào `catalog_items` với `source = 'lesson'` |

Chỉ hiện trong bài **người học tự tạo** (không đổi bài khoá học).

### 5.4 F9: tiến độ
| File | Việc |
|---|---|
| `features/profile/logic/vocabProgressClient.ts` 🆕 | Gọi `/v1/me/vocab-progress` |
| `features/profile/screens/ProgressReportScreen.tsx` 🔧 | Phần mới "Từ · Mẫu · Thì": thanh theo cấp "x / tổng", mẫu theo chức năng, lưới thì nhỏ (chạm mở `TenseMapScreen`). Offline: hiện thông báo cần mạng |

### 5.5 F7: viết đoạn cuối tuần
| File | Việc |
|---|---|
| `features/course/logic/summativeChecklist.ts` 🆕 | Tải checklist kèm nhiệm vụ; so khớp trên máy: từ / cụm từ theo `forms`, mẫu câu theo `fixed_parts` (đúng thứ tự). Thì chỉ đánh dấu sau khi kiểm trên Server |
| `features/lesson/flow/components/SummativeTaskView.tsx` 🔧 | Danh sách item bắt buộc dưới ô viết, tick ngay khi gõ (debounce). Khi nộp: gọi `/coverage`, cập nhật dấu tick cho thì. Không chặn nộp nếu thiếu, chỉ nhắc |

### Dữ liệu trên máy
**Không tăng phiên bản schema SQLite.** Dùng lại `catalog_items` (`source` mới: `library`, `lesson`) và `combo_sets_local`.

## 6. Test

**Server**
- Unit: tra từ (động từ bất quy tắc, số nhiều, từ nhiều nghĩa, loại từ), `pluralOf`, checklist (forms, fixed parts), coverage (thì có `confidence` thấp bị bỏ qua), đề xuất unit (không trùng từ giữa các unit, thiếu từ, thứ tự thì).
- DB: `/v1/items/learn` (chỉ `published`, item đã có lịch giữ nguyên, chặn `grammar` với App cũ), `/v1/me/vocab-progress`, tạo unit trong 1 transaction (lỗi giữa chừng thì không còn gì), migration 033 lên / xuống.
- admin-web: `UnitBuilderPage` (đề xuất, sửa, tạo), nút ở `CurriculumPage`.

**App (Jest)**
- `applyExercise`: không có bộ câu → null; bộ chỉ có 1 nhóm chủ ngữ → chỉ dạng sắp xếp; mẫu `locked`.
- `ItemReviewScreen`: stage 3 → bậc 2; stage 4 có câu → bậc 3; stage 4 không có câu → bậc 2.
- `WordOrderCard`, `SwapSubjectCard`: chấm đúng / sai, dạng rút gọn.
- `PatternLibraryScreen` (lọc, offline), `TenseMapScreen` (màu theo stage), `SentenceAnalysisPanel` (nhãn cấp, nút, offline), `ProgressReportScreen` (phần mới, offline), `SummativeTaskView` (tick khi gõ, sau khi nộp).

**Thủ công**: máy thật iOS + Android trước khi phát hành; dựng thử 1 unit A2 trên staging, kiểm 4 bài và câu sinh trước.

## 7. Thứ tự làm và chia commit

| # | Repo | Nội dung | Phát hành App? |
|---|---|---|---|
| S1 ✅ | Server | `feat(library): pattern and tense lists, learn single items` (3.1, 3.2) | Không |
| S2 ✅ | Server | `feat(items): look up lesson words in the word list` (3.3) | Không |
| S3 ✅ | Server | `feat(outcomes): vocab progress for the learner` (3.4) | Không |
| S4 ✅ | Server | `feat(tasks): summative checklist and coverage` (3.5) | Không |
| S5 ✅ | Server | `feat(curriculum): unit topic tag migration` (4.2) ⚠️ | Không |
| S5b ✅ | Server, admin-web | `feat(curriculum): a lesson teaches one tense` (thì là focus item của bài, tối đa 1, `required`) ⚠️ hợp đồng giao bài | Không |
| S6 | Server | `feat(curriculum): propose and create units from a topic, course coverage` (4.3 – 4.5) | Không |
| S7 | admin-web | `feat(admin): unit builder page` | Không |
| A1 | App | `feat(library): pattern library and tense map` (5.1) | |
| A2 | App | `feat(review): stage 4 written practice` (5.2) | |
| A3 | App | `feat(lesson): add words of own lessons to the path` (5.3) | |
| A4 | App | `feat(profile): words, patterns and tenses in the progress report` (5.4) | |
| A5 | App | `feat(course): required items checklist in the summative task` (5.5) | ✅ gộp A1–A5 một bản |

S1–S4 phải lên production trước khi phát hành App. S5–S7 làm song song với App; dựng nội dung theo đợt sau S7.

Tài liệu: cập nhật `vocab-pattern-tense-p2-p7-plan.md` (§0, P6), bảng §6 của `vocab-pattern-tense-path.md` (số hiệu F), `architecture/feature-map.md`, `architecture/lesson-design.md`.

## 8. Rủi ro

- ⚠️ **Migration 033**: chỉ thêm cột null được. `.down` xoá cột và mất `topic_tag` đã gán.
- ⚠️ **API công khai mới** (7 route người học): chỉ thêm; không sửa object `.strict()` cũ nên App cũ không bị ảnh hưởng.
- ⚠️ **Chi phí AI khi dựng khoá**: mỗi unit 4 lần dựng bài + câu sinh trước (mục 9, câu 2). Ước tính hiện trên `UnitBuilderPage` trước khi bấm tạo, tính vào ngân sách hệ thống, không tính vào lượt của người học.
- **Khối lượng nội dung**: ~60–65 unit vẫn cần người kiểm từng bài. Dựng theo đợt, mỗi đợt một cấp.
- **Độ chính xác F7 / F8**: so khớp dựa trên luật (không AI). Từ hiếm hoặc biến đổi lạ có thể không khớp; thà bỏ sót hơn đánh dấu sai.
- **Bậc 3 chỉ có khi đã mở bộ câu**: item chưa có bộ câu vẫn ôn bậc 2. Đây là chủ ý (không tốn thêm lượt AI).

## 9. Cần bạn chốt trước khi code

1. **Khoá mới miễn phí hay khoá (`isLocked`, cần quyền vào học)?** Đề xuất: **miễn phí** lúc đầu, khoá lại sau bằng cờ có sẵn.
2. **Sinh trước câu tổ hợp cho bài**: chỉ **mẫu câu × thì × tình huống** của bài (đề xuất, ~4–8 bộ / unit, ~260–520 bộ cho cả khoá), hay cả **12 từ** của mỗi bài (~50–100 bộ / unit, ~3.000–6.500 bộ)? Từ vẫn sinh khi người học mở như hiện nay.
3. **Số hiệu F** và **tổng số từ** theo đề xuất ở §0?
4. **Thứ tự thì theo cấp** (dùng làm mặc định khi đề xuất unit). Đề xuất: A1 hiện tại đơn, hiện tại tiếp diễn, quá khứ đơn, be going to · A2 thêm tương lai đơn, quá khứ tiếp diễn, hiện tại hoàn thành · B1 thêm hiện tại hoàn thành tiếp diễn, quá khứ hoàn thành · B2 các thì còn lại.
