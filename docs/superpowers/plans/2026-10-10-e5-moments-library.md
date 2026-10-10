# E5 – Server + app: thư viện "Khoảnh khắc", luyện lại tình huống, xoá bài tự tạo

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Bảng quyết định §2: **dùng đề xuất** (chốt 2026-10-10).
> Ngày lập: 2026-10-10. Repo: `LingoBites-App` + `LingoBites-Server`. Nhánh: `claude/beautiful-cerf-t6c9y1`.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` §3.6, §5.2. Gộp S5.5.
> Cần trước: E3 (E4 để có ảnh thu nhỏ; không có E4 thì thẻ không có ảnh). PR 15 / PR 16 (đạt bài, ôn) cho trạng thái "đạt".
> ⚠️ **API public mới** (xoá bài, luyện lại). **Xoá dữ liệu**: người học xoá được bài của chính mình (không hoàn tác). Không migration.

## 1. Mục tiêu và phạm vi

| Trong E5 | Ngoài E5 |
|---|---|
| Phân đoạn "Khoảnh khắc" trong Thư viện: bài tạo từ ảnh / tình huống / chữ của người học, có ảnh thu nhỏ, ý định, trạng thái học | Đưa từ bài tự tạo vào lịch ôn tự động (Q7 / Q-E4: giữ **không**) |
| "Luyện nói lại tình huống": chỉ bước 5 với chi tiết khác | Game với bài (Stage 6) – chỉ để sẵn nút khi cờ game bật |
| Người học xoá bài tự tạo (server + app), xoá luôn ảnh | Xoá hàng loạt |
| "Lưu từ để ôn" từng từ (flashcard có sẵn) | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| S1 | Bài nào vào "Khoảnh khắc" | Bài `origin = learner`, `library_hidden = false`, nguồn `learner_text`, `learner_ocr`, `learner_image`, `learner_situation`, và bài 6 bước sinh ra từ chúng. YouTube giữ ở mục video như hiện nay. |
| S2 | Thẻ hiện gì | Ảnh thu nhỏ (nếu có) hoặc biểu tượng theo ý định; tiêu đề; nhãn ý định (Hiểu / Tả / Dùng); ngày; trạng thái (chưa học / đang học / đã xong phần luyện / đạt bài) lấy từ dữ liệu tiến độ có sẵn. |
| S3 | Luyện lại tình huống (S5.5) | Nút trên hub bài `moment_intent = 'use'` hoặc `'describe'`. Mở **bước 5** của chính bài đó với **một chi tiết đổi** (món khác, giờ khác…) chọn tất định từ `slot_values` của mẫu câu (đã có trong bài) theo seed ngày. **Không gọi AI**, không tính lượt. Kết quả ghi `activity_attempts` như bước 5 thường. |
| S4 | Xoá bài | `DELETE /api/v1/lessons/:id`: chỉ bài `origin = learner` của chính chủ. Xoá bài + bài nguồn ẩn liên kết (nếu có) + ảnh (`releaseForLesson` → `expires_at = now()`, job dọn của E1 xoá object trong ≤ 1 giờ). Tiến độ / lượt làm của bài giữ theo FK hiện có (kiểm tra cascade khi code, ghi §7). Hỏi xác nhận trên app: "Xoá bài và ảnh của bài này? Không khôi phục được." |
| S5 | Bài đã được admin "nhận về" (Q9) | Bài nháp admin là bản sao riêng → xoá bài người học không ảnh hưởng. |
| S6 | "Lưu từ để ôn" | Dùng `saveFlashcard` có sẵn trên từng item; không đổi luật Q7. |

## 3. Server

| File | Thay đổi |
|---|---|
| `src/modules/canonicalLesson/controller/learnerLessons.ts` (mới) hoặc controller giao bài người học hiện có | `DELETE /api/v1/lessons/:id` (S4). 204; bài không phải của mình / không tồn tại → 404 (giống predicate hiển thị). Ghi log kết quả, không ghi nội dung. |
| `src/modules/canonicalLesson/repository/*` | Hàm xoá trong 1 transaction: bài 6 bước + bài nguồn ẩn (`derived_from_lesson_id` + `library_hidden`) + `releaseForLesson`. |
| `src/modules/images/repository/learnerImageStore.ts` | Dùng `releaseForLesson` đã có ở E1. |
| Catalog người học | Trả thêm `moment_intent`, `source_image.thumbnail_url` (URL ký như E4, ảnh gốc – app tự thu nhỏ khi hiển thị). |

## 4. App

| File | Thay đổi |
|---|---|
| `src/features/lesson/library/logic/librarySections.ts`, `useLibrarySegments.ts`, `lesson.ts` | Phân đoạn "Khoảnh khắc" (S1), lọc theo ý định. |
| `src/features/lesson/library/screens/LibraryListScreen.tsx` | Danh sách thẻ S2; nhấn giữ / menu "Xoá" (S4). |
| `src/ui/components/LessonCard.tsx` | Biến thể có ảnh thu nhỏ + nhãn ý định. |
| `src/features/lesson/player/components/CanonicalLessonHub.tsx` | Nút "Luyện nói lại tình huống" (S3), "Xoá bài". |
| `src/features/lesson/flow/...` (player 6 bước) | Chế độ mở thẳng bước 5 với chi tiết đổi (S3). Tái dùng màn bước 5 hiện có. |
| `src/features/lesson/player/logic/canonicalLessonClient.ts` | `deleteLearnerLesson(id)`; sau khi xoá: `removeLessonDownload`, `removeLessonMedia`, xoá khỏi danh sách local. |
| `src/features/input/screens/CreateScreen.tsx` | "Khoảnh khắc gần đây" lấy từ phân đoạn mới. |
| i18n, analytics | `moment_reopened`, `moment_replayed`, `lesson_deleted` (chỉ mã, không nội dung). |

## 5. Kiểm thử

| Repo | Nội dung |
|---|---|
| Server DB `test/learnerLessonDelete.test.ts` | Xoá bài của mình → 204, bài + bài nguồn ẩn biến mất, ảnh `expires_at` đặt lại; bài của người khác / bài admin → 404; xoá lần 2 → 404. |
| App Jest | Phân đoạn chỉ có nguồn S1; thẻ có / không ảnh; chọn chi tiết đổi tất định theo seed; xoá → gọi client, dọn local; xoá lỗi mạng → giữ bài, báo lỗi. |
| Kiểm tay | Tạo 3 bài (Hiểu / Dùng / Tả) → thấy trong Khoảnh khắc; luyện lại bước 5 → đổi chi tiết; xoá bài có ảnh → ảnh không mở được bằng URL cũ sau ≤ 1 giờ. |

## 6. Thứ tự commit

**Server**: (1) `feat(lessons): learners delete their own lessons and photos`; (2) `feat(catalog): moment intent and photo in learner catalog`.
**App**: (3) `feat(library): moments segment`; (4) `feat(lesson): replay the situation step with a changed detail`; (5) `feat(lesson): delete own lessons`.

## 7. Điểm lệch so với plan

_(điền khi code xong)_
