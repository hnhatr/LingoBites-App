# PR 14 – App: chấm bước 5 (nói và viết)

> Trạng thái: **ĐÃ CODE**: H1–H13 đã duyệt (2026-10-09). App `ddf73164` → `f92fef34` (7 commit). Xem §7 cho kết quả và các điểm lệch. **Chưa test trên máy thật** (§4).
> Ngày lập: 2026-10-09. Repo: `LingoBites-App`. Nhánh: `claude/funny-archimedes-gmioda`.
> Thuộc Giai đoạn 1 (`2026-10-09-phase1-stage3-plan.md` §6). Cần trước: PR 12, 13, 15 (server, đã code). Câu consent T4 đã OK.

## 1. Mục tiêu và phạm vi

Sau PR này, ở bước 5 (và nhiệm vụ tổng hợp, khi PR 16 có màn):
- **Câu viết** (task `write`, hoặc "viết thay nói") gửi lên server chấm và hiện kết quả ngay.
- **Câu nói** ghi âm, upload rồi chờ chấm. Chỉ khi server bật chấm nói cho tài khoản **và** người học đồng ý consent.
- Không có consent, hoặc server chưa bật: giữ **tự đánh giá** như hiện nay. Ghi âm và nghe lại vẫn chỉ ở trên máy.
- Kết quả hiện theo 4 trạng thái. Nếu đã rời màn hoặc mất mạng, kết quả về sau qua sync.

| Trong PR 14 | Ngoài PR 14 |
|---|---|
| Schema sync: `pending`, `service`, `recording_client_id`; collection `evaluations` | `lesson_outcomes`, `unit_outcomes`, `item_memory` (PR 16) |
| Bảng SQLite `task_answers` (v8 → v9) + áp `evaluations` khi pull | Bước 6 "đạt bài", tiến độ unit, ôn (PR 16) |
| Consent "Chấm bài nói bằng máy" + bật / tắt trong Cài đặt | Consent phụ huynh (Bước 1) |
| Ghi âm bài tập AAC mono 16 kHz ~32 kbps, upload mode `lesson_task` | Màn nhiệm vụ tổng hợp (PR 16; hàm gửi chấm viết sẵn ở đây) |
| "Đang chấm…" (hỏi mỗi 2 giây, tối đa 20 giây) + phản hồi 4 trạng thái | Admin nghe lại (PR 17) |
| Nút "Không nói được lúc này" (A13) | |
| Task bước 5 `response_mode = choose` (nợ 2.8) | Ghi âm từng lượt nhập vai (nợ 2.9, xem H12) |

## 2. Quyết định cần xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| H1 | **Lưu lượt gửi chấm ở đâu?** | Bảng SQLite mới `task_answers` (nâng schema **v8 → v9**), một dòng mỗi lượt. Các cột:<br>- `attempt_id`, `owner_user_id`;<br>- đích (`lesson_id` + `block_id`, hoặc `unit_id` + `task_id`);<br>- `source` (`speech` / `text`), `substitute`, `support_level`;<br>- `recording_id` (trỏ `speaking_recordings`);<br>- `pending_text` (chỉ khi gửi viết lúc mất mạng, xoá ngay khi gửi xong);<br>- `state` (`waiting_upload` / `sent` / `evaluated`);<br>- `evaluation_json`, thời gian.<br>Lượt làm vẫn ghi vào `activity_attempts` với `pending` / `service` như contract PR 12. |
| H2 | **Upload câu nói** | Dùng lại hàng đợi upload hiện có (`recordingUploadQueue`). Dòng `speaking_recordings` mode `lesson_task` (cột `activity_id` = `attempt_id`) lấy đích và mức gợi ý từ `task_answers` để dựng request `lesson_task` (fixture PR 13). Hàng đợi kiểm **consent chấm bài**, không phải consent tải bản ghi. **File trên máy xoá ngay khi upload xong** (server giữ 30 ngày). Người học nghe lại được trước khi bấm "Gửi chấm", sau đó thì không. |
| H3 | **Gửi câu viết** | Online: `POST /v1/evaluations/text`, kết quả hiện ngay. Offline: lưu `pending_text` trên máy và gửi lại khi có mạng (cùng lúc với lần sync kế tiếp); gửi xong thì xoá chữ. Chữ không rời máy cho tới khi gửi chấm, và không được ghi vào log. |
| H4 | **Chờ kết quả câu nói** (A8) | Sau khi upload: hỏi `GET /v1/evaluations/:attemptId` mỗi 2 giây, tối đa 20 giây. Quá 20 giây thì hiện "Kết quả sẽ có khi có mạng"; kết quả về sau qua sync (`evaluations`). Rời màn thì ngừng hỏi. |
| H5 | **Có được chấm nói không?** | Gọi `GET /v1/evaluations/capabilities` (PR 13) khi mở bước 5, nhớ kết quả trong `app_settings` để dùng khi offline. Lỗi hoặc chưa từng hỏi → coi là chưa bật (tự đánh giá). |
| H6 | **Consent** (T4, A12) | - Khoá `speaking.evaluation_consent` (`on` / `off` / `undecided`), tách khỏi `speaking.recording_upload_consent`.<br>- Hỏi lần đầu khi bước 5 có chấm nói. Câu chữ §5.7.2; hai nút "Đồng ý" / "Tự đánh giá".<br>- Từ chối thì ghi `speaking.evaluation_consent_asked_at`, chỉ hỏi lại sau 7 ngày.<br>- Dòng bật / tắt trong `DataSettingsScreen`, cạnh dòng bản ghi hiện có.<br>- Tắt consent: lượt chưa upload chuyển về tự đánh giá; file trên máy bị xoá. |
| H7 | **Tài khoản trẻ em** (A11) | Chưa có trường đối tượng (Bước 1) nên coi mọi tài khoản là người lớn. Server chỉ bật cho danh sách nội bộ, nên trong giai đoạn này không lộ ra người dùng thật. |
| H8 | **"Không nói được lúc này"** (A13) | - Nút ở bước 3–5. Bấm → lưu `lesson.no_speaking_until = now + 15 phút`.<br>- Trong 15 phút đó, hoạt động nói ở bước 3–4 có nút "Bỏ qua phần nói". Bỏ qua **không** ghi lượt làm, nên phần luyện chưa xong cho tới khi nói lại.<br>- Bước 5 task `speak` chuyển sang ô nhập và gửi chấm viết với `substitute = true`. Kết quả ghi "Đạt (viết thay nói)", **chưa** tính đạt bài.<br>- Có nút "Nói được rồi" để tắt sớm. |
| H9 | **Phản hồi 4 trạng thái** | Component mới `EvaluationFeedback`:<br>- **đạt**: "Bạn đã tự làm được" + tiêu chí đạt;<br>- **đạt có gợi ý**: "Đạt, nhưng còn cần gợi ý" + "Thử lại không gợi ý";<br>- **chưa đạt**: lỗi chính (`feedback_vi` hoặc tên tiêu chí), từ còn thiếu, câu tham khảo + "Luyện phần liên quan" (về bước 3) và "Thử lại";<br>- **không chấm được**: "Chưa nghe rõ, thử lại nhé" + lý do (`limit` → "Hôm nay đã hết lượt chấm").<br>Nhãn kết quả cũ của tự đánh giá giữ nguyên. |
| H10 | **Lượt `pending` không có kết quả** | Server có thể đóng job mà không có kết quả (bài bị xoá, PR 13 §10). Quá 24 giờ vẫn `pending` → coi là "chưa chấm được", cho làm lại. |
| H11 | **Task bước 5 `choose`** (nợ 2.8) | Bước 5 có task `response_mode = choose`: chạy hoạt động chọn của block (`multiple_choice` / `fill_blank` có `options`) **không có gợi ý**, app tự chấm (`assessed_by = rule`). Không gửi server. Seed chưa có ca này nên test bằng fixture. |
| H12 | **Ghi âm từng lượt nhập vai** (nợ 2.9) | **Hoãn.** Server chấm một file mỗi lượt làm, và bộ chấm đã tìm được từng câu trong cả đoạn nói (PR 12, so khớp theo cửa sổ). Ghi từng lượt sẽ cần nhiều file cho một lượt làm. Xem lại sau khi đo T2. |
| H13 | **Cấu hình ghi âm** | Chỉ bản ghi bài tập dùng AAC, mono, 16 kHz, ~32 kbps (`audioSet` của `react-native-audio-recorder-player`). Shadowing giữ cấu hình hiện tại. Tối đa 45 giây (bước 5) / 90 giây (tổng hợp): dừng tự động khi hết giờ. |

## 3. File

**Sửa:**
- `src/core/schemas/sync.ts`: §3.1 của plan giai đoạn; `EvaluationPayloadSchema`; thêm `evaluations` vào danh sách collection pull đã biết.
- `src/core/schemas/recordings.ts`: request `lesson_task`; view có `attempt_id` / `target`.
- `src/core/db/migrations.ts` (+ `types.ts`): v9, bảng `task_answers`.
- `src/features/sync/logic/pullWorker.ts`: áp collection `evaluations` vào `task_answers`. Có dòng thì cập nhật; chưa có (lượt làm từ máy khác) thì tạo dòng chỉ chứa kết quả.
- `src/features/speaking/logic/recordingService.ts`: tham số cấu hình ghi cho bài tập (H13).
- `src/features/speaking/logic/upload/recordingConsent.ts`: consent chấm bài (H6).
- `src/features/speaking/logic/upload/recordingUploadQueue.ts`: dòng `lesson_task` (H2).
- `src/features/speaking/logic/api/recordingClient.ts`: request `lesson_task`.
- `src/features/lesson/flow/components/IndependentTaskView.tsx`: ba nhánh (chấm máy / tự đánh giá / viết thay nói) + chọn (H11).
- `src/features/lesson/flow/logic/useSelfCheckRecorder.ts`: chế độ "giữ file để gửi".
- `src/features/lesson/flow/logic/useLessonFlow.ts`, `ActivityRunner.tsx`: H8.
- `src/features/profile/screens/DataSettingsScreen.tsx` (+ component dòng cài đặt trong `speaking`, như `SpeakingRecordingsSettingsRow`): dòng consent.
- `src/core/i18n/{vi,en}.json`: khoá mới.

**Thêm:**
- `src/core/sync/taskAnswers.ts`: ghi / đọc `task_answers`, áp kết quả.
- `src/features/lesson/flow/logic/evaluationClient.ts`: `POST` câu viết, `GET` kết quả, `GET` capabilities.
- `src/features/lesson/flow/logic/useTaskEvaluation.ts`: luồng gửi chấm → chờ → kết quả (H3, H4, H10).
- `src/features/lesson/flow/logic/noSpeaking.ts`: H8.
- `src/features/lesson/flow/components/EvaluationFeedback.tsx`, `EvaluationConsentPrompt.tsx`.
- Test cho từng file trên (`__tests__`).

**Xoá:** không. **Dependency mới:** không (dùng `react-native-audio-recorder-player` có sẵn).

## 4. Kiểm thử (Jest)

| Test | Nội dung |
|---|---|
| Schema / contract | Parse 3 fixture của PR 12–13 (lượt `pending`, pull `evaluations`, request `lesson_task`); payload app tạo ra khớp schema server |
| `migrations` | v8 → v9 giữ dữ liệu cũ; bảng mới đúng cột |
| `taskAnswers` / `pullWorker` | Áp `evaluations`: dòng có sẵn → cập nhật; từ máy khác → tạo mới; record lặp không đổi |
| `recordingUploadQueue` | Dòng `lesson_task` dựng đúng request; consent chấm tắt → không upload; upload xong → xoá file; consent bản ghi cũ không ảnh hưởng |
| `recordingConsent` | Ba trạng thái; hỏi lại sau 7 ngày; tắt trong Cài đặt |
| `useTaskEvaluation` | - viết online → kết quả;<br>- viết offline → giữ chữ, gửi lại, xoá chữ;<br>- nói: hỏi 2 giây / 20 giây, 404 rồi có kết quả;<br>- hết 20 giây → "khi có mạng";<br>- `pending` quá 24 giờ |
| `IndependentTaskView` | - có consent + server bật → "Gửi chấm", không có checklist;<br>- không consent / chưa bật → tự đánh giá như cũ;<br>- viết thay nói → ô nhập + `substitute`;<br>- task `choose` → chọn, không gợi ý, `rule` |
| `EvaluationFeedback` | 4 trạng thái, lý do `limit`, nút "Luyện phần liên quan" / "Thử lại" |
| `noSpeaking` | 15 phút, "Nói được rồi", bỏ qua không ghi lượt |

**Kiểm cuối:** `yarn tsc`, `yarn lint` (không nâng ngân sách warning), `yarn format:check` (lỗi `package.json` có sẵn), `yarn test`.

**Test tay trên máy thật** (Giai đoạn 0 + mục này, cần staging đã deploy PR 12–15–13 và tài khoản nội bộ trong `SPEECH_EVALUATION_USER_IDS`):
1. Ghi âm bước 5 L01 → "Đang chấm…" → kết quả đúng.
2. Tắt mạng sau khi ghi → mở lại → kết quả về qua sync.
3. Từ chối consent → tự đánh giá; sau 7 ngày được hỏi lại; bật lại trong Cài đặt.
4. L03 viết đúng / thiếu món / sai mẫu.
5. "Không nói được lúc này" ở L01.

## 5. Thứ tự commit

1. `feat(sync): pending service-assessed attempts and evaluation results` (schema + `task_answers` v9 + pull).
2. `feat(speaking): evaluation consent and lesson task recordings` (consent, cấu hình ghi, hàng đợi).
3. `feat(lesson): send step-5 answers for grading` (client, `useTaskEvaluation`, `IndependentTaskView`, `EvaluationFeedback`, consent prompt).
4. `feat(lesson): can't speak right now` (H8).
5. `feat(lesson): independent choose tasks` (H11).
6. `feat(settings): speech grading consent row`.
7. `docs: mark PR 14 plan as implemented`.

## 6. Rủi ro

- ⚠️ **Nâng schema SQLite v8 → v9** (thêm bảng, không sửa bảng cũ).
- ⚠️ **Gửi dữ liệu ra ngoài:** file giọng nói tới server rồi OpenAI; chữ viết tới server. Chỉ sau consent (giọng nói), và server chỉ bật cho tài khoản nội bộ. Trước khi bật cho mọi người: chính sách quyền riêng tư + khai báo store (T4).
- **Chỉ test tự động được phần logic.** Ghi âm, quyền micro, upload nền và cấu hình AAC 16 kHz cần **test tay trên máy thật** (§4).
- **Bỏ qua phần nói** (H8) làm phần luyện chưa xong. Đây là có chủ đích (A13): nói lại sau mới tính.
- **Hoãn 2.9** (H12): nhập vai nhiều lượt vẫn ghi một file cho cả đoạn.

## 7. Kết quả code và điểm lệch so với plan

**Kiểm tra cuối:**
- `tsc` sạch;
- `yarn lint`: 178/281 (không nâng ngân sách, không quy tắc nào vượt);
- kiểm ranh giới module: không có vi phạm mới;
- `yarn format:check`: chỉ còn `package.json` (lỗi có sẵn, file không đổi);
- Jest: 2242 pass (trước 2206), 3 skip.

**Chưa kiểm:** chưa test trên máy thật: ghi âm, quyền micro, upload nền, AAC 16 kHz, kết quả qua sync. Cần làm theo danh sách §4 trên staging, với tài khoản nội bộ có trong `SPEECH_EVALUATION_USER_IDS`.

**Điểm lệch so với plan:**
- **Thứ tự commit:**
  - H11 (task `choose` ở bước 5) vào commit 3, bằng một luật trong `hintLadder`: task `independent` không có gợi ý nào. Bước 5 dạng chọn vì vậy chạy không gợi ý, app tự chấm (`rule`). Không có commit 5 riêng.
  - Thêm 1 commit dọn format / lint.
- **Task viết (`response_mode = write`) luôn gửi server chấm.** Không còn nhánh tự đánh giá cho câu viết. Mất mạng thì câu viết được giữ trên máy và tự gửi lại mỗi khi app trở lại màn hình chính (`initWrittenAnswerQueue` trong `App.tsx`), không phải theo lần sync.
- **Server từ chối câu viết** (4xx, ví dụ bài bị xoá): bỏ câu trả lời, màn hình hiện "Chưa chấm được lượt này", cho làm lại.
- **`RecorderControls`** nhận được bộ ghi của component cha.
- **`useSelfCheckRecorder`** có thêm:
  - `forGrading`: ghi bằng cấu hình bài tập;
  - `maxMs`: tự dừng sau 45 giây;
  - `release()`: giao file cho hàng đợi upload, không xoá khi rời màn.
- **Danh sách bản ghi luyện nói** (`listSpeakingRecordings`) không còn trả bản ghi `lesson_task`.
- **Client recordings** có thêm tuỳ chọn `consent` (`upload` / `evaluation`). Bản ghi luyện nói vẫn gọi y như cũ.
- **Dòng Cài đặt "Chấm bài nói bằng máy"** viết chữ tiếng Việt trực tiếp, như dòng bản ghi có sẵn bên cạnh (chưa qua i18n). Tắt thì xoá các câu nói **chưa upload**; câu đã upload vẫn chờ kết quả.
- **Nhiệm vụ tổng hợp:** hàm gửi chấm đã nhận đích `unit_id + task_id`, nhưng chưa có màn (PR 16).
- **H12** (ghi âm từng lượt nhập vai): hoãn như đã duyệt.

