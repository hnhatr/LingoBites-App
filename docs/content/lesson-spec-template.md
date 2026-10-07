# Template phiếu đặc tả bài học (Lesson Spec)

> Phiên bản template: 0.1 (nháp, 07/10/2026). Căn cứ: "Tài liệu yêu cầu – Ứng dụng luyện tiếng Anh" v1.0.
> Bài mẫu đã điền đầy đủ: [`examples/lesson-spec-order-a-drink.md`](examples/lesson-spec-order-a-drink.md).

Phiếu này là **hợp đồng dữ liệu** giữa team nội dung và hệ thống. Player, bộ chấm, lịch ôn, tiến độ và báo cáo chỉ làm được những gì bài đã khai báo ở đây.

## Cách dùng

1. Soạn theo **thứ tự thiết kế ngược**: phần B (mục tiêu), rồi E và F (nhiệm vụ vận dụng và tiêu chí), rồi C (item), rồi D và G (hoạt động, gợi ý), rồi H (ôn).
2. Điền khối YAML ở cuối file. Các bảng bên dưới giải thích từng trường.
3. Kiểm tra bằng checklist **"Bài sẵn sàng"** trước khi nhập vào hệ thống.
4. Trường đánh dấu **(bắt buộc)** thiếu thì không được publish.

---

## A. Định danh và bối cảnh

| Trường | Ý nghĩa | Ví dụ |
|---|---|---|
| `lesson_id` (bắt buộc) | Mã bài ổn định, không đổi khi sửa nội dung | `adult.a1.food.order-drink` |
| `title_vi`, `title_en` (bắt buộc) | Tên bài | "Gọi đồ uống" |
| `topic_id` (bắt buộc) | Chủ đề trong lộ trình | `adult.a1.food` |
| `audience` (bắt buộc) | `kid` (6–11) hoặc `adult` | `adult` |
| `level` (bắt buộc) | Trình độ theo danh mục đã chốt | `A1` |
| `situation` (bắt buộc) | Ai nói với ai, ở đâu, để làm gì | Khách gọi đồ ở quầy cà phê |
| `prerequisites` | Bài và item cần biết trước | `lesson: adult.a1.food.drinks-names` |
| `estimated_minutes` (bắt buộc) | Tổng thời lượng thiết kế | `12` |
| `literacy_required` | Chỉ với trẻ: có cần biết đọc/viết không | `false` |

## B. Mục tiêu đầu ra (can-do)

| Trường | Quy tắc |
|---|---|
| `can_do` (bắt buộc, 1–2 câu) | Bắt đầu bằng "Người học có thể…". Phải **quan sát được** qua lời nói, không viết "biết", "hiểu", "nắm được". |
| `outcome_types` | Các đầu ra bài nhắm tới: `understand`, `repeat`, `use_independently`, `apply`, `retain` |
| `report_phrases` | Câu dùng trong báo cáo khi đạt hoặc chưa đạt, ví dụ "Đã tự gọi đồ uống có nêu cỡ" |

## C. Nội dung trọng tâm (learning items)

Mỗi item là một dòng. **`item_key` phải dùng chung giữa các bài**: tra kho item trước khi tạo mới.

| Trường | Ý nghĩa |
|---|---|
| `item_key` (bắt buộc) | Mã ổn định, ví dụ `pattern:can-i-have-x-please`, `word:large` |
| `kind` (bắt buộc) | `word`, `phrase`, `pattern` (mẫu câu có chỗ trống), `pronunciation`, `listening` (câu hỏi cần nghe hiểu), `grammar` |
| `required` (bắt buộc) | `true`: tính vào điều kiện đạt bài. `false`: mở rộng |
| `text_en`, `meaning_vi` | Nội dung và nghĩa |
| `template`, `slots` | Chỉ với `pattern`: khung câu và giá trị cho từng chỗ trống |
| `accepted_variants` | Cách nói khác vẫn tính là dùng đúng item |
| `common_errors` | Lỗi hay gặp của người Việt: `id`, mô tả, có chấp nhận không, câu phản hồi |
| `media` | Audio, ảnh (bắt buộc có ảnh nếu `audience: kid`) |
| `review_after_pass` | Có đưa vào lịch ôn sau khi đạt bài không |

## D. Hoạt động theo 6 bước

| Trường | Ý nghĩa |
|---|---|
| `activity_id` (bắt buộc) | Mã trong bài |
| `step` (bắt buộc) | `1_review`, `2_introduce`, `3_guided`, `4_variation`, `5_apply`, `6_result` |
| `kind` (bắt buộc) | `listen_and_repeat`, `speaking_drill`, `role_play`, `fill_blank`, `multiple_choice`, `translation`, `listen_choose_picture`… |
| `items` (bắt buộc) | Các `item_key` hoạt động này luyện |
| `modality` (bắt buộc) | `speak`, `listen`, `write`. Hội thoại thì tách phần nghe và phần nói thành hai dòng thời lượng |
| `design_seconds` (bắt buộc) | Thời gian luyện thiết kế, không tính tải, menu, thưởng |
| `required` (bắt buộc) | Thuộc phần luyện bắt buộc hay không |
| `content` | Câu, audio, lựa chọn, đáp án của hoạt động |
| `kid_alternative` | Phương án thay khi trẻ chưa đọc/viết, ví dụ thay `write` bằng `speak` hoặc chọn hình |

Tỷ lệ tham chiếu theo cụm bài: **Speak 70%, Listen 25%, Write 5%**, tính từ `design_seconds`.

## E. Nhiệm vụ vận dụng độc lập

| Trường | Ý nghĩa |
|---|---|
| `task_id` (bắt buộc) | Mã nhiệm vụ |
| `goal` (bắt buộc) | Mục đích giao tiếp của nhiệm vụ, cùng mục tiêu với bài |
| `variants` (bắt buộc, tối thiểu 2) | Mỗi biến thể đổi chi tiết so với bài mẫu: đổi đối tượng, đổi số lượng, đổi câu hỏi |
| `variants[].prompt_vi` | Lời giao nhiệm vụ cho người học (tiếng Việt, hoặc hình với trẻ) |
| `variants[].partner_lines` | Câu người đối diện nói (có audio) |
| `variants[].hidden` | Những gì **không được hiện** trong lượt độc lập |
| `variants[].expected` | Thông tin bắt buộc phải có trong câu trả lời (theo slot) |
| `variants[].use_for` | `apply` (trong bài), `retry` (thử lại), `review` (ôn) |

## F. Tiêu chí đánh giá (rubric)

Mỗi nhiệm vụ vận dụng có một rubric.

| Trường | Ý nghĩa |
|---|---|
| `purpose` (bắt buộc) | Câu trả lời phải đạt được điều gì |
| `focus_required` (bắt buộc) | Item phải xuất hiện (khớp `item_key` hoặc `accepted_variants`) |
| `clarity` (bắt buộc) | Từ khóa phải nghe rõ, ngưỡng tin cậy (tham chiếu cấu hình, không ghi số cứng nếu chưa chốt) |
| `independence` (bắt buộc) | Mức gợi ý cao nhất vẫn tính là độc lập |
| `acceptable_errors` | Lỗi không làm trượt (tham chiếu `common_errors`) |
| `blocking_errors` | Lỗi làm trượt |
| `decision` (bắt buộc) | Quy tắc gộp ra 4 kết quả: `pass_independent`, `pass_with_support`, `not_yet`, `not_assessable` |
| `feedback` | Câu phản hồi cho từng kết quả hoặc từng lỗi chính |

`not_assessable` (lỗi âm thanh hoặc xử lý) **không bao giờ** được tính là sai.

## G. Thang gợi ý

| Trường | Ý nghĩa |
|---|---|
| `hint_levels` (bắt buộc) | Danh sách mức từ nhẹ đến nặng. Mỗi mức có `level`, `type`, nội dung |
| Quy ước mức | `0` không gợi ý · `1` nghe lại câu hỏi · `2` hình hoặc từ khóa · `3` khung câu · `4` câu mẫu đầy đủ |

Mức cao nhất người học đã dùng trong một lượt chính là **mức hỗ trợ** được ghi lại.

## H. Ôn tập

| Trường | Ý nghĩa |
|---|---|
| `review_items` | Item đưa vào lịch ôn sau khi đạt bài |
| `review_task` | Nhiệm vụ dùng khi ôn: một biến thể `use_for: review` của mục E, dùng lại rubric mục F |
| `related_review_in` | Bài sau có dùng lại item này (để kiểm tra vận dụng trong ngữ cảnh mới) |

---

## Checklist "Bài sẵn sàng"

- [ ] Có `can_do` quan sát được.
- [ ] Có ít nhất 1 item `required: true`, mọi item có `item_key` ổn định và đã tra kho.
- [ ] Mọi hoạt động có `step`, `modality`, `design_seconds`, `required`.
- [ ] Có đủ bước 2, 3, 5. Bước 4 có ít nhất 1 hoạt động biến đổi.
- [ ] Nhiệm vụ vận dụng có ít nhất 2 biến thể, có ít nhất 1 biến thể `use_for: review`.
- [ ] Rubric đủ 4 tiêu chí và có quy tắc `decision`.
- [ ] Có thang gợi ý.
- [ ] Nếu `audience: kid`: mọi item có ảnh, mọi hoạt động `write` có `kid_alternative`.
- [ ] Tỷ lệ Speak/Listen/Write đã tính, lệch xa 70/25/5 thì có ghi lý do.
- [ ] Đã thử với ít nhất 3 người học (trên giấy hoặc đóng vai bộ chấm).

---

## Khối YAML trống

```yaml
lesson_id:
title_vi:
title_en:
topic_id:
audience:            # kid | adult
level:
situation:
prerequisites:
  lessons: []
  items: []
estimated_minutes:
literacy_required:   # chỉ với kid

can_do: []
outcome_types: []
report_phrases:
  pass: ""
  needs_support: ""

items:
  - item_key:
    kind:
    required:
    text_en:
    meaning_vi:
    template:          # chỉ với pattern
    slots: {}
    accepted_variants: []
    common_errors:
      - id:
        description_vi:
        acceptable:
        feedback_vi:
    media: {}
    review_after_pass:

activities:
  - activity_id:
    step:
    kind:
    items: []
    modality:
    design_seconds:
    required:
    content: {}
    kid_alternative:

apply_tasks:
  - task_id:
    goal:
    variants:
      - variant_id:
        use_for: []
        prompt_vi:
        partner_lines: []
        hidden: []
        expected: {}
    rubric:
      purpose:
      focus_required: []
      clarity:
        keywords: []
        confidence: config:clarity_threshold
      independence:
        max_hint_level:
      acceptable_errors: []
      blocking_errors: []
      decision: []
      feedback: {}

hint_levels:
  - level: 1
    type:
    content:

review:
  review_items: []
  review_task:
  related_review_in: []
```
