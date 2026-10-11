# Superpowers: spec và plan

> Dọn lại ngày 2026-10-11. Muốn biết **bài học hiện có và sắp làm**, đọc
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
| `plans/2026-10-11-practice-segments.md` | Chuỗi luyện bài tự tạo: chia bài dài thành đoạn, luyện tiếp đoạn khác | Plan, chờ duyệt |
| `specs/2026-10-02-youtube-lesson-ux-redesign.md` | UI bài YouTube (12 màn, bộ màn ở `docs/design/youtube-lesson/`) | Đã có một phần, cần rà lại phần còn thiếu |

## Cách thêm plan mới

1. Viết `plans/<ngày>-<tên>.md`: file tạo / sửa / xoá, các bước, test, dependency mới (nếu có).
2. Chờ duyệt rồi mới code (VibeGuard §1).
3. Code xong: ghi **"ĐÃ CODE"** và mục "điểm lệch so với plan", cập nhật `docs/architecture/lesson-design.md` nếu đổi bài học, rồi chuyển plan vào `archive/plans/`.

Plan trong `archive/` nhắc tới nhau bằng tên file trần. Gặp tên không thấy trong `archive/plans/` thì tìm ở `plans/` (file còn chờ làm).
