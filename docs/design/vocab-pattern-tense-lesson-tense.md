# Thiết kế: lưu "thì của bài" (P6, trước S6)

> Trạng thái: **ĐÃ CHỐT 2026-10-16: phương án B, App làm mới hoàn toàn (không còn App cũ), nên không có bước lọc theo phiên bản nào (bản trước có 3 rủi ro cho App cũ, nay không còn).** S5b đã code. Lập 2026-10-15, dựa trên code thật của LingoBites-Server và LingoBites-App.
> Liên quan: [`vocab-pattern-tense-path.md`](./vocab-pattern-tense-path.md) §3.6, [plan P6](../superpowers/plans/2026-10-15-vocab-pattern-tense-p6.md) §4.

## 1. Vấn đề

Thiết kế khoá "Oxford 3000 + IELTS" ghi mỗi bài có **≈ 12 từ + 1 mẫu + 1 thì + 1–2 tình huống**. Code hiện tại không có chỗ lưu "1 thì":

| Chỗ | Hiện trạng | Hệ quả |
|---|---|---|
| Focus items của bài (`lesson_items`) | Chặn item `grammar` (`LESSON_UNSUPPORTED_KINDS` trong `items/model/item.ts`), vì App cũ không đọc được `grammar` trong snapshot bài | Không gắn thì vào bài được |
| Nhiệm vụ cuối unit (`task_items`) | Chỉ được dùng item có trong các bài của unit | Cũng không chứa thì được, nên phần kiểm thì của F7 (S4) không bao giờ có item để kiểm |
| Cột trên `lessons` | Không có | — |

Plan P5 từng ghi *"Mở chặn `grammar` trong bài học … chỉ gửi cho App từ phiên bản hỗ trợ"* nhưng mới làm cho gói từ, chưa làm cho bài học.

## 2. Thì của bài được dùng ở đâu

1. **Dựng unit** (S6): chọn thì cho từng bài, sinh trước câu tổ hợp (mẫu × thì × tình huống).
2. **Hub bài trên App**: hiện "Thì của bài" và nút "Luyện câu" (mở bộ câu tổ hợp với thì chọn sẵn).
3. **Lịch ôn**: học xong bài thì thì vào `item_memory`, để Bản đồ thì (F3) và tiến độ (F9) có số liệu.
4. **Nhiệm vụ cuối unit (F7)**: kiểm người học có dùng thì của tuần không.
5. **Admin**: xem và sửa thì của bài; ma trận item của unit.

## 3. Các phương án

### A. Chỉ dùng lúc tạo, không lưu
Thì chọn trong đề xuất unit chỉ dùng để sinh trước câu.
- ✅ Không đổi gì.
- ❌ Mất cả 2, 3, 4, 5 ở §2. Admin không biết bài dạy thì nào. Không đúng thiết kế.

### B. Thì là một focus item của bài (đề xuất)
Bỏ chặn `grammar` trong `lesson_items`; khi giao bài cho App cũ thì lọc ra.
- ✅ Dùng lại toàn bộ cơ chế có sẵn: vai trò `required`, ghi lịch ôn khi học xong bài (`enrolItems`), nhiệm vụ cuối unit, ma trận item của unit, trang sửa bài, kiểm spec. Đáp ứng đủ 5 việc ở §2.
- ✅ Đúng với ý định ban đầu (plan P5) và đúng nghĩa: thì là thứ bài dạy, như từ và mẫu câu.
- ⚠️ Đổi nội dung snapshot bài (API công khai). Có 3 rủi ro, xử lý ở §4.

### C. Cột riêng `lessons.grammar_item_id` + API riêng
Migration thêm cột (null được, FK `items`), không đưa vào snapshot; App lấy qua một API riêng.
- ✅ Không đụng snapshot, App cũ không bị gì.
- ❌ Thành hai khái niệm "bài dạy gì" song song (`lesson_items` và cột mới). Phải làm lại riêng: ghi lịch ôn, nhiệm vụ cuối unit (gộp thì của các bài), trường sửa trên admin, ma trận item, API cho App. Hub bài khi offline không biết thì của bài.
- ❌ Vẫn gặp đúng rủi ro "App cũ nhận lịch ôn của thì" (§4.3) nếu muốn thì vào lịch ôn.

**Đề xuất: B.** C tránh được việc đổi snapshot nhưng tốn nhiều code hơn và để lại hai nguồn sự thật. Các rủi ro của B có cách giảm rõ ràng và chỉ nằm ở một đường giao bài.

## 4. Chi tiết phương án B (đã chốt)

App được làm mới hoàn toàn, không còn bản cũ nào gọi Server, nên **không lọc theo phiên bản khi giao bài**, không cần đánh dấu tải lại, và App không gặp lịch ôn của thì mà thiếu nội dung. (Nếu sau này vẫn còn bản cũ, chặn bằng màn bắt cập nhật thay vì lọc từng chỗ.)

### 4.1 Server (S5b, đã code)

| # | Chỗ sửa | Việc |
|---|---|---|
| 1 | `items/model/item.ts` | `LESSON_UNSUPPORTED_KINDS` thành rỗng (giữ hằng); thêm `LESSON_GRAMMAR_MAX = 1` |
| 2 | `spec/repository/postgresLessonSpecStore.ts` → `replaceItems` | **Tối đa 1 item `grammar` mỗi bài, chỉ vai trò `required`**; sai thì `400 ITEM_REF_INVALID`, lý do `grammar_limit` |
| 3 | `canonicalLesson/model/contract.ts` → `LessonSnapshotItemSchema` | Thêm `grammar` vào `kind` ⚠️ hợp đồng giao bài (App mới đã đọc được từ P5) |
| 4 | `lessonDelivery` (`snapshotItem.ts`, store) | Bỏ phép ép kiểu "bài không có grammar"; giao thì như mọi item |
| 5 | `outcomes` `enrolItems`, `tasks`, `evaluation` | Không đổi: thì `required` vào lịch ôn khi học xong bài; nhiệm vụ cuối unit chọn được thì; phần chấm bài lọc theo loại item nên bỏ qua thì |
| 6 | admin-web `LessonItemsTab` | Trình chọn item vốn cho chọn mọi loại; thêm câu giải thích lý do bị từ chối (`grammar_limit`…) |

### 4.2 App (gộp vào bản phát hành P6)
| Chỗ | Việc |
|---|---|
| `features/lesson/player/logic/lessonHubContent.ts` + hub | Mục "Thì của bài": tên thì, công thức, nút "Luyện câu" (mở `ComboSetupScreen` với thì chọn sẵn) và "Xem bản đồ thì" |
| Ôn tập, bản đồ thì, F9 | Không đổi: đã đọc `grammar` từ P5; nội dung thì lấy từ snapshot bài (`itemContents`) |
| Bộ thẻ bước 1 (`ListenCardDeck`) | Không đổi: chỉ hiện item mà block nhắc tới |

### 4.3 Ảnh hưởng tới S6 và S4
- S6 "Tạo unit từ chủ đề": mỗi bài nhận focus items = 12 từ + 1 mẫu + **1 thì** (đều `required`); nhiệm vụ cuối unit gồm mẫu, thì và 6 từ tiêu biểu; sinh trước câu theo (mẫu, thì của bài, tình huống của bài).
- S4 (đã code): phần kiểm thì của F7 bắt đầu có tác dụng, không cần sửa.

### 4.4 Dọn dẹp tuỳ chọn (chưa làm)
Các chỗ chặn `grammar` theo `X-App-Version` (gói từ, thư viện, tiến độ, `GRAMMAR_MIN_APP_VERSION`) không còn cần khi không có App cũ. Bỏ là một bước riêng, chỉ làm khi được yêu cầu.

## 5. Thứ tự làm

| # | Repo | Nội dung |
|---|---|---|
| S5b ✅ | Server, admin-web | Mở thì trong bài học (4.1) + test (tối đa 1 thì, snapshot, lịch ôn, nhiệm vụ cuối unit) ⚠️ hợp đồng giao bài |
| S6 | Server | Tạo unit từ chủ đề (khung bài, không AI), có thì như 4.3 |
| A-bước App | App | Mục thì ở hub (gộp vào bản phát hành P6) |

## 6. Đã chốt (2026-10-16)

1. Phương án **B**.
2. **Tối đa 1 thì mỗi bài**, vai trò `required`.
3. App làm mới hoàn toàn: không lọc theo phiên bản, không xử lý tải lại.
