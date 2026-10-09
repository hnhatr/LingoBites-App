# Thiết kế: AI chạy lâu – không bắt người học chờ, app minh bạch

> Trạng thái: **NHÁP, CHỜ DUYỆT**. Ngày lập: 2026-10-09. Áp dụng cho S4.1 (server), S4.2 (admin), S4.3 (app).
> Bổ sung cho `2026-10-09-s4-ai-prompt-config-design.md` (tham số thời gian nằm trong phiên bản prompt).

## 1. Vấn đề

Một lần gọi `compose` thường mất 10–30 giây; khi nhà cung cấp AI chậm, có thể 60 giây hoặc lâu hơn. Nếu gọi lại vì JSON sai thì thời gian gấp đôi. Thiết kế cũ (S4.3 J3) để người học ở màn chờ tới 60 giây: quá lâu, và người học không biết đang xảy ra gì.

**Mục tiêu**
1. Người học **không bị giữ ở màn chờ**: gửi xong là đi tiếp được, bài tự về khi xong.
2. Người học luôn **thấy đang ở bước nào**, còn khoảng bao lâu, và nếu lỗi thì vì sao, làm gì tiếp.
3. Server **luôn kết thúc** mỗi request trong một thời hạn rõ ràng (không treo vô hạn), lỗi do hệ thống thì không trừ lượt người học.
4. Thời gian chờ **ngắn nhất có thể** mà không tốn thêm tiền.

## 2. Server: giới hạn thời gian và tự xử lý khi chậm

### 2.1 Các mức thời gian (đặt trong `params` của phiên bản prompt, có trần cứng)

| Tham số | Mặc định | Trần cứng | Ý nghĩa |
|---|---|---|---|
| `ai_timeout_ms` | 45 000 | 90 000 | Một lần gọi AI quá thời gian này thì huỷ (`AbortController`) |
| `job_budget_ms` | 150 000 | 240 000 | Tổng thời gian một request (mọi lần gọi + dựng + ghi) |
| `max_output_tokens` | 2 000 | 4 000 | Giới hạn độ dài đầu ra, cũng giới hạn thời gian sinh |
| `fallback_model` | null | trong `AI_ALLOWED_MODELS` | Model nhanh hơn dùng cho lần gọi lại khi lần đầu **quá thời gian** |

- Lease của request `kind = compose` = `job_budget_ms` + 30 giây (lease bài thường giữ 120 giây như hiện nay), để worker khác không nhận lại request đang chạy.
- Hết `job_budget_ms` → request `failed` với `COMPOSE_TIMEOUT`.

### 2.2 Khi AI chậm hoặc lỗi

| Tình huống | Server làm gì | Tính lượt người học? |
|---|---|---|
| Lần gọi đầu quá `ai_timeout_ms` | Gọi lại 1 lần, dùng `fallback_model` nếu có (cùng prompt) | Không, nếu cuối cùng thất bại |
| Nhà cung cấp lỗi 429 / 5xx | Chờ 2–5 giây rồi gọi lại 1 lần (trong `job_budget_ms`) | Không, nếu cuối cùng thất bại |
| JSON sai | Gọi lại 1 lần kèm lỗi (như cũ) | Có (AI đã trả lời) |
| Hết `job_budget_ms` | `failed COMPOSE_TIMEOUT`, `retryable = true` | **Không** |
| Worker chết giữa chừng | Lease hết hạn → worker khác nhận lại, chạy lại từ đầu với **cùng phiên bản prompt** (đã ghim) | Không tính thêm |

Quy tắc lượt (bổ sung H12): **chỉ lượt AI trả lời được** (bài tạo thành công, "không phù hợp", hoặc JSON sai tới hết lần gọi lại) mới tính. Lượt hỏng vì timeout, lỗi nhà cung cấp, lỗi hệ thống thì **không tính**; vẫn tính vào trần chi phí tháng (`ai_calls`).

### 2.3 Báo tiến độ (cột mới ⚠️ migration 007)

`lesson_creation_requests.stage varchar(24) NULL` + `stage_at timestamptz NULL`, worker cập nhật khi đổi bước:

| `stage` | Hiện trên app | Thường mất |
|---|---|---|
| `queued` | "Đang xếp hàng" | < 2 giây |
| `preparing` | "Đang đọc các câu bạn chọn" | < 1 giây |
| `writing` | "AI đang soạn bài (tình huống, mẫu câu, hội thoại)" | 10–30 giây |
| `retrying` | "Đang soạn lại cho chuẩn hơn" | 10–30 giây |
| `building` | "Đang tạo các bước luyện tập" | < 1 giây |
| `saving` | "Đang lưu bài" | < 1 giây |
| (`succeeded` / `failed`) | Kết quả | |

`GET /v1/lesson-creations/:id` trả thêm:
- `stage`, `stage_started_at`, `elapsed_ms`;
- `expected_ms`: **p50 thời gian thật** của phiên bản prompt đang dùng (tính từ 50 request gần nhất, cache 5 phút); chưa đủ dữ liệu thì 25 000;
- khi `failed`: `error_code`, `retryable`, `reason_vi` / `suggestion_vi` (nếu có), `quota_charged: boolean` để app nói rõ có bị trừ lượt hay không.

`GET /v1/lesson-creations?kind=compose&active=true`: danh sách request đang chạy của người học → máy khác hoặc app vừa mở lại cũng thấy.

### 2.4 Rút ngắn thời gian (không tốn thêm tiền)

- Prompt tách phần cố định lên đầu → nhà cung cấp cache phần đầu, lần sau nhanh hơn (đã có trong thiết kế prompt §7).
- `max_output_tokens` vừa đủ; ví dụ mẫu ngắn.
- Mọi phần không cần AI (dịch, IPA, bước 2–4, tiêu chí) đã lấy từ DB / luật, không chờ AI.
- Worker nhận request compose **ngay** (không xếp sau hàng tạo bài dài): ưu tiên theo `kind` khi claim, hoặc 1 worker riêng cho compose (cấu hình `COMPOSE_WORKER_CONCURRENCY`, mặc định 2).

**Không làm lúc này:** stream từng phần JSON về app (phức tạp, lợi ích nhỏ vì bài chỉ dùng được khi đủ và qua validator).

## 3. App: gửi xong là đi tiếp, bài tự về

### 3.1 Luồng

```
Chọn câu ─► [Học theo 6 bước] ─► gửi (1–2 giây)
                                   │
                    ┌──────────────┴───────────────┐
                    ▼                              ▼
     Sheet tiến độ (không chặn)          Thẻ "Đang tạo bài" ở
     - bước hiện tại + thanh tiến độ      Thư viện / Hôm nay
     - "Thường mất khoảng 25 giây"        (thấy được từ mọi nơi)
     - [Nghe trước các câu đã chọn]
     - [Để đó, học tiếp]  ← đóng sheet, request vẫn chạy
                    │
                    ▼ khi xong
     - Đang mở sheet: chuyển sang "Bài đã sẵn sàng" + [Bắt đầu]
     - Đang ở màn khác: toast "Bài 6 bước đã sẵn sàng" + [Mở]
     - App ở nền: khi mở lại app → kiểm ngay, toast + chấm đỏ trên thẻ bài
```

### 3.2 Từng phần

| Phần | Chi tiết |
|---|---|
| **Sheet tiến độ** | Danh sách các bước (§2.3) có dấu ✓ / đang chạy; thời gian đã chờ; "Thường mất khoảng N giây" (từ `expected_ms`). Quá `expected_ms` × 2: đổi chữ thành "Lâu hơn thường lệ. Bạn cứ học tiếp, bài sẽ tự xuất hiện khi xong." Không có thanh tiến độ giả chạy tới 99%. |
| **"Nghe trước các câu đã chọn"** | Trong lúc chờ, người học nghe và nhắc lại chính các câu đã chọn (TTS, hoặc đoạn video với bài YouTube). App đã có đủ dữ liệu, **không cần server**. Đây chính là nội dung bước 2 của bài sắp có. Lượt này chỉ để khởi động, **không ghi** lượt làm. |
| **Thẻ "Đang tạo bài"** | Ở đầu Thư viện → "Bài của tôi" và màn Hôm nay: tên bài gốc, số câu, bước hiện tại. Bấm vào mở lại sheet. Xong thì thành thẻ bài thường có chip "Mới · AI tạo". |
| **Lưu request đang chờ** | Lưu `request_id` + bài gốc + câu đã chọn vào AsyncStorage (cùng cách `creationIdempotencyStore` đang làm), **không đổi SQLite**. Mở lại app → đọc danh sách, poll tiếp; đồng bộ thêm với `GET /v1/lesson-creations?kind=compose&active=true`. |
| **Poll** | Khi sheet mở: 2 giây. Khi sheet đóng, app ở foreground: 5 giây. App ở nền: dừng; khi quay lại foreground thì kiểm ngay. Dừng hẳn khi request kết thúc. |
| **Thông báo** | Trong app: toast + chấm "Mới" trên thẻ bài. App ở nền thì không chạy nền được nếu không thêm thư viện background fetch (**không thêm**); khi người học mở lại app sẽ thấy ngay. Thông báo khi app đóng cần push từ server (8.7), không thuộc Stage 4. |
| **Giới hạn đồng thời** | Mỗi người học tối đa **1** request compose đang chạy. Gửi thêm khi đang có → mở sheet của request đang chạy. |
| **Offline** | Không gửi được khi mất mạng (nút tắt, như hiện nay). Mất mạng khi đang chờ: thẻ ghi "Đang chờ mạng…", có mạng lại thì poll tiếp; request trên server vẫn chạy bình thường. |

### 3.3 Khi thất bại: nói rõ, có việc để làm tiếp

| `error_code` | Chữ hiện (vi) | Nút | Trừ lượt? |
|---|---|---|---|
| `COMPOSE_TIMEOUT`, lỗi nhà cung cấp | "Máy chủ AI đang chậm, chưa tạo được bài. Lượt này **không bị tính**." | [Thử lại] (giữ nguyên câu đã chọn) | Không |
| `COMPOSE_NOT_SUITABLE` | `reason_vi` + `suggestion_vi` | [Chọn lại câu] | Có |
| `COMPOSE_AI_INVALID` / `COMPOSE_SPEC_INVALID` | "AI chưa tạo được bài đạt chuẩn từ các câu này. Thử chọn đoạn khác nhé." | [Chọn lại câu] [Thử lại] | Có / theo `quota_charged` |
| `COMPOSE_LIMIT_REACHED` | "Hôm nay bạn đã dùng hết N lượt. Lượt mới có lúc 0:00." | — | — |
| `COMPOSE_BUDGET_EXHAUSTED` | "Tính năng tạm dừng, vui lòng thử lại sau." | — | Không |

App luôn đọc `quota_charged` từ server để viết câu "có / không bị tính lượt", không tự đoán.

## 4. Admin (S4.2)

Admin cũng không phải chờ: dialog "Sinh bài 6 bước" hiện tiến độ như §2.3; đóng dialog thì request vẫn chạy, bài nháp xuất hiện trong unit khi xong. Trang unit có dòng "Đang sinh: N bài". Trang "Prompt AI" (S4.2b) hiện p50 / p95 thời gian theo phiên bản (§8 thiết kế prompt).

## 5. Thay đổi so với các plan

| Plan | Thay đổi |
|---|---|
| S4.1 | Migration 007 thêm `stage`, `stage_at`; tham số thời gian trong `params`; timeout + gọi lại bằng `fallback_model`; `COMPOSE_TIMEOUT`; lease riêng cho compose; `quota_charged`; `expected_ms`; route danh sách request đang chạy; 1 request đang chạy / người học; ưu tiên claim compose. |
| S4.2 | Dialog không chặn; dòng "Đang sinh" trên unit. |
| S4.3 | Thay J3 (chờ 60 giây) bằng §3: sheet không chặn, nghe trước, thẻ "Đang tạo bài", lưu request chờ, poll theo trạng thái app, toast / thông báo local, bảng lỗi §3.3. |

## 6. Kiểm thử

| Repo | Nội dung |
|---|---|
| Server | AI giả lập chậm hơn `ai_timeout_ms` → gọi lại bằng `fallback_model`; chậm cả hai → `COMPOSE_TIMEOUT`, `quota_charged = false`, `ai_calls` vẫn tăng; hết `job_budget_ms` → failed; `stage` đổi đúng thứ tự; lease compose dài hơn; người học có request đang chạy gửi thêm → trả request cũ; `expected_ms` mặc định khi chưa có dữ liệu. |
| App | Đóng sheet → request vẫn được poll; mở lại app → khôi phục request chờ từ AsyncStorage; poll dừng ở nền và kiểm ngay khi về foreground; xong khi đang ở màn khác → toast; lỗi timeout hiện "không bị tính" theo `quota_charged`; mất mạng → "Đang chờ mạng…"; nghe trước không ghi lượt làm. |
| Kiểm tay | Máy thật: gửi, đóng sheet, học bài khác, nhận toast; khoá màn hình 1 phút rồi mở → thấy toast và bài mới. |

## 7. Câu hỏi để bạn chốt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| W1 | Có màn "Nghe trước các câu đã chọn" trong lúc chờ | Có |
| W2 | Mỗi người học chỉ 1 request đang chạy | Có |
| W3 | Lượt hỏng vì timeout / lỗi hệ thống không trừ lượt | Có |
| W4 | Lần gọi lại sau timeout dùng model nhanh hơn (`fallback_model`) | Có, nếu admin cấu hình; mặc định để trống (gọi lại cùng model) |
| W5 | Thông báo khi bài xong | Toast + chấm "Mới" trong app; khi app đóng thì chờ push server (8.7) |
