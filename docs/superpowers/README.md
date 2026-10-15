# Superpowers: spec và plan

> Dọn lại ngày 2026-10-11, rà lại với code ngày 2026-10-15. Muốn biết **bài học hiện có và sắp làm**, đọc
> [`docs/architecture/lesson-design.md`](../architecture/lesson-design.md) trước.

Thư mục này chỉ giữ thiết kế **chưa làm xong**. Plan đã code, đã bị thay thế hoặc bỏ dở nằm trong `archive/`.

| Thư mục | Nội dung |
| --- | --- |
| `plans/` | Plan đang chờ làm |
| `specs/` | Spec thiết kế đang chờ làm |
| `archive/plans/`, `archive/specs/` | Plan và spec cũ, giữ nguyên nội dung để tra cứu (mục "Kết quả / điểm lệch" ghi quyết định thật) |

## Đang chờ làm

| File | Nội dung | Trạng thái |
| --- | --- | --- |
| `plans/2026-10-10-stage5-9-image-lesson-game-hub.md` | Game Hub và 3 nhóm game (Stage 6–9). §2 (ảnh → bài) đã làm qua E0–E6 | Thiết kế, cần chốt §5 rồi viết plan từng PR |
| `plans/2026-10-11-compose-monologue-lessons.md` | Bài 6 bước từ nội dung độc thoại: bước 5 "kể lại" thay nhập vai (hướng B) | Plan, chờ duyệt (đề xuất đo số liệu prompt v2 trước) |
| `specs/2026-10-02-youtube-lesson-ux-redesign.md` | UI bài YouTube (12 màn, bộ màn ở `docs/design/youtube-lesson/`) | Đã có một phần. Đã rà với code ngày 2026-10-15, phần còn thiếu ở §7.1 của spec |
| `plans/2026-10-11-speech-pronunciation-feedback-options.md` | So sánh hai hướng chấm phát âm: OpenAI logprobs (D) và Azure Pronunciation Assessment (C) | Thiết kế, làm sau |
| `plans/2026-10-12-pronunciation-architecture.md` | Kiến trúc chấm phát âm bằng Azure. Bước 1 (nghe mẫu, "Nghe và chọn") đã làm | Đề xuất, chờ trả lời §11 rồi mới làm bước 0, 2–4 |
| `../design/vocab-pattern-tense-p2-p7-plan.md` | Lộ trình Từ · Mẫu câu · Thì. P0–P5 đã code | Còn P6 (kho mẫu, bản đồ thì, ôn bậc 3, tiến độ, khoá học) và P7 (chưa thiết kế) |

## Cách thêm plan mới

1. Viết `plans/<ngày>-<tên>.md`: file tạo / sửa / xoá, các bước, test, dependency mới (nếu có).
2. Chờ duyệt rồi mới code (VibeGuard §1).
3. Code xong: ghi **"ĐÃ CODE"** và mục "điểm lệch so với plan", cập nhật `docs/architecture/lesson-design.md` nếu đổi bài học, rồi chuyển plan vào `archive/plans/`.

Plan trong `archive/` nhắc tới nhau bằng tên file trần. Gặp tên không thấy trong `archive/plans/` thì tìm ở `plans/` (file còn chờ làm).
