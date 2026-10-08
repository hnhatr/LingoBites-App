# Bài mẫu: Gọi đồ uống (người lớn, A1)

> Điền theo [`../lesson-spec-template.md`](../lesson-spec-template.md) v0.1. Đây là bài mẫu để chốt template và schema, chưa phải nội dung chính thức.
> Các giá trị ngưỡng ghi dạng `config:...` vì chưa chốt (xem trang 09 của tài liệu yêu cầu).

## Tóm tắt cho người đọc nhanh

- **Mục tiêu:** tự gọi được một đồ uống có nêu cỡ, và trả lời được khi người bán hỏi "Anything else?".
- **Item bắt buộc:** mẫu câu `Can I have a [size] [drink], please?`, 3 từ chỉ cỡ, 2 câu hỏi của người bán cần nghe hiểu.
- **Bằng chứng đạt bài:** ở lượt vận dụng độc lập, người học gọi được đồ uống *khác* bài mẫu, có nêu cỡ, chỉ dùng tối đa gợi ý mức 1.
- **Tỷ lệ thiết kế:** Speak 70% · Listen 26% · Write 4% (tổng 600 giây luyện).

## Luồng bài theo 6 bước

| Bước | Hoạt động | Hình thức | Giây | Bắt buộc |
|---|---|---|---|---|
| 1 Ôn liên quan | `a1` Nghe tên đồ uống, chọn hình | Listen | 30 | có |
| 1 Ôn liên quan | `a1b` Nói lại tên 3 đồ uống | Speak | 30 | có |
| 2 Làm quen | `a2` Nghe hội thoại mẫu ở quầy, xem nghĩa | Listen | 60 | có |
| 2 Làm quen | `a3` Nghe và chọn: người bán hỏi gì? | Listen | 30 | có |
| 3 Luyện có hướng dẫn | `a4` Nói theo từng cụm, rồi cả câu | Speak | 120 | có |
| 3 Luyện có hướng dẫn | `a5` Luyện âm cuối và trọng âm | Speak | 60 | có |
| 4 Luyện biến đổi | `a6` Nhìn hình, đổi đồ uống và cỡ | Speak | 120 | có |
| 4 Luyện biến đổi | `a7` Đóng vai: trả lời "What size?" và "Anything else?" | Listen 20 + Speak 60 | 80 | có |
| 4 Luyện biến đổi | `a8` Gõ tên đồ uống mình gọi | Write | 25 | không |
| 5 Vận dụng độc lập | `t1` Biến thể A (trong bài) | Listen 15 + Speak 30 | 45 | có |
| 6 Xem kết quả | Màn kết quả | — | 0 | — |

Tính tỷ lệ: Speak 420 giây (70%), Listen 155 giây (26%), Write 25 giây (4%). Tổng 600 giây.

## Bốn kết quả của lượt vận dụng

| Người học nói | Gợi ý đã dùng | Kết quả | Hệ thống làm gì |
|---|---|---|---|
| "Can I have a large lemon tea, please?" | 0 | Đạt độc lập | Đạt bài, đưa item vào lịch ôn |
| "I want large lemon tea." | 0 | Đạt độc lập | Lỗi chấp nhận được: góp ý lịch sự và thiếu "a", vẫn đạt |
| "Can I have a lemon tea, please?" | 2 (xem hình cỡ) | Đạt khi có gợi ý | Luyện lại `a6`, thử lại bằng biến thể B |
| "Lemon tea." | 0 | Chưa đạt | Thiếu cỡ và mẫu yêu cầu: chỉ lỗi chính, về `a4` |
| (đọc nguyên câu mẫu ở gợi ý mức 4) | 4 | Chưa đạt | Không tính độc lập, về `a6` |
| (tiếng ồn, STT không nhận diện) | bất kỳ | Không đánh giá được | Nhờ nói lại, không tính sai |

## Đặc tả đầy đủ

```yaml
lesson_id: adult.a1.food.order-drink
title_vi: Gọi đồ uống
title_en: Ordering a drink
topic_id: adult.a1.food
audience: adult
level: A1
situation: Khách gọi đồ uống ở quầy quán cà phê; người bán hỏi cỡ và hỏi có cần gì thêm không.
prerequisites:
  lessons: [adult.a1.food.drinks-names]
  items: [word:coffee, word:iced-coffee, word:lemon-tea, word:orange-juice, word:milk-tea]
estimated_minutes: 12

can_do:
  - Người học có thể tự gọi một đồ uống có nêu cỡ ở quầy.
  - Người học có thể nghe hiểu và trả lời câu hỏi "What size?" và "Anything else?".
outcome_types: [understand, repeat, use_independently, apply]
report_phrases:
  pass: Đã tự gọi đồ uống có nêu cỡ và trả lời được câu hỏi của người bán.
  needs_support: Gọi được đồ uống nhưng còn cần gợi ý khi nêu cỡ.

items:
  - item_key: pattern:can-i-have-a-size-drink-please
    kind: pattern
    required: true
    text_en: Can I have a [size] [drink], please?
    meaning_vi: Cho tôi một [đồ uống] cỡ [cỡ] nhé.
    template: "Can I have a {size} {drink}, please?"
    slots:
      size: [word:small, word:medium, word:large]
      drink: [word:coffee, word:iced-coffee, word:lemon-tea, word:orange-juice, word:milk-tea]
    accepted_variants:
      - "I'd like a {size} {drink}, please."
      - "Could I get a {size} {drink}?"
      - "A {size} {drink}, please."
      - "I want a {size} {drink}."        # chấp nhận, kèm góp ý lịch sự
    common_errors:
      - id: err.i-want-direct
        description_vi: Dùng "I want…" nghe cộc lốc với người bán
        acceptable: true
        feedback_vi: Câu của bạn hiểu được. Nói "Can I have…" sẽ lịch sự hơn.
      - id: err.missing-article
        description_vi: Thiếu "a" trước cỡ và đồ uống
        acceptable: true
        feedback_vi: Thêm "a" trước "large lemon tea" để câu tự nhiên hơn.
      - id: err.missing-size
        description_vi: Không nêu cỡ
        acceptable: false
        feedback_vi: Bạn chưa nói cỡ. Người bán cần biết bạn muốn cỡ nào.
    media: {audio: pattern_can_i_have.mp3}
    review_after_pass: true

  - item_key: word:small
    kind: word
    required: true
    text_en: small
    meaning_vi: nhỏ
    media: {audio: small.mp3, image: size_small.png}
    review_after_pass: true
  - item_key: word:medium
    kind: word
    required: true
    text_en: medium
    meaning_vi: vừa
    common_errors:
      - id: err.medium-stress
        description_vi: Nhấn sai trọng âm (me-DI-um)
        acceptable: true
        feedback_vi: Nhấn vào âm đầu, ME-di-um.
    media: {audio: medium.mp3, image: size_medium.png}
    review_after_pass: true
  - item_key: word:large
    kind: word
    required: true
    text_en: large
    meaning_vi: lớn
    media: {audio: large.mp3, image: size_large.png}
    review_after_pass: true

  - item_key: listening:what-size
    kind: listening
    required: true
    text_en: What size?
    meaning_vi: Bạn muốn cỡ nào?
    media: {audio: what_size.mp3}
    review_after_pass: true
  - item_key: listening:anything-else
    kind: listening
    required: true
    text_en: Anything else?
    meaning_vi: Bạn cần gì thêm không?
    accepted_variants: ["That's all, thanks.", "No, thank you.", "That's it."]
    media: {audio: anything_else.mp3}
    review_after_pass: true

  - item_key: pron:final-consonant-d-t
    kind: pronunciation
    required: false
    text_en: iced coffee, that's it
    meaning_vi: Giữ âm cuối /t/ trong "iced", "it"
    common_errors:
      - id: err.drop-final-consonant
        description_vi: Bỏ âm cuối, "ice coffee", "tha i"
        acceptable: true
        feedback_vi: Giữ âm /t/ ở cuối "iced" để người nghe hiểu là cà phê đá.
    review_after_pass: false

activities:
  - activity_id: a1
    step: 1_review
    kind: listen_choose_picture
    items: [word:coffee, word:lemon-tea, word:orange-juice]
    modality: listen
    design_seconds: 30
    required: true
  - activity_id: a1b
    step: 1_review
    kind: listen_and_repeat
    items: [word:coffee, word:lemon-tea, word:orange-juice]
    modality: speak
    design_seconds: 30
    required: true
  - activity_id: a2
    step: 2_introduce
    kind: dialogue_listen
    items: [pattern:can-i-have-a-size-drink-please, listening:what-size, listening:anything-else]
    modality: listen
    design_seconds: 60
    required: true
    content:
      lines:
        - {speaker: barista, en: "Hi! What can I get for you?", vi: "Chào bạn! Bạn dùng gì?"}
        - {speaker: customer, en: "Can I have a coffee, please?", vi: "Cho tôi một cà phê nhé."}
        - {speaker: barista, en: "Sure. What size?", vi: "Được ạ. Cỡ nào ạ?"}
        - {speaker: customer, en: "Medium, please.", vi: "Cỡ vừa nhé."}
        - {speaker: barista, en: "Anything else?", vi: "Bạn cần gì thêm không?"}
        - {speaker: customer, en: "No, thank you.", vi: "Không, cảm ơn."}
  - activity_id: a3
    step: 2_introduce
    kind: multiple_choice
    items: [listening:what-size, listening:anything-else]
    modality: listen
    design_seconds: 30
    required: true
    content:
      question_audio: what_size.mp3
      choices_vi: ["Hỏi cỡ", "Hỏi giá", "Hỏi tên"]
      answer_index: 0
  - activity_id: a4
    step: 3_guided
    kind: speaking_drill
    items: [pattern:can-i-have-a-size-drink-please]
    modality: speak
    design_seconds: 120
    required: true
    content:
      chunks: ["Can I have", "a medium coffee", "please"]
      full: "Can I have a medium coffee, please?"
  - activity_id: a5
    step: 3_guided
    kind: listen_and_repeat
    items: [word:medium, pron:final-consonant-d-t]
    modality: speak
    design_seconds: 60
    required: true
    content:
      lines: ["medium", "iced coffee", "That's it."]
  - activity_id: a6
    step: 4_variation
    kind: speaking_drill
    items: [pattern:can-i-have-a-size-drink-please, word:small, word:large]
    modality: speak
    design_seconds: 120
    required: true
    content:
      picture_prompts:
        - {drink: orange-juice, size: small}
        - {drink: milk-tea, size: large}
        - {drink: iced-coffee, size: medium}
  - activity_id: a7
    step: 4_variation
    kind: role_play
    items: [listening:what-size, listening:anything-else]
    modality: [listen, speak]
    design_seconds: {listen: 20, speak: 60}
    required: true
    content:
      partner_lines: ["What size?", "Anything else?"]
  - activity_id: a8
    step: 4_variation
    kind: type_answer
    items: [word:lemon-tea]
    modality: write
    design_seconds: 25
    required: false
    content:
      prompt_vi: Gõ tên đồ uống bạn vừa gọi.

apply_tasks:
  - task_id: t1
    goal: Tự gọi một đồ uống có nêu cỡ và kết thúc lượt gọi món.
    variants:
      - variant_id: A
        use_for: [apply]
        prompt_vi: Bạn muốn một ly trà chanh cỡ lớn. Hãy gọi món.
        partner_lines: ["Hi! What can I get for you?"]
        hidden: [text_en_of_answer, pattern_template]
        expected: {drink: word:lemon-tea, size: word:large}
      - variant_id: B
        use_for: [retry]
        prompt_vi: Bạn muốn một ly nước cam cỡ nhỏ. Người bán sẽ hỏi thêm.
        partner_lines: ["Hi! What can I get for you?", "Anything else?"]
        hidden: [text_en_of_answer, pattern_template]
        expected: {drink: word:orange-juice, size: word:small, closing: listening:anything-else}
      - variant_id: C
        use_for: [review]
        prompt_vi: Bạn muốn một ly trà sữa. Người bán sẽ hỏi cỡ, bạn chọn cỡ vừa.
        partner_lines: ["What can I get for you?", "What size?"]
        hidden: [text_en_of_answer, pattern_template]
        expected: {drink: word:milk-tea, size: word:medium}
    rubric:
      purpose: Người bán biết chính xác đồ uống và cỡ người học muốn.
      focus_required:
        - pattern:can-i-have-a-size-drink-please   # khớp template hoặc accepted_variants
        - slot:size
        - slot:drink
      clarity:
        keywords: ["{drink}", "{size}"]
        confidence: config:clarity_threshold
      independence:
        max_hint_level: 1
      acceptable_errors: [err.i-want-direct, err.missing-article, err.medium-stress, err.drop-final-consonant]
      blocking_errors: [err.missing-size]
      decision:
        - if: audio_error or confidence < config:min_assessable_confidence
          then: not_assessable
        - if: purpose_met and focus_met and clarity_met and max_hint_used <= 1
          then: pass_independent
        - if: purpose_met and focus_met and clarity_met and max_hint_used <= 3
          then: pass_with_support
        - else: not_yet
      feedback:
        pass_independent: Tốt lắm! Bạn đã tự gọi đồ uống rõ ràng.
        pass_with_support: Bạn gọi được rồi. Thử lại một lần nữa mà không cần gợi ý nhé.
        not_yet: "{feedback_of_main_error}"
        not_assessable: Mình chưa nghe rõ. Bạn nói lại giúp mình nhé.

hint_levels:
  - {level: 1, type: replay_partner, content: Phát lại câu của người bán}
  - {level: 2, type: picture, content: Hình đồ uống và biểu tượng cỡ}
  - {level: 3, type: template, content: "Can I have a ___ ___, please?"}
  - {level: 4, type: model_answer, content: Nghe và đọc câu đầy đủ}

review:
  review_items:
    - pattern:can-i-have-a-size-drink-please
    - word:small
    - word:medium
    - word:large
    - listening:what-size
    - listening:anything-else
  review_task: t1.C
  related_review_in:
    - adult.a1.food.order-food        # dùng lại pattern với đồ ăn
    - adult.a1.shopping.ask-for-item  # dùng lại pattern khi mua hàng
```

## Ghi chú cho team kỹ thuật

Bài mẫu này cho thấy các thay đổi dữ liệu cần có so với hiện tại:

- `LearningItems` cần thêm các loại `pattern`, `listening`, `pronunciation`, cùng các trường `template`, `slots`, `accepted_variants`, `common_errors`, `required`. Hiện chỉ có `word` và `grammar`.
- `item_key` phải dùng chung giữa các bài. Hiện ràng buộc unique là `(lesson_id, kind, item_key)`, tức item thuộc riêng một bài. Cần một kho item dùng chung, hoặc một bảng liên kết bài với item.
- Block `activity` cần thêm `step`, `modality`, `design_seconds`, `required`, `items`. Cần thêm các loại `listen_choose_picture`, `dialogue_listen`, `type_answer`.
- Cần thực thể mới cho nhiệm vụ vận dụng (`apply_tasks`), rubric và thang gợi ý.
- Các giá trị `config:*` cần đọc từ cấu hình có version, không hardcode.
