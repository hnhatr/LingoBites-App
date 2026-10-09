# S4.1 – Bản nháp prompt `compose` (để review)

> ⚠️ **Đã được thay bằng** `2026-10-09-s4-ai-prompt-config-design.md` §7 (prompt v1 tách system / user, mọi con số thành `{{params.*}}`, lưu trong kho prompt có phiên bản). File này giữ lại vì có ví dụ, luật kiểm và ca mẫu; phần nào khác §7 thì theo §7.

> Trạng thái: **NHÁP, CHỜ REVIEW**. Ngày lập: 2026-10-09. Đi kèm plan `2026-10-09-s4-1-server-lesson-composer.md` §4.
> Code sẽ nằm ở `LingoBites-Server/src/modules/curriculum/composer/service/composeAi.ts`.
> Prompt viết **tiếng Anh**, giống các prompt hiện có (`creationEnrich.ts`, `creationTranslation.ts`), vì model theo luật tốt hơn. Kết quả trả về: nội dung học bằng tiếng Anh, phần giải thích bằng tiếng Việt (D4).

## 1. Tổng quan một lần gọi

```
Server chuẩn bị (không AI)                AI (1 lần)                     Server kiểm (không AI)
─────────────────────────                 ──────────                     ─────────────────────
câu đã chọn (en, vi)          ┐                                         zod + luật riêng (§5)
phân tích đã lưu của câu      ├─► prompt ─► JSON ───────────────────►   sai → gọi lại 1 lần kèm lỗi (§6)
item có sẵn khớp với câu      │                                         đúng → composeLesson() → validator
trình độ, đối tượng           ┘                                         (0 vi phạm mới ghi DB)
```

- Phần **AI làm**: những gì cần hiểu ngữ cảnh. Gồm: bài có dùng được để học giao tiếp không; can-do; tình huống; chọn item trọng tâm; rút mẫu câu có chỗ trống; viết đề bài và gợi ý; viết hội thoại nhập vai có đổi chi tiết.
- Phần **server làm theo luật**: bước 2 (chính các câu đã chọn), bước 3–4 (`activityDrafts` của PR 8), tiêu chí chấm, mã bài, thời lượng, IPA (từ CMUdict). AI không phải viết những phần này, nên prompt ngắn hơn và ít chỗ để sai.
- **Không gửi** tên, email, mã người học hay tiêu đề bài người học tự đặt. Chỉ gửi câu, bản dịch và item.

## 2. Dữ liệu điền vào prompt

| Biến | Lấy từ | Giới hạn |
|---|---|---|
| `{{level}}` | Admin: mã level của unit đích. Người học: `A1` | 1 trong `Pre-A1`, `A1`, `A2`, `B1` |
| `{{audience}}` | `lessons.audience` của bài gốc (`all` / `adult` / `child`) | |
| `{{sentences}}` | Câu đã chọn: `id` ngắn (`s1`, `s2`…), `en`, `vi` | 2–8 câu, mỗi câu ≤ 300 ký tự |
| `{{analysis_hints}}` | Từ vựng / ngữ pháp đã lưu của các câu đó (enrich hoặc phân tích khi bấm). Câu chưa có thì bỏ trống | ≤ 5 từ + 2 điểm ngữ pháp mỗi câu |
| `{{catalog_items}}` | Item `published` trong danh mục có `normalizeItemKey` xuất hiện trong câu: `code`, `kind`, `text`, `meaning_vi` | ≤ 40 |

Id câu gửi cho AI là `s1`, `s2`…, không phải uuid, để AI không chép sai. Server tự đổi lại thành uuid.

## 3. Prompt (bản nháp)

```text
You design one short English speaking lesson for Vietnamese learners, using
backward design: first the outcome, then the situation, the key language, and
the tasks that show the learner can do it without help.

Learner level: {{level}} (CEFR). Audience: {{audience}}.

RULES
1. Decide first which sentences belong to ONE communication situation
   (someone says something to someone, somewhere, to get something done).
   a. If some sentences do not fit that situation (another topic, a fragment
      from somewhere else), leave them out: "used_sentence_ids" lists only the
      sentences you keep, in their original order.
   b. If the sentences describe or tell something but contain no dialogue, you
      may choose ONE everyday situation in which a learner would naturally say
      them (for example telling a friend about the weather) and set
      "situation_source": "inferred". If the sentences already show who speaks
      to whom, set "situation_source": "source".
   c. If fewer than 2 sentences can be kept, or no everyday situation fits
      (songs, poems, news, lists of facts, unrelated sentences), set
      "suitable": false, fill "reason_vi" (why) and "suggestion_vi" (what to
      select instead) with one short Vietnamese sentence each, and set
      "lesson": null.
2. Stay inside the language of the sentences. Do not teach words or structures
   above {{level}} that the sentences do not contain.
3. "can_do": 1–2 Vietnamese sentences, each starting with an action verb the
   learner can show (gọi, hỏi, trả lời, giới thiệu, đề nghị…). Never "hiểu",
   "biết", "nắm được".
4. "situation": who speaks (speaker), to whom (listener), where (place), to do
   what (purpose). Vietnamese, short phrases, as in "khách" / "người bán" /
   "quán cà phê" / "gọi đồ uống".
5. "items": 3–8 words or short phrases the learner must use. Prefer an entry of
   CATALOG ITEMS: then copy its "code" exactly and leave the other fields as in
   the catalog. A new item has "code": null. Mark "required": true only for
   items the independent task cannot be done without (at most 5).
6. "patterns": 1–2 reusable sentence frames taken from the sentences, with
   1–2 slots written as {slot_name} (lower_case letters and _). "slots" is a
   list with one entry per slot ("name" = the slot_name in the frame); each
   lists 2–6 values that fit the situation and the level. "variants" are other
   natural ways to say the same frame, using exactly the same slots (0–3).
   "example_sentence_ids" lists the given sentences that match the frame.
7. "guided_task": the learner practises the patterns with support. Vietnamese
   title and prompt; "hint_levels": 2–3 Vietnamese hints, from a gentle nudge
   to almost the answer.
8. "independent_task": the same goal in a CHANGED situation (another place,
   item, person or detail), so the learner cannot just repeat the sentences.
   Vietnamese title and prompt; no hints.
9. "role_play": a short dialogue (4–8 turns) for the changed situation. The
   learner's turns must use the patterns (set "pattern_index"); the other
   speaker's turns stay at {{level}}. Every turn has English and Vietnamese.
10. All English must be natural, correct, and polite. All Vietnamese must be
   natural Vietnamese, not word-by-word translation.

Lesson sentences (JSON):
{{sentences}}

Saved analysis hints (JSON, may be empty):
{{analysis_hints}}

CATALOG ITEMS (JSON, may be empty):
{{catalog_items}}

Return ONLY one JSON object that matches the OUTPUT TEMPLATE below, with
exactly these keys and no others. Use null where the template allows it; never
omit a key. No markdown, no comments.

OUTPUT TEMPLATE
{
  "suitable": boolean,
  "reason_vi": string | null,          // null when suitable
  "suggestion_vi": string | null,      // null when suitable
  "lesson": null | {                   // null when not suitable
    "used_sentence_ids": [string],
    "situation_source": "source" | "inferred",
    "can_do": [string],
    "situation": { "speaker": string, "listener": string, "place": string, "purpose": string },
    "items": [{ "code": string | null, "kind": "word" | "phrase", "text": string,
                "meaning_vi": string, "ipa": string | null, "pos": string | null,
                "required": boolean }],
    "patterns": [{ "frame": string, "meaning_vi": string,
                   "slots": [{ "name": string, "label_vi": string, "values": [string] }],
                   "variants": [string], "example_sentence_ids": [string] }],
    "guided_task": { "title_vi": string, "prompt_vi": string, "hint_levels": [string] },
    "independent_task": { "title_vi": string, "prompt_vi": string,
                          "situation": { "speaker": string, "listener": string, "place": string, "purpose": string } },
    "role_play": { "learner_speaker": "A" | "B",
                   "turns": [{ "speaker": "A" | "B", "text_en": string, "text_vi": string,
                               "pattern_index": integer | null }] }
  }
}
```

Ghi chú thiết kế:
- Luật 1 là cửa của D2: bài không phù hợp thì dừng sớm, trả về rất ít token (vẫn tính lượt vì đã gọi AI, theo H12).
- Luật 2 và 6 giữ bài **bám sát nguồn**. Không cho AI "dạy thêm" thứ ngoài câu đã chọn.
- Luật 3 ứng với cảnh báo `CAN_DO_NOT_OBSERVABLE` của validator: tránh động từ không quan sát được.
- Luật 8 yêu cầu **đổi chi tiết** ở bước 5, đúng tinh thần "vận dụng độc lập" (không chỉ lặp lại câu).
- Đầu ra bị khoá bằng **3 lớp** (xem §3.1): khuôn trong prompt, JSON Schema do nhà cung cấp AI ép, và server kiểm lại.

## 3.1 Khuôn đầu ra: 3 lớp để AI không sinh sai định dạng

Chỉ ghi khuôn trong prompt thì **chưa đủ**: model vẫn có thể đổi tên trường, bỏ trường, thêm trường, trả `"A/B"` thay vì `"A"`. Vì vậy đầu ra được khoá bằng 3 lớp:

| Lớp | Làm gì | Bắt được lỗi gì | Không bắt được |
|---|---|---|---|
| 1. Khuôn trong prompt (`OUTPUT TEMPLATE` ở §3) | Cho model thấy đúng hình dạng và ý nghĩa từng trường | Giúp model hiểu; không đảm bảo | — |
| 2. **Structured output**: gửi JSON Schema cho nhà cung cấp AI | OpenAI: `response_format: { type: "json_schema", json_schema: { name: "compose_lesson", strict: true, schema } }`. Gemini: `generationConfig.responseSchema`. Model **không thể** trả JSON khác schema. | Sai tên trường, thiếu / thừa trường, sai kiểu, giá trị ngoài `enum` (`kind`, `speaker`, `situation_source`), JSON hỏng | Luật phụ thuộc nhau (slot trong frame phải khớp `slots`, id câu phải thuộc danh sách), độ dài, số lượng |
| 3. Server kiểm lại (zod + luật §5) | Parse bằng `ComposeAiResponseSchema` rồi kiểm luật nghiệp vụ | Mọi thứ lớp 2 không bắt được | — |

Sai ở lớp 3 thì gọi lại 1 lần kèm danh sách lỗi (§6). Sau đó `composeLesson()` dựng bài và validator (`checkLessonSpec`) kiểm thêm một lần nữa trước khi ghi DB.

**Vì sao khuôn có dạng như trên:**
- Chế độ `strict` của OpenAI yêu cầu **mọi trường đều bắt buộc** và cấm khoá động. Vì vậy:
  - bài "không phù hợp" và bài "phù hợp" dùng **chung một khuôn** (`lesson: null` khi không phù hợp), thay vì hai hình dạng khác nhau;
  - `slots` là **danh sách** `[{ name, label_vi, values }]` thay vì object có khoá là tên slot. Server đổi lại thành `payload.slots` của item pattern;
  - trường không dùng thì để `null`, không bỏ.
- Schema viết tay trong `composer/model/composeAiSchema.ts` (JSON Schema dạng hằng số), **không thêm thư viện** (zod 3 hiện có chưa xuất được JSON Schema). Test so khớp: mọi fixture hợp lệ với schema thì cũng hợp lệ với zod, và ngược lại cho các fixture lỗi.
- `temperature: 0.2` (thấp hơn mức 0.4 của prompt dịch) để kết quả ổn định hơn.

**Cách thực hiện trong code:** hàm `callProviderJson` (`canonicalLesson/service/creationAi.ts`) thêm tham số tuỳ chọn `jsonSchema`.
- Có schema: OpenAI gửi `json_schema` + `strict`; Gemini gửi `responseSchema`.
- Không có schema (các prompt dịch, IPA, enrich hiện nay): giữ nguyên `json_object`, **không đổi hành vi cũ**.
- Model không hỗ trợ structured output (provider báo lỗi 400): ghi log `compose_schema_unsupported`, gọi lại bằng `json_object` và vẫn nhờ lớp 1 và lớp 3. Lần gọi lại này tính vào `ai_calls`.

## 4. Ví dụ (dùng làm fixture test)

**Đầu vào:** bài YouTube người học tạo; chọn 4 câu; trình độ A1. Catalog có `word:large` (đã publish).

```json
[
  { "id": "s1", "en": "Hi, what can I get for you?", "vi": "Chào bạn, bạn muốn dùng gì?" },
  { "id": "s2", "en": "Can I have a large latte, please?", "vi": "Cho tôi một ly latte lớn nhé." },
  { "id": "s3", "en": "Sure. Anything else?", "vi": "Được ạ. Còn gì nữa không?" },
  { "id": "s4", "en": "No, that's all. How much is it?", "vi": "Không, vậy thôi. Bao nhiêu tiền?" }
]
```

**AI trả về mong đợi (rút gọn):**

```json
{
  "suitable": true,
  "reason_vi": null,
  "suggestion_vi": null,
  "lesson": {
    "used_sentence_ids": ["s1", "s2", "s3", "s4"],
    "situation_source": "source",
    "can_do": ["Gọi một đồ uống kèm cỡ và hỏi giá ở quán cà phê."],
    "situation": { "speaker": "khách", "listener": "nhân viên", "place": "quán cà phê", "purpose": "gọi đồ uống và trả tiền" },
    "items": [
      { "code": "word:large", "kind": "word", "text": "large", "meaning_vi": "lớn", "ipa": null, "pos": "adjective", "required": true },
      { "code": null, "kind": "word", "text": "latte", "meaning_vi": "cà phê sữa latte", "ipa": "ˈlɑːteɪ", "pos": "noun", "required": false },
      { "code": null, "kind": "phrase", "text": "that's all", "meaning_vi": "vậy thôi", "ipa": null, "pos": null, "required": true },
      { "code": null, "kind": "phrase", "text": "how much is it", "meaning_vi": "bao nhiêu tiền", "ipa": null, "pos": null, "required": true }
    ],
    "patterns": [
      { "frame": "Can I have a {size} {drink}, please?", "meaning_vi": "Cho tôi một {drink} {size} nhé.",
        "slots": [
          { "name": "size", "label_vi": "cỡ", "values": ["small", "medium", "large"] },
          { "name": "drink", "label_vi": "đồ uống", "values": ["latte", "tea", "coffee"] }
        ],
        "variants": ["Could I have a {size} {drink}, please?"], "example_sentence_ids": ["s2"] }
    ],
    "guided_task": { "title_vi": "Gọi đồ uống theo cỡ", "prompt_vi": "Gọi một ly trà nhỏ, rồi nói bạn không cần thêm gì.",
                     "hint_levels": ["Bắt đầu bằng \"Can I have…\"", "Can I have a small … , please?"] },
    "independent_task": { "title_vi": "Gọi đồ ở quầy nước ép", "prompt_vi": "Bạn ở quầy nước ép. Gọi một ly nước cam lớn và hỏi giá.",
                          "situation": { "speaker": "khách", "listener": "nhân viên", "place": "quầy nước ép", "purpose": "gọi nước ép và hỏi giá" } },
    "role_play": { "learner_speaker": "B", "turns": [
      { "speaker": "A", "text_en": "Hi! What would you like?", "text_vi": "Chào bạn! Bạn muốn uống gì?", "pattern_index": null },
      { "speaker": "B", "text_en": "Can I have a large orange juice, please?", "text_vi": "Cho tôi một ly nước cam lớn nhé.", "pattern_index": 0 },
      { "speaker": "A", "text_en": "Sure. Anything else?", "text_vi": "Được ạ. Còn gì nữa không?", "pattern_index": null },
      { "speaker": "B", "text_en": "No, that's all. How much is it?", "text_vi": "Không, vậy thôi. Bao nhiêu tiền?", "pattern_index": null }
    ] }
  }
}
```

Mẫu câu: server tính mã bằng `deriveItemCode('pattern', frame)`. Nếu danh mục đã có pattern cùng mã thì dùng lại pattern đó (không ghi đè), giống luật item.

**Server dựng ra (không AI):**

| Bước | Nội dung |
|---|---|
| 2 | `listen_and_repeat` 4 câu s1–s4, phát đúng đoạn video của từng câu + thẻ item bắt buộc |
| 3 | `speaking_drill` / `fill_blank` từ pattern `{size} {drink}` (luật PR 8) |
| 4 | `translation` / `multiple_choice` (luật PR 8), có gợi ý của `guided_task` |
| 5 | `role_play` (B là người học) + task độc lập "Gọi đồ ở quầy nước ép", 4 tiêu chí mặc định |

**Các ví dụ lạc quẻ (cũng dùng làm fixture test):**

| Câu chọn | Kết quả mong đợi |
|---|---|
| `Yeah.` · `Oh!` · `OK.` | Server chặn trước (`COMPOSE_SENTENCES_TOO_THIN`), **không gọi AI**, không tính lượt |
| 4 câu lời bài hát | `{ "suitable": false, "reason_vi": "Đoạn này là lời bài hát, không có tình huống giao tiếp để luyện.", "suggestion_vi": "Hãy chọn một đoạn hội thoại trong bài.", "lesson": null }` – có gọi AI nên **tính lượt** |
| s1–s4 ở trên + `The Eiffel Tower is in Paris.` | `lesson.used_sentence_ids = ["s1","s2","s3","s4"]`, bỏ câu về tháp Eiffel; app báo "Đã bỏ 1 câu không cùng tình huống" |
| `The weather is hot today.` · `I like ice cream.` · `Let's go to the beach.` | `lesson.situation_source = "inferred"`, tình huống "rủ bạn đi chơi khi trời nóng"; bài ghi nhãn "Tình huống do AI gợi ý" |
| `Hi, what can I get for you?` · `The Eiffel Tower is in Paris.` | Giữ được < 2 câu cùng tình huống → `suitable: false` + gợi ý chọn thêm câu liền nhau |

## 5. Server kiểm gì sau khi nhận JSON

| Kiểm | Khi sai |
|---|---|
| Đúng schema zod (lớp 3; lớp 2 đã chặn sai cấu trúc), độ dài trong giới hạn (`CAN_DO_MAX`, `SITUATION_FIELD_MAX`, `HINT_LEVELS_MAX`…) | Gọi lại |
| `suitable` khớp với `lesson` (true ↔ có `lesson`; false ↔ có `reason_vi`) | Gọi lại |
| `frame` parse được, tên slot trong frame khớp đúng các `slots[].name` (không trùng), mỗi slot 2–6 giá trị, biến thể dùng đúng slot | Gọi lại |
| `code` khác null phải có trong CATALOG ITEMS đã gửi | Gọi lại |
| `example_sentence_ids` thuộc `s1…sN` | Gọi lại |
| `used_sentence_ids` ⊆ câu đã chọn, ≥ 2 câu, giữ thứ tự; `example_sentence_ids` ⊆ `used_sentence_ids` | Gọi lại |
| `role_play` có lượt của người học; `pattern_index` hợp lệ; lượt người học có `pattern_index` khớp frame (`acceptedAnswers`) | Gọi lại |
| Item `required` ≤ 5, tổng item ≤ 10 | Server tự cắt (giữ thứ tự), không gọi lại |
| Validator (`checkLessonSpec`) sau khi dựng bài | Lỗi `COMPOSE_SPEC_INVALID`, không ghi, log rule |

## 6. Lần gọi lại (tối đa 1)

Gửi lại **cùng prompt** và thêm cuối:

```text
Your previous answer was rejected for these reasons:
- lesson.patterns[0]: slot "drink" is used in the frame but missing in "slots"
- lesson.role_play: the learner (B) has no turn
Return the whole JSON object again with these problems fixed.
```

Không gửi lại câu trả lời cũ (tiết kiệm token). Lần 2 vẫn sai → `COMPOSE_AI_INVALID`.

## 7. Ước tính chi phí

- Đầu vào khoảng 1.200–2.000 token (luật ~700, 8 câu + gợi ý + 40 item). Đầu ra khoảng 600–900 token.
- 1 lần gọi mỗi bài; gọi lại chỉ khi lỗi; trúng cache thì không gọi.
- Đo thật bằng log `compose_ai_call` (số token, thời gian), ghi vào mục "Điểm lệch" khi code xong.

## 8. Cách review prompt

1. Đọc luật 1–10 (§3): có luật nào sai ý sư phạm, thiếu hay thừa không?
2. Xem ví dụ §4: đầu ra mong đợi có đúng kiểu bài bạn muốn không (độ dài hội thoại, số gợi ý, cách đổi chi tiết ở bước 5)?
3. Sau khi code S4.1, chạy script `scripts/composeSample.ts --live` (cần `AI_API_KEY`, tắt mặc định) trên 3–5 bài thật: in prompt và JSON ra màn hình để đọc trực tiếp. Có thể so 2 model nếu muốn.
4. Mỗi lần sửa prompt là tạo một phiên bản mới trong kho prompt; `checksum` của phiên bản nằm trong `compose_key` (cache cũ tự hết hiệu lực vì nằm trong `compose_key`).

**Câu hỏi để bạn chốt khi review:**

| # | Câu hỏi | Đề xuất |
|---|---|---|
| P1 | Hội thoại nhập vai bao nhiêu lượt | 4–8 |
| P2 | Bước 5 có bắt buộc **đổi chi tiết** (nơi, món, người) không | Có |
| P3 | Số item bắt buộc tối đa | 5 |
| P4 | Có cho AI thêm từ không có trong câu (ví dụ giá trị slot "tea" khi câu chỉ có "latte") | Có, chỉ cho giá trị slot, cùng trình độ |
| P5 | Tình huống ghi bằng tiếng Việt | Có (như seed) |
