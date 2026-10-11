# Bước 0 – Cấu hình cho bản chạy thử (P2.0)

> Lập 2026-10-09, theo plan `2026-10-09-phase2-product-trial-plan.md` (đã duyệt "ok"). **ĐÃ CHỐT** cho bản chạy thử.
> Phần quyền phụ huynh / giáo viên: **bỏ qua** trong giai đoạn này.
> Đổi giá trị nào thì sửa file này trước, rồi mới sửa code.

## 1. Trình độ (C1)

| Mã level | Tên | Có bài khi chạy thử |
|---|---|---|
| `Pre-A1` | Làm quen | Không (để sau, cho trẻ) |
| `A1` | Sơ cấp 1 | Có: 8 unit × 3 bài |
| `A2` | Sơ cấp 2 | Có: 6 unit × 3 bài |
| `B1` | Trung cấp | Không |

- Trẻ em và người lớn dùng chung thang.
- Course duy nhất khi chạy thử: **"Tiếng Anh giao tiếp"** (`tieng-anh-giao-tiep`), gồm level `A1` (vị trí 1) và `A2` (vị trí 2) (G1).

## 2. Nhóm đối tượng (C2, Q6, G5)

| Giá trị | Ai | Ghi chú |
|---|---|---|
| `kids` | Trẻ 6–11 | Không chấm máy (A11), chỉ tự đánh giá. Không thấy unit `adults`. |
| `adults` | Người lớn ≥ 16 | Thấy mọi unit. |

- Nhóm 12–15 tuổi: chưa làm. Onboarding hiện 2 lựa chọn.
- Item dùng chung cho mọi nhóm (`audience = all`).
- Unit chỉ dành cho người lớn: `A2-HOTEL`. Mọi unit khác: `all`.

## 3. Tỷ lệ kỹ năng (C3)

Nói 70 / nghe 25 / viết 5, sai lệch ± 10, tính theo unit, **chỉ cảnh báo**. Đây đúng là luật `skillBalance` hiện có. Seed nội dung mẫu phải nằm trong ngưỡng (có test kiểm).

## 4. Kiểm tra đầu vào (C4, G4)

- 12 câu nghe + chọn: 6 câu A1, 6 câu A2. Không có câu nói. Khoảng 5 phút.
- Bỏ qua được. Bỏ qua (hoặc thoát giữa chừng, hoặc không có mạng) thì bắt đầu từ A1.
- Kết quả chỉ **đề xuất**; người học chọn lại được ngay ở màn kết quả và trong Cài đặt.
- **Luật đề xuất:** đúng ≥ 5/6 câu A1 **và** ≥ 4/6 câu A2 → `A2`. Còn lại → `A1`.
- Đáp án chỉ có trên server; app không nhận đáp án.

## 5. Onboarding (C5)

| Hỏi | Lựa chọn | Lưu thành |
|---|---|---|
| Nhóm tuổi | Trẻ em (6–11) / Người lớn | `age_group`: `kids` / `adults` |
| Mục tiêu (chọn 1 hoặc nhiều) | Giao tiếp hằng ngày / Du lịch / Công việc / Học ở trường | `goals`: `communication`, `travel`, `work`, `school` |
| Sở thích (tối đa 3, bỏ trống được) | Âm nhạc / Phim ảnh / Thể thao / Nấu ăn / Du lịch / Công nghệ / Đọc sách / Trò chơi | `interests`: `music`, `movies`, `sports`, `cooking`, `travel`, `technology`, `reading`, `games` |
| Thời gian học mỗi ngày | 5 / 10 / 15 / 20 phút | `daily_minutes` |

- Người dùng cũ chưa có hồ sơ: hỏi một lần, có nút "Để sau" (mặc định `adults`, `A1`, mục tiêu `communication`, 10 phút).
- Sở thích chỉ lưu lại, chưa dùng để gợi ý (S5.4 làm sau).

## 6. Nội dung khi chạy thử (C6, G2)

Danh mục 14 unit / 42 bài ở mục 3.3 và 3.4 của plan Giai đoạn 2. Mỗi unit có nhiệm vụ tổng hợp. Mỗi unit có ít nhất một hoạt động viết.

## 7. Thưởng (C7)

Giữ nguyên XP / streak hiện có. Không code thêm trong Giai đoạn 2.

## 8. Gói (C8)

Chạy thử: **miễn phí toàn bộ**, course không khoá (`is_locked = false`). Đề xuất gói ở bảng 5.4 giữ nguyên để làm ở Giai đoạn 5.

## 9. Publish nội dung (T5)

| Môi trường | Lệnh | Publish |
|---|---|---|
| local, staging | `yarn seed:curriculum` / `yarn seed:curriculum:staging` | Seed tự publish |
| production | `yarn seed:curriculum --draft` | Không; người phụ trách nội dung đọc lại rồi bấm publish trong admin |

## 10. Phụ huynh / giáo viên

Không làm trong Giai đoạn 2: không tài khoản phụ huynh / giáo viên, không liên kết, không consent phụ huynh. Hệ quả: tài khoản `kids` luôn dùng tự đánh giá.
