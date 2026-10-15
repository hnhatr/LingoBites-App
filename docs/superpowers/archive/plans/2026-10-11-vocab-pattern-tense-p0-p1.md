# Kế hoạch P0 + P1: migration và import CSV trên admin

> Trạng thái: **ĐÃ CODE** (LingoBites-Server: migration `019_vocab_import.sql`, module `src/modules/imports/`, trang Import trên admin-web). Rà lại ngày 2026-10-15.
> Thiết kế gốc: [`vocab-pattern-tense-path.md`](../../../design/vocab-pattern-tense-path.md) (mục 8.7, 9, 10). Các giai đoạn sau: [`vocab-pattern-tense-p2-p7-plan.md`](../../../design/vocab-pattern-tense-p2-p7-plan.md).
> Repo làm việc: **LingoBites-Server** (server + `admin-web`). App **không đổi** ở P0 + P1.

## 0. Quyết định đã chốt (2026-10-11)

| Câu hỏi | Quyết định |
|---|---|
| Gói học ban đầu | Chỉ có gói `free` |
| Lượt gọi AI mỗi ngày của gói free | **10**, là setting, chỉnh lại sau |
| Bản quyền Oxford 3000 / 5000 | Cứ dùng, xử lý sau |
| Cấp làm giàu | **Tất cả các cấp** (A1 → C1), không chia đợt |

Hai mục đầu áp dụng ở P3, mục cuối ở P2. Kế hoạch này chỉ gồm P0 + P1.

## 1. Kết quả P0 + P1

Sau P0 + P1, admin có thể:
1. Mở trang **Import** trên admin-web và chọn loại dữ liệu: *Từ vựng · Mẫu câu · Thì · Tình huống*.
2. Upload CSV và xem trước: dòng nào tạo mới, dòng nào đã có, dòng nào lỗi kèm lý do.
3. Xác nhận để ghi. Xem danh sách các lô import, tải file dòng lỗi.
4. Import 4 file đã chuẩn bị sẵn:

| File | Kết quả sau import |
|---|---|
| `tenses.csv` | 13 item `grammar` (12 thì + be going to), `draft` |
| `ielts-patterns.csv` | 25 item `pattern` có khung slot + ví dụ EN/VI, `draft` |
| `oxford-3000.csv`, `oxford-5000-extra.csv` | 5.323 dòng vào **hàng chờ làm giàu** (`import_rows`), có sẵn IPA từ cmudict. Thành item ở P2, sau khi AI soạn nghĩa. |

**Vì sao từ vựng chưa thành item ngay?** Bảng `items` có ràng buộc `items_meaning_vi_check`: nghĩa tiếng Việt không được rỗng. Mình **giữ nguyên ràng buộc này**, vì App và các bài học dựa vào nó. Thay vào đó, từ chưa có nghĩa nằm trong hàng chờ `import_rows` cho tới khi được làm giàu.

Dòng CSV nào **đã có `meaning_vi`** thì tạo item luôn.

## 2. P0: migration

Thêm 1 file migration **`019_vocab_import.sql`** + **`019_vocab_import.down.sql`** trong `src/common/database/migrations/`, và cập nhật `prisma/schema.prisma` cho khớp. Repo dùng các file SQL đánh số, chạy theo `schema_migrations` (`src/common/database/migrate.ts`).

### 2.1 Thay đổi bảng có sẵn ⚠️

| Bảng | Thay đổi | Ảnh hưởng dữ liệu cũ |
|---|---|---|
| `items` | `items_kind_check`: thêm `'grammar'` | Không. Chỉ nới rộng. |
| `items` | Thêm cột `cefr_level varchar(4)` (null, CHECK `A1…C2`), `frequency_rank int` (null), `import_batch_id uuid` (null, FK) | Không. Cột mới để trống. |
| `situations` | `situations_level_check`: từ `A1, A2` → `A1…C1` | Không. Chỉ nới rộng. |
| `situations` | Thêm cột `register varchar(8) DEFAULT 'neutral'`, `combo_enabled boolean DEFAULT false` | Không |

Không xoá cột, không đổi kiểu, không sửa dữ liệu. File `.down.sql` đảo lại được; riêng việc thu hẹp CHECK trong `.down` sẽ **thất bại có chủ đích** nếu đã có item `grammar` hoặc tình huống B1+ (phải xoá chúng trước).

### 2.2 Bảng mới

```sql
CREATE TABLE tags (
  code      varchar(64) PRIMARY KEY,           -- 'topic:education', 'function:emphasis', 'list:oxford-3000'
  kind      varchar(16) NOT NULL CHECK (kind IN ('topic','function','exam','list','register')),
  label_vi  varchar(120) NOT NULL,
  position  int NOT NULL DEFAULT 0,
  CHECK (code = lower(code) AND split_part(code, ':', 1) = kind)
);
CREATE TABLE item_tags (
  item_id  uuid NOT NULL REFERENCES items ON DELETE CASCADE,
  tag_code varchar(64) NOT NULL REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_code)
);
CREATE INDEX item_tags_tag_idx ON item_tags (tag_code);

CREATE TABLE item_links (
  from_item_id uuid NOT NULL REFERENCES items ON DELETE CASCADE,
  to_item_id   uuid NOT NULL REFERENCES items ON DELETE RESTRICT,
  relation     varchar(16) NOT NULL CHECK (relation IN ('collocation','word_family','synonym','uses_grammar','contrast')),
  position     int NOT NULL DEFAULT 0,
  PRIMARY KEY (from_item_id, to_item_id, relation),
  CHECK (from_item_id <> to_item_id)
);

CREATE TABLE situation_tags (
  situation_id uuid NOT NULL REFERENCES situations ON DELETE CASCADE,
  tag_code     varchar(64) NOT NULL REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (situation_id, tag_code)
);

CREATE TABLE import_batches (
  id          uuid PRIMARY KEY,
  kind        varchar(16) NOT NULL CHECK (kind IN ('words','patterns','grammar','situations')),
  file_name   varchar(200) NOT NULL,
  file_sha256 char(64) NOT NULL,
  status      varchar(12) NOT NULL CHECK (status IN ('previewed','applying','applied','failed','discarded')),
  counts      jsonb NOT NULL DEFAULT '{}',  -- {total, create, update, unchanged, staged, rejected}
  error       varchar(500),
  created_by  varchar(80) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  applied_at  timestamptz
);

-- Mỗi dòng CSV đã kiểm: dùng cho xem trước, apply, tải dòng lỗi,
-- và là hàng chờ làm giàu cho từ chưa có nghĩa (P2).
CREATE TABLE import_rows (
  batch_id  uuid NOT NULL REFERENCES import_batches ON DELETE CASCADE,
  line      int  NOT NULL,
  code      varchar(160),
  action    varchar(12) NOT NULL CHECK (action IN ('create','update','unchanged','stage','reject')),
  data      jsonb NOT NULL,                -- dòng đã chuẩn hoá (+ ipa tra từ điển)
  reason    varchar(300),                  -- lý do khi action = reject
  item_id   uuid REFERENCES items ON DELETE SET NULL,
  enrichment_status varchar(12) CHECK (enrichment_status IN ('pending','done','failed')),
  PRIMARY KEY (batch_id, line)
);
CREATE INDEX import_rows_enrichment_idx ON import_rows (enrichment_status) WHERE enrichment_status = 'pending';
CREATE INDEX import_rows_code_idx ON import_rows (code);
```

Migration chèn sẵn các tag cơ bản: `list:oxford-3000`, `list:oxford-5000`, `list:ielts-patterns`, `exam:ielts-writing`, 11 tag `function:*` (emphasis, benefit, cause-effect, condition, necessity, contrast, comparison, trend, opinion, problem, influence, linking) và khoảng 20 tag `topic:*` phổ biến (education, work, travel, environment, health, technology, …).

### 2.3 Code server đổi theo P0

| File | Thay đổi |
|---|---|
| `src/modules/items/model/item.ts` | Thêm `'grammar'` vào `ItemKindValues` |
| `src/modules/items/model/itemPayload.ts` | Schema `GrammarPayloadSchema`: `family`, `time`, `aspect`, `forms{affirmative,negative,question}`, `signals[]`, `uses_vi[]`, `contrast_with[]` (item refs), `check{aux[],verb_form}`, `order` |
| `src/modules/items/model/itemPayload.ts` | `PatternPayloadSchema` thêm trường tuỳ chọn `combo_subject_groups: string[]` và `tense_mode: free \| clause \| locked` (dùng ở P4) |
| `src/modules/items/repository/postgresItemStore.ts`, `adminItem.ts` | Đọc / ghi `cefr_level`, `frequency_rank`, tag; lọc theo `cefr_level`, `tag`, `import_batch_id` |
| **Chặn gắn `grammar` vào bài học** | `lesson_items` / `task_items` từ chối item `kind = grammar` cho tới P5. Lý do: App kiểm loại item bằng danh sách cố định (`CatalogItemKindValues` trong `src/core/schemas/lesson.ts` của App); gặp `grammar` trong snapshot bài thì sẽ lỗi đọc bài. |

## 3. P1: import CSV

### 3.1 Server: module mới `src/modules/imports/`

```
src/common/csv/parseCsv.ts            đọc CSV theo RFC 4180 (dấu ngoặc kép, dấu phẩy và xuống dòng trong ô, BOM UTF-8)
src/modules/imports/
  model/importKinds.ts                schema zod cho từng loại dòng + luật chuẩn hoá
  model/rowMapping.ts                 dòng → item / tình huống (khung slot, payload grammar, tag)
  repository/importStore.ts           import_batches, import_rows
  service/importPreview.ts            đọc file, kiểm từng dòng, so với DB → action
  service/importApply.ts              ghi theo lô 500 dòng, mỗi lô 1 transaction
  controller/adminImports.ts          route admin
```

**Không thêm dependency.** Repo chưa có thư viện CSV, nên mình viết một bộ đọc nhỏ (khoảng 80 dòng, có test). Upload dùng `@fastify/multipart` đã có sẵn.

### 3.2 API admin

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/v1/admin/imports` | multipart: `kind` + `file` (≤ 5 MB, ≤ 10.000 dòng). Kiểm tra và lưu `import_rows`, trả về số lượng + 50 dòng đầu mỗi nhóm. **Không ghi item.** |
| GET | `/v1/admin/imports` | Danh sách lô (phân trang) |
| GET | `/v1/admin/imports/:id` | Trạng thái, số lượng, dòng theo nhóm (phân trang) |
| GET | `/v1/admin/imports/:id/rejects.csv` | Tải các dòng lỗi + cột `reason` để sửa và upload lại |
| POST | `/v1/admin/imports/:id/apply` | Ghi vào DB. Chạy nền; trạng thái `applying` → `applied` / `failed`. |
| POST | `/v1/admin/imports/:id/discard` | Huỷ lô đang xem trước |

- Mọi route dùng guard admin + CSRF như các route admin hiện có. Ghi `admin_audit_log` khi apply / discard.
- Apply kiểm lại DB ngay lúc ghi, vì từ lúc xem trước đến lúc apply dữ liệu có thể đã đổi.
- Một file (theo `file_sha256` + `kind`) đã apply rồi thì upload lại sẽ được cảnh báo, nhưng vẫn cho chạy (an toàn, vì chạy lại không tạo trùng).

### 3.3 Luật xử lý từng dòng

**Chung cho mọi loại:**
- Khoá chính là `code`, theo luật đã ghi ở mục 9.1 của thiết kế.
- `code` chưa có → `create` (item `draft`, `source = admin`, `import_batch_id`).
- `code` đã có, dữ liệu giống hệt → `unchanged`.
- `code` đã có, **chưa duyệt** (`reviewed_at` null) và **chưa publish** → `update` (chỉ điền trường trống + thêm tag).
- `code` đã có, đã duyệt hoặc đã publish → **chỉ thêm tag**; nếu dữ liệu khác thì ghi `reason` để admin xem. Không ghi đè.
- Trùng `code` trong cùng file → dòng sau `reject`.

| Loại | Kiểm tra riêng | Ghi vào |
|---|---|---|
| **Từ vựng** | `kind` ∈ word/phrase; `cefr` ∈ A1…C1; `lists` là tag `list:*` đã có. Word có dấu cách (luật item hiện có) → đổi `"a, an"` thành text `a/an`. Tra IPA bằng cmudict ✅. | Có `meaning_vi` → item. Không có → `stage` (`enrichment_status = pending`) |
| **Mẫu câu** | `frame` đọc được bằng `parseFrame` ✅; slot trong `slot_values` khớp đúng placeholder; `function` là tag có sẵn; có `example_en` + `example_vi` | Item `pattern` (text = frame, `note_vi` = usage + notes, `payload.combo_subject_groups`, `payload.tense_mode` ∈ free / clause / locked) + 1 `item_examples` + tag `function:*`, `exam:*`, `list:ielts-patterns` |
| **Thì** | `time`, `aspect` hợp lệ; `contrast_with` trỏ tới mã có trong file hoặc DB (kiểm sau khi tạo hết, theo 2 lượt) | Item `grammar` + ví dụ |
| **Tình huống** | `level` ∈ A1…C1; `audience`; `register`; `topics` là tag có sẵn | Bảng `situations` + `situation_tags`. Tình huống có sẵn: cập nhật các trường được gửi. |

### 3.4 Admin-web

| Trang | Loại | Nội dung |
|---|---|---|
| `ImportPage` (`/imports`) | 🆕 | Chọn loại → upload → bảng 5 nhóm (tạo / cập nhật / không đổi / chờ làm giàu / lỗi) → nút **Ghi vào DB** (qua `ConfirmDialog` có sẵn) → theo dõi tiến độ. Danh sách lô bên dưới. Nút **tải file mẫu** cho từng loại, và **tải dòng lỗi**. |
| `ItemListPage` | 🔧 | Thêm bộ lọc *Cấp*, *Tag*, *Lô import*; thêm loại `grammar` vào bộ lọc loại; cột *Cấp* |
| `ItemEditPage` | 🔧 | Ô *Cấp CEFR*, chọn tag. Loại `grammar`: form cho công thức, dấu hiệu, cách dùng, thì hay nhầm, luật kiểm tra |
| `SituationsPage` | 🔧 | Cấp B1–C1, `register`, công tắc `combo_enabled`, tag chủ đề |
| `AdminShell` | 🔧 | Thêm mục menu *Import* |

### 3.5 Test

| Test | Loại | Ở đâu |
|---|---|---|
| `parseCsv` (ngoặc kép, dấu phẩy trong ô, xuống dòng, BOM, dòng thiếu cột) | unit | `test/csvParse.test.ts` → `yarn test` |
| Luật từng loại dòng, luật mã, khung slot, payload grammar | unit | `test/importRows.test.ts` → `yarn test` |
| Migration 019 chạy và đảo lại được trên DB trống | DB | `test/vocabImportSchema.test.ts` → `yarn test:db` |
| Route import: preview / apply / chạy lại không trùng / item đã duyệt không bị ghi đè / rejects.csv / quyền admin | DB | `test/adminImports.test.ts` → `yarn test:db` |
| Không gắn được `grammar` vào bài | DB | thêm vào `test/lessonSpecRoutes.test.ts` |
| `ImportPage`, bộ lọc mới | component | `admin-web/src/routes/ImportPage.test.tsx` → `yarn admin-web:test` |
| **Import thật 4 file** đã chuẩn bị trên DB local | thủ công | Ghi kết quả số lượng vào báo cáo |

Trước mỗi lần push: `yarn lint`, `yarn typecheck`, `yarn test`, `yarn test:db` (cần Postgres local), `yarn admin-web:test`.

## 4. Chia commit

| # | Commit | Nội dung |
|---|---|---|
| 1 | `feat(db): add vocab import schema (019)` | Migration + down + `schema.prisma` + test schema |
| 2 | `feat(items): grammar kind, cefr level and tags` | Model, payload, store, chặn grammar trong bài, test |
| 3 | `feat(imports): CSV parser and row rules` | `parseCsv`, `importKinds`, `rowMapping`, unit test |
| 4 | `feat(imports): admin preview and apply routes` | Store, service, controller, test DB |
| 5 | `feat(admin-web): import page` | `ImportPage`, menu, test |
| 6 | `feat(admin-web): item and situation filters for import` | ItemList / ItemEdit / Situations |

Mỗi commit tự chạy được và qua test. Tất cả nằm trên nhánh `claude/compassionate-clarke-s7ff6r` của **LingoBites-Server**.

## 5. Rủi ro và điểm cần xem kỹ

| Rủi ro | Cách xử lý |
|---|---|
| ⚠️ **Migration nới CHECK** của `items` và `situations` | Chỉ nới rộng, không sửa dữ liệu. `.down` thất bại có chủ đích nếu đã có dữ liệu mới. Chạy thử trên staging trước production. |
| ⚠️ **App gặp item `grammar`** | Chặn ở server: không gắn `grammar` vào bài / task. App chỉ hỗ trợ ở P5. |
| Item `word` không được chứa dấu cách | Đổi `"a, an"` → `a/an`. Các mục còn lại có dấu cách đã là `phrase`. |
| File lớn làm chậm request | Preview xử lý ~5.000 dòng trong vài giây (không gọi AI, chỉ tra từ điển). Apply chạy nền theo lô 500. |
| Hàng chờ làm giàu tồn lâu | Chỉ là dữ liệu trong `import_rows`, không ảnh hưởng người học. P2 sẽ xử lý. |
| `test:db` cần Postgres | Nếu môi trường cloud không có Postgres, mình sẽ nói rõ test nào chưa chạy được và lệnh để bạn chạy. |

## 6. Không làm trong P0 + P1

- Làm giàu bằng AI (P2).
- Gói học, giới hạn theo người dùng (P3).
- Kho câu tổ hợp (P4).
- Mọi thay đổi trong App (P5+).
- Upload CSV câu tổ hợp (loại thứ 5, làm cùng P4).

## Kết quả / điểm lệch so với plan

- Migration giữ đúng số `019_vocab_import.sql` (+ `.down.sql`).
- Thêm sau plan: chế độ **ghi đè** khi import (`025_import_overwrite.sql`), bộ lọc item / tình huống trên trang Import.
