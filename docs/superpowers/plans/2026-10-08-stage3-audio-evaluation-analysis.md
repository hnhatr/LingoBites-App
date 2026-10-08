# Stage 3 – Âm thanh và chấm bài: thiết kế chốt

> Ngày lập: 2026-10-08. Nền code: nhánh **`develop`** (đã merge Stage 1–2: server #114, app #221).
> Thay cho bản phân tích nhiều phương án trước đó. Spec MVP cũ `docs/superpowers/specs/2026-09-06-…` **không còn hiệu lực** cho phần này (DEC-4, REQ-22 bỏ).
> Mỗi PR dưới đây vẫn cần plan chi tiết riêng trước khi code (VibeGuard), nhưng hướng làm đã chốt ở đây.

---

## 1. Chốt hướng

| Chủ đề | Chốt |
|---|---|
| Máy chấm cái gì | **Nội dung, mục đích, độ rõ, độc lập** (4 tiêu chí của task), dựa trên **chữ nhận dạng được (transcript)**. **Không chấm phát âm theo âm vị.** |
| Chấm ở đâu | **Trên server.** App chỉ ghi âm, gửi lên và hiện kết quả. |
| Lượt nào được chấm máy | **Bước 5 (vận dụng độc lập)** và **nhiệm vụ tổng hợp của unit**: các lượt quyết định "đạt bài" / "đạt unit". Bước 2–4 giữ như hiện nay (tự chấm + gợi ý). |
| Câu viết ở bước 5 | Chấm bằng cùng bộ chấm, bỏ bước nhận dạng. |
| Nhận dạng giọng nói (STT) | Dịch vụ **OpenAI Speech-to-Text**. Server đã có tích hợp OpenAI (`AI_PROVIDER=openai`), và dịch vụ này nhận thẳng file `.m4a` app đang ghi. Đặt sau một cổng `SpeechToText` để đổi nhà cung cấp được. Model cụ thể đặt bằng env, chọn sau khi đo (mục 6). |
| Lỗi hoặc không nghe được | `unscorable`: không tính là sai, người học làm lại. |
| Quyền riêng tư | Consent riêng "Cho phép chấm bài nói". Bản ghi chấm xong **tự xoá sau 30 ngày**. **Không lưu nguyên văn transcript.** |

---

## 2. Phần âm thanh đưa vào bằng cách nào

### 2.1 Luồng

```
APP (bước 5 / nhiệm vụ tổng hợp)
 1. Ghi âm (RecorderControls hiện có), giữ file sau khi người học bấm "Xong".
 2. Ghi lượt làm: outcome = pending, assessed_by = service, recording_client_id.
 3. Lưu vào speaking_recordings (mode = lesson_task, activity_id = attempt id).
 4. Hàng đợi upload hiện có đẩy file lên (kiểm consent "chấm bài nói").
SERVER
 5. POST /v1/recordings (mode = lesson_task, attempt_id, block_id) → PUT …/content
 6. Upload xong → tạo job "evaluation" (hàng đợi job Postgres hiện có).
 7. Worker: lấy file → STT → bộ chấm → ghi `evaluations` → cập nhật lesson_outcomes.
APP
 8. Đang mở màn: hỏi GET /v1/evaluations/:attemptId (mỗi 2 giây, tối đa ~20 giây).
    Đã rời màn / offline: kết quả về qua sync pull (collection `evaluations`).
 9. Hiện phản hồi 4 trạng thái.
```

### 2.2 Thay đổi cụ thể

**App** (`LingoBites-App`):

| File / chỗ | Thay đổi |
|---|---|
| `features/speaking/logic/recordingService.ts` | `startRecorder` đặt cấu hình ghi: **AAC, mono, 16 kHz, ~32 kbps**. Đủ cho nhận dạng giọng nói và cho file nhỏ: 35 giây khoảng 140 KB, thay vì mặc định của thư viện. |
| `features/lesson/flow/components/IndependentTaskView.tsx` | Khi người học có consent "chấm bài nói": ghi âm → "Gửi chấm", **không** hiện checklist tự đánh giá. Không có consent, hoặc tài khoản trẻ chưa có consent phụ huynh: giữ tự đánh giá như hiện nay. |
| `features/lesson/flow/logic/useSelfCheckRecorder.ts` | Thêm chế độ "giữ file": không xoá khi rời màn nếu file đã được giao cho hàng đợi upload. |
| `speaking_recordings` (SQLite) + `recordingUploadQueue` | Dùng lại nguyên. Thêm mode `lesson_task` và cổng consent mới cho mode này. Không cần nâng schema, vì `mode` và `activity_id` đều là cột text sẵn có. |
| `features/speaking/logic/upload/recordingConsent.ts` | Thêm khoá `speaking.evaluation_consent` (`on` / `off` / chưa hỏi) và màn hỏi consent riêng (nội dung ở mục 5). |
| `core/schemas/sync.ts` | `LessonAttemptOutcome` thêm `pending`; `assessed_by` thêm `service`; payload thêm `recording_client_id?`. Collection pull mới `evaluations`. |

**Server** (`LingoBites-Server`):

| File / chỗ | Thay đổi |
|---|---|
| `recordings/model/recordings.ts` | `mode` thêm `lesson_task`. Với mode này: `sentence_id` không bắt buộc; thêm `attempt_id` và `block_id` (uuid, bắt buộc). |
| `prisma/schema.prisma` + migration `007_…` | Bảng `recordings` thêm cột `attempt_id`, `block_id`, `evaluate_by` (hạn xoá). Thêm bảng `evaluations` (mục 3.4). |
| `recordings/controller/recordings.ts` | PUT content xong mà mode là `lesson_task` thì tạo job `evaluation`. |
| `common/jobs/` | Thêm loại job `evaluation`, dùng lease / retry sẵn có (thử tối đa 2 lần). |
| `app/service/cleanup.ts` | Job dọn: xoá file + dòng `recordings` mode `lesson_task` sau **30 ngày**. |
| `sync/model/sync.ts` + `sync/repository/store.ts` | Nhận lượt `pending`; không tính lượt `pending` vào kết quả cho tới khi có `evaluations`. |

---

## 3. Phần chấm cần gì

### 3.1 Thành phần

| Thành phần | Nội dung | Kiểm thử |
|---|---|---|
| **Cổng `SpeechToText`** | `transcribe({audio, mimeType, language: 'en', prompt?}) → {text, durationMs}`. Prompt là gợi ý từ vựng: câu mẫu và item của task, giúp nhận đúng tên đồ uống… | Adapter `mock` trả transcript theo fixture |
| **Adapter OpenAI** | Gọi API transcription bằng file `.m4a`; timeout 20 giây; env `STT_PROVIDER`, `STT_MODEL`, `STT_API_KEY` (mặc định dùng `AI_API_KEY`). | Test tích hợp tắt mặc định, bật bằng env khi có key |
| **Bộ chấm `evaluateUtterance`** | Hàm thuần: transcript + dữ liệu task → điểm từng tiêu chí, lỗi, kết quả (mục 3.2). Dùng chung cho câu nói và câu viết. | Test bảng với nhiều câu đúng / sai / thiếu |
| **So khớp theo từ** | Chuẩn hoá bằng `normalizeAnswer` sẵn có, tách từ, tính **độ trùng từ** (khoảng cách chỉnh sửa theo từ) giữa transcript và từng câu chấp nhận; trả về từ thiếu / từ thừa để làm phản hồi. | Test riêng |
| **Job `evaluation`** | Lấy bản ghi → STT → chấm → ghi `evaluations` → cập nhật `lesson_outcomes` → xoá tạm. Lỗi STT sau 2 lần thì thành `unscorable`. | Test DB với STT mock |
| **API kết quả** | `GET /v1/evaluations/:attemptId` (chủ lượt làm mới xem được); `POST /v1/evaluations/text` cho câu viết (chữ không được lưu). | Test route |
| **Giới hạn chi phí** | Tối đa **30 lượt chấm / user / ngày** (env `EVAL_DAILY_LIMIT`); không chấm lại cùng một file (theo SHA-256). Vượt giới hạn thì trả `unscorable` với lý do `limit`. | Test |

### 3.2 Luật chấm (phiên bản 1, không dùng AI ngoài STT)

**Dữ liệu đầu vào lấy từ bài** (đã có trong DB):
- **câu chấp nhận** = `acceptedAnswers` của các mẫu câu trong `task.item_codes` ∪ câu mẫu của lượt người học trong block (`role_play` / `modelEn`…);
- **item bắt buộc** của task;
- **lỗi thường gặp** của các item đó;
- **ngưỡng** trong `task_criteria.threshold`, rỗng thì dùng mặc định bên dưới.

| Tiêu chí | Đạt khi | Ngưỡng mặc định |
|---|---|---|
| **content** | Độ trùng từ với câu chấp nhận gần nhất ≥ ngưỡng **và** giá trị chỗ trống là giá trị hợp lệ của mẫu câu. | 0.80 |
| **purpose** | Có đủ **item bắt buộc** của task trong câu (mẫu câu khớp khung; từ / cụm từ có mặt). | tất cả |
| **clarity** | Máy nhận ra ≥ ngưỡng số **từ khoá** của câu chấp nhận gần nhất (từ khoá là từ không phải hư từ: a / the / please…). | 0.60 |
| **independence** | `support_level = none`. | — |

**Lỗi thường gặp:** transcript giống `wrong_example` của một lỗi (độ trùng từ ≥ 0.85) thì ghi mã lỗi đó. Lỗi `blocking` làm trượt; lỗi `tolerated` chỉ hiện nhắc nhở.

**Kết quả:**

| Điều kiện | Kết quả |
|---|---|
| Đủ mọi tiêu chí **bắt buộc**, không có lỗi `blocking` | `pass_independent` (hoặc `pass_with_support` nếu đã dùng gợi ý) |
| Thiếu tiêu chí bắt buộc hoặc có lỗi `blocking` | `fail` + **lỗi chính** (tiêu chí trượt đầu tiên hoặc lỗi `blocking`) + từ còn thiếu |
| Bản ghi dưới 1 giây, STT trả rỗng, quá giới hạn, hoặc STT lỗi sau 2 lần | `unscorable` + lý do |

**Phản hồi cho người học** (dữ liệu để app hiện):
- tiêu chí đạt / chưa;
- lỗi chính kèm `feedback_vi` của lỗi;
- các từ còn thiếu so với câu chấp nhận gần nhất;
- câu tham khảo.

**Hướng mở rộng, không làm trong phiên bản 1:** tiêu chí `purpose` dùng AI text khi luật không đủ (câu nói đúng ý nhưng không dùng mẫu câu của bài). Chỉ làm nếu số liệu thật cho thấy bị chấm oan nhiều.

### 3.3 Đo độ chính xác trước khi bật cho người dùng

Không cần spike riêng; làm trong PR server âm thanh:
1. Team ghi khoảng **40 câu** bằng app, gồm người lớn và trẻ em, câu đúng / sai / ấp úng, trên bài L01. Mỗi câu kèm nhãn "người chấm: đạt / chưa".
2. Script chạy cả bộ qua STT + bộ chấm, in ra:
   - tỷ lệ **chấm oan** (máy chưa đạt, người đạt);
   - tỷ lệ **chấm lọt** (máy đạt, người chưa đạt);
   - độ trễ, tỷ lệ `unscorable`.
3. Bật cho người dùng khi chấm oan **dưới 10%**; nếu chưa đạt thì chỉnh ngưỡng mặc định rồi đo lại.
4. Toàn bộ tính năng nằm sau feature flag `speechEvaluation`, mặc định tắt.

### 3.4 Dữ liệu lưu

Bảng `evaluations` (server):

| Cột | Ghi chú |
|---|---|
| `id`, `user_id`, `attempt_id` (unique), `lesson_id`, `block_id`, `task_id` | |
| `source` | `speech` \| `text` |
| `outcome` | `pass_independent` \| `pass_with_support` \| `fail` \| `unscorable` |
| `criteria` | JSON: tiêu chí → `{passed, score}` |
| `errors` | JSON: danh sách mã lỗi |
| `missing_words` | JSON |
| `unscorable_reason` | |
| `stt_provider`, `stt_model`, `latency_ms`, `audio_ms` | `audio_ms` dùng để tính chi phí |
| `created_at` | |

- **Không có cột transcript.**
- Collection sync `evaluations`: chỉ chiều server → app.

---

## 4. App hiện kết quả

| Trạng thái | Màn hình |
|---|---|
| Đang chấm | "Đang chấm…" (tối đa ~20 giây), rồi "Kết quả sẽ có khi có mạng" nếu chưa xong |
| Đạt | "Bạn đã tự làm được" + tiêu chí đạt |
| Đạt có gợi ý | "Đạt, nhưng còn cần gợi ý" + nút "Luyện lại" (về bước 3–4) và "Thử lại không gợi ý" |
| Chưa đạt | Lỗi chính (`feedback_vi`), từ còn thiếu, câu tham khảo + nút "Luyện phần liên quan" và "Thử lại" |
| Không chấm được | "Chưa nghe rõ, thử lại nhé" (kèm lý do) + "Thử lại"; **không** tính là sai |

---

## 5. Consent và dữ liệu trẻ em

- **Màn consent "Chấm bài nói bằng máy"**, hỏi lần đầu ở bước 5. Nội dung chốt:
  > "Để chấm bài nói, LingoBites gửi bản ghi của bạn tới máy chủ và dịch vụ nhận dạng giọng nói. Bản ghi tự xoá sau 30 ngày và không dùng cho mục đích khác."

  Hai nút: "Đồng ý" / "Tự đánh giá".
- **Tài khoản trẻ em:** cho tới khi có hồ sơ người học và consent phụ huynh (Bước 1 của lộ trình), tài khoản đánh dấu là trẻ **không** bật chấm máy. Hiện chưa có trường đối tượng, nên mặc định coi mọi tài khoản là người lớn. Ghi rõ điều này trong chính sách quyền riêng tư trước khi phát hành cho trẻ.
- Cập nhật `docs/01-ba/07-release/02-privacy-policy-draft.md` (repo server): mục giọng nói, bên xử lý (OpenAI), thời hạn 30 ngày.

---

## 6. Việc còn lại sau khi merge `develop` (thứ tự làm)

| # | PR | Repo | Nội dung | Cần trước |
|---|---|---|---|---|
| 0 | — | cả hai | **Test tay** bản `develop` (Phụ lục A của backlog), sửa lỗi phát sinh. | — |
| 12 | **Bộ chấm + kết quả (chưa âm thanh)** | server | `evaluateUtterance`, so khớp theo từ, bảng `evaluations`, `POST /v1/evaluations/text`, `GET /v1/evaluations/:attemptId`, collection `evaluations`, lượt `pending` / `service`. | — |
| 13 | **Âm thanh vào server** | server | recordings `lesson_task` + `attempt_id`, cổng `SpeechToText` + adapter OpenAI + mock, job `evaluation`, giới hạn / ngày, xoá sau 30 ngày, script đo độ chính xác, feature flag. | PR 12, API key OpenAI |
| 14 | **App chấm bước 5** | app | Cấu hình ghi âm, consent mới, gửi chấm (nói / viết), màn "Đang chấm…", phản hồi 4 trạng thái, nhận `evaluations` qua sync. | PR 12, 13 |
| 15 | **Đạt bài, đạt unit, ghi nhớ** | server | `passed_at` (xong phần luyện + bước 5 `pass_independent` từ `evaluations`), `unit_outcomes`, `item_memory` + lịch ôn, pull về app. | PR 12; chốt khoảng ôn |
| 16 | **App kết quả, tiến độ, ôn** | app | Bước 6 hiện "đạt bài"; tiến độ unit "đã học / đã đạt"; màn nhiệm vụ tổng hợp; ôn theo item; Today đọc `item_memory`. | PR 15 |
| 17 | **Admin** | admin | Cấu hình ngưỡng mặc định và khoảng ôn; xem lượt làm + kết quả chấm của user (nghe lại bản ghi trong 30 ngày); thống kê tỷ lệ đạt, lỗi hay gặp. | PR 12–15 |

**Số liệu còn cần team cung cấp:**
1. **API key OpenAI** dùng cho STT (có thể dùng chung key AI hiện tại).
2. **Bộ khoảng 40 bản ghi mẫu có nhãn** để đo (mục 3.3).
3. **Khoảng ôn:** đề xuất 1 – 3 – 7 – 14 – 30 ngày; "ghi nhớ ổn định" = đạt 2 lần liên tiếp ở mức ≥ 7 ngày.

Ngoài ba thứ trên, các ngưỡng và quy tắc trong file này là **mặc định đã chốt**. Chỉnh sau bằng admin (PR 17) hoặc theo số liệu đo, không cần quyết định thêm để bắt đầu code.
