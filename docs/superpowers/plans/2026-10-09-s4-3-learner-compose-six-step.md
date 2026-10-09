# S4.3 – Server + app: người học "Học theo 6 bước" từ câu đã chọn

> Trạng thái: **ĐÃ CODE 2026-10-09** (xem §8). Duyệt 2026-10-09 (quyết định dùng đề xuất). Cần S4.1 xong trước (S4.2 không bắt buộc).
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server` + `LingoBites-App`. Nhánh: `claude/affectionate-darwin-krszil` ở cả hai repo.
> Thiết kế chung ở plan S4.1. Gộp mục 4.7 của backlog (hub bài tự tạo hiện như bài curriculum).

## 1. Mục tiêu và phạm vi

Trong một bài người học đang xem (bài tự tạo từ text / OCR / YouTube, hoặc bài chung dạng hub), người học bật chế độ **"Chọn câu để học 6 bước"**, tick 2–8 câu rồi bấm **"Học theo 6 bước"**. App chờ server sinh bài (khoảng 10–30 giây), sau đó mở **bài mới** (nhãn "AI tạo") trong player 6 bước. Bài mới nằm trong thư viện "Bài của tôi", có liên kết về bài gốc.

| Trong S4.3 | Ngoài S4.3 |
|---|---|
| `POST /v1/lessons/:id/compose` cho người học | Chấm máy bước 5 (Stage 3 – PR 14). Bước 5 dùng tự đánh giá như hiện nay |
| Snapshot bài người học có spec / `lesson_items` / tasks khi bài có đặc tả | Gói trả phí, tài khoản trẻ em (Bước 1 chưa có) |
| `/v1/capabilities` trả `lessons.compose.enabled` | Stage 5 (tình huống) |
| App: chế độ chọn câu, màn chờ, mở player cho bài người học có spec (bỏ điều kiện `origin = admin`) | |
| App: bước 2 phát đúng đoạn video (`startMs` / `endMs`) với bài YouTube | |
| Hub bài sinh ra hiện các hàng như bài curriculum (4.7), chip "AI tạo", link "Bài gốc" | |
| Enrich lúc tạo bài **giữ bật** như hiện nay (J7) | Đổi mặc định hoặc xoá code enrich |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| J1 | Bài nào người học được chọn câu | Bài người học đọc được: bài của chính họ (`origin = learner`) **và** bài chung đã publish **chưa có** 6 bước (không phải flow lesson). Bài đã là bài sinh ra thì không chọn tiếp. |
| J2 | Giới hạn | Theo từng tài khoản (H12; mặc định 1 / ngày). Chỉ lượt có gọi AI mới tính; trúng cache, bị lọc trước không tính. Màn chọn câu hiện "Còn N lượt hôm nay". Hết lượt: "Hôm nay bạn đã tạo đủ bài 6 bước. Mai thử lại nhé." Nút vẫn mở được bài đã sinh trúng cache. |
| J8 | Câu lạc quẻ (H7) | - Lọc trước ngay trên app (cùng luật §3.1 S4.1): nút tắt kèm "Hãy chọn thêm câu có nội dung".<br>- Chọn các câu cách xa nhau (> 3 câu) → nhắc nhẹ "Nên chọn các câu liền nhau trong cùng đoạn", vẫn cho gửi.<br>- `COMPOSE_NOT_SUITABLE` → hiện `reason_vi` + `suggestion_vi`, **giữ nguyên lựa chọn** để người học sửa.<br>- Bài có câu bị bỏ → "Đã bỏ N câu không cùng tình huống".<br>- `situation_source = inferred` → chip "Tình huống do AI gợi ý" trên hub. |
| J3 | Chờ kết quả | **Không chặn người học** (thay thiết kế chờ 60 giây): sheet tiến độ đóng được, nghe trước các câu đã chọn, thẻ "Đang tạo bài" ở Thư viện / Hôm nay, lưu request chờ qua lần mở app, toast khi xong, bảng lỗi rõ ràng có ghi "có / không bị tính lượt". Xem `2026-10-09-s4-compose-wait-ux-design.md` §3. |
| J4 | Offline | Nút tắt khi không có mạng (giống tạo bài hiện nay). Bài đã sinh tải về chạy offline như bài khác. |
| J5 | Tiến độ / lượt làm | Dùng nguyên `activity_attempts` kind `lesson` + `lesson_outcomes` (PR 8). Hiện `curriculum/outcomes/repository/lessonOutcomes.ts:35` **bỏ qua** bài `origin != admin`; đổi thành "bài có đặc tả" để bài sinh ra cũng ghi `practice_completed_at`. |
| J6 | Item của bài sinh ra trên app | Như bài curriculum: thẻ item, lưu flashcard theo item. Không vào lịch ôn item của Stage 3 (Q7 / B6: bài người học tự tạo không tính). |
| J7 | Enrich cũ | **Giữ bật** (user chốt lại 2026-10-09): bài tự tạo vẫn có từ vựng / ngữ pháp cho hub, quiz, ôn ngay khi tạo. Tắt được bằng env `CREATION_ENRICH_ENABLED=false` (không cần sửa code). Composer dùng lại phân tích đã lưu của câu đã chọn (S4.1 H4). |

## 3. Server

- `POST /v1/lessons/:id/compose`, body `{ sentence_ids: uuid[2..8] }`, header `Idempotency-Key`.
  - Quyền: người học phải đọc được bài (J1). Bài của người khác → 404 như route đọc bài.
  - 200 `{ lesson_id, cached: true }` | 202 `{ request_id }`. Lỗi: `COMPOSE_DISABLED` 403, `COMPOSE_LIMIT_REACHED` 429 (kèm `resets_at`, `limit`, `used`), `COMPOSE_SENTENCES_TOO_THIN` 400, `COMPOSE_BUDGET_EXHAUSTED` 503, `COMPOSE_SENTENCES_INVALID` 400.
  - Poll bằng `GET /v1/lesson-creations/:id` có sẵn; `failed` có `error_code` (và `reason_vi` khi `COMPOSE_NOT_SUITABLE`).
- `postgresLessonDeliveryStore.ts:174`: thay `header.origin !== 'admin'` bằng "không có đặc tả" (bài người học **có** `can_do` / `situation` / task thì trả `spec`, `lesson_items`, `tasks`). Bài người học thường vẫn trả `spec: null, lesson_items: []` như cũ.
- `lessonOutcomes.ts:35`: đổi `if (origin !== 'admin') continue` thành "bỏ qua khi bài không có đặc tả" (J5).
- `GET /v1/lessons/:id/compose-quota` → `{ limit, used, resets_at }` cho dòng "Còn N lượt hôm nay".
- Header snapshot thêm `situation_source` (nullable), `derived_from_lesson_id` (tuỳ chọn, nullable) và `generated: boolean` (`compose_key` khác null).
- `/v1/capabilities`: `lessons.compose = { enabled }` (`LESSON_COMPOSE_ENABLED` và chưa vượt trần tháng).
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
| Server DB `learnerLessonCompose.test.ts` | 202 → bài learner `published`, owner đúng; snapshot của bài sinh ra có spec / items / tasks; bài learner thường vẫn `spec: null`; bài người khác 404; giới hạn ngày 429; cache 200 không tính lượt; `NOT_SUITABLE` **có** tính lượt (đã gọi AI); bị lọc trước không tính; giới hạn theo `users.compose_daily_limit`; capability bật / tắt; push `activity_attempts` cho bài learner tính `practice_completed_at`. |
| App Jest | `isFlowLesson` cho bài learner có spec; `useCompose` các trạng thái (giả lập client); chế độ chọn câu giới hạn 8; `ListenRepeatActivity` có / không có đoạn video; hub hiện chip "AI tạo"; parse fixture snapshot mới. |
| App kiểm tay (máy thật) | Tạo bài từ text → chọn 3 câu → học trọn 6 bước; bài YouTube → bước 2 phát đúng đoạn; tắt mạng sau khi tải bài → vẫn học được. |

Lệnh app: `yarn tsc`, `yarn lint` (không vượt ngân sách warning 281), `yarn format:check`, `yarn test` (mục tiêu không giảm 2198 pass). Server: `yarn test`, `yarn test:db`.

## 6. Thứ tự commit

**Server**
1. `feat(compose): learner compose route, limit and capability`.
2. `feat(delivery): learner lessons with a spec ship spec, items and tasks`.
3. `test: refresh snapshot fixture for derived lessons`.

**App**
4. `chore(fixtures): copy derived-lesson snapshot fixture from server`.
5. `feat(lesson): six-step player runs learner lessons with a spec`.
6. `feat(lesson): select sentences and compose a six-step lesson`.
7. `feat(lesson): listen and repeat plays the source video clip`.
8. `feat(lesson): hub and library mark AI-made six-step lessons`.
9. `docs: S4.1–S4.3 plans marked implemented; remaining-work plan progress`.

## 7. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Đổi điều kiện `isFlowLesson` mở player cho bài learner cũ | Bài learner cũ không có `spec` nên vẫn `false`; có test. |
| Người học chờ lâu | Màn chờ tối đa 60 giây, bài vẫn về thư viện khi xong. |
| Phát đoạn YouTube không chính xác trên máy yếu | Dừng theo `endMs` với sai số ±300 ms; kiểm tay trên máy thật. |

## 8. Kết quả code và điểm lệch so với plan

> Code ngày 2026-10-09. Server `fa97866`, `7577c52`; app `52ff3c9` → `ff6c99c` (nhánh `claude/affectionate-darwin-krszil` ở cả hai repo). Chưa mở PR.

**Đã làm**

| Phần | File chính |
|---|---|
| `POST /api/v1/lessons/:id/compose` cho người học (J1: bài của mình hoặc bài chung đã publish chưa có 6 bước; bài người khác 404), `GET /api/v1/lessons/compose-quota`, `GET /api/v1/lesson-creations?kind=compose&active=true` | Server `curriculum/composer/controller/composeRoutes.ts` |
| `/v1/capabilities` có `lessons.compose.enabled` (bật env **và** còn ngân sách tháng) | Server `app/controller/capabilities.ts`, `app/server.ts`, `composePipeline.ts` (`available()`) |
| Snapshot bài người học **có đặc tả** trả `spec` / `lesson_items` / `tasks`; bài người học sinh ra có thêm `generated`, `derived_from_lesson_id`, `situation_source` | Server `postgresLessonDeliveryStore.ts`, `lessonDeliveryService.ts`, `canonicalLesson/model/lesson.ts` |
| Lượt làm trên bài người học có đặc tả (của chính họ) ghi `practice_completed_at` (J5) | Server `outcomes/repository/lessonOutcomes.ts` |
| Fixture mới `valid-lesson-snapshot-composed-response.json` (SHA ghim ở cả hai repo) | Server `canonicalLesson/model/fixtures*`, app `core/schemas/fixtures.ts` |
| App: schema snapshot / `listen_and_repeat` (`sentenceId`, `startMs`, `endMs`) / tiến độ compose; `isFlowLesson` bỏ điều kiện `origin = admin` | `core/schemas/*`, `flow/logic/practiceCompletion.ts` |
| App: client compose, luật lọc câu giống server (J8), bộ theo dõi request (zustand + AsyncStorage, gộp danh sách đang chạy từ server), hook chọn câu | `player/logic/composeClient.ts`, `composePick.ts`, `composeTracker.ts`, `useComposePick.ts` |
| App: sheet "Chọn câu để học 6 bước" (chọn 2–8, "Còn N lượt hôm nay", nhắc câu cách xa, lỗi theo mã, tiến độ thật theo stage, "Nghe trước", "Để đó, học tiếp", kết quả / lỗi có ghi "có / không bị tính lượt" theo `quota_charged`) | `player/components/ComposeSheet.tsx` |
| App: lối vào ở hub (bài văn bản) và nút trên header (bài YouTube); bài 6 bước mở ở hub kể cả khi từ video; chip "AI tạo", "Tình huống do AI gợi ý", link "Bài gốc" | `CanonicalLessonHub.tsx`, `CanonicalLessonPlayerScreen.tsx` |
| App: chạy nền — poll 5 giây khi app ở trước (dừng khi ở nền, kiểm ngay khi quay lại), tự tải bài xong vào thư viện, banner "Bài 6 bước đã sẵn sàng · Mở"; thẻ "Đang tạo bài" ở "Bài học của tôi" / "Video của tôi" và Hôm nay; nhãn thẻ thư viện "6 bước · AI tạo" | `ComposeTrackerHost.tsx`, `ComposeRequestCards.tsx`, `AppNavigator.tsx`, `LibraryListScreen.tsx`, `TodayScreen.tsx`, `useLibrarySegments.ts` |
| App: bước 2 "Nghe đoạn gốc" phát đúng đoạn video (seek + dừng ở `endMs`), TTS giữ làm dự phòng | `flow/components/SourceClipPlayer.tsx`, `flow/logic/sourceClip.ts`, `ListenRepeatActivity.tsx` |

**Điểm lệch**

| # | Plan | Đã làm | Lý do |
|---|---|---|---|
| N1 | `POST /v1/lessons/:id/compose`, `GET /v1/lessons/:id/compose-quota`, 202 `{ request_id }` | `/api/v1/lessons/:id/compose`, `/api/v1/lessons/compose-quota` (giới hạn theo tài khoản, không theo bài), 202 giống route tạo bài `{ contract_version, request: { id, status } }` | Các route người học về bài đều nằm dưới `/api/v1`; app dùng lại parser có sẵn. |
| N2 | 429 kèm `resets_at`, `limit`, `used` | Có, nằm trong khoá `details` của envelope lỗi. ⚠️ Sửa luôn lỗi của S4.1/S4.2: trước đó server ghi `detail` nên bị schema response bỏ mất | Envelope lỗi chung chỉ có `details`. |
| N3 | — | Mã mới `COMPOSE_ALREADY_SIX_STEP` (409) khi chọn câu trong bài đã có 6 bước (bài chung hoặc bài đã sinh) | J1. |
| N4 | Header snapshot thêm 3 trường (tuỳ chọn) | Chỉ có trên **bài người học sinh ra**; bài khác không có các khoá này | App cũ parse snapshot `.strict()`: bài thường vẫn đọc được. Bài admin sinh ra (S4.2) không mang các trường này. |
| N5 | "Bài có đặc tả" | = bài admin, hoặc có `can_do` / `situation`. Ghi lượt chỉ cho bài người học **của chính họ** | Định nghĩa đơn giản, không thêm truy vấn task. |
| N6 | Chế độ chọn nhiều ngay trong player / carousel YouTube | Sheet chọn câu riêng, mở từ hub hoặc header | Không đụng chế độ chọn một câu để xem phân tích; một chỗ cho cả bài văn bản và video. |
| N7 | — | ⚠️ Mọi bài 6 bước (có spec + bước) mở ở hub kể cả `source_type = youtube`, gồm cả bài admin từ video | Trước đó bài video mở thẳng màn học video, không có nút "Học theo 6 bước". Cần xem lại trên máy thật. |
| N8 | "Nghe trước" đọc lần lượt (TTS hoặc đoạn video) | Danh sách câu đã chọn, chạm câu nào nghe câu đó (TTS) | `speak` không báo khi đọc xong nên không nối được tự động; không ghi lượt làm. |
| N9 | Toast + chấm "Mới" trên thẻ bài | Banner trong app (app chưa có thư viện toast); **chưa có chấm "Mới"** | Không thêm thư viện. |
| N10 | — | Bài xong được tải về ngay (chưa kèm media) để có trong thư viện dù chưa mở; bài sinh từ video nằm ở "Video của tôi" | J3 "bài vẫn về thư viện". Media tải khi mở bài như mọi bài khác. |
| N11 | — | Đăng ký route capabilities chuyển xuống sau phần dựng compose trong `server.ts` | Cần service compose để đọc ngân sách tháng. |

**Kiểm tra đã chạy (2026-10-09)**

| Lệnh | Kết quả | Trước S4.3 |
|---|---|---|
| Server `yarn test` | 462 pass, 0 fail | 461 |
| Server `yarn test:db` (thêm `learnerLessonCompose.test.ts`) | 251 pass, 0 fail | 250 |
| Server `yarn typecheck`, `yarn format` | xanh | xanh |
| Server `eslint src test` | còn 1 lỗi **có sẵn** `test/ipa.test.ts:84` | như cũ |
| App `yarn test` (Jest) | 2234 pass, 3 skip, 0 fail | 2198 |
| App `npx tsc`, kiểm module boundary | xanh | xanh |
| App `yarn lint` (ngân sách warning) | đạt; `has-accessibility-hint` 82/84 | — |
| App `yarn format:check` | chỉ còn `package.json` (có sẵn, không đổi) | như cũ |

**Chưa kiểm được:** chạy với AI thật (không có key); kiểm tay trên máy thật (tạo bài text → chọn 3 câu → học trọn 6 bước; bài YouTube → bước 2 phát đúng đoạn, sai số ±300 ms; tắt mạng sau khi tải; khoá màn hình rồi mở lại thấy banner).

