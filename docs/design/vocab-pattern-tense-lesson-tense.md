# Thiết kế: lưu "thì của bài" (P6, trước S6)

> Trạng thái: **CHỜ DUYỆT.** Lập 2026-10-15, dựa trên code thật của LingoBites-Server và LingoBites-App.
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

## 4. Chi tiết phương án B

### 4.1 Server

| # | Chỗ sửa | Việc |
|---|---|---|
| 1 | `items/model/item.ts` | Bỏ `grammar` khỏi `LESSON_UNSUPPORTED_KINDS` (để mảng rỗng, giữ hằng cho rõ ý) |
| 2 | `spec/repository/postgresLessonSpecStore.ts` → `replaceItems` | Thêm luật: **tối đa 1 item `grammar` mỗi bài**, chỉ vai trò `required` (lỗi mới `grammar_limit`). Giữ đúng "1 thì / bài" và để hub / sinh câu không phải chọn |
| 3 | `lessonDelivery/repository/postgresLessonDeliveryStore.ts` → `loadSnapshotWhere` (đường giao bài duy nhất cho người học) | Nhận `grammarAllowed` (từ `X-App-Version ≥ GRAMMAR_MIN_APP_VERSION`, như gói từ). App cũ: bỏ item `grammar` khỏi `lesson_items` **và** khỏi `item_codes` của các task. Xem trước trên admin vẫn thấy đủ |
| 4 | `lessonDelivery/controller/lessonDelivery.ts` | Đọc header, truyền xuống. `content_revision` không đổi theo phiên bản (xem 4.2) |
| 5 | `outcomes/repository/learningOutcomes.ts` → `enrolItems` | Không đổi: thì `required` vào lịch ôn khi học xong bài, như từ |
| 6 | `tasks/repository/postgresTaskStore.ts` | Không đổi: nhiệm vụ cuối unit được chọn thì vì thì đã là item của bài |
| 7 | `spec/model/specViews.ts` | Giữ lý do `unsupported_kind` cho các loại khác sau này; thêm `grammar_limit` |
| 8 | admin-web: trình chọn item của bài | Thêm `grammar` vào các loại được chọn; ma trận item của unit hiện thêm cột thì |

`GRAMMAR_MIN_APP_VERSION` để trống = không App nào nhận `grammar` (mặc định an toàn, như hiện nay).

### 4.2 Rủi ro 1: App cũ tải bài có thì
App cũ parse snapshot chặt; gặp `grammar` là hỏng **cả bài**. Lọc ở mục 4.1.3 xử lý việc này. Đây là chỗ duy nhất giao snapshot bài cho người học (`loadSnapshotWhere`), nên chỉ cần sửa một chỗ. Test: App cũ nhận bài không có thì, task không có mã thì; App mới nhận đủ.

### 4.3 Rủi ro 2: bài tải bằng App cũ, sau đó nâng cấp App
App so `content_revision` để biết bài có bản mới. Bản lọc cho App cũ có **cùng** `content_revision`, nên sau khi nâng cấp, App mới vẫn giữ bản thiếu thì cho tới khi bài đổi lần sau.
- Cách xử lý (App): lần chạy đầu sau khi nâng cấp lên phiên bản đọc được thì trong bài, App đánh dấu mọi bài khoá học đã tải là "có bản cập nhật" (đặt `server_revision` như cơ chế `applyLessonRevisionStates` đang dùng). Bài được tải lại khi có mạng, theo đúng luồng cập nhật hiện có.
- Không đổi DB trên máy (cờ "đã đánh dấu" lưu ở bảng cài đặt có sẵn, hoặc theo `PRAGMA user_version` nếu tiện hơn lúc code).

### 4.4 Rủi ro 3: App cũ nhận lịch ôn của thì
Thì đã vào `item_memory` (học xong bài trên App mới, hoặc trên App cũ vì Server ghi lịch ôn) sẽ được đồng bộ xuống App cũ. App cũ không có nội dung item nên hiện *"N từ cần tải lại bài để ôn"*, dù tải lại cũng không có. Đồng bộ hiện chưa phân biệt phiên bản App.
- **Đề xuất:** chấp nhận ở P6, vì chỉ xảy ra với khoá mới và App cũ không được cập nhật. Chỉ là một dòng nhắc sai, không mất dữ liệu, không hỏng bài.
- Nếu muốn chặn hẳn: lọc `item_memory` của item `grammar` trong luồng đồng bộ cho App cũ. Đồng bộ chưa đọc `X-App-Version`, nên đây là thay đổi riêng, tách bước nếu cần.

### 4.5 App
| Chỗ | Việc |
|---|---|
| `features/lesson/player/logic/lessonHubContent.ts` + hub | Mục "Thì của bài": tên thì, công thức, nút "Luyện câu" (mở `ComboSetupScreen` với thì chọn sẵn) và "Xem bản đồ thì" |
| Đánh dấu tải lại một lần (4.3) | Như trên |
| Ôn tập, bản đồ thì, F9 | Không đổi: đã đọc `grammar` từ P5; nội dung thì lấy từ snapshot bài (`itemContents`) |
| Bộ thẻ bước 1 (`ListenCardDeck`) | Không đổi: chỉ hiện item mà block nhắc tới, thì không tự hiện thành thẻ nghe |

### 4.6 Ảnh hưởng tới S6 và S4
- S6 "Tạo unit từ chủ đề": mỗi bài nhận focus items = 12 từ (`required`) + 1 mẫu (`required`) + **1 thì (`required`)**; nhiệm vụ cuối unit gồm mẫu, thì và 6 từ tiêu biểu; sinh trước câu theo (mẫu, thì của bài, tình huống của bài).
- S4 (đã code): phần kiểm thì của F7 bắt đầu có tác dụng, không cần sửa.

## 5. Thứ tự làm

| # | Repo | Nội dung |
|---|---|---|
| S5b | Server, admin-web | Mở thì trong bài học: 4.1 mục 1–4, 7, 8 + test (App cũ / mới, tối đa 1 thì, nhiệm vụ cuối unit) ⚠️ API công khai |
| S6 | Server | Tạo unit từ chủ đề (khung bài, không AI), có thì như 4.6 |
| A-bước App | App | Mục thì ở hub + đánh dấu tải lại một lần (gộp vào bản phát hành P6) |

## 6. Cần bạn quyết

1. Chọn **B** (đề xuất), **C** hay **A**?
2. Giới hạn **tối đa 1 thì mỗi bài**, có đồng ý không?
3. Rủi ro 3 (App cũ thấy dòng "cần tải lại bài"): **chấp nhận ở P6** (đề xuất), hay làm luôn lọc đồng bộ theo phiên bản?
