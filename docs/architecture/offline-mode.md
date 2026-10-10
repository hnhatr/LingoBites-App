# Chế độ offline — thiết kế

> Mục tiêu: người học **đã có tài khoản** mở được app và học tiếp khi không
> có mạng. Chỉ những tính năng cần Server tính toán (AI, OCR, chấm điểm)
> hoặc nội dung chưa tải về máy mới bị khoá.

## 1. Nguyên tắc

1. **Local-first:** SQLite trên máy là nguồn dữ liệu chính; mạng chỉ để tải
   thêm và đồng bộ.
2. **Ghi không bao giờ bị khoá:** học, ôn, bookmark, ghi âm, trả lời bài đều
   lưu ngay và vào outbox (`sync_outbox`); `appSync.ts` tự gửi khi có mạng.
3. **Chỉ khoá** tính năng cần Server tính toán, hoặc nội dung chưa có trên máy.
4. **Khoá có lý do:** tính năng bị khoá vẫn hiện (mờ), ghi lý do
   ("Cần kết nối mạng") và có nút "Thử lại" — không ẩn, không spinner vô hạn.
5. **Phát hiện offline bằng chính request:** lỗi mạng hoặc timeout của
   `fetch` (không thêm NetInfo — cùng cách `appSync.ts` đang làm).

Ký hiệu: ✅ dùng đầy đủ · 🟡 dùng giới hạn · ⏳ dùng được, lưu hàng chờ,
gửi khi có mạng · 🔒 khoá.

## 2. Bảng tính năng

| # | Nhóm | Tính năng | Offline | Hành vi khi offline | Khi có mạng lại |
|---|---|---|:-:|---|---|
| 1 | Khởi động | Mở app (đã có tài khoản) | ✅ | Session trong Keychain + user đã cache → vào thẳng Home | Âm thầm refresh token + `/me` |
| 2 | Khởi động | Cài mới / tạo tài khoản | 🔒 | Màn "Cần kết nối mạng để tạo tài khoản" + Thử lại | Tiếp tục |
| 3 | Khởi động | Onboarding hồ sơ học + Placement test | ✅ | Lưu cache `pending` | Đẩy hồ sơ lên Server |
| 4 | Trang chủ | Home, Today plan, streak, mục tiêu tuần | ✅ | Đọc SQLite | Đồng bộ tiến độ |
| 5 | Ôn tập | Daily Review (SRS), Item Review | ✅ | Chấm + lên lịch trên máy, ghi outbox | Gửi `/v1/review-events` |
| 6 | Ôn tập | Flashcard, bookmark từ / ngữ pháp / bài | ✅ | Optimistic, lưu local | Đồng bộ |
| 7 | Luyện tập | Practice / Quiz | ✅ | Dùng bài đã tải | Đồng bộ attempt |
| 8 | Thư viện | Tab Bài học / Từ vựng / Ngữ pháp (local) | ✅ | Nội dung đã có trên máy | — |
| 9 | Thư viện | Danh sách bài công khai / catalog | 🟡 | Chỉ hiện bài **đã tải**, nhãn "Có sẵn offline" | Tải lại catalog |
| 10 | Bài học | Mở bài đã tải | ✅ | Bản SQLite (`offline: true`) | Kiểm tra bản mới |
| 11 | Bài học | Mở bài chưa tải | 🔒 | "Bài này chưa có trên máy. Kết nối mạng để tải." | — |
| 12 | Bài học | Lesson Flow 6 bước (học, nghe, đọc) | ✅ | Chạy trên bản đã tải | — |
| 13 | Bài học | Bước 5 — bài viết | ⏳ | Lưu câu trả lời, "Đang chờ chấm" | Gửi chấm, hiện kết quả |
| 14 | Bài học | Bước 5 — bài nói | ⏳ | Ghi âm, hàng chờ upload | Upload, chấm |
| 15 | Bài học | Phân tích câu AI | 🟡 | Phân tích đã lưu xem được; câu mới `offline-missing` | Cho phân tích |
| 16 | Bài học | "Học theo 6 bước" (Compose) | 🔒 | Nút disable + lý do | Mở lại |
| 17 | Khoá học | Course / Level / Unit | 🟡 | Bản cache lần cuối + nhãn "Dữ liệu offline" | Làm mới |
| 18 | Khoá học | Summative task | 🟡 | Dùng cache; nộp bài ⏳ | Gửi bài |
| 19 | Khoá học | Mở khoá khoá học trả phí | 🟡 | Giữ entitlement đã biết lần cuối; không mở khoá mới | Kiểm tra lại |
| 20 | Tạo bài | Dán văn bản → AI | 🔒 | Banner "Tạo bài cần mạng" | Mở lại |
| 21 | Tạo bài | Chụp / chọn ảnh → OCR | 🔒 | OCR chạy trên Server | Mở lại |
| 22 | Tạo bài | YouTube link, Video Hub | 🔒 | Khoá; clip nguồn trong bài có fallback | Mở lại |
| 23 | Nói | Shadowing | ✅ | TTS + ghi âm local, lưu attempt | Upload bản ghi |
| 24 | Nói | Nghe lại bản ghi chỉ có trên Server | 🟡 | Bản trên máy nghe được; bản Server khoá | Phát được |
| 25 | Âm thanh | TTS | 🟡 | Giọng offline của máy; giọng cần mạng → giọng offline | — |
| 26 | Âm thanh | Audio chương đã tải | ✅ | File trên máy | — |
| 27 | Hồ sơ | Xem hồ sơ, tiến độ, báo cáo | ✅ | Local (tên từ user cache) | — |
| 28 | Hồ sơ | Đổi tên hiển thị / số điện thoại | 🔒 | `network_lost`, giữ giá trị cũ | Cho sửa |
| 29 | Cài đặt | Theme, ngôn ngữ, nhắc học, quyền ghi âm | ✅ | Local | — |
| 30 | Dữ liệu | Xoá dữ liệu local, quản lý audio offline | ✅ | Thực hiện ngay | — |
| 31 | Dữ liệu | Xoá bản ghi âm trên Server | ⏳ | Hàng chờ | Gửi lệnh xoá |
| 32 | Tài khoản | Đăng xuất | ✅ | Hỏi xác nhận: offline thì không vào lại được tới khi có mạng | Logout Server |
| 33 | Tài khoản | Chuyển / gộp tài khoản | 🔒 | Khoá | — |
| 34 | Hệ thống | Sync outbox, analytics | ⏳ | Xếp hàng, backoff | Tự đẩy |

### Quyết định

- **#2 giữ khoá.** Tài khoản do Server tạo (bootstrap ticket + idempotency
  key); tạo "tài khoản tạm" offline sẽ sinh nhánh gộp tài khoản phức tạp.
- **#1 không tin user cache mù quáng:** chỉ dùng khi id user cache khớp cả
  `session.user_id` và `current_account_id` (cách ly tài khoản, M4).
- **Chỉ lỗi mạng mới cho vào offline.** Lỗi API (`INVALID_SESSION`,
  `SESSION_REPLAYED`, `MERGE_IN_PROGRESS`, …) giữ nguyên luồng hiện tại.

## 3. Giao diện chung

- **Banner offline** đầu các tab: "Đang offline — tiến độ sẽ đồng bộ khi có
  mạng" (+ "· N mục chờ đồng bộ" khi outbox còn hàng).
- **`LockedFeature`**: component dùng chung cho mọi chỗ 🔒 (icon, lý do,
  Thử lại).
- **Nhãn "Có sẵn offline"** trên thẻ bài đã tải.
- **Store `connectivity`**: `offline` khi request lỗi mạng / timeout,
  `online` khi một request thành công; probe nhẹ khi app về foreground.

## 4. Lộ trình

| Giai đoạn | Nội dung | File chính |
|---|---|---|
| **P0** — vào app khi offline | Cache `AuthUser`; boot dùng session cũ khi lỗi mạng; timeout auth; revalidate khi foreground | `accountBootstrap.ts`, `useAccountStore.ts`, `authClient.ts` |
| **P1** — giao diện offline | Store `connectivity`, banner, `LockedFeature`, khoá các mục 🔒; xác nhận đăng xuất offline | `src/core`, `src/ui/components`, màn Create / Catalog / Account |
| **P2** — cache nội dung | Cache Course / Level / Unit + entitlement (#17, #19); catalog lọc bài đã tải (#9) | `useCurriculum.ts`, `courseClient.ts`, `PublicLessonsList` |
| **P3** — tuỳ chọn | Nháp tạo bài / OCR xếp hàng (#20, #21) | input / ocr |

### Trạng thái triển khai

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| P0 | ✅ Xong | `offlineBoot` trong `accountBootstrap.ts`; user lưu ở `app_settings` (`account.cached_user`), xoá khi đăng xuất; timeout 12s (`AUTH_REQUEST_TIMEOUT_MS`); `revalidate()` khi app về foreground |
| P1 | ✅ Xong | `core/api/connectivity.ts`; `OfflineBanner` trong mọi `AppScreen` (BootGate tắt); `LockedFeature`; Create hub khoá #20–22; cảnh báo đăng xuất offline #32 |
| P2 | ✅ Xong | `courseClient.getList` lưu câu trả lời hợp lệ (`curriculum_cache.*`, entitlement theo tài khoản) và trả lại khi lỗi mạng; catalog / Home rơi về bài đã tải (#9) |
| P3 | Chưa làm | — |

Khác với thiết kế ban đầu:

- Banner chưa hiện số mục chờ đồng bộ ("· N mục chờ").
- #17 không có nhãn "Dữ liệu offline" riêng: banner offline chung đã báo.
- Lỗi Server (5xx) không dùng cache / không mở app offline — chỉ lỗi mạng.

## 5. Rủi ro

- Token hết hạn vẫn cho dùng offline; mọi request Server chờ tới khi có mạng
  và refresh được.
- User cache sai tài khoản → rò dữ liệu giữa tài khoản; vì vậy kiểm tra khớp
  id (mục 2).
- Không có migration: `app_settings` đã là bảng key/value.
