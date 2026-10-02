# Thiết kế: Bài học YouTube

Bộ thiết kế UI/UX cho tính năng học từ link YouTube, dựng trên logic lesson hiện tại
(`LessonCreation` → `CanonicalLessonPlayer`). Yêu cầu chi tiết nằm trong spec
[`docs/superpowers/specs/2026-10-02-youtube-lesson-ux-redesign.md`](../../superpowers/specs/2026-10-02-youtube-lesson-ux-redesign.md).

- **Canvas gốc (nguồn chỉnh sửa):** https://claude.ai/artifact/8jyVYfrJxdeMAgk74RswYK (riêng tư, cần được chia sẻ mới mở được)

## Các file, đọc file nào

| File | Dùng cho | Ghi chú |
|------|----------|---------|
| `screens/*.html` | **Nguồn chính khi code** (người và agent) | HTML độc lập, mở thẳng bằng trình duyệt. Mọi kích thước, màu, chữ đều nằm trong style inline. |
| `tokens.json` | Đổi style HTML sang theme React Native | Mỗi biến CSS trùng tên key theme: `var(--accentSoft)` → `theme.colors.accentSoft`, `var(--text-muted)` → `theme.colors.text.muted`. Có giá trị cho cả theme Sáng và Tối. |
| `screens/*.png` | Xem nhanh, review PR | Chụp từ đúng file HTML cùng tên, 390×844 @2x. Không dùng để đo. |
| `canvas/` | Sửa tiếp trên canvas | `canvas.json` và `*.dc.html` cần runtime của canvas, không mở trực tiếp được. |

Icon là Material Symbols Rounded (giống `MaterialIcon` trong app): `<span class="ms">volume_up</span>` là icon `volume_up` dạng outline, thêm class `f` là dạng filled. Tên video, câu và số liệu trong thiết kế chỉ là nội dung mẫu.

### Đọc HTML thành component

- Mỗi `<button>`, `<input>`, `<label>` tương ứng một control thật. `aria-label` trên nút chỉ có icon là nhãn trợ năng cần giữ khi code.
- `display:flex` + `gap` → `View` với `flexDirection` và `gap`; px trong HTML = dp trong React Native.
- Màn 06–08 là bottom sheet nằm trên màn 05: phần từ `top: 283px` trở xuống là sheet, phần trên vẫn là video.
- Theme Tối: thêm class `dark` vào phần tử `.lb` (xem `12-hoc-bai-toi.html`).

## Các màn

| # | Màn | Route / trạng thái | File |
|---|-----|--------------------|------|
| 01 | Nhập link YouTube | `LessonCreation`, `idle` | [01-nhap-link.html](screens/01-nhap-link.html) · [png](screens/01-nhap-link.png) |
| 02 | Đang tạo bài | `LessonCreation`, `submitting` / `processing` | [02-dang-tao-bai.html](screens/02-dang-tao-bai.html) · [png](screens/02-dang-tao-bai.png) |
| 03 | Mất lâu hơn dự kiến | `LessonCreation`, `timedOut` | [03-qua-thoi-gian.html](screens/03-qua-thoi-gian.html) · [png](screens/03-qua-thoi-gian.png) |
| 04 | Tạo bài thất bại | `LessonCreation`, `failed` / `error` | [04-that-bai.html](screens/04-that-bai.html) · [png](screens/04-that-bai.png) |
| 05 | Học bài YouTube | `CanonicalLessonPlayer`, `source_type = youtube` | [05-hoc-bai.html](screens/05-hoc-bai.html) · [png](screens/05-hoc-bai.png) |
| 06 | Phân tích câu (sheet) | `CanonicalLessonPlayer` | [06-phan-tich-cau.html](screens/06-phan-tich-cau.html) · [png](screens/06-phan-tich-cau.png) |
| 07 | Công cụ luyện nghe (sheet) | `CanonicalLessonPlayer` | [07-cong-cu.html](screens/07-cong-cu.html) · [png](screens/07-cong-cu.png) |
| 08 | Transcript (sheet) | `CanonicalLessonPlayer` | [08-transcript.html](screens/08-transcript.html) · [png](screens/08-transcript.png) |
| 09 | Học xong bài | `CanonicalLessonPlayer`, sau câu cuối | [09-hoc-xong.html](screens/09-hoc-xong.html) · [png](screens/09-hoc-xong.png) |
| 10 | Bài YouTube đã lưu | `CanonicalCatalog`, lọc bài YouTube | [10-bai-da-luu.html](screens/10-bai-da-luu.html) · [png](screens/10-bai-da-luu.png) |
| 11 | Ngoại tuyến và bản mới | `CanonicalLessonPlayer`, `offline` / `hasUpdate` | [11-ngoai-tuyen.html](screens/11-ngoai-tuyen.html) · [png](screens/11-ngoai-tuyen.png) |
| 12 | Học bài, theme Tối | như 05 | [12-hoc-bai-toi.html](screens/12-hoc-bai-toi.html) · [png](screens/12-hoc-bai-toi.png) |

## Cập nhật thiết kế

1. Sửa trên canvas gốc.
2. Xuất lại `canvas/` từ canvas (giữ nguyên tên file), rồi tạo lại `screens/*.html` từ đó.
3. Chụp lại PNG từ HTML (390×844, deviceScaleFactor 2) và cập nhật `tokens.json` nếu thêm biến màu.
4. Cập nhật spec nếu yêu cầu thay đổi, rồi mở PR.
