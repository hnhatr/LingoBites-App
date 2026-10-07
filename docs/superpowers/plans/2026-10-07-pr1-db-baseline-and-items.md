# PR 1 – DB baseline + danh mục `items` (Server)

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1).
> Ngày lập: 2026-10-07. Repo: `LingoBites-Server`. Nhánh: `claude/optimistic-bell-mfgk44`.
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md` (plan tổng đã được duyệt).

## 1. Mục tiêu và phạm vi

PR này làm hai việc:

1. **Gộp 29 migration (49 file SQL) thành một baseline**, schema giữ y hệt hiện tại. Đây là thay đổi thuần cấu trúc, không đổi hành vi.
2. **Thêm danh mục item dùng chung:**
   - các bảng `items`, `item_examples`, `item_variants`, `item_errors`;
   - module `src/modules/items`;
   - API admin để tạo, sửa, liệt kê, publish và archive item.

**Ngoài phạm vi** (để PR sau, giữ cho PR này chạy được độc lập):

| Việc | PR |
|---|---|
| Xoá `learning_items`, `vocabularies`, `lesson_block_vocabularies`, block `vocabulary` / `grammar` | PR 2. Các bảng này đang được delivery, block editor, pipeline AI và admin-web dùng; xoá ngay sẽ làm server và admin hỏng |
| `lesson_items`, đặc tả bài, tasks, criteria, validator, snapshot mới | PR 2 |
| Trang admin danh mục item | PR 3 (dùng API của PR này) |
| Map item từ pipeline AI | PR 7 |

Sau PR này, `items` **chạy song song** với `vocabularies`. Chưa có gì đọc từ `items` ngoài API admin.

## 2. Quyết định mặc định cho các câu hỏi đang mở

Các câu hỏi này chạm tới schema của PR 1. Tôi chọn phương án đơn giản nhất mà vẫn mở rộng được. **Cần bạn xác nhận.**

| # | Câu hỏi | Mặc định |
|---|---|---|
| Q5 | Item do AI tạo có phải duyệt không? | Có. `source = 'ai'` thì luôn bắt đầu ở `status = 'draft'`. Chỉ item `published` mới được gắn vào bài `curriculum` (kiểm tra ở PR 2). Admin bấm publish để duyệt |
| Q6 | Item tách theo đối tượng hay dùng chung? | Một item dùng chung. Trường `audience` (`all`, `kids`, `adults`) dùng để lọc khi chọn. Ảnh là tuỳ chọn. Nếu trẻ em và người lớn cần ví dụ khác nhau, mỗi ví dụ có `audience` riêng |
| Q2 | Gợi ý cố định 3 mức hay mỗi task tự đặt? | Không ảnh hưởng PR 1, để chốt ở PR 2 |
| — | `code` có được đổi không? | Đổi tự do khi còn `draft`. **Không đổi được sau khi publish**, vì app dùng `code` làm khoá lịch ôn |

## 3. Phần 1 – Gộp migration thành baseline

### Cách làm
1. Chạy Postgres 16 bằng `docker-compose` của repo, rồi chạy `runMigrations` trên DB rỗng với chuỗi migration hiện tại.
2. `pg_dump --schema-only --no-owner --no-privileges` → dọn lại thành `001_baseline.sql`:
   - bỏ các câu `SET` của pg_dump;
   - giữ extension `pgcrypto` (cho `gen_random_uuid()`);
   - nhóm theo bảng, giữ nguyên tên constraint và tên index.
   - Bảng `schema_migrations` **không** nằm trong baseline, vì `migrate.ts` tự tạo.
3. **Kiểm tương đương** trước khi commit (không commit script này): dump schema của DB chạy chuỗi cũ và của DB chạy baseline, chuẩn hoá thứ tự, `diff` phải rỗng. Thêm `prisma db pull` trên DB baseline: không được khác `schema.prisma`.
4. Xoá 49 file `src/common/database/migrations/0*.sql` cũ, kể cả các file `.down.sql`.
5. Sửa comment trong `migrate.ts` để ghi lại quy ước mới: baseline là `001`, các migration sau đánh số tiếp từ `002`.

### Reset DB
Mọi DB đang có (local, staging, production) đều đã có `schema_migrations` ghi các file cũ. Nếu chỉ deploy baseline lên DB cũ, nó sẽ chạy `CREATE TABLE` trùng và lỗi. Vì vậy:
- Thêm `scripts/db-reset.ts`: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` rồi `runMigrations`.
  - Chỉ chạy khi `APP_ENV` là `local` hoặc `staging`.
  - Với production phải truyền thêm cờ `--confirm-production <tên-db>`.
  - In ra host và tên DB, rồi chờ gõ `yes`.
- Thêm script trong `package.json`: `db:reset`, `db:reset:staging`.
- ⚠️ **Xoá toàn bộ dữ liệu** của DB đích, kể cả media metadata. File trên GCS không bị xoá. Bạn đã xác nhận là không có người dùng.

### Test phải sửa vì gắn với tên file migration cũ
| File | Xử lý |
|---|---|
| `test/canonicalLessonMigration.test.ts` | **Xoá.** Nó test cutover 024 trên dữ liệu cũ; không còn dữ liệu cũ để test |
| `test/recordingsMigration.test.ts` | **Xoá** phần test nâng cấp 027. Các assert về constraint của bảng `recordings`, nếu có, chuyển vào `databaseBaseline.test.ts` |
| `test/helpers/resourceMigrationTestHelpers.ts` | **Xoá.** Thay chỗ gọi rollback/apply 017–019 trong `curriculum.test.ts`, `adminContentDelete.test.ts`, `lessonBlockPublish.test.ts`, `mediaLookup.test.ts`, `vocabularyLookup.test.ts` bằng `runMigrations` và dọn dữ liệu (TRUNCATE) |
| `test/learningItems.test.ts` | Bỏ phần đọc `029_learning_items.sql` / `.down.sql`. Giữ phần test hành vi của store (module này bị xoá ở PR 2) |
| `test/canonicalLessonCoreSchema.test.ts` | Giữ các assert về constraint. Chỉ sửa comment và tên version nếu có tham chiếu |
| `package.json` → `test:db` | Bỏ hai test đã xoá, thêm các test mới (§5) |

## 4. Phần 2 – Danh mục item

### 4.1 Migration `002_items.sql` (kèm `002_items.down.sql`)

```sql
CREATE TABLE items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            varchar(160) NOT NULL,
  kind            varchar(16)  NOT NULL,
  language        varchar(35)  NOT NULL DEFAULT 'en',
  text            varchar(500) NOT NULL,           -- dạng hiển thị: "coffee", "Can I have a {size} {drink}, please?"
  meaning_vi      text         NOT NULL,
  ipa             varchar(255) NULL,
  part_of_speech  varchar(64)  NULL,
  note_vi         text         NULL,               -- ghi chú cho người soạn / giải thích cho người học
  audio_media_id  uuid NULL REFERENCES media (id) ON DELETE RESTRICT,
  image_media_id  uuid NULL REFERENCES media (id) ON DELETE RESTRICT,
  audience        varchar(8)   NOT NULL DEFAULT 'all',
  payload         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  source          varchar(8)   NOT NULL DEFAULT 'admin',
  status          varchar(16)  NOT NULL DEFAULT 'draft',
  published_at    timestamptz  NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT items_code_unique     UNIQUE (code),
  CONSTRAINT items_kind_check      CHECK (kind IN ('word','phrase','pattern','pronunciation','listening')),
  CONSTRAINT items_code_kind_check CHECK (split_part(code, ':', 1) = kind AND length(split_part(code, ':', 2)) > 0),
  CONSTRAINT items_audience_check  CHECK (audience IN ('all','kids','adults')),
  CONSTRAINT items_source_check    CHECK (source IN ('admin','ai')),
  CONSTRAINT items_status_check    CHECK (status IN ('draft','published','archived')),
  CONSTRAINT items_published_at_check CHECK (status = 'draft' OR published_at IS NOT NULL),
  CONSTRAINT items_payload_object_check CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX items_kind_status_idx      ON items (kind, status);
CREATE INDEX items_updated_cursor_idx   ON items (updated_at DESC, id DESC);
CREATE INDEX items_text_lower_idx       ON items (lower(text) varchar_pattern_ops);
CREATE INDEX items_audio_media_id_idx   ON items (audio_media_id) WHERE audio_media_id IS NOT NULL;
CREATE INDEX items_image_media_id_idx   ON items (image_media_id) WHERE image_media_id IS NOT NULL;

CREATE TABLE item_examples (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  text_en        varchar(500) NOT NULL,
  text_vi        varchar(500) NOT NULL,
  audio_media_id uuid NULL REFERENCES media (id) ON DELETE RESTRICT,
  audience       varchar(8) NOT NULL DEFAULT 'all' CHECK (audience IN ('all','kids','adults')),
  position       int NOT NULL CHECK (position >= 0),
  CONSTRAINT item_examples_item_position_unique UNIQUE (item_id, position)
);

CREATE TABLE item_variants (               -- câu khác đáp án mẫu nhưng vẫn chấp nhận
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id   uuid NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  text      varchar(500) NOT NULL,         -- được dùng {slot} giống frame: "I'd like a {size} {drink}, please."
  note_vi   varchar(500) NULL,             -- vd "lịch sự hơn", "thân mật"
  position  int NOT NULL CHECK (position >= 0),
  CONSTRAINT item_variants_item_position_unique UNIQUE (item_id, position)
);

CREATE TABLE item_errors (                 -- lỗi thường gặp của người Việt
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  code            varchar(64)  NOT NULL,   -- vd "missing_article", "final_consonant_drop", "blunt_i_want"
  description_vi  varchar(500) NOT NULL,
  feedback_vi     varchar(500) NOT NULL,   -- câu phản hồi hiện cho người học
  severity        varchar(10)  NOT NULL CHECK (severity IN ('blocking','tolerated')),
  wrong_example   varchar(500) NULL,       -- "Can I have coffee?"
  right_example   varchar(500) NULL,       -- "Can I have a coffee?"
  position        int NOT NULL CHECK (position >= 0),
  CONSTRAINT item_errors_item_code_unique     UNIQUE (item_id, code),
  CONSTRAINT item_errors_item_position_unique UNIQUE (item_id, position)
);
```

`002_items.down.sql`: `DROP TABLE item_errors, item_variants, item_examples, items;`

Trong `prisma/schema.prisma`: thêm các model `Items`, `ItemExamples`, `ItemVariants`, `ItemErrors`, cùng các quan hệ ngược trên `Media`. Đặt tên theo style hiện có: PascalCase số nhiều, `@map` snake_case.

### 4.2 Payload theo `kind` (`model/itemPayload.ts`, zod `.strict()`)

| kind | payload | Kiểm tra |
|---|---|---|
| `word`, `phrase` | `{}` | `phrase` bắt buộc `text` có khoảng trắng; `word` thì không được có |
| `pattern` | `{ slots: { [name]: { label_vi, values?: string[], item_refs?: string[] } } }` | Frame là chính `text`. Tập `{tên}` trong `text` **trùng khít** với các khoá trong `slots`. Tên slot khớp `^[a-z][a-z_]{0,23}$`. Tối đa 4 slot. Mỗi slot có ít nhất 1 giá trị (`values` cộng `item_refs`). Tối đa 30 giá trị mỗi slot |
| `pronunciation` | `{ focus, focus_ipa?, tip_vi, minimal_pairs: [string, string][], target_item_refs?: string[] }` | `minimal_pairs` tối đa 10 cặp |
| `listening` | `{ question_en, question_vi?, audio_media_id?, answer_text?, answer_item_refs?: string[] }` | Phải có `answer_text` hoặc `answer_item_refs`. `audio_media_id` là media `audio` đang `active` |

Mọi `*_item_refs` là **`code`** của item khác, không dùng id, để dễ đọc và dễ seed. Service kiểm tra:
- item được tham chiếu tồn tại và không bị `archived`;
- với `slots.*.item_refs` thì kind phải là `word` hoặc `phrase`;
- item không được tự tham chiếu chính nó.

Với variant: tập `{slot}` của variant phải là tập con của slot trong frame.

### 4.3 Mã item (`model/itemCode.ts`)

- Chuyển `normalizeItemKey` từ `learningItems/model/itemKey.ts` sang đây. File cũ re-export lại cho tới khi PR 2 xoá module `learningItems`.
- `deriveItemCode(kind, text)`:
  - `word` / `phrase`: `kind + ':' + normalizeItemKey(text)`. Giữ đúng quy tắc khoá hiện tại, nên fixture `learning-item-keys.json` vẫn đúng.
  - `pattern`: bỏ phần `{…}`, chuẩn hoá, nối bằng `-`, cắt ở 80 ký tự. Ví dụ `pattern:can-i-have-a-please`. Admin nên tự đặt mã gọn hơn, ví dụ `pattern:can-i-have`.
  - `pronunciation` / `listening`: lấy từ `focus` hoặc `question_en` theo cùng cách.
- Nếu request không gửi `code` thì server tự sinh. Nếu trùng, trả lỗi `409 ITEM_CODE_CONFLICT` kèm id của item đã có. Không tự thêm hậu tố.
- Định dạng phần sau dấu `:` khớp `^[a-z0-9' -]{1,150}$`. Kiểm tra ở zod và ở CHECK của DB.

### 4.4 Khung câu (`model/patternFrame.ts`, hàm thuần)

- `parseFrame(text)` trả về danh sách đoạn chữ và slot.
- `expandPattern(frame, slots, resolveRef, limit)` trả về các câu cụ thể. Mặc định giới hạn 20 câu, lấy mẫu tất định: duyệt tích Descartes theo thứ tự rồi cắt. Ví dụ: "Can I have a small milk, please?"…
- PR này dùng `expandPattern` để trả `preview` trong API admin. Stage 2 dùng để sinh bài luyện, Stage 3 dùng để chấm.

### 4.5 Quy tắc trạng thái (`service/itemService.ts`)

| Chuyển trạng thái | Điều kiện |
|---|---|
| tạo mới | `source=admin` thì `draft`. Chỉ code hệ thống được tạo `source=ai` (PR 7); API admin luôn đặt `source=admin` |
| `draft → published` | Payload hợp lệ. Mọi `item_refs` trỏ tới item đã `published`. Media đang `active`. Đặt `published_at` |
| `published → archived` | Luôn cho phép ở PR này. PR 2 sẽ chặn nếu item còn được bài đang publish dùng |
| `archived → published` | Cho phép, chạy lại kiểm tra như khi publish |
| `→ draft` từ trạng thái khác | Không cho phép |
| sửa `code` | Chỉ khi `draft`. Ngược lại trả `409 ITEM_CODE_IMMUTABLE` |
| sửa `kind` | Không cho phép sau khi tạo, vì `code` có tiền tố là kind |

Mọi thao tác ghi chạy trong một transaction Prisma và cập nhật `updated_at`.

### 4.6 API admin (`controller/adminItems.ts`)

Cùng cách bảo vệ như `adminVocabularies.ts`: `requireAdminSession`, cộng `requireCsrfToken` cho các thao tác ghi, `requireStore`, trả 503 khi không có DB. Body dùng snake_case. Response bọc trong `{ request_id, status: 'success', … }`. Lỗi dùng `apiError`.

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/v1/admin/items` | Danh sách. Query: `kind`, `status`, `audience`, `source`, `q` (tiền tố của `text` hoặc `code`), `cursor`, `limit` (≤100, mặc định 50). Phân trang cursor theo `(updated_at, id)`, tái dùng `globalListCursor` |
| `GET` | `/v1/admin/items/:id` | Chi tiết, gồm `examples`, `variants`, `errors` và `preview` (≤20 câu, chỉ khi kind là `pattern`) |
| `GET` | `/v1/admin/items/by-code/:code` | Tra theo mã (dùng cho chọn tham chiếu và seed) |
| `POST` | `/v1/admin/items` | Tạo item `draft`. Body: `kind`, `code?`, `text`, `meaning_vi`, `ipa?`, `part_of_speech?`, `note_vi?`, `audio_media_id?`, `image_media_id?`, `audience?`, `payload` |
| `PATCH` | `/v1/admin/items/:id` | Sửa các trường trên, trừ `kind`. Có thể sửa `status` theo §4.5 |
| `PUT` | `/v1/admin/items/:id/examples` | Thay toàn bộ danh sách ví dụ. `position` lấy theo thứ tự mảng. Tối đa 10 |
| `PUT` | `/v1/admin/items/:id/variants` | Thay toàn bộ danh sách biến thể. Tối đa 20 |
| `PUT` | `/v1/admin/items/:id/errors` | Thay toàn bộ danh sách lỗi. Tối đa 20 |

Không có API xoá item. Muốn bỏ thì archive. Việc thay cả danh sách cho ví dụ, biến thể và lỗi khớp với cách form admin lưu một lần (PR 3).

**Mã lỗi:**

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ITEM` | Body không đúng schema |
| 400 | `ITEM_PAYLOAD_INVALID` | Payload sai theo kind. Kèm `details` chỉ ra trường sai |
| 400 | `ITEM_REF_INVALID` | `item_refs` không tồn tại, bị archive, sai kind, hoặc chưa publish lúc publish |
| 400 | `ITEM_MEDIA_INVALID` | Media sai loại hoặc không `active`. Tái dùng `PostgresMediaLookupStore` |
| 404 | `ITEM_NOT_FOUND` | Không có item |
| 409 | `ITEM_CODE_CONFLICT` | Mã đã tồn tại |
| 409 | `ITEM_CODE_IMMUTABLE` | Sửa mã sau khi publish |
| 409 | `ITEM_STATUS_TRANSITION_INVALID` | Chuyển trạng thái không hợp lệ |

Đăng ký trong `src/app/server.ts`, ngay sau `registerAdminVocabularyRoutes`. Gắn tag OpenAPI `Items (Admin)`.

### 4.7 Fixture dùng chung (Stage 0)

`test/fixtures/items/` gồm một file JSON cho mỗi kind, lấy theo unit mẫu "Gọi đồ uống":
- `word-coffee.json`
- `phrase-orange-juice.json`
- `pattern-can-i-have.json`: 2 slot, 2 biến thể, 3 lỗi
- `pronunciation-final-t.json`
- `listening-what-size.json`

Có test kiểm tra mọi fixture đều parse được bằng schema response. App và admin-web sẽ copy các file này giống cách đang làm với `learning-item-keys.json`.

## 5. File thay đổi

**Tạo mới**
```
src/common/database/migrations/001_baseline.sql
src/common/database/migrations/002_items.sql
src/common/database/migrations/002_items.down.sql
src/modules/items/model/item.ts            -- hằng số, enum, kiểu record
src/modules/items/model/itemCode.ts
src/modules/items/model/itemPayload.ts
src/modules/items/model/patternFrame.ts
src/modules/items/model/adminItem.ts       -- schema body/response + lớp lỗi
src/modules/items/repository/postgresItemStore.ts
src/modules/items/service/itemService.ts
src/modules/items/controller/adminItems.ts
scripts/db-reset.ts
test/itemCode.test.ts                       -- unit (yarn test)
test/itemPayload.test.ts                    -- unit
test/patternFrame.test.ts                   -- unit
test/itemFixtures.test.ts                   -- unit
test/adminItems.test.ts                     -- DB (test:db): CRUD, lọc, cursor, publish/archive, ref, media, CSRF
test/databaseBaseline.test.ts               -- DB: migrate DB rỗng → đủ bảng/constraint, chạy 2 lần không lỗi
test/fixtures/items/*.json
```

**Sửa**
```
prisma/schema.prisma                        -- thêm 4 model + quan hệ Media
src/app/server.ts                           -- đăng ký route
src/common/database/migrate.ts              -- comment quy ước đánh số
src/modules/learningItems/model/itemKey.ts  -- re-export normalizeItemKey từ items
package.json                                -- db:reset*, danh sách test:db
test/curriculum.test.ts, test/adminContentDelete.test.ts, test/lessonBlockPublish.test.ts,
test/mediaLookup.test.ts, test/vocabularyLookup.test.ts, test/learningItems.test.ts,
test/canonicalLessonCoreSchema.test.ts      -- bỏ phụ thuộc file migration cũ
docs/01-ba/02-technical/05-data-model.md    -- thêm mục items
```

**Xoá (cần duyệt)**
```
src/common/database/migrations/001_jobs.sql … 029_learning_items.down.sql   (49 file)
test/canonicalLessonMigration.test.ts
test/recordingsMigration.test.ts            (assert constraint còn giá trị chuyển sang databaseBaseline.test.ts)
test/helpers/resourceMigrationTestHelpers.ts
```

**Dependency mới:** không có.

## 6. Thứ tự commit

1. `refactor(db): squash migrations 001–029 into baseline`: baseline, xoá file cũ, sửa test, `databaseBaseline.test.ts`, `db-reset`. Toàn bộ test hiện có phải xanh.
2. `feat(items): add items catalog tables`: `002_items*.sql`, Prisma.
3. `feat(items): item code, payload and pattern frame models`: các hàm thuần cùng unit test và fixture.
4. `feat(items): admin item store, service and routes`: store, service, controller, `adminItems.test.ts`, đăng ký route, cập nhật doc.

## 7. Kiểm tra trước khi push

- `yarn lint`, `yarn format`, `yarn typecheck`.
- `yarn test` (unit) và `yarn test:db` trên Postgres 16 local (`docker compose up db`).
- Diff schema: chuỗi cũ so với baseline phải rỗng (§3 bước 3). Ghi kết quả vào mô tả PR.
- `prisma generate` không lỗi; `prisma db pull` trên DB đã migrate không ra khác biệt.
- Kiểm tay qua Swagger UI: tạo `word:milk` → tạo `pattern:can-i-have` tham chiếu tới nó → publish pattern trước word thì bị từ chối (`ITEM_REF_INVALID`) → publish word rồi publish pattern thì được → `preview` ra đúng câu.

## 8. Rủi ro và cần review kỹ

- ⚠️ **Reset DB staging và production** khi deploy PR này. Lệnh `yarn db:reset:staging` phải chạy **trước** khi khởi động server mới. Nếu không, server sẽ lỗi lúc chạy migration (bảng đã tồn tại).
- ⚠️ **Baseline sai lệch với chuỗi cũ:** giảm thiểu bằng bước diff schema bắt buộc và toàn bộ `test:db`.
- Bước diff baseline cần Docker và Postgres trên máy chạy. Nếu môi trường làm PR không có, sẽ báo lại và không push commit 1.
- `items` và `vocabularies` cùng tồn tại cho tới PR 2. Hai bên chưa đồng bộ với nhau, đây là có chủ đích.
- Giới hạn độ dài và số lượng (4 slot, 30 giá trị, 20 biến thể, 20 lỗi) là phỏng đoán ban đầu. Dễ nới về sau.
