# PR 2 – Đặc tả bài, `lesson_items`, nhiệm vụ & tiêu chí (Server)

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1).
> Ngày lập: 2026-10-07. Repo: `LingoBites-Server`. Nhánh: `claude/optimistic-bell-mfgk44` (nối tiếp PR 1).
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md`, mục Server 3–6.

## 1. Mục tiêu và phạm vi

Sau PR này, server lưu và trả về đủ **phiếu đặc tả bài**: mục tiêu can-do, tình huống, bài tiên quyết, item trọng tâm, nhiệm vụ và tiêu chí. Server cũng **chặn publish** bài curriculum thiếu đặc tả.

| Trong PR 2 | Ngoài PR 2 |
|---|---|
| Cột đặc tả cho `courses`, `levels`, `units`, `lessons` | Trang admin cho các phần này (PR 4) |
| `lesson_prerequisites`, `lesson_items` | Map item từ pipeline AI (PR 7) |
| `tasks`, `task_items`, `task_criteria` (gồm nhiệm vụ tổng hợp của unit) | `expected` / đáp án chi tiết của từng `activityKind` (Stage 2) |
| `lesson_blocks`: thêm `step`, `skill`, `duration_sec`; block mới `item_cards`; `activity.data` thêm `item_refs`, `task_id` | Chấm điểm, lượt làm, mức hoàn thành (Stage 2–3) |
| Validator đặc tả, chặn publish, API kiểm tra (`spec-check`) | **Xoá mô hình cũ** (§9: lịch xoá) |
| Snapshot bài học thêm `spec`, `lesson_items`, `tasks`, `step`/`skill` của block | Sửa app để đọc snapshot mới (PR 5) |
| Bảo vệ toàn vẹn: không archive item đang dùng, clone khi chuyển bài, tăng `content_revision` | |

**Nguyên tắc:** PR này chỉ **thêm**, không xoá gì. `vocabularies`, `learning_items`, block `vocabulary`/`grammar` và `items[]` cũ trong snapshot vẫn chạy song song. Admin-web và app hiện tại không hỏng.

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Mặc định đề xuất |
|---|---|---|
| D1 | Bài nào bắt buộc đủ đặc tả mới được publish? | **Mọi bài admin** (`origin = admin`), kể cả bài admin tạo từ YouTube, đúng nguyên tắc "bài từ nguồn mở rộng vẫn phải có mục tiêu và tiêu chí". Bài người học tự tạo (`origin = learner`) không bao giờ bị kiểm tra |
| D2 (= Q2) | Gợi ý cố định 3 mức hay mỗi task tự đặt? | **Tối đa 3 mức, mỗi task tự soạn.** Mỗi mức chọn một loại `replay` (nghe lại), `keyword` (từ khoá) hoặc `model` (hiện mẫu), thứ tự tuỳ người soạn |
| D3 | Bước nào trong 6 bước bắt buộc có block? | Bước 2, 3, 4, 5 bắt buộc. Bước 1 (Ôn liên quan) chỉ bắt buộc khi bài có item `prerequisite` hoặc `recycled`. Bước 6 (Xem kết quả) là màn hình hệ thống, không có block |
| D4 | Tiêu chí mặc định khi tạo task | Tự tạo đủ 4 dòng tiêu chí. Task `independent` / `summative`: cả 4 bắt buộc. Task `guided` / `variation`: chỉ `content` bắt buộc. Người soạn sửa được |
| D5 | Nhiệm vụ tổng hợp của unit có chặn publish unit không? | **Chưa chặn ở PR 2**, chỉ báo trong `spec-check` của unit. Stage 3 (mức "hoàn thành chủ đề") mới cần |

## 3. Migration `003_lesson_spec.sql` (kèm `.down.sql`)

```sql
-- Đối tượng ở mọi tầng lộ trình
ALTER TABLE courses ADD COLUMN audience varchar(8) NOT NULL DEFAULT 'all'
  CONSTRAINT courses_audience_check CHECK (audience IN ('all','kids','adults'));
ALTER TABLE levels  ADD COLUMN audience varchar(8) NOT NULL DEFAULT 'all'
  CONSTRAINT levels_audience_check CHECK (audience IN ('all','kids','adults'));
ALTER TABLE units   ADD COLUMN audience varchar(8) NOT NULL DEFAULT 'all'
  CONSTRAINT units_audience_check CHECK (audience IN ('all','kids','adults')),
                    ADD COLUMN can_do text[] NOT NULL DEFAULT '{}'
  CONSTRAINT units_can_do_check CHECK (cardinality(can_do) <= 3);

-- Phiếu đặc tả bài
ALTER TABLE lessons
  ADD COLUMN code varchar(64) NULL,                 -- "L1-U3-L02"; bắt buộc khi publish bài admin
  ADD COLUMN audience varchar(8) NOT NULL DEFAULT 'all',
  ADD COLUMN can_do text[] NOT NULL DEFAULT '{}',   -- 1–2 câu "Người học có thể…"
  ADD COLUMN situation jsonb NULL,                  -- {speaker, listener, place, purpose}
  ADD CONSTRAINT lessons_code_unique UNIQUE (code),
  ADD CONSTRAINT lessons_audience_check CHECK (audience IN ('all','kids','adults')),
  ADD CONSTRAINT lessons_can_do_check CHECK (cardinality(can_do) <= 2),
  ADD CONSTRAINT lessons_situation_object_check CHECK (situation IS NULL OR jsonb_typeof(situation) = 'object'),
  ADD CONSTRAINT lessons_learner_no_code_check CHECK (origin = 'admin' OR code IS NULL);

CREATE TABLE lesson_prerequisites (
  lesson_id              uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  prerequisite_lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position               int  NOT NULL CHECK (position >= 0),
  PRIMARY KEY (lesson_id, prerequisite_lesson_id),
  CONSTRAINT lesson_prerequisites_not_self CHECK (lesson_id <> prerequisite_lesson_id),
  CONSTRAINT lesson_prerequisites_position_unique UNIQUE (lesson_id, position)
);
CREATE INDEX lesson_prerequisites_prereq_idx ON lesson_prerequisites (prerequisite_lesson_id);

CREATE TABLE lesson_items (
  lesson_id    uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  role         varchar(10) NOT NULL CHECK (role IN ('required','extended')),
  introduction varchar(12) NOT NULL CHECK (introduction IN ('new','recycled','prerequisite')),
  position     int NOT NULL CHECK (position >= 0),
  PRIMARY KEY (lesson_id, item_id),
  CONSTRAINT lesson_items_position_unique UNIQUE (lesson_id, position)
);
CREATE INDEX lesson_items_item_idx ON lesson_items (item_id);   -- "item này dùng ở bài nào"

CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     uuid NULL REFERENCES lessons(id) ON DELETE CASCADE,
  unit_id       uuid NULL REFERENCES units(id)   ON DELETE CASCADE,
  kind          varchar(12) NOT NULL CHECK (kind IN ('guided','variation','independent','summative')),
  title_vi      varchar(255) NOT NULL,
  prompt_vi     text NOT NULL,                  -- đề bài cho người học
  situation     jsonb NULL,                     -- tình huống đã đổi chi tiết
  response_mode varchar(8) NOT NULL CHECK (response_mode IN ('speak','write','choose')),
  hint_levels   jsonb NOT NULL DEFAULT '[]',    -- [{level:1..3, type:replay|keyword|model, content_vi, content_en?}]
  position      int NOT NULL CHECK (position >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_owner_check CHECK ((lesson_id IS NULL) <> (unit_id IS NULL)),
  CONSTRAINT tasks_summative_unit_check CHECK ((kind = 'summative') = (unit_id IS NOT NULL)),
  CONSTRAINT tasks_hint_levels_array_check CHECK (jsonb_typeof(hint_levels) = 'array'),
  CONSTRAINT tasks_situation_object_check CHECK (situation IS NULL OR jsonb_typeof(situation) = 'object')
);
CREATE UNIQUE INDEX tasks_lesson_position_unique ON tasks (lesson_id, position) WHERE lesson_id IS NOT NULL;
CREATE UNIQUE INDEX tasks_unit_position_unique   ON tasks (unit_id, position)   WHERE unit_id IS NOT NULL;

CREATE TABLE task_items (                 -- item trọng tâm nhiệm vụ kiểm tra
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_id  uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  position int NOT NULL CHECK (position >= 0),
  PRIMARY KEY (task_id, item_id),
  CONSTRAINT task_items_position_unique UNIQUE (task_id, position)
);
CREATE INDEX task_items_item_idx ON task_items (item_id);

CREATE TABLE task_criteria (
  task_id   uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  criterion varchar(12) NOT NULL CHECK (criterion IN ('purpose','content','clarity','independence')),
  required  boolean NOT NULL,
  threshold numeric(4,3) NULL CHECK (threshold IS NULL OR (threshold >= 0 AND threshold <= 1)),
  note_vi   varchar(500) NULL,
  PRIMARY KEY (task_id, criterion)
);

-- Khối hoạt động gắn với bước trong bài
ALTER TABLE lesson_blocks
  ADD COLUMN step smallint NULL CHECK (step BETWEEN 1 AND 6),
  ADD COLUMN skill varchar(8) NULL CHECK (skill IN ('speak','listen','write')),
  ADD COLUMN duration_sec int NULL CHECK (duration_sec IS NULL OR duration_sec > 0);
ALTER TABLE lesson_blocks DROP CONSTRAINT lesson_blocks_type_check,
  ADD CONSTRAINT lesson_blocks_type_check CHECK (type IN
    ('text','example','vocabulary','media','context','grammar','activity','item_cards'));
```

Cập nhật `prisma/schema.prisma`: thêm cột mới vào `Courses`, `Levels`, `Units`, `Lessons`, `LessonBlocks`, cùng các model `LessonPrerequisites`, `LessonItems`, `Tasks`, `TaskItems`, `TaskCriteria`. Không chạy `prisma format` trên cả file. Kiểm tra `prisma migrate diff` phải rỗng (cách làm như PR 1).

## 4. Model và quy tắc (thuần, có unit test)

### 4.1 `src/modules/curriculum/spec/model/` (module mới, dùng chung cho lesson/unit/task)
- **`situation.ts`**: zod `{ speaker, listener, place, purpose }`, mỗi trường 1–200 ký tự, `.strict()`.
- **`canDo.ts`**: mảng 1–2 câu (unit 0–3 câu), mỗi câu 10–300 ký tự.
  - **Cảnh báo, không chặn:** câu không bắt đầu bằng mẫu quan sát được ("Tự …", "Hỏi…", "Trả lời…", "Gọi…", "Nói…", "Nghe…") hoặc chứa động từ không quan sát được ("biết", "hiểu", "nắm được"). Cảnh báo trả về dạng `warning` trong `spec-check`. Đây đúng ví dụ "Biết từ vựng đồ uống" là không đạt.
- **`hintLevels.ts`**: tối đa 3 phần tử. `level` là 1, 2, 3, liên tục, không trùng. `type` thuộc `replay | keyword | model`. `content_vi` 1–500 ký tự.
- **`lessonCode.ts`**: `^[A-Z0-9]+(-[A-Z0-9]+){1,5}$`, tối đa 64 ký tự (ví dụ `L1-U3-L02`).

### 4.2 `src/modules/curriculum/spec/service/specValidator.ts` (hàm thuần)
Đầu vào là ảnh chụp đã tải sẵn của bài: lesson, prerequisites, lesson_items kèm trạng thái item, tasks kèm criteria và task_items, blocks. Đầu ra: `{ violations: SpecViolation[], warnings: SpecWarning[] }`.

**Violations (chặn publish bài admin, quyết định D1):**

| Rule | Điều kiện vi phạm |
|---|---|
| `CODE_REQUIRED` | `code` rỗng |
| `CAN_DO_REQUIRED` | `can_do` rỗng |
| `SITUATION_REQUIRED` | `situation` rỗng |
| `REQUIRED_ITEM_MISSING` | Không có `lesson_item` nào `role = required` |
| `ITEM_NOT_PUBLISHED` | Có item trong `lesson_items` hoặc `task_items` chưa `published` (mỗi item một dòng) |
| `INDEPENDENT_TASK_MISSING` | Không có task `independent` |
| `TASK_CRITERIA_MISSING` | Task `independent` thiếu đủ 4 dòng tiêu chí, hoặc không có tiêu chí `required` |
| `TASK_ITEMS_MISSING` | Task `independent` không có `task_items` |
| `TASK_ITEM_NOT_IN_LESSON` | `task_items` trỏ tới item không thuộc `lesson_items` của bài |
| `BLOCK_STEP_MISSING` | Block không có `step` |
| `STEP_EMPTY` | Bước 2–5 không có block. Bước 1 rỗng trong khi bài có item `prerequisite`/`recycled` (D3) |
| `STEP_6_NOT_ALLOWED` | Block đặt ở bước 6 |
| `INDEPENDENT_ACTIVITY_MISSING` | Bước 5 không có block `activity` nào có `task_id` trỏ tới task `independent` của bài |
| `ITEM_CARDS_FOREIGN_ITEM` | Block `item_cards` chứa item không thuộc `lesson_items` |
| `ACTIVITY_TASK_FOREIGN` | `activity.task_id` không phải task của bài |
| `PREREQUISITE_NOT_PUBLISHED` | Bài tiên quyết chưa publish (bài tiên quyết đã bị archive thì chỉ cảnh báo) |

**Warnings (chỉ báo):**
- `CAN_DO_NOT_OBSERVABLE` (§4.1)
- `REQUIRED_ITEM_UNUSED`: item `required` không xuất hiện trong block `item_cards`, `activity.item_refs` hay `task_items` nào
- `SKILL_MISSING`: block bước 3–5 chưa có `skill`
- `DURATION_MISMATCH`: tổng `duration_sec` lệch quá 50% so với `estimated_minutes`
- `INDEPENDENT_TASK_HAS_HINTS`: task `independent` có hint (vận dụng độc lập không nên có gợi ý)
- `RECYCLED_ITEM_NEW`: item đánh dấu `recycled`/`prerequisite` nhưng chưa từng là `new` ở bài nào trong cùng course

**Unit** (`unitSpecValidator`, chỉ cảnh báo theo D5):
- `UNIT_CAN_DO_MISSING`
- `SUMMATIVE_TASK_MISSING`
- `ITEM_SINGLE_USE`: item `required` chỉ xuất hiện ở 1 bài trong unit. Đây là dấu hiệu chưa thiết kế lặp lại

### 4.3 Block
- `blockType.ts`: thêm `item_cards`.
- `blockData.ts`: `ItemCardsBlockDataSchema = { item_ids: uuid[] 1–30, unique }`.
- `extendedBlockContent.ts` → `ActivityBlockDataSchema` thêm `item_refs?: uuid[] (≤20)` và `task_id?: uuid`. Cả hai tuỳ chọn, nên block cũ vẫn hợp lệ.
- `lessonContentValidator.ts`: thêm case `item_cards`. Các rule `BLOCK_DATA_INVALID` hiện có giữ nguyên.

## 5. Repository và API admin

Mọi route nằm dưới `/v1/admin`, bảo vệ như các route hiện có (`requireAdminSession` cộng `requireCsrfToken` khi ghi). Body và response dùng snake_case, trừ khi mở rộng route sẵn có viết camelCase (lesson, unit): khi đó giữ đúng kiểu của route đó. Mọi thao tác ghi vào dữ liệu của một bài sẽ **khoá dòng lesson** (`lockLessonRowForUpdate`) và **tăng `content_revision`** (`bumpLessonContentRevision`).

### 5.1 Mở rộng route sẵn có
| Route | Thay đổi |
|---|---|
| `PATCH /v1/admin/lessons/:id` | Thêm `code`, `audience`, `canDo`, `situation` (theo kiểu camelCase của route). Chỉ áp dụng cho bài `origin = admin`; bài learner trả 404 như hiện nay |
| `GET /v1/admin/lessons/:id`, danh sách | Record thêm `code`, `audience`, `canDo`, `situation` |
| `PATCH /v1/admin/units/:id` | Thêm `audience`, `canDo` |
| `PATCH` course / level | Thêm `audience` |
| `POST /v1/admin/lessons/:id/publish` | Gọi `specValidator` sau validator block hiện có. Vi phạm → `422 LESSON_SPEC_INVALID` với `details.violations` (cùng kiểu với `LessonBlockPublishInvalidError` hiện nay) |

### 5.2 Route mới
| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/lessons/:id/spec` | Toàn bộ đặc tả: các trường của bài, `prerequisites[]` (id, code, title, status), `items[]` (item tóm tắt + role + introduction), `tasks[]` (kèm criteria, items, hint_levels) |
| `PUT` | `/lessons/:id/prerequisites` | `{ lesson_ids: uuid[] ≤ 10 }`, thay toàn bộ danh sách. Bài tiên quyết phải là bài admin cùng course, không phải chính nó, không tạo vòng (CTE đệ quy) → lỗi `PREREQUISITE_INVALID` kèm `details.reason` là `self`, `cycle`, `not_found` hoặc `other_course` |
| `PUT` | `/lessons/:id/items` | `{ items: [{ item_id, role, introduction }] ≤ 40 }`, thay toàn bộ. Item không được `archived` (`ITEM_REF_INVALID`). Không cho bỏ item đang được `task_items` hoặc block `item_cards` của bài dùng → `409 LESSON_ITEM_IN_USE` |
| `GET` | `/lessons/:id/spec-check` | `{ violations, warnings }`, chạy validator mà không publish. Admin hiện danh sách điều kiện còn thiếu (PR 4) |
| `POST` | `/lessons/:id/tasks` | Tạo task (`kind` không được là `summative`), tự tạo tiêu chí mặc định theo D4 |
| `POST` | `/units/:id/tasks` | Tạo nhiệm vụ tổng hợp (`kind = summative`) |
| `GET` | `/units/:id/tasks` | Danh sách nhiệm vụ tổng hợp |
| `GET` | `/tasks/:id` | Chi tiết task + `accepted_answers` (≤ 50 câu: mở rộng khung câu của các item `pattern` trong `task_items` cộng biến thể, dùng `expandPattern` của PR 1) |
| `PATCH` | `/tasks/:id` | Sửa `title_vi`, `prompt_vi`, `situation`, `response_mode`, `hint_levels`, `position` |
| `DELETE` | `/tasks/:id` | Xoá task. Bị chặn nếu block `activity` còn trỏ `task_id` tới task → `409 TASK_IN_USE` kèm id các block |
| `PUT` | `/tasks/:id/items` | `{ item_ids }`, thay toàn bộ. Với task của bài: item phải thuộc `lesson_items` (`TASK_ITEM_NOT_IN_LESSON`). Với task của unit: item phải thuộc `lesson_items` của ít nhất một bài trong unit |
| `PUT` | `/tasks/:id/criteria` | `{ criteria: [{ criterion, required, threshold?, note_vi? }] }`, đúng 4 phần tử, mỗi tiêu chí một lần |
| `GET` | `/units/:id/item-map` | Ma trận item × bài của unit, kèm role/introduction. Dữ liệu cho màn "ma trận lặp lại" (PR 4) và cho cảnh báo `ITEM_SINGLE_USE` |
| `GET` | `/units/:id/spec-check` | Cảnh báo của unit (D5) |

Code đặt ở:
- `src/modules/curriculum/spec/`: `model/`, `repository/postgresLessonSpecStore.ts`, `service/specValidator.ts`, `controller/lessonSpec.ts`
- `src/modules/curriculum/tasks/`: `model/task.ts`, `repository/postgresTaskStore.ts`, `controller/tasks.ts`

### 5.3 Bảo vệ toàn vẹn ở module khác
- **Item (PR 1)**: chuyển `published → archived` bị chặn nếu item nằm trong `lesson_items` hoặc `task_items` của bài đang `published` → `409 ITEM_IN_USE` kèm `details.lessons`. Sửa item đã publish (text, payload, ví dụ, biến thể, lỗi) sẽ tăng `content_revision` của mọi bài dùng nó, giống `postgresVocabularyAdminStore.update` hiện nay.
- **Chuyển bài** (`adminLessonMove.ts`, thực chất là clone sang unit khác): copy thêm `lesson_items`, `tasks` (id mới), `task_items`, `task_criteria`, và ánh xạ `activity.data.task_id` sang id task mới. **Không** copy `prerequisites` (khác course) và **không** copy `code` (unique), nên bài mới là draft chưa có mã.
- **Xoá media** (`adminContentDeleteStore.deleteMedia`): FK RESTRICT từ `items` / `item_examples` đã chặn ở DB. Sửa để trả `409 MEDIA_IN_USE` rõ ràng thay vì lỗi 500.
- **Xoá lesson/unit**: CASCADE đã lo `lesson_items`, `tasks`, `prerequisites`. Bổ sung số lượng vào `DeleteCounts`.

## 6. Snapshot bài học (delivery)

`LessonSnapshotSchema` (`canonicalLesson/model/lesson.ts`) và `postgresLessonDeliveryStore.ts` thêm các phần sau, giữ nguyên mọi trường cũ, kể cả `items[]` lấy từ `learning_items`:

```jsonc
{
  "spec": {                       // null với bài learner
    "code": "L1-U3-L02", "audience": "all",
    "can_do": ["Tự gọi một đồ uống kèm cỡ và trả lời câu hỏi của người bán."],
    "situation": { "speaker": "khách", "listener": "người bán", "place": "quán cà phê", "purpose": "gọi đồ uống" },
    "estimated_minutes": 12,
    "prerequisites": [{ "lesson_id": "…", "code": "L1-U3-L01", "title": "…" }]
  },
  "lesson_items": [               // [] với bài learner
    { "role": "required", "introduction": "new", "position": 0,
      "item": { /* item: code, kind, text, meaning_vi, ipa, audio/image url, payload,
                   examples, variants, errors — bỏ trường quản trị (status, source, timestamps) */ } }
  ],
  "tasks": [
    { "id": "…", "kind": "independent", "title_vi": "…", "prompt_vi": "…", "situation": {…},
      "response_mode": "speak", "hint_levels": [], "item_codes": ["pattern:can-i-have"],
      "criteria": [{ "criterion": "purpose", "required": true, "threshold": null }] }
  ],
  "blocks": [{ "…": "…", "step": 3, "skill": "speak", "duration_sec": 60 }]
}
```

- Item trong snapshot là **bản tại thời điểm tải** (tăng `content_revision` theo §5.3 để app biết tải lại).
- Media của item trả theo cách các block media hiện làm (`CurriculumMediaUrlResolver`).
- Admin preview (`/v1/admin/lessons/:id/preview`) trả cùng cấu trúc.
- Catalog bài (`/api/v1/lessons`, `/v1/units/:unitId/lessons`) thêm `code` và `can_do`.
- Fixture `src/modules/canonicalLesson/model/fixtures/valid-lesson-snapshot-with-spec-response.json` theo unit mẫu "Gọi đồ uống". App sẽ copy fixture này ở PR 5.

> ⚠️ App hiện parse snapshot ở chế độ `.strict()`, nên **bản app hiện tại sẽ không mở được bài** sau PR này. Không có người dùng (đã chốt), app sửa ở PR 5. Nếu cần giữ app dev chạy được trong lúc chờ, có thể bật cờ env `LESSON_SNAPSHOT_SPEC_ENABLED` (mặc định `true`), giống cờ `lessonSnapshotItemsEnabled` đang có. **Đề xuất: có cờ**, vì chi phí rất nhỏ.

## 7. Seed unit mẫu

`scripts/seed-sample-unit.ts` (`yarn seed:sample-unit[:staging]`). Script idempotent, tra theo `code`, và gọi qua repository (không dùng HTTP). Nội dung:
- Course `A1 Giao tiếp` → Level `A1` → Unit **"Gọi đồ uống"** (can-do, nhiệm vụ tổng hợp).
- Item lấy từ fixture PR 1: word, phrase, pattern, pronunciation, listening (đã publish).
- 3 bài:
  - L01: Gọi đồ uống, giới thiệu `pattern:can-i-have`.
  - L02: Nói cỡ và trả lời người bán, `recycled` pattern, `new` listening.
  - L03: Gọi đồ ăn (`recycled` pattern ở ngữ cảnh mới).
- Mỗi bài có đủ đặc tả, task `independent` kèm 4 tiêu chí, và block bước 1–5.
- Kết thúc bằng publish cả 3 bài. Đây chính là bài kiểm tra end-to-end của validator.

Nội dung tiếng Anh/Việt của unit mẫu lấy theo phần **"Viết 1 unit mẫu"** ở Stage 0. Nếu nhóm nội dung chưa viết xong, tôi soạn bản nháp để bạn duyệt.

## 8. File thay đổi

**Tạo mới**
```
src/common/database/migrations/003_lesson_spec.sql (+ .down.sql)
src/modules/curriculum/spec/model/{situation,canDo,hintLevels,lessonCode,spec}.ts
src/modules/curriculum/spec/service/specValidator.ts
src/modules/curriculum/spec/repository/postgresLessonSpecStore.ts
src/modules/curriculum/spec/controller/lessonSpec.ts
src/modules/curriculum/tasks/model/task.ts
src/modules/curriculum/tasks/repository/postgresTaskStore.ts
src/modules/curriculum/tasks/controller/tasks.ts
src/modules/canonicalLesson/model/fixtures/valid-lesson-snapshot-with-spec-response.json
scripts/seed-sample-unit.ts
test/specModels.test.ts            -- unit: situation, can-do, hint levels, lesson code
test/specValidator.test.ts         -- unit: từng rule violation/warning
test/lessonSpecRoutes.test.ts      -- DB: spec, prerequisites (vòng), lesson items, spec-check, publish 422/200
test/taskRoutes.test.ts            -- DB: CRUD task, criteria, items, accepted_answers, TASK_IN_USE
test/lessonSpecSnapshot.test.ts    -- DB: snapshot có spec/lesson_items/tasks; bài learner rỗng; revision tăng
test/lessonSpecIntegrity.test.ts   -- DB: ITEM_IN_USE, clone khi chuyển bài, MEDIA_IN_USE
test/seedSampleUnit.test.ts        -- DB: seed chạy 2 lần, 3 bài đều publish được
```

**Sửa**
```
prisma/schema.prisma
src/app/server.ts                                       -- đăng ký route
src/modules/curriculum/lessons/{model,repository,controller}  -- trường đặc tả + publish
src/modules/curriculum/units/{model,repository,controller}    -- audience, can_do
src/modules/curriculum/courses/…, levels/…                     -- audience
src/modules/curriculum/lessonBlocks/model/{blockType,blockData,extendedBlockContent,apiContracts,views}.ts
src/modules/curriculum/lessonBlocks/{repository,service}/…    -- step/skill/duration, item_cards
src/modules/curriculum/lessonDelivery/{repository,service}/…  -- snapshot
src/modules/canonicalLesson/model/lesson.ts                   -- LessonSnapshotSchema, catalog
src/modules/items/repository/postgresItemStore.ts             -- ITEM_IN_USE, bump revision
src/modules/admin/controller/adminLessonMove.ts               -- clone spec/items/tasks
src/modules/admin/repository/adminContentDeleteStore.ts       -- MEDIA_IN_USE, counts
src/common/config/env.ts                                      -- LESSON_SNAPSHOT_SPEC_ENABLED
test/openApiDocument.test.ts, test/databaseBaseline.test.ts   -- số route, bảng mới
package.json                                                  -- seed script, test:db
docs/01-ba/02-technical/05-data-model.md                      -- entity Lesson spec, Task
```

**Xoá:** không.
**Dependency mới:** không.

## 9. Lịch xoá mô hình cũ (để chắc chắn không bỏ sót)

| Phần cũ | Còn ai dùng sau PR 2 | Xoá ở |
|---|---|---|
| API `/v1/admin/vocabularies*`, module `vocabulary`, trang Vocabulary trên admin | admin-web | **PR 3** (trang danh mục item thay thế) |
| Block `vocabulary`, `grammar`, bảng `lesson_block_vocabularies`, route `/blocks/:id/vocabularies` | admin-web block editor, bài cũ | **PR 4** (editor dùng `item_cards`) |
| `learning_items`, `rebuildLearningItems` (4 chỗ), `items[]` trong snapshot, script backfill | Pipeline AI, app hiện tại | **PR 7** (AI map vào danh mục; app PR 5 đã chuyển sang `lesson_items`) |
| `vocabularies`, `user_vocabulary_progress`, thống kê vocab ở trang user | Bảng trên | **PR 7** (cùng lúc, không còn tham chiếu) |
| Versioning contract (v1/v2), cờ `lessonSnapshotItemsEnabled` / `…SpecEnabled` | — | **PR 7** |

Mỗi lần xoá sẽ được liệt kê lại trong plan của PR đó để duyệt (VibeGuard §2).

## 10. Thứ tự commit

1. `feat(curriculum): lesson spec, prerequisites, lesson items and task tables`: migration 003 + Prisma + baseline test.
2. `feat(curriculum): spec models and validator`: model thuần + `specValidator` + unit test.
3. `feat(curriculum): lesson spec fields and admin routes`: PATCH lesson/unit/course/level, `/spec`, `/prerequisites`, `/items`, `/spec-check`, `/item-map`.
4. `feat(curriculum): tasks, criteria and summative tasks`: module tasks + route.
5. `feat(lesson-blocks): step, skill, duration and item_cards`: block + activity refs + validator.
6. `feat(curriculum): enforce lesson spec on publish`.
7. `feat(delivery): lesson spec, items and tasks in the snapshot` + fixture + cờ env.
8. `feat(curriculum): integrity guards`: ITEM_IN_USE, revision bump, clone khi chuyển bài, MEDIA_IN_USE.
9. `feat(scripts): seed the sample "Gọi đồ uống" unit`.

## 11. Kiểm tra trước khi push
- `yarn lint` (trừ lỗi có sẵn ở `test/ipa.test.ts`), `yarn format`, `yarn typecheck`, `yarn test`.
- `yarn test:db` trên Postgres 16 với DB mới tạo. Chạy 2 lần (có test chập chờn ở phần tạo bài YouTube, xem báo cáo PR 1).
- `prisma migrate diff` rỗng.
- `yarn seed:sample-unit` trên DB local, sau đó `GET /api/v1/lessons/:id` của bài L01 trả đúng fixture.

## 12. Rủi ro
- ⚠️ **Thay đổi API công khai**: snapshot có thêm trường, nên app hiện tại không mở được bài cho tới PR 5 (giảm thiểu bằng cờ env ở §6).
- ⚠️ **Publish bài admin khó hơn**: mọi bài admin phải có đủ đặc tả (D1), kể cả bài admin tạo từ YouTube. Bài đang ở trạng thái publish không bị ảnh hưởng (DB sẽ reset; seed tạo bài đúng chuẩn).
- Khối lượng lớn: khoảng 9 commit, 7 file test mới. Có thể tách thành PR 2a (commit 1–5) và PR 2b (6–9) nếu muốn review nhỏ hơn.
- `RECYCLED_ITEM_NEW` và `ITEM_SINGLE_USE` truy vấn theo course/unit, nên cần index `lesson_items_item_idx` (đã có trong migration).
