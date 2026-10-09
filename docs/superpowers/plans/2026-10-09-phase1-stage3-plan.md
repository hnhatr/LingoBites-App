# Giai đoạn 1 – Stage 3: âm thanh, chấm bài, đạt bài, ghi nhớ (PR 12–17)

> Trạng thái: **CHỜ DUYỆT**. Chưa code.
> Ngày lập: 2026-10-09. Nền: `develop` (Stage 0–2 đã merge). Repo: `LingoBites-Server` (PR 12, 13, 15, 17 + admin-web), `LingoBites-App` (PR 14, 16).
> Nguồn: `2026-10-08-remaining-work-plan.md` (mục 4 "Giai đoạn 1", mục 5 "Bảng chốt") và `2026-10-08-stage3-audio-evaluation-analysis.md` (thiết kế chốt).
>
> File này là **plan của cả giai đoạn**: thứ tự, phụ thuộc, contract dùng chung giữa các PR, cổng kiểm. **PR 12 viết đủ chi tiết để code ngay** sau khi duyệt (§4). PR 13–17 có phạm vi, file và test chính; mỗi PR vẫn viết plan riêng `…-prNN-….md` trước khi code, vì còn phụ thuộc kết quả PR trước và dữ liệu team (T1–T4).

---

## 1. Mục tiêu và điều kiện xong

**Mục tiêu:** unit mẫu "Gọi đồ uống" đi trọn vòng **Học → Vận dụng → Đánh giá → Ghi nhận → Ôn**:
1. Bước 5 (và nhiệm vụ tổng hợp của unit) được **server chấm**: câu viết chấm ngay; câu nói qua STT (OpenAI) rồi chấm.
2. Kết quả chấm quyết định **đạt bài / đạt unit**.
3. Item của bài đã học vào **lịch ôn** 1–3–7–14–30; Today đọc lịch này.
4. Admin chỉnh ngưỡng, xem lượt làm, nghe lại bản ghi (≤ 30 ngày), xem thống kê.

**Xong giai đoạn khi:**
- trên máy thật, unit mẫu chạy trọn vòng trên (PR 16 "Xong khi");
- script đo trên bộ T2 đạt ngưỡng A3 (chấm oan < 10%, chấm lọt < 15%, `unscorable` < 10%) **trước** khi bật flag `speechEvaluation` cho người dùng;
- mọi bước kiểm ở §7 xanh trên cả hai repo.

---

## 2. Thứ tự và phụ thuộc

```
PR 12 (server: bộ chấm + evaluations, câu viết)        ← làm ngay, không cần team
  ├─► PR 13 (server: âm thanh, STT, job)              ← cần T1 (key OpenAI)
  │     └─► [đo T2 → bật flag]                         ← cần T2 (40 bản ghi)
  │     └─► PR 14 (app: chấm bước 5)                   ← cần T4 (câu consent – đã OK)
  └─► PR 15 (server: đạt bài, unit, item_memory)       ← cần T3 (khoảng ôn) – dùng đề xuất nếu trống
        └─► PR 16 (app: kết quả, tiến độ, ôn)          ← cần PR 14 cho phần hiện kết quả chấm
              └─► PR 17 (admin)                        ← cần PR 12–15
```

- PR 15 chỉ cần PR 12, có thể làm song song PR 13–14.
- Thứ tự đề xuất cho một người: **12 → 15 → 13 → 14 → 16 → 17**. Lý do: PR 15 không chờ key OpenAI; PR 14 và 16 đều sửa player bước 5–6, làm liền nhau đỡ xung đột.
- Mỗi PR một pull request vào `develop`, merge xong mới mở PR kế tiếp ở cùng repo (tránh chồng nhánh).

**Nhánh:** phiên này làm trên `claude/funny-archimedes-gmioda` (cả hai repo), tạo từ `develop`. File ghi nhớ còn ghi `claude/optimistic-bell-mfgk44`; sẽ sửa lại tên nhánh trong mục 1 khi cập nhật tiến độ.

---

## 3. Contract dùng chung cả giai đoạn (chốt ở PR 12, các PR sau chỉ thêm)

### 3.1 Lượt làm bước 5 được chấm máy

`activity_attempts` (`kind = lesson`), mở rộng **không phá** contract PR 8:

| Trường | Thay đổi |
|---|---|
| `outcome` | thêm `pending` |
| `assessed_by` | thêm `service` |
| `recording_client_id` | **mới**, `uuid` tùy chọn (chỉ lượt nói, PR 13–14) |

Ràng buộc chéo (thêm vào `refine`):
- `outcome = pending` ⇔ `assessed_by = service`. App **không bao giờ** tự ghi kết quả cho lượt chấm máy; kết quả thật nằm ở `evaluations`.
- `recording_client_id` chỉ có khi `assessed_by = service`.
- `pending` không tính vào "hoàn thành phần luyện" (đã đúng: chỉ bước 2–4 được đếm, và lượt chấm máy chỉ có ở bước 5 / nhiệm vụ tổng hợp).

`SYNC_CONTRACT_VERSION` **giữ 2** (chỉ thêm giá trị). App cũ không gửi các giá trị mới.

### 3.2 Collection `evaluations` (server → app, chỉ đọc)

- Server ghi một dòng `sync_records` (`collection = evaluations`, `entity_id = attempt_id`) **cùng transaction** với dòng bảng `evaluations`, tăng `user_sync_state.last_revision` như một lượt push. Như vậy pull đi đúng thứ tự revision, không cần đường pull thứ hai.
- App push vào `evaluations` → **400 `SYNC_COLLECTION_READ_ONLY`** (cả batch bị từ chối, như các lỗi payload khác).
- App cũ: pull đã "dễ dãi" với collection lạ (`SyncPullRecordSchema`, `pullWorker` bỏ qua kèm log), nên không vỡ.

Payload (cũng là body của `GET /v1/evaluations/:attemptId`):

```ts
{
  attempt_id: uuid,
  lesson_id: uuid | null,      // null với nhiệm vụ tổng hợp của unit
  unit_id: uuid | null,
  block_id: uuid | null,
  task_id: uuid,
  source: 'text' | 'speech',
  substitute: boolean,         // A13: viết thay nói
  outcome: 'pass_independent' | 'pass_with_support' | 'fail' | 'unscorable',
  criteria: { purpose, content, clarity, independence: { passed: boolean, score: number | null, required: boolean } },
  errors: [{ item_code, code, severity: 'blocking' | 'tolerated', feedback_vi }],
  primary_issue: { kind: 'criterion', criterion } | { kind: 'error', code } | null,
  missing_words: string[],     // ≤ 10, so với câu tham khảo
  reference_en: string | null, // câu chấp nhận gần nhất
  unscorable_reason: 'empty' | 'too_short' | 'limit' | 'stt_failed' | null,
  scorer_version: 1,
  evaluated_at: string,
}
```

- **Không có transcript / chữ người học** ở bất kỳ đâu (bảng, payload, log). `missing_words` và `reference_en` lấy từ **nội dung bài**, không phải từ câu người học.
- `feedback_vi` chép tại lúc chấm (nội dung bài, không phải dữ liệu người học) để app offline hiện được.

### 3.3 Bảng `evaluations` (migration 007, PR 12)

```sql
CREATE TABLE evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id uuid NOT NULL,
    lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
    unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
    block_id uuid,
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    source varchar(8) NOT NULL,            -- text | speech
    substitute boolean NOT NULL DEFAULT false,
    outcome varchar(20) NOT NULL,
    criteria jsonb NOT NULL,
    errors jsonb NOT NULL DEFAULT '[]',
    missing_words jsonb NOT NULL DEFAULT '[]',
    reference_en varchar(500),
    unscorable_reason varchar(16),
    scorer_version smallint NOT NULL,
    stt_provider varchar(32), stt_model varchar(64),   -- PR 13
    latency_ms integer, audio_ms integer,              -- PR 13
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT evaluations_attempt_unique UNIQUE (user_id, attempt_id),
    CONSTRAINT evaluations_owner_check CHECK ((lesson_id IS NOT NULL) <> (unit_id IS NOT NULL))
);
CREATE INDEX evaluations_user_created_idx ON evaluations (user_id, created_at);
CREATE INDEX evaluations_task_idx ON evaluations (task_id);
```

- Cột STT có sẵn từ 007 (null với câu viết) để PR 13 không phải sửa bảng.
- Xoá tài khoản: cascade theo user. Gộp tài khoản (`adminStore` merge): chuyển `evaluations` sang user đích cùng chỗ đang chuyển `sync_records`.

### 3.4 Capabilities

`GET /v1/capabilities` thêm `evaluation: { text: boolean, speech: boolean }`.
- PR 12: `text = true`, `speech = false`.
- PR 13: `speech = SPEECH_EVALUATION_ENABLED` (env, mặc định `false`) — đây là flag `speechEvaluation`. Bật cho tài khoản nội bộ trước (A10) bằng env `SPEECH_EVALUATION_USER_IDS` (danh sách id, rỗng = theo cờ chung).
- App PR 14 đọc capabilities: `speech = false` thì bước 5 giữ tự đánh giá như hiện nay.

---

## 4. PR 12 – Server: bộ chấm + kết quả (câu viết, chưa có âm thanh)

### 4.1 Phạm vi

| Trong PR 12 | Ngoài PR 12 |
|---|---|
| Hàm thuần `evaluateUtterance` + so khớp theo từ | STT, recordings `lesson_task`, job (PR 13) |
| Migration 007 bảng `evaluations` + Prisma | `passed_at`, `unit_outcomes`, `item_memory` (PR 15) |
| `POST /v1/evaluations/text`, `GET /v1/evaluations/:attemptId` | UI app (PR 14) |
| Sync: `pending` / `service` / `recording_client_id`; collection `evaluations` chỉ đọc | Ngưỡng chỉnh trong admin (PR 17) |
| Viết thay nói (A13): `substitute = true` | Tính "đạt bài" từ `substitute` (PR 15: không tính) |
| Nhiệm vụ tổng hợp của unit: cùng route (đích `unit_id + task_id`) | Màn nhiệm vụ tổng hợp (PR 16) |
| Capabilities `evaluation.text` | |
| Fixture dùng chung cho app (PR 14 chép) | |

### 4.2 Quyết định cần xác nhận

Ô "Chốt" của Bảng chốt còn trống → dùng đề xuất: **A2** 0.80 / 0.60 / đủ item / không gợi ý; **A5** câu viết 100 lượt / ngày, không tính vào A4; **A9** làm lại không giới hạn, PR 15 lấy kết quả tốt nhất.

| # | Câu hỏi | Đề xuất |
|---|---|---|
| E1 | Kết quả chấm về app bằng đường nào? | Dòng `sync_records` do server ghi, collection `evaluations` chỉ đọc (§3.2). Không thêm route pull riêng. |
| E2 | App có được push outcome thật cho lượt chấm máy không? | Không. Lượt chấm máy luôn `pending` + `service`; `evaluations` là nguồn đúng duy nhất. Chặn được việc app (hoặc client giả) tự ghi "đạt". |
| E3 | Câu viết gửi lên thế nào? | `POST /v1/evaluations/text` **đồng bộ** (chấm < 50 ms, không cần job). Body có `text`; khoá `req.body.text` **đã nằm trong danh sách redact** của logger, nên không lọt vào log. Chữ chỉ ở trong bộ nhớ khi chấm, không ghi DB. |
| E4 | Gửi lại cùng `attempt_id`? | Trả lại kết quả đã có (200, `replayed: true`), không chấm lại, không trừ lượt. Một lượt làm = một kết quả; làm lại bước 5 là lượt mới (`attempt_id` mới). |
| E5 | Đích chấm | Hai dạng: `{ lesson_id, block_id }` (bước 5: block `activity` ở step 5, có `task_id` trỏ tới task `independent`) hoặc `{ unit_id, task_id }` (task `summative` của unit). Bài phải là bài admin **đã publish**, unit đã publish. Sai → 404 / 422. |
| E6 | Viết thay nói (A13) | Body có `substitute: boolean`. `true` chỉ hợp lệ khi `response_mode = speak`; task `response_mode = write` thì luôn `false` (gửi `true` → 422). `choose` không chấm bằng route này (422). |
| E7 | Câu chấp nhận lấy từ đâu? | Tách hàm `taskAcceptedAnswers` đang private trong `postgresTaskStore.ts` ra service dùng chung (không đổi hành vi route task), rồi hợp với câu mẫu của lượt người học trong `content` của block (`role_play` → `turns[learnerSpeaker].textEn` + `acceptedAnswers` của `patternItemId`; `translation` → `modelEn`). Giới hạn 200 câu như hiện nay. |
| E8 | Từ khoá cho `clarity` | Bỏ danh sách hư từ cố định trong `evaluation/model/stopWords.ts` (a, an, the, please, to, of, and, is, are, i, you, it, …, ~40 từ). Câu tham khảo không còn từ khoá nào → `clarity` tính trên mọi từ. |
| E9 | Thang ngày cho giới hạn | Theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), đếm trên `evaluations` (`source = text`). Vượt → **200** với `outcome = unscorable`, `unscorable_reason = limit` (không lưu dòng, không ghi sync) để app hiện "Hôm nay đã hết lượt chấm". |

### 4.3 Bộ chấm (`src/modules/evaluation/model/`)

Hàm thuần, không đụng DB, dùng chung cho câu viết (PR 12) và transcript (PR 13).

```ts
export const SCORER_VERSION = 1;

export type EvaluationTask = {
  criteria: Array<{ criterion: Criterion; required: boolean; threshold: number | null }>;
  acceptedAnswers: string[];                 // đã normalizeAnswer
  requiredItems: Array<
    | { kind: 'pattern'; code: string; frames: string[]; slots: Record<string, string[]> } // giá trị đã resolve
    | { kind: 'word' | 'phrase'; code: string; forms: string[] }                           // text + variants
  >;
  errors: Array<{ itemCode: string; code: string; severity: 'blocking' | 'tolerated'; feedbackVi: string; wrongExample: string | null }>;
};

export function evaluateUtterance(input: {
  utterance: string;               // câu viết hoặc transcript, không lưu
  supportLevel: LessonSupportLevel;
  task: EvaluationTask;
}): EvaluationResult;              // shape = payload §3.2 trừ id/thời gian
```

**So khớp theo từ** (`wordMatch.ts`):
- `tokens(text)`: `normalizeAnswer` → bỏ dấu câu giữa câu (`,.!?;:`) → tách theo khoảng trắng. Giữ dấu nháy (`i'd`, `can't`).
- `similarity(a, b) = 1 − levenshtein(a, b) / max(|a|, |b|)` trên mảng từ.
- `bestMatch(utterance, accepted)` → `{ sentence, similarity, missing, extra }` (từ thiếu / thừa lấy từ đường đi chỉnh sửa). Hoà điểm thì lấy câu đứng trước (thứ tự xác định).

**Tiêu chí** (ngưỡng: `task_criteria.threshold`, null thì mặc định):

| Tiêu chí | Đạt khi | `score` |
|---|---|---|
| content | `bestMatch.similarity ≥ 0.80` **và** mọi chỗ trống của pattern bắt buộc có ít nhất một giá trị hợp lệ xuất hiện trong câu (cụm nhiều từ so liên tiếp). Thiếu giá trị hợp lệ thì trượt dù độ trùng cao (chặn "Can I have a large pizza" khi pizza không thuộc bài). | similarity |
| purpose | Mọi item bắt buộc có mặt: pattern → một khung (frame / variant) khớp với `similarity ≥` ngưỡng content sau khi điền đúng giá trị có trong câu; word / phrase → một dạng xuất hiện liên tiếp trong câu. | tỷ lệ item có mặt |
| clarity | Tỷ lệ từ khoá của `bestMatch.sentence` có trong câu ≥ 0.60 | tỷ lệ |
| independence | `supportLevel = none` | null |

**Lỗi thường gặp:** `similarity(utterance, wrongExample) ≥ 0.85` → ghi lỗi. `blocking` làm trượt, `tolerated` chỉ nhắc.

**Kết quả** (theo thứ tự):
1. Câu rỗng sau chuẩn hoá → `unscorable` (`empty`).
2. Có lỗi `blocking`, hoặc một tiêu chí **bắt buộc** khác independence trượt → `fail`; `primary_issue` = lỗi `blocking` đầu tiên, nếu không có thì tiêu chí trượt đầu tiên theo thứ tự content → purpose → clarity.
3. Còn lại: `supportLevel = none` → `pass_independent`, ngược lại → `pass_with_support`.

`missing_words` = từ thiếu so với `reference_en` (tối đa 10), chỉ trả khi `fail`.

### 4.4 Route (`src/modules/evaluation/controller/evaluations.ts`)

Cả hai route cần đăng nhập người học (guard như `/v1/sync/*`), rate limit theo nhóm hiện có.

**`POST /v1/evaluations/text`**

```ts
body: {
  attempt_id: uuid,
  target: { lesson_id: uuid, block_id: uuid } | { unit_id: uuid, task_id: uuid },
  text: string (1..500, trim),
  support_level: 'none' | 'hint_1' | 'hint_2' | 'model',
  substitute: boolean,
}
200: { request_id, status: 'success', replayed: boolean, evaluation: EvaluationPayload }
```

Các bước (một transaction):
1. Có sẵn `(user_id, attempt_id)` → trả lại (E4).
2. Tải đích: block / task / task_items / task_criteria / item (kèm variants, errors, slot refs). Không thấy hoặc chưa publish → 404 `EVALUATION_TARGET_NOT_FOUND`; task không phải `independent` / `summative`, hoặc `response_mode` không hợp (E6) → 422 `EVALUATION_TARGET_INVALID`.
3. Đếm lượt câu viết hôm nay (E9). Vượt → trả `unscorable/limit`, dừng.
4. `evaluateUtterance`.
5. Insert `evaluations` + ghi `sync_records` collection `evaluations` (hàm mới `writeServerRecord(tx, userId, collection, entityId, payload)` trong `sync/repository/store.ts`, khoá `user_sync_state FOR UPDATE` như `push`).

**`GET /v1/evaluations/:attemptId`**: chủ lượt mới thấy; không có → 404 `EVALUATION_NOT_FOUND` (PR 13 dùng 404 cho "đang chấm"; app hiểu là chờ tiếp).

OpenAPI: +2 path. Lỗi theo `ApiErrorResponseSchema` sẵn có.

### 4.5 File

**Thêm (server):**
- `src/modules/evaluation/model/evaluation.ts` (schema body / payload / lỗi), `wordMatch.ts`, `stopWords.ts`, `evaluateUtterance.ts`;
- `src/modules/evaluation/repository/postgresEvaluationStore.ts` (tải đích, đếm lượt, insert + sync record, đọc theo attempt);
- `src/modules/evaluation/controller/evaluations.ts` + đăng ký trong `src/app/server.ts`;
- `src/modules/curriculum/tasks/service/taskAcceptedAnswers.ts` (tách từ `postgresTaskStore.ts`, E7);
- `src/common/database/migrations/007_evaluations.sql` + `.down.sql`;
- fixture `test/fixtures/evaluation-cases.json` (các ca chấm dùng chung), `canonicalLesson/model/fixtures/valid-sync-evaluation-record.json`, `valid-sync-activity-attempt-lesson-pending-push-request.json`;
- test ở §4.6.

**Sửa (server):**
- `prisma/schema.prisma` (model `Evaluations`);
- `src/modules/sync/model/sync.ts` (`pending`, `service`, `recording_client_id`, collection `evaluations`, ràng buộc chéo);
- `src/modules/sync/repository/store.ts` (chặn push vào `evaluations`; `writeServerRecord`), `src/modules/sync/controller/sync.ts` (map lỗi `SYNC_COLLECTION_READ_ONLY`);
- `src/modules/curriculum/tasks/repository/postgresTaskStore.ts` (gọi hàm đã tách, không đổi output);
- `src/modules/admin/repository/adminStore.ts` (gộp tài khoản chuyển `evaluations`);
- `src/app/controller/capabilities.ts` (§3.4);
- `src/modules/canonicalLesson/model/fixtures.ts` (SHA fixture mới), `package.json` (thêm test DB vào `test:db`).

**Sửa (app, 1 commit chỉ fixture):** chép 2 fixture sync mới vào `src/core/schemas/__tests__/fixtures/` + SHA. Không đổi code app (schema app đổi ở PR 14).

**Xoá:** không. **Dependency mới:** không.

### 4.6 Kiểm thử

| Test | Nội dung |
|---|---|
| `wordMatch.test.ts` | Levenshtein theo từ, similarity, từ thiếu / thừa, dấu câu, dấu nháy cong, hoà điểm xác định |
| `evaluateUtterance.test.ts` | Bảng ca từ `evaluation-cases.json` trên item thật của seed (L01, L03): đúng ("Can I have a sandwich, please?") → `pass_independent`; đúng nhưng dùng gợi ý → `pass_with_support`; thiếu món ("Can I have a, please?") → `fail` content + `missing_words`; sai mẫu ("I want coffee") → `fail` purpose; món ngoài bài ("…large pizza…") → `fail` content; có lỗi `blocking` → `fail` + `primary_issue`; có lỗi `tolerated` → vẫn đạt + có trong `errors`; rỗng / chỉ dấu câu → `unscorable empty`; ngưỡng riêng của task được dùng thay mặc định; tiêu chí không bắt buộc trượt không làm `fail` |
| `evaluationRoutes.test.ts` (`test:db`) | 401 khi chưa đăng nhập; 404 đích lạ / bài chưa publish; 422 task sai loại, `substitute` với task viết, `choose`; L03 bước 5 câu đúng / thiếu món / sai mẫu cho đúng kết quả (điều kiện "Xong khi"); nhiệm vụ tổng hợp của unit; gửi lại cùng `attempt_id` → `replayed`, không thêm dòng; lượt 101 trong ngày → `unscorable limit`, ranh giới 0:00 giờ VN; GET của người khác → 404; DB **không có cột / dòng nào chứa chữ đã gửi** (quét `evaluations` + `sync_records` theo chuỗi gửi lên) |
| `syncActivityAttempts.test.ts` (mở rộng) | `pending` + `service` nhận; `pending` + `self`, `service` + `fail`, `recording_client_id` với `self` → 400; lượt cũ PR 8 không đổi |
| `syncEvaluations.test.ts` (mới, `test:db`) | chấm xong → pull thấy record `evaluations` đúng revision; push vào `evaluations` → 400 cả batch; xoá user cascade; gộp tài khoản chuyển cả `evaluations` và record sync |
| `taskRoutes.test.ts` | `accepted_answers` của task không đổi sau khi tách hàm |
| `capabilities.test.ts` | có `evaluation.text = true`, `speech = false` |
| `databaseBaseline.test.ts` | migration 007 lên / xuống; `prisma migrate diff` rỗng |
| Contract (2 repo) | SHA fixture mới khớp byte |

### 4.7 Thứ tự commit

1. `feat(evaluation): word-level matching and rule-based utterance scorer` (§4.3 + test thuần + fixture ca chấm).
2. `refactor(tasks): share task accepted answers with evaluation` (E7, không đổi hành vi).
3. `feat(evaluation): evaluations table (migration 007)`.
4. `feat(sync): pending service-assessed attempts and read-only evaluations collection`.
5. `feat(evaluation): text evaluation and result routes` (+ capabilities, gộp tài khoản).
6. App: `test(contract): sync PR 12 evaluation fixtures`.
7. `docs: mark PR 12 plan as implemented` (+ điểm lệch, cập nhật mục 6 file ghi nhớ).

### 4.8 Rủi ro

- ⚠️ **Migration 007** thêm bảng (không xoá gì). Staging cần chạy migrate.
- ⚠️ **Đổi contract công khai (thêm):** enum `outcome` / `assessed_by`, trường `recording_client_id`, collection `evaluations`, 2 route, capabilities. App hiện tại không gửi / không đọc, không vỡ. Một rủi ro nhỏ: thiết bị cũ pull lượt `pending` do thiết bị mới đẩy lên — `pullWorker.ts` ghi thẳng payload `activity_attempts` vào SQLite; cần kiểm cột `outcome` / `assessed_by` của bảng SQLite có ràng buộc giá trị không (nếu có thì PR 14 nới, và ghi chú bản app tối thiểu).
- **Luật chấm chỉ theo chữ**: câu đúng ý nhưng không theo mẫu của bài sẽ trượt `purpose` / `content`. Đã chấp nhận ở thiết kế (§3.2 "hướng mở rộng"); số liệu PR 17 sẽ cho biết có cần nới không.
- **Ghi `sync_records` từ server** là đường mới: phải khoá `user_sync_state` đúng như `push`, nếu không có thể trùng revision khi push song song. Có test chạy song song push + chấm.

---

## 5. PR 13 – Server: âm thanh vào server

**Cần trước:** PR 12 merge; T1 (key; mặc định dùng `AI_API_KEY`). Code và test bằng STT `mock` được khi chưa có key.

| Phần | Nội dung |
|---|---|
| Recordings | `SpeakingModeSchema` thêm `lesson_task`. Với mode này `sentence_id` bỏ trống, bắt buộc `attempt_id`, `block_id` (hoặc `unit_id + task_id`), `duration_ms` ≤ 45 000 (bước 5) / 90 000 (tổng hợp) theo A6. Migration **008**: `recordings` thêm `attempt_id`, `block_id`, `task_id`, `evaluate_by` (hạn xoá = hoàn tất + 30 ngày), `sentence_id` nullable. |
| Cổng STT | `src/common/stt/`: `SpeechToText.transcribe({audio, mimeType, language: 'en', prompt}) → {text, durationMs}`; adapter `openai` (`gpt-4o-mini-transcribe`, timeout 20 giây, `prompt` = câu tham khảo + item của task, **không** gửi tên / email / id người học) và `mock` (transcript theo fixture, khoá theo SHA-256 file). Env `STT_PROVIDER` (`openai` \| `mock`), `STT_MODEL`, `STT_API_KEY` (rỗng → `AI_API_KEY`); kiểm trong `env.ts` như `AI_PROVIDER`. Adapter Google chỉ viết nếu team muốn (A1). |
| Job `evaluation` | Hàng đợi hiện có (`common/jobs`) gắn chặt pipeline phân tích; đề xuất **bảng nhỏ `evaluation_jobs`** trong migration 008 (`recording_id`, `status`, `attempts`, `lease_expires_at`, `last_error`), worker dùng lại `LEASE_TTL_MS` / `MAX_STAGE_ATTEMPTS = 2` và cách sweep lease của orchestrator. Sẽ chốt trong plan PR 13 sau khi đọc kỹ `orchestrator.ts`. PUT content xong (mode `lesson_task`) → tạo job. Worker: lấy file → STT → `evaluateUtterance` (cùng hàm PR 12) → ghi `evaluations` + sync record → transcript bỏ khỏi bộ nhớ. STT lỗi sau 2 lần → `unscorable stt_failed`. Dưới 1 giây → `too_short`. |
| Giới hạn | `EVAL_DAILY_LIMIT` (mặc định 30, A4) đếm `source = speech` theo giờ VN; cùng SHA-256 file của cùng user → dùng lại kết quả, không gọi STT. |
| Dọn | `startRecordingCleanup` thêm bước: xoá file + dòng `recordings` mode `lesson_task` quá `evaluate_by` (A7). `evaluations` giữ lại (không chứa giọng nói / chữ). |
| Đo | `scripts/evaluation/measure.ts`: đọc thư mục bản ghi + bảng nhãn CSV (§5.7.1 file ghi nhớ), chạy STT thật + bộ chấm, in chấm oan / chấm lọt / `unscorable` / độ trễ p50–p95, so được 2 model. Bản ghi **không vào repo**. |
| Flag | §3.4. `POST /v1/recordings` mode `lesson_task` khi flag tắt cho user → 403 `SPEECH_EVALUATION_DISABLED`. |

**Test:** job với STT mock (đạt / trượt / rỗng / lỗi rồi thử lại / lỗi 2 lần); hết hạn lease → job được nhận lại; giới hạn 30 lượt; trùng SHA; dọn sau 30 ngày (đồng hồ giả); flag tắt; `env.ts` cấu hình STT; test tích hợp OpenAI **tắt mặc định** (`STT_INTEGRATION=1`).
**Xong khi:** upload `.m4a` (STT mock) → có `evaluations` trong ~20 giây; script đo chạy được.
⚠️ Migration 008; đổi API `POST /v1/recordings` (thêm mode, `sentence_id` tùy chọn với mode mới).

**Sau PR 13 (team + code):** chạy script trên bộ T2 → đạt A3 thì bật flag cho tài khoản nội bộ, rồi người lớn (A10). Chưa đạt: chỉnh ngưỡng mặc định / thử `gpt-4o-transcribe`, đo lại trên **cùng bộ**.

---

## 6. PR 14 – App: chấm bước 5

**Cần trước:** PR 12 (câu viết làm được ngay), PR 13 (câu nói). Câu consent T4 đã OK.

| Phần | File chính | Nội dung |
|---|---|---|
| Schema | `src/core/schemas/sync.ts` | §3.1; collection `evaluations` + `EvaluationPayloadSchema`; nới parser pull `activity_attempts` nếu cần (§4.8) |
| Lưu kết quả | `src/core/sync/evaluations.ts` (mới) + SQLite | Bảng `lesson_evaluations` (⚠️ nâng schema SQLite v8 → v9) theo `attempt_id`; pull applier ghi vào |
| Ghi âm | `features/speaking/logic/recordingService.ts` | AAC mono 16 kHz ~32 kbps; giới hạn 45 / 90 giây (A6) |
| Consent | `features/speaking/logic/upload/recordingConsent.ts` + màn mới | Khoá `speaking.evaluation_consent` tách khỏi `recording_upload_consent`; câu chữ §5.7.2; từ chối thì hỏi lại ≤ 1 lần / 7 ngày (A12); bật / tắt trong Cài đặt. Tài khoản trẻ: chưa có trường đối tượng → coi là người lớn (A11, ghi rõ trong chính sách) |
| Bước 5 | `IndependentTaskView.tsx`, `useSelfCheckRecorder.ts`, `independent.ts` | `capabilities.evaluation.speech` + consent → "Gửi chấm"; không thì giữ tự đánh giá (ghi âm và nghe lại trên máy). Câu viết (`response_mode = write`) luôn gửi chấm khi online; offline thì xếp hàng gửi lại |
| Viết thay nói | `IndependentTaskView.tsx`, `useLessonFlow.ts` | Nút "Không nói được lúc này" (A13): ẩn hoạt động nói bước 3–4 trong 15 phút; bước 5 chuyển ô nhập, gửi `substitute = true` |
| Upload | `recordingUploadQueue.ts` | Mode `lesson_task`, kiểm consent chấm bài; giữ file tới khi upload xong |
| Chờ kết quả | hook mới `useEvaluationResult.ts` | Hỏi `GET /v1/evaluations/:attemptId` mỗi 2 giây, tối đa 20 giây (A8); quá → "Kết quả sẽ có khi có mạng", rồi nhận qua sync |
| Phản hồi | `StepResult.tsx` + component mới | 4 trạng thái theo §4 file thiết kế; nút "Thử lại không gợi ý", "Luyện phần liên quan" |
| Việc nợ | `ChoiceEntry.tsx`, `activities/` | task `response_mode = choose` (2.8); ghi âm từng lượt trong nhập vai (2.9) |
| i18n | `vi` / `en` | Khoá mới cho consent, trạng thái chấm, lý do `unscorable` |

**Test (Jest):** parse fixture PR 12; pull applier `evaluations`; consent (hỏi lại sau 7 ngày, tắt trong Cài đặt); IndependentTaskView đủ 3 nhánh (chấm máy / tự đánh giá / viết thay nói); hook hỏi kết quả (timeout, 404 rồi có kết quả); hàng đợi upload mode mới.
**Xong khi:** máy thật, ghi âm bước 5 → nhận kết quả đúng; tắt mạng → kết quả về sau qua sync.
⚠️ Nâng schema SQLite; cần test tay trên máy thật (quyền micro, ghi âm nền).

---

## 7. PR 15 – Server: đạt bài, đạt unit, ghi nhớ

**Cần trước:** PR 12. T3 trống → dùng 1–3–7–14–30, "ổn định" = đạt 2 lần liền ở mức ≥ 7 ngày. Q7, B1–B10 dùng đề xuất.

| Phần | Nội dung |
|---|---|
| `passed_at` | Đặt khi `practice_completed_at` có **và** có `evaluations` `pass_independent` cho task bước 5 của bài, `substitute = false` (B1, A13). Tự đánh giá (`assessed_by = self`, `pass_independent`) cũng tính (B3) — ghi nguồn vào cột mới `lesson_outcomes.passed_by` (`service` \| `self`). `pass_with_support` không tính (B2). `unscorable` không làm gì. Một lần, không lùi. Gọi từ: transaction chấm (PR 12/13 path) và push lượt `self`. |
| `unit_outcomes` | Bảng mới `(user_id, unit_id, summative_unlocked_at, passed_at)`. Mở nhiệm vụ tổng hợp khi mọi bài của unit có `practice_completed_at` (B4); đạt unit khi mọi bài `passed_at` **và** task `summative` có `pass_independent` (B5). |
| `item_memory` | Bảng `(user_id, item_id, stage 0..4, due_at, last_result, stable_at)`. Vào lịch khi bài `practice_completed_at`: item `required` của bài admin (B6, Q7). Ôn đúng → lên một mức; sai → lùi **một** mức (B7); không đụng `passed_at`. Kết quả ôn lấy từ lượt `activity_attempts` `kind = review` có `item_key` (contract cũ, không đổi). |
| Pull về app | Collections chỉ đọc `lesson_outcomes`, `unit_outcomes`, `item_memory`, cùng cơ chế `writeServerRecord` của PR 12. |
| Publish unit | Thiếu task `summative` → **vi phạm** (B10), đang là cảnh báo. ⚠️ Unit đang publish không bị gỡ; chỉ chặn lần publish sau. Seed unit mẫu đã có task tổng hợp (kiểm lại). |

**Test (`test:db`):** quên item không xoá `passed_at`; `unscorable` không làm trượt; `substitute` không tính; `pass_with_support` không tính; tự đánh giá tính với `passed_by = self`; đạt unit; lịch ôn lên / lùi một mức, "ổn định"; push lặp không đổi thời điểm; publish unit thiếu tổng hợp → vi phạm.
⚠️ Migration 009 (2 bảng + 1 cột), đổi luật publish (thêm vi phạm).

---

## 8. PR 16 – App: kết quả, tiến độ, ôn

**Cần trước:** PR 15 (và PR 14 cho phần hiện kết quả chấm).

- Bước 6 hiện "đạt bài" / "đã xong phần luyện" (A14) theo `lesson_outcomes` pull về, offline thì tính cục bộ theo đúng luật PR 15.
- Tiến độ unit "đã học / đã đạt"; màn nhiệm vụ tổng hợp (mở theo B4, chấm như bước 5 với đích `unit_id + task_id`).
- Ôn theo item: đọc `item_memory`, tối đa 20 item / ngày, ưu tiên quá hạn lâu nhất (B8); thay `getDueFlashcardsByItemKeys` nếu trùng chức năng (sẽ chốt trong plan PR 16).
- Today: ôn đến hạn → bài đang học dở → bài tiếp theo (B9).
- Lượt kéo về từ máy khác ghi "complete" dựa vào `lesson_outcomes` (2.7).
- XP theo C7 nếu đã chốt; chưa chốt thì giữ cách tính hiện tại.

**Xong khi:** unit mẫu đi trọn vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn (điều kiện xong Stage 3).
⚠️ Có thể nâng schema SQLite (bảng `item_memory`, `unit_outcomes` cục bộ).

---

## 9. PR 17 – Admin

**Cần trước:** PR 12–15.

- Cấu hình ngưỡng mặc định (content / clarity) và khoảng ôn: bảng `app_settings` (hoặc tương đương sẵn có), chỉ admin sửa, mọi thay đổi ghi log (B11). Bộ chấm đọc ngưỡng từ đây thay cho hằng số.
- Xem lượt làm + kết quả chấm theo user / bài; nghe lại bản ghi ≤ 30 ngày qua stream (không có nút tải), mỗi lần nghe ghi log (B12).
- Thống kê: tỷ lệ đạt theo bài / task, lỗi hay gặp (từ `evaluations.errors`), tỷ lệ `unscorable` theo lý do, chi phí STT ước tính từ `audio_ms`.
- Preview 6 bước: thống nhất nhãn kết quả (2.10), thử ghi âm + chấm (2.11, dùng route PR 12/13 với tài khoản admin).
- Cảnh báo khi kỹ năng viết = 0% (B13).

**Test:** Vitest cho màn mới; Playwright luồng sửa ngưỡng + xem lượt làm; server `test:db` cho route admin (401 / CSRF / log).
⚠️ Thêm bảng cấu hình nếu chưa có (migration).

---

## 10. Kiểm tra trước mỗi lần push

| Repo | Lệnh | Mức hiện tại (không được tụt) |
|---|---|---|
| Server | `yarn tsc`, `yarn lint`, `yarn test`, `yarn test:db`, `prisma migrate diff` rỗng | unit 431, db 245 |
| Admin | `yarn admin-web:test`, Playwright `e2e/` | Vitest 160, Playwright 16/16 |
| App | `yarn tsc`, `yarn lint` (ngân sách warning 281), `yarn format:check`, `yarn test` | lint 178/281, Jest 2198 |

Sau khi đổi nhánh server: `yarn prisma generate`.

---

## 11. Việc team song song với code

| Việc | Cho PR | Ghi chú |
|---|---|---|
| Điền ô "Chốt" còn trống ở 5.2–5.3 (A2–A11, T3, B1–B13) | 12, 15 | Trống thì dùng đề xuất |
| T1: đặt key STT trong env staging (không vào repo) | 13 | Có thể dùng chung `AI_API_KEY` |
| T2: ghi 40 bản ghi + 10 câu viết có nhãn | bật flag | Có consent người được ghi; không vào repo |
| T4: mục giọng nói trong chính sách + khai báo store | bật flag | Người hiểu luật xem lại |

---

## 12. Bước tiếp theo

1. Bạn duyệt plan này (đặc biệt **E1–E9** ở §4.2 và thứ tự 12 → 15 → 13 → 14 → 16 → 17 ở §2).
2. Duyệt xong: code PR 12 trên `claude/funny-archimedes-gmioda` (server), theo §4.7.
