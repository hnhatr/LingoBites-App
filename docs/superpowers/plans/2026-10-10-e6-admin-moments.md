# E6 – Server + admin-web: theo dõi bài từ đời thường, danh mục tình huống, báo sai

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Ngày lập: 2026-10-10. Repo: `LingoBites-Server` (+ `admin-web` trong cùng repo) + `LingoBites-App` (nút báo sai). Nhánh: `claude/beautiful-cerf-t6c9y1`.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` §6, §7 (R1, R4). Gộp S5.9 và phần admin của S5.1.
> Cần trước: E2, E4.
> ⚠️ **Migration** (bảng báo sai) và **API admin mới**. Admin xem ảnh người học → mỗi lần xem ghi log (giống B12 với bản ghi âm).

## 1. Mục tiêu và phạm vi

| Trong E6 | Ngoài E6 |
|---|---|
| Admin: trang "Khoảnh khắc" – danh sách request `moment` / bài từ ảnh / tình huống, lọc theo ý định, trạng thái, mã lỗi | Báo cáo kinh doanh |
| Thống kê §6 thiết kế: tỷ lệ từ chối (ảnh / text / không phù hợp), đổi ý định, thời gian tạo bài, học xong | Dashboard thời gian thực |
| Danh mục tình huống: thêm / sửa / ẩn / sắp xếp (S5.1 đầy đủ) | Dịch danh mục sang ngôn ngữ khác |
| Người học "Báo từ sai" trên từng từ của bài từ ảnh (R1); admin xem và xử lý | Tự sửa bài bằng AI |
| "Nhận về" bài từ ảnh / tình huống thành bài nháp (Q9, dùng chức năng S4.2 có sẵn) | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| T1 | Admin xem ảnh người học | Chỉ tài khoản admin; mỗi lần mở ảnh ghi vào bảng `admin_audit_log` có sẵn (ai, khi nào, ảnh nào); không có nút tải về. Danh sách mặc định **không** hiện ảnh, chỉ hiện khi bấm "Xem ảnh". |
| T2 | Admin xem nội dung request bị từ chối | Chỉ thấy mã lỗi và thời gian; **không lưu** nội dung bị `CONTENT_REJECTED` / `IMAGE_REJECTED` (không có gì để xem). |
| T3 | Báo từ sai | Nút cờ trên thẻ từ (bài `learner_image`); lý do chọn nhanh: "Không có trong ảnh", "Nghĩa sai", "Khác". Lưu bảng `lesson_item_reports`. Admin đánh dấu "Đã xem" / "Sửa item" (mở trang item có sẵn). |
| T4 | Ngưỡng cảnh báo | Tỷ lệ từ chối 7 ngày > 5% hoặc báo sai > 10% bài từ ảnh → thẻ cảnh báo trên dashboard admin (chỉ hiện, không gửi mail). |

## 3. Thay đổi

### 3.1 Migration `016_lesson_item_reports.sql`

```sql
CREATE TABLE lesson_item_reports (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('not_in_image', 'wrong_meaning', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (lesson_id, item_key, reporter_user_id)
);
```

### 3.2 Server

| File | Thay đổi |
|---|---|
| `src/modules/situations/controller/adminSituations.ts` (mới) | CRUD danh mục (`/v1/admin/situations`), CSRF + phiên admin như route admin khác. |
| `src/modules/moments/controller/adminMoments.ts` (mới) | Danh sách request `moment` + bài ý định khác `null`; thống kê §6; xem ảnh có log (T1). |
| `src/modules/moments/controller/itemReports.ts` (mới) | `POST /api/v1/lessons/:id/items/:itemKey/report` (người học); `GET/PATCH /v1/admin/item-reports`. |
| `src/modules/admin/controller/adminDashboard.ts` | Thẻ cảnh báo T4. |

### 3.3 Admin-web

Trang mới "Khoảnh khắc" (danh sách, bộ lọc, thống kê, xem ảnh có xác nhận), "Tình huống" (bảng sửa danh mục), "Báo sai" (hàng chờ). Dùng component bảng / form có sẵn của admin-web.

### 3.4 App

Nút "Báo từ sai" trên thẻ từ của bài `learner_image`; client `reportItem`; i18n.

## 4. Kiểm thử

| Repo | Nội dung |
|---|---|
| Server DB | CRUD danh mục (chỉ admin, CSRF); thống kê đếm đúng theo mã; xem ảnh ghi audit; người học báo sai 2 lần cùng từ → 1 hàng; người khác không báo được bài không phải của mình. |
| Admin-web | Vitest cho trang mới; Playwright: sửa một tình huống, đánh dấu báo sai đã xem. |
| App | Jest: nút báo sai chỉ ở bài `learner_image`; gửi đúng lý do. |

Lệnh: `yarn test`, `yarn test:db`, `yarn admin-web:test`, Playwright `e2e/`; app như các PR khác.

## 5. Thứ tự commit

(1) `feat(db): lesson item reports`; (2) `feat(admin): situations catalog editor`; (3) `feat(admin): moments list, stats and audited photo view`; (4) `feat(reports): learners flag wrong words; admin queue`; (5) app `feat(lesson): report a wrong word`.

## 6. Điểm lệch so với plan

_(điền khi code xong)_
