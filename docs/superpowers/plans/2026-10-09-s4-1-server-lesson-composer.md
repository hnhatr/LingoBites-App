# S4.1 – Server: `lessonComposer` lõi (chọn câu → bài 6 bước)

> Trạng thái: **ĐÃ DUYỆT 2026-10-09, ĐANG CODE**.
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server`. Nhánh: `claude/affectionate-darwin-krszil` (tạo từ `develop`).
> PR đầu tiên của Giai đoạn 3 (Stage 4) trong `2026-10-08-remaining-work-plan.md`. S4.2 (admin) và S4.3 (người học) xây trên PR này.
> Stage 3 (PR 12–17) **chưa làm**: bước 5 của bài sinh ra dùng **tự đánh giá** như bài curriculum hiện nay; khi Stage 3 xong thì được chấm máy mà không phải sửa composer.

## 1. Mục tiêu và phạm vi

Hiện tại một bài tạo từ text / OCR / YouTube chỉ có **câu + dịch + IPA** (và phân tích từ vựng / ngữ pháp nếu bật enrich). Bài đó chỉ mở được dạng hub; player 6 bước chỉ chạy bài admin có đặc tả.

**Phương án đã chốt (2026-10-09):** người dùng **chọn một số câu trong một bài** rồi bấm "Học theo 6 bước" (người học) / "Sinh bài 6 bước" (admin). Server sinh ra **một bài mới** có đủ đặc tả, item, task, hoạt động bước 2–5, liên kết về bài gốc. Một bài gốc có thể sinh nhiều bài 6 bước (mỗi lần chọn một nhóm câu).

Sau PR này, server có:
1. Hàm `composeLesson()` thuần: nhận câu đã chọn + kết quả AI, trả **bản dựng bài** (đặc tả, item, task, block) đã qua `checkLessonSpec` với **0 vi phạm**.
2. **Một lần gọi AI** (`compose`) cho mỗi bài sinh ra; dịch, IPA lấy lại từ DB, hoạt động bước 2–4 sinh bằng luật (PR 8).
3. Hàng đợi: tái dùng `lesson_creation_requests` (idempotency, lease, worker, poll) với `kind = 'compose'`.
4. Ghi bài trong **một transaction**: bài mới + câu chép từ bài gốc + item (tự publish) + `lesson_items` + task + tiêu chí + block.
5. Item do AI tạo được **publish ngay** với `source = 'ai'`, `reviewed_at = null` để admin rà sau (S4.2).
6. Giới hạn lượt và trần chi phí (đọc env), cache theo nhóm câu.

| Trong S4.1 | Ngoài S4.1 |
|---|---|
| Model, prompt, kiểm tra JSON AI, `composeLesson()` thuần | Route admin + nút admin + bộ lọc "AI tạo, chưa rà" (**S4.2**) |
| Store ghi bài sinh ra (1 transaction), worker phân nhánh theo `kind` | Route người học, snapshot bài người học có spec, app (**S4.3**) |
| Migration `007`: `lessons.derived_from_lesson_id` / `compose_key` / `situation_source`, `lesson_creation_requests.kind` / `ai_calls`, `items.reviewed_at`, `users.compose_daily_limit` | Đổi cấu hình enrich (giữ bật, tắt được bằng env) |
| Mở rộng `listen_and_repeat.prompts` với `sentenceId` / `startMs` / `endMs` (tuỳ chọn) | App / admin phát đúng đoạn video (**S4.2** preview, **S4.3** app) |
| Giới hạn lượt / trần chi phí / cache (service + env) | Gói trả phí, tài khoản trẻ em (chưa có hồ sơ – Bước 1) |
| Script dev `scripts/composeSample.ts` chạy trên bài L03 của seed | Stage 5 (tình huống) – tái dùng `composeLesson()` ở S5.3 |

## 2. Quyết định (đã chốt / dùng đề xuất)

| # | Câu hỏi | Chốt |
|---|---|---|
| H1 | Đầu vào | `lesson_id` + `sentence_ids` (**2–8 câu** – ít nhất 2 để có ngữ cảnh tình huống, cùng một bài, giữ thứ tự trong bài). Bài gốc là bài bất kỳ có câu: `admin_text`, `learner_text`, `learner_ocr`, `youtube`. Câu dài quá 300 ký tự bị từ chối (`COMPOSE_SENTENCE_TOO_LONG`). |
| H2 | Lưu ở đâu | **Bài mới** (user chốt 2026-10-09). `lessons.derived_from_lesson_id` (FK, `ON DELETE SET NULL`) + `lessons.compose_key`. Câu được **chép** sang bài mới (giữ `text_vi`, `ipa`, `start_ms`, `end_ms`); bài mới giữ `source_type` và `youtube_video_id` của bài gốc để phát đúng đoạn video. |
| H3 | Ai sở hữu bài sinh ra | Admin: `origin = admin`, `status = draft`, `unit_id` do admin chọn (S4.2). Người học: `origin = learner`, `owner_user_id`, `status = published`, không unit (S4.3). |
| H4 | Số lần gọi AI | **1 lần** `compose` / bài. Không gọi dịch, IPA, enrich: dữ liệu câu lấy từ DB. Câu đã có phân tích (enrich lúc tạo bài hoặc phân tích khi bấm) thì đưa từ vựng / ngữ pháp đã lưu vào prompt làm gợi ý; câu chưa có thì AI tự rút trong cùng lần gọi. Item mới lấy IPA từ CMUdict cục bộ, thiếu thì dùng `ipa` AI trả trong cùng lần gọi. JSON sai thì gọi lại **1 lần** kèm danh sách lỗi (tối đa 2 lần gọi khi lỗi). |
| H5 | Cache | `compose_key = sha256(source_lesson_id, sentence_ids đã sắp xếp, checksum của phiên bản prompt đang dùng, level)`. Người học chọn lại đúng nhóm câu đó → trả bài đã sinh, **không gọi AI**, không tính lượt. Admin có `force: true` để sinh bản mới (S4.2). |
| H6 | Item AI tạo (Q5) | **Tự publish** (user chốt 2026-10-09) với `source = 'ai'`, `reviewed_at = null`. Quy tắc khi trùng mã: item `published` có sẵn → dùng lại, **không ghi đè**; item `draft` có `source = 'ai'` → publish; item `archived` hoặc `draft` của admin → **không dùng** (bỏ item đó khỏi bài, ghi log). Pattern chỉ dùng `values` cho chỗ trống, không dùng `item_refs` (tránh luật "published chỉ trỏ tới published"). |
| H7 | Câu chọn lạc quẻ / không có tình huống (D2, chốt 2026-10-09) | 4 trường hợp, xem §3.1:<br>(1) **Lọc trước, không AI:** câu quá ngắn / trùng / không phải tiếng Anh → `COMPOSE_SENTENCES_TOO_THIN` (400).<br>(2) **Hoàn toàn lạc đề:** AI trả `suitable = false` + `reason_vi` + `suggestion_vi` → `failed COMPOSE_NOT_SUITABLE`; bài gốc giữ dạng hub.<br>(3) **Chọn lẫn:** AI giữ nhóm câu liền mạch nhất (`used_sentence_ids`), bỏ câu lạc quẻ, bài vẫn tạo; còn < 2 câu → như (2).<br>(4) **Có nội dung nhưng không có hội thoại:** AI suy ra một tình huống đời thường, `situation_source = inferred`; bài ghi nhãn "Tình huống do AI gợi ý". |
| H8 | Ngôn ngữ (D4) | Nội dung học tiếng Anh; can-do, tình huống, đề bài, gợi ý, nghĩa bằng tiếng Việt (như seed). |
| H9 | Trình độ | Admin: mã level của unit đích. Người học: `A1` (chưa có hồ sơ – Bước 1). Đưa vào prompt và `compose_key`. |
| H10 | Tiêu chí task (A2) | 4 tiêu chí mặc định: content 0.80, clarity 0.60, purpose = đủ item bắt buộc, independence = không dùng gợi ý; tất cả `required`. |
| H11 | Mã bài | `AI-<8 ký tự hex đầu của lesson id, viết hoa>` (khớp `LessonCodeSchema`). |
| H12 | Giới hạn (Q8, chốt 2026-10-09) | **Đặt theo từng tài khoản:** cột `users.compose_daily_limit` (null = dùng mặc định env `COMPOSE_LEARNER_DAILY_LIMIT`, mặc định **1**; `0` = khoá). Admin sửa trên trang chi tiết người dùng (S4.2). **Chỉ lượt AI trả lời được mới tính** (bài tạo thành công, "không phù hợp", hoặc JSON sai tới hết lần gọi lại); lượt bị lọc trước (H7-1), trúng cache, timeout, lỗi nhà cung cấp / hệ thống thì **không tính** (vẫn tính vào trần tháng). Chi tiết thời gian chờ, timeout, tiến độ: `2026-10-09-s4-compose-wait-ux-design.md`. Ngày theo giờ Việt Nam. Admin (tài khoản quản trị): không giới hạn. |
| H13 | Trần chi phí (Q11) | `COMPOSE_MONTHLY_CALL_CAP` (mặc định `0` = không trần) đếm số lần gọi AI compose trong tháng; vượt → `COMPOSE_BUDGET_EXHAUSTED` (503) và capability báo tắt (S4.3). Model, temperature, nội dung prompt: lấy từ **phiên bản prompt đang bật** (`2026-10-09-s4-ai-prompt-config-design.md`), mặc định = `AI_MODEL`; cùng `AI_PROVIDER` / `AI_API_KEY`. |
| H14 | Bật / tắt | `LESSON_COMPOSE_ENABLED` (mặc định `false`); `/v1/capabilities` trả `lessons.compose.enabled` ở S4.3. Admin dùng được khi biến này bật. |

## 3. Luồng xử lý

```
POST (S4.2 / S4.3) ─► kiểm tra quyền đọc bài gốc, câu, giới hạn, cache
                      │ cache hit → trả lesson_id ngay (200)
                      ▼
          lesson_creation_requests (kind = compose, status = queued) → 202
                      ▼ worker (lessonCreationWorker, phân nhánh theo kind)
   1. Đọc câu đã chọn (text_en, text_vi, ipa, start_ms, end_ms) + bài gốc
   2. Tìm item ứng viên trong danh mục (không AI): mọi item published có
      normalizeItemKey xuất hiện trong câu, tối đa 40
   3. Gọi AI compose (1 lần; sai JSON → gọi lại 1 lần kèm lỗi)
   4. composeLesson(): dựng item, pattern, task, block bước 2–5 (thuần)
   5. checkLessonSpec() trong bộ nhớ → phải 0 vi phạm, nếu không: failed
      COMPOSE_SPEC_INVALID (ghi rule vào log), không ghi gì vào DB
   6. materializeComposed(): 1 transaction có fence lease
```

### 3.1 Lọc trước khi gọi AI (`composePrecheck.ts`, không AI)

Từ chối ngay (`COMPOSE_SENTENCES_TOO_THIN`, không tính lượt) khi:
- tổng số từ của các câu đã chọn < 8;
- hơn một nửa số câu chỉ có 1–2 từ (câu cảm thán: "Yeah.", "Oh!", "OK.");
- sau khi `normalizeAnswer` các câu trùng nhau còn 1 câu;
- câu không có chữ Latin (OCR lỗi, ngôn ngữ khác).

App hiện cùng luật này để tắt nút sớm (S4.3), server vẫn kiểm lại.

## 4. Prompt và JSON trả về (`curriculum/composer/service/composeAi.ts`)

> Bản nháp prompt đầy đủ + ví dụ để review: `2026-10-09-s4-1-compose-prompt-draft.md`.
> **Prompt không viết cứng trong code:** nội dung, ví dụ, tham số số lượng, model nằm trong kho prompt có phiên bản (`ai_prompts` / `ai_prompt_versions`), xem `2026-10-09-s4-ai-prompt-config-design.md`. S4.1 làm phần backend của kho prompt (§11 của file đó).
> **Bản nháp đó là nguồn chuẩn** cho prompt và khuôn đầu ra (`suitable` / `reason_vi` / `suggestion_vi` / `lesson`, `slots` dạng danh sách). Đầu ra khoá 3 lớp: khuôn trong prompt + JSON Schema `strict` gửi cho nhà cung cấp + zod và luật ở server.

Prompt gồm: trình độ, đối tượng, câu đã chọn (`id`, `en`, `vi`), item ứng viên (`code`, `text`, `meaning_vi`), luật đầu ra và marker `COMPOSE_PROMPT_MARKER = 'Lesson sentences (JSON):'` (nằm trong `user_template` mặc định; lint bắt buộc giữ marker này để AI giả lập trong test nhận ra) để completion giả lập trong test nhận ra (giống `TRANSLATION_PROMPT_MARKER`).

JSON trả về: xem `OUTPUT TEMPLATE` và §3.1 trong bản nháp prompt. Kiểm bằng `ComposeAiResponseSchema` (zod) và cùng hình dạng với JSON Schema `strict` gửi cho nhà cung cấp.

Kiểm thêm ngoài zod (lỗi nào cũng đưa vào lần gọi lại):
- `suitable` khớp với `lesson` / `reason_vi`;
- `frame` parse được bằng `parseFrame`, tên chỗ trống khớp `slots[].name`, biến thể dùng đúng các chỗ trống (`variantSlotProblem` có sẵn);
- `example_sentence_ids` thuộc câu đã chọn;
- `role_play` có ít nhất 1 lượt của người học; `pattern_index` hợp lệ;
- `code` (nếu có) phải nằm trong danh sách ứng viên đã gửi.

## 5. `composeLesson()` (`curriculum/composer/service/composeLesson.ts`, hàm thuần)

Input: bài gốc (header), câu đã chọn, kết quả AI đã kiểm, item ứng viên, `now`. Output: `ComposedLesson` (mọi id đã sinh sẵn, sẵn sàng ghi).

| Phần | Cách dựng |
|---|---|
| Header | `title` = `"<tiêu đề bài gốc> · 6 bước"` (cắt 255), `code` (H11), `can_do`, `situation`, `audience = all`, `estimated_minutes` = ceil(tổng `durationSec` / 60). |
| Item | Item ứng viên được AI chọn → dùng lại id. Item mới → `deriveItemCode`, `source = ai`, `status = published`. `required` theo AI; pattern luôn `required`. Mọi item `introduction = new` (bài sinh ra không thuộc course nên không có "recycled"). Ví dụ của pattern = các câu trong `example_sentence_ids` (`ItemExamples`), biến thể → `ItemVariants`. |
| Bước 2 | 1 block `listen_and_repeat`: mỗi câu đã chọn là 1 prompt `{ id, textEn, textVi, sentenceId, startMs?, endMs? }` (contract mở rộng ở §6). Thêm 1 block `item_cards` các item `required`. |
| Bước 3–4 | `activityDrafts(3 / 4, items, resolveRef)` có sẵn (PR 8), không AI. Bước 4 thêm `translation` từ câu đã chọn khớp pattern nếu drafts thiếu. |
| Bước 5 | Block `role_play` (`task_id` = task độc lập), `skill = speak`. |
| Task | `guided` (gắn bước 3–4, có `hint_levels`), `independent` (bước 5, không gợi ý, `response_mode = speak`). Item của task = item `required`. 4 tiêu chí (H10). |
| Kiểm | Dựng `LessonSpecInput` trong bộ nhớ → `checkLessonSpec()`. Vi phạm → lỗi `COMPOSE_SPEC_INVALID`. Cảnh báo → trả kèm để log. |

Hàm thuần nên test được mọi luật mà không cần DB hay AI.

## 6. Mở rộng contract `listen_and_repeat`

`ListenAndRepeatContentSchema.prompts[]` thêm 3 trường **tuỳ chọn**: `sentenceId` (uuid, phải là câu của chính bài), `startMs`, `endMs` (số nguyên ≥ 0, `endMs > startMs`, đoạn ≤ 30 000 ms theo D1).

- Tương thích ngược: block cũ không có trường này vẫn hợp lệ; app / admin cũ bỏ qua trường lạ (app đọc `data` dạng record).
- Spec-check thêm vi phạm `ACTIVITY_SENTENCE_NOT_IN_LESSON` khi `sentenceId` không thuộc bài.
- ⚠️ **Đổi API public (thêm trường)**: làm mới fixture `valid-lesson-snapshot-with-spec-response.json` nếu seed dùng; app chép fixture ở S4.3.

## 7. Migration `007_lesson_compose` ⚠️

```sql
ALTER TABLE lessons
  ADD COLUMN derived_from_lesson_id uuid NULL REFERENCES lessons(id) ON DELETE SET NULL,
  ADD COLUMN compose_key varchar(64) NULL;
CREATE INDEX lessons_derived_compose_idx
  ON lessons (derived_from_lesson_id, compose_key) WHERE compose_key IS NOT NULL;

ALTER TABLE lesson_creation_requests
  ADD COLUMN kind varchar(16) NOT NULL DEFAULT 'source'
    CHECK (kind IN ('source', 'compose')),
  ADD COLUMN ai_calls integer NOT NULL DEFAULT 0;

ALTER TABLE items ADD COLUMN reviewed_at timestamptz NULL;

ALTER TABLE users ADD COLUMN compose_daily_limit integer NULL
  CHECK (compose_daily_limit IS NULL OR compose_daily_limit BETWEEN 0 AND 100);

ALTER TABLE lessons ADD COLUMN situation_source varchar(8) NULL
  CHECK (situation_source IN ('source', 'inferred'));
UPDATE items SET reviewed_at = updated_at WHERE source = 'admin';
```

- File `.down.sql` đi kèm; cập nhật `prisma/schema.prisma` rồi `yarn prisma generate`.
- Không xoá dữ liệu. Staging chỉ cần chạy migrate (không cần reset).
- ⚠️ Số `007` lấy trước PR 12 (Stage 3). PR 12 sẽ dùng `008`; ghi điểm lệch vào plan PR 12 khi tới lượt.
- Cache người học: tìm theo `(derived_from_lesson_id, compose_key, owner_user_id)`; admin theo `(derived_from_lesson_id, compose_key, unit_id)`.

## 8. Hàng đợi, giới hạn, chi phí

- `lesson_creation_requests.kind = 'compose'`, `input = { lesson_id, sentence_ids, level }`, `source_type` = của bài gốc. Idempotency, lease, poll **dùng lại nguyên** (`GET /v1/lesson-creations/:id`, `/v1/admin/lesson-creations/:id`).
- Worker: `lessonCreationWorker` gọi `pipelineFor(request.kind).process(request)`; pipeline cũ không đổi.
- `composeLimits.ts`: lượt = request `kind = compose` của user trong ngày VN **có ít nhất 1 lần gọi AI** (cột mới `lesson_creation_requests.ai_calls`, tăng ngay trước mỗi lần gọi AI). Giới hạn = `users.compose_daily_limit ?? COMPOSE_LEARNER_DAILY_LIMIT`. Kiểm khi nhận request (429) và kiểm lại trong worker trước khi gọi AI (chống gửi song song). Trần tháng = tổng `ai_calls` của request compose trong tháng (kể cả gọi lại).
- Mã lỗi mới: `COMPOSE_SENTENCES_TOO_THIN` (400), `COMPOSE_NOT_SUITABLE`, `COMPOSE_AI_INVALID`, `COMPOSE_SPEC_INVALID`, `COMPOSE_LIMIT_REACHED` (429), `COMPOSE_BUDGET_EXHAUSTED` (503), `COMPOSE_DISABLED` (403), `COMPOSE_SENTENCE_TOO_LONG`, `COMPOSE_SENTENCES_INVALID` (400).
- Log: `compose_ai_call` (request_id, model, số câu, độ dài prompt, thời gian, `retry`), **không** log nội dung câu.

## 9. Kiểm thử

| Loại | Nội dung |
|---|---|
| Unit `composeAi.test.ts` | JSON Schema và zod khớp nhau trên mọi fixture (hợp lệ / lỗi); request gửi tới OpenAI có `json_schema` + `strict`, tới Gemini có `responseSchema`; nhà cung cấp báo không hỗ trợ → gọi lại bằng `json_object`; các prompt cũ vẫn gửi `json_object`. Parse JSON hợp lệ; từng loại lỗi (frame sai, slot thiếu, role_play không có lượt người học, `code` lạ, `example_sentence_ids` lạ) → danh sách lỗi đúng; prompt có marker và không chứa dữ liệu người dùng ngoài câu. |
| Unit `composeLesson.test.ts` | Fixture `test/fixtures/compose/l03-food.json` (câu bài L03 + AI trả mẫu) → **0 vi phạm** `checkLessonSpec`; bước 2 có đủ câu kèm `startMs` khi bài gốc là YouTube; item trùng mã dùng lại id; item `archived` bị bỏ; `suitable = false` → lỗi `COMPOSE_NOT_SUITABLE`; `used_sentence_ids` bỏ câu lạc quẻ (bước 2 chỉ còn câu được giữ); còn < 2 câu → `COMPOSE_NOT_SUITABLE`; `situation_source = inferred` được ghi; cùng input → cùng output. |
| Unit `composePrecheck.test.ts` | Câu quá ngắn / trùng / chỉ câu cảm thán / không Latin → `COMPOSE_SENTENCES_TOO_THIN`, không gọi AI. |
| Unit `activityContent` | `listen_and_repeat` có / không có `sentenceId`, `endMs ≤ startMs` → lỗi, đoạn > 30 giây → lỗi. |
| Unit spec-check | `ACTIVITY_SENTENCE_NOT_IN_LESSON`. |
| DB `composePipeline.test.ts` (thêm vào danh sách `test:db` trong `package.json`) | Completion giả lập → request `succeeded`, bài mới có spec + item published `source = ai` `reviewed_at = null` + task + block; câu được chép; JSON sai 2 lần → `failed COMPOSE_AI_INVALID`, không có bài; mất lease → không ghi; cache hit không tạo request; giới hạn ngày; trần tháng. |
| DB migration | `up` → `down` → `up` sạch. |

Lệnh: `yarn test`, `yarn test:db`, `yarn lint`, `yarn tsc` (server). Mục tiêu: không giảm số test đang xanh (unit 431, db 245).

## 10. Thứ tự commit

1. `feat(db): migration 007 lesson compose columns` (+ schema.prisma).
2. `feat(blocks): listen_and_repeat prompts carry source sentence and clip` (+ spec-check rule, test).
3. `feat(composer): compose AI prompt and response validation` (+ completion giả lập).
4. `feat(composer): pure composeLesson builds a publishable six-step lesson`.
5. `feat(composer): materialize composed lesson and worker dispatch by kind`.
6. `feat(composer): learner daily limit, monthly cap, compose cache`.
7. `chore(scripts): composeSample dev script on the sample unit` (mặc định dùng AI giả lập; `--live` gọi AI thật và in prompt + JSON để review).
8. `docs: S4.1 plan marked implemented` (repo app).

## 11. File tóm tắt

| Tạo | Sửa |
|---|---|
| `src/common/database/migrations/007_lesson_compose{,.down}.sql` | `prisma/schema.prisma` |
| `src/modules/curriculum/composer/model/compose.ts` (zod, mã lỗi) | `src/modules/curriculum/lessonBlocks/model/activityContent.ts` |
| `src/modules/curriculum/composer/model/composeAiSchema.ts` (JSON Schema cho structured output) |
| `src/modules/curriculum/composer/service/composeAi.ts` | `src/modules/curriculum/spec/service/specValidator.ts` |
| `src/modules/curriculum/composer/service/composeLesson.ts` | `src/modules/canonicalLesson/service/lessonCreationWorker.ts` (phân nhánh `kind`) |
| `src/modules/curriculum/composer/service/composePipeline.ts` | `src/modules/canonicalLesson/repository/creationRequestStore.ts` (`kind`, đếm lượt) |
| `src/modules/curriculum/composer/service/composeLimits.ts` | `src/modules/canonicalLesson/service/creationAi.ts` (completion giả lập nhận marker compose; `callProviderJson` thêm tham số tuỳ chọn `jsonSchema`, không đổi hành vi các prompt cũ) |
| `src/modules/curriculum/composer/repository/composeStore.ts` | `src/common/config/*.ts` (env §2 H12–H14) |
| `src/common/ai/prompts/registry.ts`, `promptRuntime.ts`, `promptTemplate.ts` (render + lint), `src/modules/curriculum/composer/prompts/composeDefaultV1.ts` (bản mặc định), `scripts/aiPrompt.ts`, `scripts/seedAiPrompts.ts` | |
| `scripts/composeSample.ts` | `.env.example` (chỉ thêm tên biến, **không** sửa `.env`), `package.json` (thêm test DB vào `test:db`) |
| `test/composeAi.test.ts`, `test/composeLesson.test.ts`, `test/composePipeline.test.ts`, `test/fixtures/compose/*.json` | |

Không thêm dependency.

## 12. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Item AI tự publish làm bẩn danh mục chung | `reviewed_at = null` + bộ lọc rà ở S4.2; không ghi đè item có sẵn; không dùng `item_refs`. |
| AI trả bài không qua validator | Kiểm trước khi ghi, gọi lại 1 lần kèm lỗi; không bao giờ ghi bài lỗi. |
| Chi phí AI | 1 lần gọi / bài, cache theo nhóm câu, giới hạn ngày, trần tháng, flag mặc định tắt. |
| Bài gốc bị xoá | `ON DELETE SET NULL`; bài sinh ra có câu riêng nên vẫn chạy. |
| Migration trùng số với PR 12 | Ghi rõ ở §7; PR 12 dùng `008`. |
