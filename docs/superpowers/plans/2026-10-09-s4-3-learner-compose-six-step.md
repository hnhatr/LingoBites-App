# S4.3 – Server + app: người học "Học theo 6 bước" từ câu đã chọn

> Trạng thái: **CHỜ DUYỆT**. Chưa code. Cần S4.1 xong trước (S4.2 không bắt buộc).
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server` + `LingoBites-App`. Nhánh: `claude/affectionate-darwin-krszil` ở cả hai repo.
> Thiết kế chung ở plan S4.1. Gộp mục 4.7 của backlog (hub bài tự tạo hiện như bài curriculum).

## 1. Mục tiêu và phạm vi

Trong một bài người học đang xem (bài tự tạo từ text / OCR / YouTube, hoặc bài chung dạng hub), người học bật chế độ **"Chọn câu để học 6 bước"**, tick 1–8 câu rồi bấm **"Học theo 6 bước"**. App chờ server sinh bài (khoảng 10–30 giây), sau đó mở **bài mới** (nhãn "AI tạo") trong player 6 bước. Bài mới nằm trong thư viện "Bài của tôi", có liên kết về bài gốc.

| Trong S4.3 | Ngoài S4.3 |
|---|---|
| `POST /v1/lessons/:id/compose` cho người học | Chấm máy bước 5 (Stage 3 – PR 14). Bước 5 dùng tự đánh giá như hiện nay |
| Snapshot bài người học có spec / `lesson_items` / tasks khi bài có đặc tả | Gói trả phí, tài khoản trẻ em (Bước 1 chưa có) |
| `/v1/capabilities` trả `lessons.compose.enabled` | Stage 5 (tình huống) |
| App: chế độ chọn câu, màn chờ, mở player cho bài người học có spec (bỏ điều kiện `origin = admin`) | |
| App: bước 2 phát đúng đoạn video (`startMs` / `endMs`) với bài YouTube | |
| Hub bài sinh ra hiện các hàng như bài curriculum (4.7), chip "AI tạo", link "Bài gốc" | |
| Tắt enrich lúc tạo bài mặc định (`CREATION_ENRICH_ENABLED` mặc định `false`) | Xoá code enrich (đề xuất riêng khi dọn dẹp) |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| J1 | Bài nào người học được chọn câu | Bài người học đọc được: bài của chính họ (`origin = learner`) **và** bài chung đã publish **chưa có** 6 bước (không phải flow lesson). Bài đã là bài sinh ra thì không chọn tiếp. |
| J2 | Giới hạn | 1 bài / ngày (H12). Trúng cache không tính lượt. Hết lượt: "Hôm nay bạn đã tạo đủ bài 6 bước. Mai thử lại nhé." Nút vẫn hiện để mở bài đã sinh trúng cache. |
| J3 | Chờ kết quả | Poll `GET /v1/lesson-creations/:id` mỗi 2 giây, tối đa 60 giây trên màn; quá thì "Bài đang được tạo, sẽ có trong Bài của tôi"; kết quả về qua thư viện / poll lại khi mở app. |
| J4 | Offline | Nút tắt khi không có mạng (giống tạo bài hiện nay). Bài đã sinh tải về chạy offline như bài khác. |
| J5 | Tiến độ / lượt làm | Dùng nguyên `activity_attempts` kind `lesson` + `lesson_outcomes` (PR 8). Hiện `curriculum/outcomes/repository/lessonOutcomes.ts:35` **bỏ qua** bài `origin != admin`; đổi thành "bài có đặc tả" để bài sinh ra cũng ghi `practice_completed_at`. |
| J6 | Item của bài sinh ra trên app | Như bài curriculum: thẻ item, lưu flashcard theo item. Không vào lịch ôn item của Stage 3 (Q7 / B6: bài người học tự tạo không tính). |
| J7 | Enrich cũ | `CREATION_ENRICH_ENABLED` đổi mặc định thành `false` (user chốt 2026-10-09). Phân tích câu khi bấm (`/sentences/:id/analysis`) **giữ nguyên**. ⚠️ Bài mới tạo sẽ không còn item tự động cho ôn / quiz cho tới khi người học mở phân tích câu hoặc sinh bài 6 bước. |

## 3. Server

- `POST /v1/lessons/:id/compose`, body `{ sentence_ids: uuid[1..8] }`, header `Idempotency-Key`.
  - Quyền: người học phải đọc được bài (J1). Bài của người khác → 404 như route đọc bài.
  - 200 `{ lesson_id, cached: true }` | 202 `{ request_id }`. Lỗi: `COMPOSE_DISABLED` 403, `COMPOSE_LIMIT_REACHED` 429 (kèm `resets_at`), `COMPOSE_BUDGET_EXHAUSTED` 503, `COMPOSE_SENTENCES_INVALID` 400.
  - Poll bằng `GET /v1/lesson-creations/:id` có sẵn; `failed` có `error_code` (và `reason_vi` khi `COMPOSE_NOT_SUITABLE`).
- `postgresLessonDeliveryStore.ts:174`: thay `header.origin !== 'admin'` bằng "không có đặc tả" (bài người học **có** `can_do` / `situation` / task thì trả `spec`, `lesson_items`, `tasks`). Bài người học thường vẫn trả `spec: null, lesson_items: []` như cũ.
- `lessonOutcomes.ts:35`: đổi `if (origin !== 'admin') continue` thành "bỏ qua khi bài không có đặc tả" (J5).
- Header snapshot thêm `derived_from_lesson_id` (tuỳ chọn, nullable) và `generated: boolean` (`compose_key` khác null).
- `/v1/capabilities`: `lessons.compose = { enabled }` (`LESSON_COMPOSE_ENABLED` và chưa vượt trần tháng).
- Config: `CREATION_ENRICH_ENABLED` mặc định `false`; cập nhật `.env.example` và docs vận hành (**không** sửa `.env`).
- ⚠️ **Đổi API public:** thêm trường vào snapshot (tuỳ chọn) và capabilities → làm mới fixture `valid-lesson-snapshot-*` và SHA, chép sang app trong 1 commit fixture.

## 4. App

| Chỗ | Thay đổi |
|---|---|
| `core/schemas/lesson.ts` | Header thêm `derived_from_lesson_id?`, `generated?`; `listen_and_repeat` prompt thêm `sentenceId?`, `startMs?`, `endMs?` (`core/schemas/activityContent.ts`). Chép fixture từ server. Không đổi SQLite (snapshot lưu dạng JSON, vẫn v8). |
| `features/lesson/flow/logic/practiceCompletion.ts` | `isFlowLesson`: bỏ `origin === 'admin'`; điều kiện còn lại là có `spec` và có block đặt bước. Cập nhật test (bài learner có spec → `true`). |
| `features/lesson/player/logic/composeClient.ts` (mới) | `requestCompose(lessonId, sentenceIds)` + poll, dùng lại `Idempotency-Key` và cách poll của `canonicalLessonClient.ts`. |
| `features/lesson/player/logic/useCompose.ts` (mới) | Trạng thái: chọn câu → đang gửi → đang sinh → xong / không phù hợp / hết lượt / lỗi mạng. Đọc capability `lessons.compose.enabled`. |
| `CanonicalLessonPlayer.tsx`, `YouTubeLessonStudy.tsx` / `YouTubeSentenceCarousel.tsx` | Nút "Chọn câu để học 6 bước" → chế độ chọn nhiều (checkbox, "Đã chọn 2/8"), thanh dưới có "Học theo 6 bước". Chế độ chọn một câu để xem phân tích **giữ nguyên** khi không bật chế độ này. |
| `ComposeProgressScreen.tsx` (mới, hoặc sheet) | "Đang tạo bài 6 bước…", nút huỷ chờ (không huỷ request), xong thì `navigate` tới hub bài mới. |
| `CanonicalLessonHub.tsx` | Bài `generated`: chip "AI tạo", link "Bài gốc"; hiện các hàng item / mẫu câu / task như bài curriculum (4.7) vì snapshot đã có `lesson_items`. |
| `ListenRepeatActivity.tsx` | Bài có `youtube` và prompt có `startMs` / `endMs` → phát đoạn bằng `YouTubePlayer` có sẵn (seek + dừng ở `endMs`); không có thì giữ TTS như hiện nay. |
| `LibraryListScreen.tsx` | Bài sinh ra nằm trong "Bài của tôi" với chip "6 bước · AI tạo". |
| i18n `vi` / `en` | Chuỗi mới cho nút, màn chờ, lỗi (J2, `COMPOSE_NOT_SUITABLE`, trần chi phí). |

Không thêm thư viện; dùng `YouTubePlayer`, client HTTP và poll có sẵn.

## 5. Kiểm thử

| Repo | Nội dung |
|---|---|
| Server DB `learnerLessonCompose.test.ts` | 202 → bài learner `published`, owner đúng; snapshot của bài sinh ra có spec / items / tasks; bài learner thường vẫn `spec: null`; bài người khác 404; giới hạn ngày 429; cache 200 không tính lượt; `NOT_SUITABLE` không tính lượt; capability bật / tắt; push `activity_attempts` cho bài learner tính `practice_completed_at`. |
| Server unit | Config `CREATION_ENRICH_ENABLED` mặc định `false`; pipeline tạo bài không gọi enrich khi tắt. |
| App Jest | `isFlowLesson` cho bài learner có spec; `useCompose` các trạng thái (giả lập client); chế độ chọn câu giới hạn 8; `ListenRepeatActivity` có / không có đoạn video; hub hiện chip "AI tạo"; parse fixture snapshot mới. |
| App kiểm tay (máy thật) | Tạo bài từ text → chọn 3 câu → học trọn 6 bước; bài YouTube → bước 2 phát đúng đoạn; tắt mạng sau khi tải bài → vẫn học được. |

Lệnh app: `yarn tsc`, `yarn lint` (không vượt ngân sách warning 281), `yarn format:check`, `yarn test` (mục tiêu không giảm 2198 pass). Server: `yarn test`, `yarn test:db`.

## 6. Thứ tự commit

**Server**
1. `feat(compose): learner compose route, limit and capability`.
2. `feat(delivery): learner lessons with a spec ship spec, items and tasks`.
3. `chore(config): creation enrich off by default`.
4. `test: refresh snapshot fixture for derived lessons`.

**App**
5. `chore(fixtures): copy derived-lesson snapshot fixture from server`.
6. `feat(lesson): six-step player runs learner lessons with a spec`.
7. `feat(lesson): select sentences and compose a six-step lesson`.
8. `feat(lesson): listen and repeat plays the source video clip`.
9. `feat(lesson): hub and library mark AI-made six-step lessons`.
10. `docs: S4.1–S4.3 plans marked implemented; remaining-work plan progress`.

## 7. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Đổi điều kiện `isFlowLesson` mở player cho bài learner cũ | Bài learner cũ không có `spec` nên vẫn `false`; có test. |
| Tắt enrich làm giảm item cho ôn / quiz của bài tự tạo | Ghi rõ ở J7; đổi lại được bằng env nếu cần. |
| Người học chờ lâu | Màn chờ tối đa 60 giây, bài vẫn về thư viện khi xong. |
| Phát đoạn YouTube không chính xác trên máy yếu | Dừng theo `endMs` với sai số ±300 ms; kiểm tay trên máy thật. |
