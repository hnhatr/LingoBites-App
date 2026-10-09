# PR 13 – Server: âm thanh vào server, nhận dạng giọng nói, job chấm

> Trạng thái: **CHỜ DUYỆT**. Chưa code.
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server` (+ 1 commit chỉ chép fixture sang `LingoBites-App`). Nhánh: `claude/funny-archimedes-gmioda`.
> Thuộc Giai đoạn 1 (`2026-10-09-phase1-stage3-plan.md` §5). Cần trước: PR 12 và PR 15 (đã code). Migration là **009** (PR 15 đã dùng 008).
> **Key OpenAI (T1) không chặn việc code.** Toàn bộ test chạy bằng STT `mock`; key chỉ cần khi chạy test tích hợp, chạy script đo và bật trên staging (§9).

## 1. Mục tiêu và phạm vi

Sau PR này, app ghi âm bước 5 hoặc nhiệm vụ tổng hợp rồi upload bằng route recordings sẵn có (mode mới `lesson_task`). Server lần lượt:
1. tạo job chấm;
2. nhận dạng giọng nói thành chữ (STT);
3. chấm bằng bộ chấm của PR 12;
4. ghi `evaluations`. Ghi `evaluations` kéo theo PR 15: đạt bài, đạt unit, sync về app.

Chữ nhận dạng chỉ nằm trong bộ nhớ khi chấm, không lưu. File âm thanh tự xoá sau 30 ngày.

| Trong PR 13 | Ngoài PR 13 |
|---|---|
| Recordings mode `lesson_task` (migration 009) | Ghi âm AAC 16 kHz, consent, UI "Đang chấm…" (**PR 14**) |
| Cổng `SpeechToText` + adapter `openai` + `mock` | Adapter Google (chỉ khi team muốn so, A1) |
| Bảng + worker `evaluation_jobs` (lease, thử lại 2 lần) | Admin nghe lại bản ghi, thống kê (PR 17) |
| Giới hạn 30 lượt nói / ngày; dùng lại kết quả khi trùng file | Bật flag cho người dùng thật (sau khi đo T2) |
| Xoá bản ghi `lesson_task` sau 30 ngày | |
| Flag `speechEvaluation` (env + danh sách user nội bộ) | |
| Script đo độ chính xác trên bộ T2 | |

## 2. Quyết định cần xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| S1 | **Key STT lấy từ đâu?** | Env `STT_API_KEY`. Nếu trống **và** `AI_PROVIDER=openai` thì dùng `AI_API_KEY` (cùng key OpenAI). Nếu `AI_PROVIDER` là Gemini mà `STT_PROVIDER=openai` và thiếu `STT_API_KEY` → server báo lỗi lúc khởi động ở staging / production, như cách đang kiểm `AI_API_KEY`. Nếu dùng key riêng: `deploy-staging.sh` / `deploy-production.sh` thêm `STT_API_KEY=STT_API_KEY:latest` vào `--set-secrets` (production gắn có điều kiện như Better Stack, để deploy không vỡ khi chưa có secret). ❓ **Cần bạn cho biết:** staging / production đang chạy `AI_PROVIDER` nào? |
| S2 | **Lưu metadata bản ghi bài tập ở đâu?** | Dùng lại bảng `recordings`, mode mới `lesson_task`. Bảng hiện bắt buộc `lesson_id`, `sentence_id`, ≤ 35 giây và giữ một bản ghi mỗi (mode, câu). Migration 009 nới các ràng buộc này **chỉ cho `lesson_task`** (§3). Mode khác giữ nguyên luật cũ. |
| S3 | **Không làm vỡ app cũ** | `SpeakingModeSchema` (dùng cho `speaking_attempts`) **không** thêm `lesson_task`; recordings dùng schema mode riêng. `GET /v1/recordings` (danh sách) **không trả** bản ghi `lesson_task` trừ khi hỏi `?mode=lesson_task`, vì app cũ parse `sentence_id` bắt buộc. |
| S4 | **Hàng đợi job** | Bảng nhỏ `evaluation_jobs` (một job cho mỗi recording), worker trong chính process server. Worker hỏi bảng mỗi 2 giây, nhận job bằng `FOR UPDATE SKIP LOCKED`, lease 60 giây. PUT xong thì đánh thức worker ngay để kịp ~20 giây. Hàng đợi phân tích hiện có gắn chặt với pipeline nhiều giai đoạn nên **không** dùng lại; chỉ lấy lại cách lease / thử lại. |
| S5 | **Thử lại** | STT lỗi (mạng, 5xx, timeout 20 giây) → thử lại tối đa 2 lần; vẫn lỗi → `unscorable / stt_failed`. Lỗi 4xx (key sai, file hỏng) → `stt_failed` ngay, không thử lại. Mọi kết thúc đều ghi `evaluations` để app không treo ở `pending`. |
| S6 | **Giới hạn 30 lượt / ngày** (A4) | Kiểm **lúc chạy job**. Vượt giới hạn → `unscorable / limit` và xoá file ngay. Không chặn ở bước upload: hàng đợi upload của app chạy nền, kết quả vẫn cần về qua sync. Đếm `evaluations` `source = speech` có gọi STT theo ngày giờ Việt Nam. Env `EVAL_DAILY_LIMIT` (mặc định 30). |
| S7 | **Trùng file** | Cùng user, cùng SHA-256, đã có kết quả nói → chép kết quả sang lượt mới, không gọi STT, không tính lượt. |
| S8 | **Ngắn / dài** (A6) | Bước 5 ≤ 45 giây, nhiệm vụ tổng hợp ≤ 90 giây: kiểm ở `POST /v1/recordings`. Dưới 1 giây → `unscorable / too_short`, không gọi STT. Transcript rỗng → `unscorable / empty`. |
| S9 | **Flag `speechEvaluation`** (A10) | Env `SPEECH_EVALUATION_ENABLED` (mặc định `false`) và `SPEECH_EVALUATION_USER_IDS` (danh sách id user nội bộ, cách nhau dấu phẩy). `POST /v1/recordings` mode `lesson_task` khi user chưa được bật → 403 `SPEECH_EVALUATION_DISABLED`. `/v1/capabilities` không cần đăng nhập nên chỉ báo cờ chung; thêm route `GET /v1/evaluations/capabilities` (cần đăng nhập) trả `{ text: true, speech: <cho user này> }`, app PR 14 dùng route này. |
| S10 | **Gửi gì cho OpenAI** | File âm thanh, `model`, `language = en`, và `prompt` gồm các câu tham khảo + chữ của item trong task (để nhận đúng "orange juice"…), tối đa ~200 từ. **Không** gửi id, tên, email người học. Không log transcript (kể cả khi lỗi). |
| S11 | **Xoá sau 30 ngày** (A7) | Cột `evaluate_by` = lúc upload xong + 30 ngày. Job dọn bản ghi hiện có (`startRecordingCleanup`) xoá thêm file + dòng `lesson_task` quá hạn. `evaluations` giữ lại (không chứa giọng nói hay chữ). |
| S12 | **Script đo** | `scripts/evaluation/measure.ts --dir <thư mục> --labels <csv> [--model …]`. Đọc file + bảng nhãn T2, chạy STT thật + bộ chấm, in chấm oan / chấm lọt / `unscorable` / độ trễ p50–p95. Không ghi DB. Chạy trên máy team có key; bản ghi **không** vào repo. |

## 3. Migration `009_lesson_task_recordings.sql` (+ `.down.sql`)

**Bảng `recordings`:**
- `lesson_id` và `sentence_id` cho phép null;
- thêm `attempt_id`, `block_id`, `unit_id`, `task_id` (uuid), `support_level` (varchar 8), `evaluate_by` (timestamptz);
- `recordings_mode_check` thêm `lesson_task`.
- `recordings_duration_ms_check`:
  - `lesson_task`: 1..90 000;
  - mode khác: 1..35 000 như cũ.
- `recordings_target_check`:
  - `lesson_task`: bắt buộc có `attempt_id` + `support_level`, và có đúng một đích (`lesson_id + block_id` hoặc `unit_id + task_id`);
  - mode khác: bắt buộc có `lesson_id + sentence_id` như cũ.
- Unique `(user_id, attempt_id)` cho `lesson_task`: một lượt làm có một bản ghi.
- Chỗ "giữ một bản ghi mỗi câu" khi upload xong bỏ qua `lesson_task`.

**Bảng `evaluation_jobs`:**

```sql
CREATE TABLE evaluation_jobs (
  recording_id uuid PRIMARY KEY REFERENCES recordings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL,          -- queued | processing | done
  attempts smallint NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  last_error varchar(64),               -- mã lỗi, không có nội dung
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evaluation_jobs_runnable_idx ON evaluation_jobs (status, lease_expires_at);
```

⚠️ Down script xoá các bản ghi `lesson_task` trước khi siết lại ràng buộc cũ.

## 4. Contract

`POST /v1/recordings` nhận thêm dạng `lesson_task`:

```ts
{ client_recording_id, mode: 'lesson_task', attempt_id,
  target: { lesson_id, block_id } | { unit_id, task_id },
  support_level, duration_ms, mime_type, byte_size, sha256 }
```

- Đích được kiểm bằng `loadTarget` của PR 12: task phải là `speak` (hoặc `write` khi viết thay nói thì không đi đường này).
- `RecordingView` thêm `attempt_id`, `target`, `evaluate_by`; `sentence_id` / `lesson_id` có thể null với `lesson_task`.
- Fixture mới `valid-recording-lesson-task-create-request.json` (khoá SHA, chép sang app cho PR 14).

## 5. Thành phần (server)

| File | Việc |
|---|---|
| `src/common/stt/speechToText.ts` | Cổng `SpeechToText.transcribe({ audio, mimeType, prompt }) → { text }` + lỗi `SttRetryableError` / `SttFatalError` |
| `src/common/stt/openaiSpeechToText.ts` | `POST https://api.openai.com/v1/audio/transcriptions` (multipart: `file`, `model`, `language`, `prompt`, `response_format=json`) bằng `fetch` + `FormData` có sẵn của Node 22. Không thêm thư viện. Timeout 20 giây. |
| `src/common/stt/mockSpeechToText.ts` | Trả transcript theo SHA-256 của file từ một bảng fixture; không có thì trả câu tham khảo đầu tiên |
| `src/common/stt/index.ts` | Chọn adapter theo env |
| `src/common/config/env.ts` | `STT_PROVIDER` (`mock` \| `openai`, mặc định `mock`), `STT_MODEL` (mặc định `gpt-4o-mini-transcribe`), `STT_API_KEY` (S1), `EVAL_DAILY_LIMIT`, `SPEECH_EVALUATION_ENABLED`, `SPEECH_EVALUATION_USER_IDS` |
| `src/modules/recordings/model/recordings.ts`, `controller/recordings.ts`, `repository/store.ts` | Mode `lesson_task` (S2, S3, S8, S9); PUT xong → tạo job + đánh thức worker |
| `src/modules/evaluation/service/evaluationWorker.ts` | Nhận job → kiểm giới hạn / trùng file / quá ngắn → lấy file từ storage → STT → `evaluateUtterance` → `store.record` (PR 12, kéo theo PR 15) với `source = speech`, `stt_provider`, `stt_model`, `latency_ms`, `audio_ms` |
| `src/app/server.ts`, `src/app/shutdown.ts` | Khởi động / dừng worker (chỉ khi có DB) |
| `src/app/service/cleanup.ts` | Xoá `lesson_task` quá `evaluate_by` (S11) |
| `src/modules/evaluation/controller/evaluations.ts` | `GET /v1/evaluations/capabilities` (S9) |
| `scripts/evaluation/measure.ts` | S12 |
| `.env.example` | Thêm biến STT (không có giá trị thật) |

## 6. Kiểm thử

| Test | Nội dung |
|---|---|
| `speechToText.test.ts` | Adapter OpenAI với `fetch` giả: đúng URL, header, các trường multipart, không có id người học; 5xx / timeout → lỗi thử lại được; 401 / 400 → lỗi dừng; mock theo SHA |
| `envConfig.test.ts` (mở rộng) | Mặc định STT; dùng `AI_API_KEY` khi `AI_PROVIDER=openai`; thiếu key ở production → lỗi |
| `recordingsLessonTask.test.ts` (`test:db`) | - tạo + upload `lesson_task`: đích hợp lệ, 403 khi flag tắt, 400 khi quá 45 / 90 giây, đích sai / task viết → 422;<br>- hai lượt cùng block không đè nhau;<br>- danh sách mặc định không có `lesson_task`;<br>- mode cũ không đổi hành vi |
| `evaluationWorker.test.ts` (`test:db`, STT mock) | - upload → có `evaluations` `source = speech`, đạt bài theo PR 15, record sync;<br>- dưới 1 giây → `too_short`; transcript rỗng → `empty`;<br>- lỗi tạm 1 lần rồi thành công; lỗi 2 lần → `stt_failed`; 401 → `stt_failed` ngay;<br>- lượt 31 trong ngày → `limit`, file bị xoá;<br>- trùng SHA → chép kết quả, không gọi STT;<br>- hết lease → job được nhận lại; hai worker không chạy trùng một job |
| `recordingCleanup` (mở rộng) | `lesson_task` quá 30 ngày bị xoá file + dòng, `evaluations` còn |
| `sttIntegration.test.ts` | Gọi OpenAI thật, **chỉ chạy khi** `STT_INTEGRATION=1` và có key; mặc định skip |
| `databaseBaseline.test.ts` | 009 lên / xuống |
| `openApiDocument.test.ts`, contract | +1 path; fixture mới |

Kiểm cuối như PR 15 (server, admin-web Playwright, app `jest src/core/schemas`).

## 7. Thứ tự commit

1. `feat(recordings): lesson task recordings (migration 009)` — schema + store + route + test.
2. `feat(stt): speech-to-text port with OpenAI and mock adapters` — + env.
3. `feat(evaluation): evaluation job worker for spoken answers` — worker, giới hạn, trùng file, đánh thức sau PUT.
4. `feat(evaluation): speech evaluation flag and per-user capabilities`.
5. `feat(recordings): delete lesson task recordings after 30 days`.
6. `feat(scripts): measure scorer accuracy on a labelled set`.
7. `test(contract): lesson task recording fixture` (server) + app chép fixture.
8. `docs: mark PR 13 plan as implemented`.

## 8. Rủi ro

- ⚠️ **Migration 009 sửa bảng `recordings` đang chạy thật** (nới null, đổi check). Dữ liệu cũ vẫn thoả luật cũ. Down script phải xoá bản ghi `lesson_task` trước.
- ⚠️ **Đổi API công khai:** `POST /v1/recordings` nhận dạng mới; `RecordingView` thêm trường; 1 route mới. App cũ không thấy `lesson_task` (S3).
- ⚠️ **Dữ liệu ra bên thứ ba:** file giọng nói đi tới OpenAI. Chỉ bật cho người dùng sau khi có consent (PR 14), chính sách quyền riêng tư và khai báo store (T4).
- **Worker trong process server:** Cloud Run có thể tắt CPU khi không có request. Job kẹt sẽ chạy lại khi instance thức dậy (lease hết hạn), nhưng có thể trễ hơn 20 giây. Khi đó app nhận kết quả qua sync. Nếu thấy trễ nhiều, đặt Cloud Run "CPU always allocated" hoặc tách worker (sau này).
- **Chi phí:** ~$0.003 / phút với `gpt-4o-mini-transcribe` (5.7.3); giới hạn 30 lượt / ngày và dùng lại kết quả trùng file giữ chi phí trong tầm.

## 9. Việc team làm song song (key OpenAI)

Chi tiết từng bước nằm trong câu trả lời ở phiên chat (2026-10-09). Tóm tắt:
1. Tạo **project riêng** cho LingoBites trên platform.openai.com, đặt hạn mức chi tiêu.
2. Tạo **secret key** trong project đó, quyền giới hạn ở phần audio nếu được.
3. Đặt key vào **Secret Manager** của GCP (staging trước), tên `STT_API_KEY`. Nếu `AI_PROVIDER` đã là `openai` thì có thể dùng luôn `AI_API_KEY`. **Không** dán key vào repo, file `.env` được commit hay chat.
4. Kiểm phần Data controls / thời gian lưu dữ liệu của project.
