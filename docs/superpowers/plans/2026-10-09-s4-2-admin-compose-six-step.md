# S4.2 – Server + admin: "Sinh bài 6 bước" từ câu đã chọn

> Trạng thái: **ĐÃ CODE** (2026-10-09). Xem §8 cho kết quả và điểm lệch.
> Ngày lập: 2026-10-09. Repo: `LingoBites-Server` (server + `admin-web`). Nhánh: `claude/affectionate-darwin-krszil`.
> Thiết kế chung (chọn câu → bài mới, 1 lần gọi AI, item tự publish) ở plan S4.1.

## 1. Mục tiêu và phạm vi

Admin mở một bài có câu (bài admin từ text / YouTube, hoặc bài người học xem qua `UserLessonPanel`), **tick chọn 2–8 câu**, bấm **"Sinh bài 6 bước"**, chọn unit đích. Server tạo **bài nháp** trong unit đó; admin sửa trên các tab có sẵn (Đặc tả, Item, Task, Hoạt động), preview 6 bước (bước 2 phát đúng đoạn video), rồi publish như bài thường.

Đây cũng là cách "nhận về" bài người học làm nội dung chung (Q9): sinh từ bài người học → bài nháp của admin, người học vẫn giữ bài của mình.

| Trong S4.2 | Ngoài S4.2 |
|---|---|
| `POST /v1/admin/lessons/:id/compose` (202 + poll route có sẵn) | Route và UI người học (**S4.3**) |
| Chọn câu + nút "Sinh bài 6 bước" ở `LessonSentencesSection` | Sinh lại từng phần (chỉ task, chỉ hội thoại) – để sau nếu cần |
| Hiển thị "Sinh từ bài …" trên bài sinh ra, link về bài gốc | |
| Preview bước 2 phát đúng đoạn video (`startMs` / `endMs`) | |
| Editor `listen_and_repeat` giữ và hiện liên kết câu gốc (chỉ đọc) | |
| Danh mục item: bộ lọc **"AI tạo, chưa rà"** + nút "Đánh dấu đã rà" | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| I1 | Bài nào có nút | Mọi bài có ≥ 1 câu, trừ bài đã là bài sinh ra (`derived_from_lesson_id` khác null) để tránh sinh lồng. |
| I2 | Unit đích | Bài admin: mặc định unit hiện tại, đổi được. Bài người học: bắt buộc chọn unit (dùng lại danh sách unit của `UserLessonPanel`). Level của unit đưa vào prompt (H9). |
| I3 | Sinh lại | Cùng nhóm câu + unit đã có bài sinh ra → hỏi "Mở bài đã sinh" hay "Sinh bản mới" (`force: true`). |
| I4 | Vị trí bài mới | Cuối unit, `status = draft`. |
| I5 | Quyền | Chỉ tài khoản admin có quyền ghi (`canMutate`), như các route admin khác. Ghi log `admin_actor` vào request (cột có sẵn). |
| I8 | Giới hạn theo tài khoản (H12) | Trang chi tiết người dùng (`UserDetailPage`) có ô "Số bài 6 bước / ngày": để trống = mặc định hệ thống, `0` = khoá. Hiện số lượt đã dùng hôm nay. Ghi `admin_actor` vào log. Route `PATCH /v1/admin/users/:id` nhận thêm `compose_daily_limit`. |
| I6 | Rà item AI | Lọc `source = ai` và `reviewed_at IS NULL`. Nút "Đánh dấu đã rà" ghi `reviewed_at = now()`. Sửa item AI qua editor có sẵn cũng tự ghi `reviewed_at`. Không chặn publish bài (item đã published). |
| I7 | Video ở preview | `iframe` YouTube nhúng sẵn (`youtube-nocookie.com/embed/<id>?start=&end=`), không thêm thư viện. |

## 3. Server

- `POST /v1/admin/lessons/:id/compose`, body `{ sentence_ids: uuid[2..8], unit_id: uuid, force?: boolean }`, header `Idempotency-Key`.
  - 200 `{ lesson_id, cached: true }` khi trúng cache và không `force`.
  - 202 `{ request_id }` khi xếp hàng; poll `GET /v1/admin/lesson-creations/:id` (có sẵn), kết quả `succeeded` có `lesson_id`.
  - Lỗi: `COMPOSE_DISABLED` 403, `COMPOSE_SENTENCES_INVALID` 400, `LESSON_NOT_FOUND` 404, `UNIT_NOT_FOUND` 404, `COMPOSE_BUDGET_EXHAUSTED` 503, `IDEMPOTENCY_CONFLICT` 409.
- Snapshot / chi tiết bài admin trả thêm `derived_from: { lesson_id, title } | null`.
- `GET /v1/admin/items` thêm query `reviewed=false`; item view trả `reviewed_at`.
- `POST /v1/admin/items/:id/review` → ghi `reviewed_at`; `PATCH` item hiện có cũng ghi `reviewed_at`.
- OpenAPI cập nhật cho các route trên.

## 4. Admin-web

| Chỗ | Thay đổi |
|---|---|
| `LessonSentencesSection.tsx` | Chế độ chọn: checkbox mỗi câu (tối đa 8, đếm "Đã chọn 3/8"), nút **"Sinh bài 6 bước"**. |
| `ComposeLessonDialog.tsx` (mới) | Chọn unit (I2), xác nhận; hiện tiến độ (poll 2 giây, như `LessonCreationPage`); lỗi bằng tiếng Việt; xong thì chuyển sang `LessonEditPage` của bài mới, tab "Đặc tả". `COMPOSE_NOT_SUITABLE` hiện `reason_vi`. |
| `LessonEditPage.tsx` | Banner "Bài sinh tự động từ câu của bài **…**" + link; nhắc rà item AI (đếm item `source = ai` chưa rà trong bài). |
| `PreviewListenRepeat.tsx` | Prompt có `startMs` / `endMs` và bài có `youtube` → nhúng đoạn video; không có → giữ như hiện nay. |
| Editor `listen_and_repeat` | Giữ nguyên `sentenceId` / `startMs` / `endMs` khi lưu; hiện nhãn "Câu gốc · 00:12–00:15" (chỉ đọc). |
| `ItemListPage.tsx` | Bộ lọc "AI tạo, chưa rà"; nhãn "AI" trên dòng item; nút "Đánh dấu đã rà" (cả ở `ItemEditPage`). |
| `api/client.ts`, `api/types.ts` | Hàm và kiểu cho các route mới. |

## 5. Kiểm thử

| Loại | Nội dung |
|---|---|
| Server DB `adminLessonCompose.test.ts` | 202 → worker (completion giả lập) → bài nháp trong unit, `derived_from` đúng; cache 200; `force` tạo bài mới; câu không thuộc bài → 400; tắt flag → 403; bài sinh ra không sinh tiếp được; quyền chỉ đọc → 403. |
| Server DB `adminItems.test.ts` (bổ sung) | Lọc `reviewed=false`; `review` ghi `reviewed_at`; sửa item ghi `reviewed_at`. |
| Vitest | `LessonSentencesSection` chọn / giới hạn 8; `ComposeLessonDialog` các trạng thái (đang sinh, xong, không phù hợp, hết lượt); `PreviewListenRepeat` có / không có đoạn video; `ItemListPage` bộ lọc. |
| Playwright `e2e/` | 1 kịch bản: mở bài L03 seed → chọn 2 câu → sinh (server dùng `AI_PROVIDER=mock`) → bài nháp mở được, spec-check 0 vi phạm → preview 6 bước. |

Lệnh: `yarn test`, `yarn test:db`, `yarn admin-web:test`, Playwright `e2e/` (mục tiêu không giảm: Vitest 160, Playwright 16/16).

## 6. Thứ tự commit

1. `feat(compose): admin compose route with cache and force`.
2. `feat(items): reviewed_at filter and review action`.
3. `feat(admin-web): select sentences and compose a six-step draft`.
4. `feat(admin-web): preview plays the source clip in listen and repeat`.
5. `feat(admin-web): AI item review filter`.
6. `test(e2e): compose a six-step lesson from the sample unit`.

## 7. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Admin publish bài có item AI chưa ai đọc | Banner nhắc trên bài + bộ lọc rà; không chặn (đúng lựa chọn "tự publish"). |
| Nhúng YouTube trong admin bị chặn bởi CSP | Kiểm `vite.config.ts` / header deploy; nếu chặn thì hiện link "mở đoạn trên YouTube" có `?t=`. |

Không thêm dependency.

## 8. Kết quả code và điểm lệch so với plan

> Code ngày 2026-10-09, server `b4f6c59` → `c53f07a` (nhánh `claude/affectionate-darwin-krszil`).

**Đã làm**

| Phần | File chính |
|---|---|
| `POST /v1/admin/lessons/:id/compose` (200 cache / 202 / lỗi theo mã), dùng chung service compose với worker | `curriculum/composer/controller/composeRoutes.ts`, `app/server.ts` |
| Poll `GET /v1/{admin/}lesson-creations/:id` có thêm khối `compose` (stage, thời gian, `expected_ms` = p50 50 lần gần nhất, `quota_charged`, `reason_vi` / `suggestion_vi`, câu bị bỏ) — **chỉ** với request compose | `canonicalLesson/model/creation.ts`, `lessonCreationService.ts`, `creationRequestStore.ts` |
| Bài trả thêm `derivedFromLessonId`, `situationSource`; item trong đặc tả trả thêm `source`, `reviewed_at` | `curriculum/lessons/*`, `curriculum/spec/*` |
| Item: lọc `reviewed=false|true`, `reviewed_at` trong view, `POST /v1/admin/items/:id/review`; sửa item hoặc tạo item bởi admin tự ghi `reviewed_at` | `items/*` |
| Giới hạn compose theo tài khoản: `GET` / `PATCH /v1/admin/users/:id/compose-quota` | `composeRoutes.ts` |
| Admin-web: chọn 2–8 câu + "Sinh bài 6 bước"; dialog chọn unit, tiến độ theo stage, cache / "Sinh bản mới", lỗi theo mã; banner "Bài sinh tự động từ …" + đếm item AI chưa rà; preview bước 2 nhúng đoạn video; editor giữ và ghi nhãn "Câu gốc · 0:12–0:15"; danh sách item lọc "Chưa rà" + nút "Đã rà"; trang item có "Đánh dấu đã rà"; trang người dùng có ô "Số bài 6 bước / ngày" | `LessonSentencesSection.tsx`, `ComposeLessonDialog.tsx`, `lesson/DerivedLessonBanner.tsx`, `preview/PreviewListenRepeat.tsx`, `activity/ListenAndRepeatEditor.tsx`, `ItemListPage.tsx`, `items/ItemLifecyclePanel.tsx`, `users/ComposeQuotaPanel.tsx`, `LessonEditPage.tsx`, `UserDetailPage.tsx` |
| Playwright `e2e/compose.spec.ts`: tạo bài text → chọn 3 câu → sinh → bài nháp mở được, banner, không còn mục thiếu để publish ngoài rà item, preview 6 bước | `admin-web/e2e/compose.spec.ts`, `playwright.config.ts` (`LESSON_COMPOSE_ENABLED=true` cho server e2e) |

**Điểm lệch**

| # | Plan | Đã làm | Lý do |
|---|---|---|---|
| M1 | Bài trả `derived_from: { lesson_id, title }` | Trả `derivedFromLessonId` (+ `situationSource`); banner tự lấy tiêu đề bài gốc | Giữ bản ghi bài phẳng như các trường hiện có; không thêm join. |
| M2 | `PATCH /v1/admin/users/:id` nhận `compose_daily_limit` (I8) | Route con riêng `GET` / `PATCH /v1/admin/users/:id/compose-quota`, trả cả số lượt đã dùng hôm nay | Không đụng route người dùng hiện có; trang người dùng đọc được "đã dùng / giới hạn". |
| M3 | Trang unit có dòng "Đang sinh: N bài" (thiết kế chờ §4) | **Chưa làm**; đóng dialog khi đang chạy thì trang bài hiện ghi chú "bài nháp sẽ xuất hiện trong unit khi xong" | Tách khỏi S4.2 cho gọn; làm cùng S4.2b nếu cần. |
| M4 | Rủi ro CSP | ⚠️ Thêm `frame-src https://www.youtube-nocookie.com` vào CSP của admin SPA (chỉ nguồn này) | Không có thì iframe preview bị chặn. |
| M5 | Không có | Item do admin **tạo** cũng ghi `reviewed_at` ngay; "Đã rà" không đổi `updated_at` | Bộ lọc "chưa rà" chỉ còn item AI; rà không phải sửa nội dung nên không đẩy bài lên bản mới. |
| M6 | Lỗi: 403, 400, 404, 503, 409 | Thêm `COMPOSE_ALREADY_DERIVED` (409) khi chọn câu trong bài đã là bài sinh ra | I1: không sinh lồng. |
| M7 | — | E2E bắt lỗi: sau khi sinh xong, chuyển sang bài mới mà dialog vẫn mở (trang không remount) → đóng dialog khi đổi bài | Đã sửa trong `LessonEditPage.tsx`. |
| M8 | — | ⚠️ Đổi API (chỉ thêm trường / route): +3 path, +4 operation OpenAPI | Ghi vào `test/openApiDocument.test.ts`. |
