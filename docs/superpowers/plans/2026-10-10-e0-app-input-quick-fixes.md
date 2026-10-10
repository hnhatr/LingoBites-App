# E0 – App: sửa nhanh luồng nhập text / ảnh hiện có

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Bảng quyết định §2: **dùng đề xuất** (chốt 2026-10-10).
> Ngày lập: 2026-10-10. Repo: `LingoBites-App` (chỉ app). Nhánh: `claude/beautiful-cerf-t6c9y1`.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` (§1 "Lỗi nhỏ", §5.3, §8 E0).
> Không phụ thuộc PR nào. Không migration, không đổi API, không thêm thư viện.

## 1. Mục tiêu và phạm vi

Sửa các lỗi đã thấy khi đọc code, để luồng hiện tại (dán chữ, chụp / chọn ảnh → OCR → kiểm tra → tạo bài) đúng và rõ ràng **trước khi** làm luồng mới.

| Trong E0 | Ngoài E0 |
|---|---|
| Thống nhất giới hạn độ dài (500 từ) và bộ đếm trên màn | Màn chọn ý định, luồng mới (E3) |
| Hiện cảnh báo `text_exceeds_max_length` của server | Kiểm duyệt, phát hiện thông tin cá nhân (E1–E3) |
| Bỏ mục "Ảnh gần đây" giả | Thư viện khoảnh khắc (E5) |
| Đưa chữ viết cứng trên 3 màn vào i18n (`vi`, `en`) | Viết lại giao diện |
| Sửa câu minh bạch "App chỉ gửi text bạn xác nhận cho AI" | Màn đồng ý đầy đủ (E3) |
| Sửa trạng thái cờ `ocrReviewEdit` trong `feature-registry.ts` | Đổi cấu hình bật / tắt cờ |
| Kiểm tay EXIF trên máy thật (ghi kết quả cho E1) | Gỡ EXIF (E1) |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| K1 | Giới hạn nào là chuẩn | **500 từ** (`MAX_LESSON_V2_WORDS`), vì đây là giới hạn thật trước khi gửi. Giới hạn 3000 ký tự giữ lại như lớp chặn thứ hai (server cũng chặn theo `MAX_TEXT_LENGTH`). |
| K2 | Bộ đếm hiện gì | `N/500 từ`. Vượt 500 → chip đổi màu cảnh báo, nút chính tắt kèm dòng "Đoạn văn dài quá 500 từ. Hãy xoá bớt." (dùng `errors.text_too_long_words`). |
| K3 | Cảnh báo `text_exceeds_max_length` | Hiện như 2 cảnh báo có sẵn trên `OCRReviewScreen`, câu: "Ảnh có nhiều chữ hơn giới hạn của một bài. Hãy xoá bớt phần không cần học." |
| K4 | Mục "Ảnh gần đây" | **Bỏ hẳn** khỏi `ImageCaptureScreen` (thư viện khoảnh khắc thật ở E5). Giữ thẻ "OCR thông minh" nhưng sửa câu cho đúng việc app làm: "Đọc chữ tiếng Anh trong ảnh để bạn kiểm tra và tạo bài." (bỏ "tự phát hiện ngôn ngữ và trích các từ đáng học" vì OCR không làm việc đó). |
| K5 | Câu minh bạch trên `OCRReviewScreen` | "Ảnh đã được gửi lên máy chủ để đọc chữ. Chỉ đoạn chữ bạn xác nhận dưới đây được dùng để tạo bài." |
| K6 | Cờ `ocrReviewEdit` | Đổi `status` từ `not_implemented` sang `ready` (màn kiểm tra đã có và production đang bật). Nếu test `validate-release-config` dựa vào trạng thái cũ thì sửa test theo. |
| K7 | Chip "Phát hiện: Tiếng Anh" trên `PasteTextScreen` | **Bỏ**: app không phát hiện ngôn ngữ, chip luôn hiện khi có chữ nên gây hiểu sai. |

## 3. File thay đổi

| File | Thay đổi |
|---|---|
| `src/core/utils/textValidation.ts` | Thêm `countWords(text)` (dùng chung, cùng cách tách `/\s+/` như `validateLessonV2InputText`) và `validateDraftText(text)` trả `{words, overWordLimit, overCharLimit}` cho bộ đếm. Không đổi hành vi của 2 hàm hiện có. |
| `src/features/input/screens/PasteTextScreen.tsx` | Dùng `countWords` chung (bỏ hàm cục bộ); chip `N/500 từ` theo K2; bỏ chip ngôn ngữ (K7); nút chính tắt khi vượt giới hạn; chữ qua i18n. |
| `src/features/ocr/screens/OCRReviewScreen.tsx` | Như trên cho bộ đếm (thay `x/3000`); thêm cảnh báo K3; câu minh bạch K5; chữ qua i18n. |
| `src/features/input/screens/ImageCaptureScreen.tsx` | Bỏ `RECENT_PLACEHOLDERS` và khối "Ảnh gần đây" (K4); sửa thẻ "OCR thông minh"; chữ qua i18n (tiêu đề, trạng thái chờ, nút "Thử OCR lại", "Chọn ảnh khác", "Nhập text thủ công", "Trích xuất text", "Chạm để chọn ảnh", "PNG hoặc JPG"). Bỏ import `ImagePlaceholder`, `SectionHeader` nếu không còn dùng. |
| `src/core/i18n/vi.json`, `src/core/i18n/en.json` | Khoá mới dưới `input.*` (màn dán chữ, màn ảnh) và `ocr.*` (màn kiểm tra), `errors.ocr_text_too_long` (K3). |
| `src/core/release/feature-registry.ts` | `ocrReviewEdit.status = 'ready'`, bỏ `limitations`, thêm `entryPoint` (K6). |
| `src/features/input/screens/__tests__/*.test.tsx`, `src/features/ocr/screens/__tests__/OCRReviewScreen*.test.tsx` | Cập nhật theo chữ mới (tìm theo khoá i18n hoặc `testID`, không theo chuỗi cứng); thêm test mới (§4). |
| `src/core/utils/__tests__/textValidation.test.ts` | Test `countWords`, `validateDraftText`. Tạo mới nếu chưa có. |

Không xoá file nào. Không đổi navigation, không đổi API.

## 4. Kiểm thử

| Loại | Nội dung |
|---|---|
| Unit | `countWords`: chuỗi rỗng, nhiều khoảng trắng / xuống dòng, 500 và 501 từ. `validateDraftText`: cờ vượt từ / vượt ký tự. |
| Màn `PasteTextScreen` | 501 từ → chip cảnh báo, nút tắt; xoá bớt → nút bật lại; không còn chip "Phát hiện: Tiếng Anh". |
| Màn `OCRReviewScreen` | Bộ đếm `N/500 từ`; `warnings` có `text_exceeds_max_length` → hiện câu K3; câu minh bạch K5 hiện. |
| Màn `ImageCaptureScreen` | Không còn "Ảnh gần đây"; các trạng thái (chờ, lỗi, quyền bị từ chối) hiện chữ từ i18n. |
| Release config | `validate-release-config` pass với `ocrReviewEdit = ready`. |
| Kiểm tay (máy thật, iOS + Android) | Chụp ảnh có GPS bật → tải ảnh mà app gửi đi (bắt request qua proxy dev hoặc log tạm trên máy dev, **không commit log**) → kiểm tra còn EXIF / GPS không. Ghi kết quả vào §7 để E1 dùng. Đồng thời kiểm tra ảnh HEIC từ thư viện iOS có bị app đổi sang JPEG không (Google Vision không liệt kê HEIC trong định dạng hỗ trợ). |

Lệnh: `yarn tsc`, `yarn lint` (không vượt ngân sách warning), `yarn format:check`, `yarn test`.

## 5. Thứ tự commit

1. `refactor(input): share word counting and draft validation` (textValidation + test).
2. `fix(input): count words against the real 500-word limit` (2 màn + test).
3. `fix(ocr): show the over-length warning and an accurate privacy note`.
4. `fix(input): drop placeholder recent images, move copy to i18n`.
5. `chore(release): mark ocrReviewEdit as ready`.

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Test cũ tìm theo chuỗi tiếng Việt cứng | Đổi sang `testID` / khoá i18n trong cùng commit |
| Người dùng đang quen chip ký tự | Thay đổi nhỏ, chỉ là cách đếm |

## 7. Kết quả kiểm tay EXIF / HEIC

_(điền sau khi chạy §4 trên máy thật)_
