# Thiết kế: Lộ trình Từ · Mẫu câu · Thì

> Trạng thái: **💭 đề xuất, chờ duyệt**. Chưa có code.
> Cập nhật: 2026-10-11 (bản 3: thêm **quản trị trên web admin** và **script import**).
> Đối chiếu với [`architecture/lesson-design.md`](../architecture/lesson-design.md) và schema server
> (`items`, `item_memory`, `situations`, `recordings`, `admin_settings`).
> Nguồn nội dung: **Oxford 3000** (A1–B2) và bảng **mẫu câu IELTS Writing**.
> Sơ đồ trực quan: artifact "Lộ trình Từ · Mẫu · Thì".

Ký hiệu: ✅ đã có, dùng lại · 🔧 có rồi, cần mở rộng · 🆕 làm mới

---

## 1. Ý tưởng chính

Người học thường học từ, mẫu câu và thì như 3 danh sách rời. Thiết kế này nối chúng lại bằng **bộ câu tổ hợp**:

> **Từ / cụm từ / mẫu câu** + **tình huống** (chọn từ danh mục) + **thì**
> → server trả về **n câu** dùng đủ cả ba, chia đều theo **chủ ngữ** (I, he/she, they…).
> Mỗi câu có **audio, IPA từng từ, nghe – đọc theo – chấm phát âm**.

```mermaid
flowchart LR
  W["Từ / cụm từ / mẫu câu"] --> K{"Khoá bộ câu<br/>item + tình huống + thì"}
  S["Tình huống<br/>(danh mục server)"] --> K
  G["Thì"] --> K
  K --> POOL[("Kho câu dùng chung<br/>combo_sentences")]
  POOL -->|"đủ câu"| SET["Bộ n câu<br/>chia theo chủ ngữ"]
  POOL -->|"thiếu câu"| AI["AI sinh phần thiếu<br/>+ kiểm tra tự động"]
  AI --> POOL
  SET --> PR["Mỗi câu: nghe · IPA · đọc theo · chấm phát âm"]
  PR --> M["item_memory ✅"]
```

**Nguyên tắc: dùng lại tối đa những gì đã có.**

| Cần | Đã có trong LingoBites |
|---|---|
| Danh mục từ, cụm từ, mẫu câu | `items` (`word / phrase / pattern`) ✅ |
| Mẫu câu có slot, slot trỏ tới từ | `pattern` + `payload.slots[].item_refs` ✅ |
| Danh mục tình huống do admin soạn | `situations` (code, tên VI/EN, cấp, đối tượng, sở thích) ✅ |
| IPA theo từ | `lessonText/service/ipa` (cmudict + LLM dự phòng) ✅ |
| Đọc câu | `ttsService` trên máy (en-US, chỉnh tốc độ) ✅ |
| Đọc theo | Shadowing: `SentenceCard`, `RecorderPanel`, `SelfCheckList` ✅ |
| Chấm nói | Upload → STT (OpenAI) → so khớp từng từ (`wordMatch`) ✅ |
| Kiểm duyệt chữ AI sinh | `moderateText` ✅ |
| Cấu hình admin | `admin_settings` (key → JSON) ✅ |
| Lịch ôn theo người học | `item_memory` ✅ |
| Khoá → cấp → unit → bài, bài 6 bước | curriculum + `LessonFlowPlayer` ✅ |

---

## 2. Phân tích yêu cầu câu tổ hợp

### 2.1 Yêu cầu và cách hiểu

| # | Yêu cầu | Cách hiểu trong thiết kế |
|---|---|---|
| R1 | Server **tự sinh** hoặc **lấy câu có sẵn** | Có một kho câu dùng chung cho mọi người học. Khi được yêu cầu, server lấy câu từ kho trước, chỉ gọi AI cho phần còn thiếu. Câu sinh ra được lưu lại cho người sau. |
| R2 | **Số lượng và quy định theo chủ ngữ**, ví dụ 3 câu *I*, 3 câu *they*, 3 câu *he/she* | Một **hạn ngạch chủ ngữ** (subject quota) do admin cấu hình. Mỗi câu gắn 1 nhóm chủ ngữ. Server phát câu theo hạn ngạch. |
| R3 | Đầu vào: **từ / cụm từ / câu + tình huống + thì**. Tình huống **có giới hạn từ server**, người dùng không tự đặt. | Người học chỉ được **chọn** trong `situations` đã publish và phù hợp với item. Không có ô nhập tự do (khác tính năng Khoảnh khắc). |
| R4 | Ra **n câu** tuỳ setting, hoặc người dùng bấm **tải thêm** | `n` mặc định lấy từ admin. Người học được chọn trong các mức cho phép (3 / 6 / 9 / 12). "Tải thêm" lấy đợt tiếp theo, tiếp tục đúng vòng chủ ngữ. |
| R5 | Mỗi câu có **phần đọc + IPA theo từ** | Câu lưu sẵn danh sách từ (token), mỗi token có IPA và vai trò (chủ ngữ / động từ / item). Audio đọc bằng TTS trên máy, có tốc độ chậm. |
| R6 | **Đọc theo + kiểm tra phát âm** | Dùng luồng shadowing có sẵn và thêm chế độ ghi âm `combo_shadowing`. Server chấm theo từng từ. Không có consent thì tự đánh giá. |

### 2.2 Những điểm cần lưu ý khi làm

1. **Đổi chủ ngữ thì động từ đổi theo.** Đây chính là giá trị học: người học thấy rõ *I have placed* / *she has placed*, *I do* / *he does*. Câu nên tô màu phần động từ đã chia.
2. **Không phải mẫu nào cũng hợp mọi chủ ngữ.** Mẫu IELTS trang trọng ("Many schools place a heavy emphasis on…") đi với *I* thì gượng. Vì vậy mỗi item có thể **ghi đè hạn ngạch**: ví dụ mẫu IELTS dùng nhóm chủ ngữ `noun_phrase` (Many schools, The government…) thay cho *I*.
3. **Không phải tình huống nào cũng hợp mọi từ.** Ví dụ "emphasis" khó đi với "Gọi đồ uống". Server chỉ gợi ý các tình huống **trùng chủ đề** với item. Nếu AI báo câu không tự nhiên thì bỏ câu đó, và bộ câu có thể trả **ít câu hơn kèm lý do**.
4. **Số tổ hợp có thể rất lớn**: ~4.500 item × 12 thì × ~50 tình huống × 5 nhóm chủ ngữ. Vì vậy **không sinh trước toàn bộ**. Chỉ sinh trước (prewarm) các tổ hợp nằm trong bài giáo trình. Phần còn lại sinh khi có người yêu cầu và lưu vào kho.
5. **Chấm phát âm hiện tại là chấm theo từ, không theo âm.** STT nghe ra từ nào thì so với câu mẫu. Cách này bắt được từ bị thiếu hoặc nói thành từ khác, nhưng **không** bắt được lỗi âm cuối, trọng âm hay ngữ điệu, và STT còn hay tự "sửa" giúp người nói. Muốn chấm theo âm vị cần một dịch vụ chấm phát âm riêng: **dependency mới, có chi phí, cần bạn duyệt** (xem mục 9).

---

## 3. Tổ chức dữ liệu

### 3.1 Mô hình tổng thể

```mermaid
erDiagram
  ITEM ||--o{ ITEM_TAG : "chủ đề, chức năng 🆕"
  ITEM ||--o{ ITEM_LINK : "từ ↔ cụm ↔ mẫu ↔ thì 🆕"
  ITEM ||--o{ ITEM_MEMORY : "lịch ôn ✅"
  SITUATION ||--o{ SITUATION_TAG : "chủ đề 🆕"
  ITEM ||--o{ COMBO_SENTENCE : "item chính"
  ITEM ||--o{ COMBO_SENTENCE : "thì (grammar)"
  SITUATION ||--o{ COMBO_SENTENCE : ""
  COMBO_SENTENCE ||--o{ COMBO_SET_SENTENCE : ""
  COMBO_SET ||--o{ COMBO_SET_SENTENCE : "thứ tự phát"
  USER ||--o{ COMBO_SET : "bộ câu đã mở"
  COMBO_SENTENCE ||--o{ RECORDING : "đọc theo ✅🔧"
  COMBO_SENTENCE ||--o{ COMBO_REPORT : "báo câu sai 🆕"
```

### 3.2 Bảng `items` 🔧

| Thay đổi | Kiểu | Ý nghĩa |
|---|---|---|
| `cefr_level` 🆕 | `varchar(4)` null | `A1`…`C1`, lấy từ Oxford 3000 |
| `frequency_rank` 🆕 | `int` null | Thứ tự ưu tiên trong cùng cấp |
| `kind = 'grammar'` 🆕 | giá trị mới | Thì và điểm ngữ pháp |

Hai cột mới cho phép null, nên **không đụng dữ liệu cũ**.

**Mã item bị khoá sau khi publish.** Oxford 3000 có từ cùng chữ khác nghĩa, nên cần thêm hậu tố nghĩa vào mã: `word:bank-money`, `word:bank-river`, `word:close-verb`, `word:close-adj`. Mẫu câu đặt mã như `pattern:place-emphasis-on`, thì như `grammar:present-perfect`.

**Mẫu câu** dùng khung `{slot}` sẵn có:

```jsonc
{ "kind": "pattern", "code": "pattern:place-emphasis-on",
  "text": "{subject} place a heavy emphasis on {thing}",
  "meaning_vi": "Đặt sự chú trọng lớn vào…", "cefr_level": "B2",
  "payload": { "slots": {
    "subject": { "label_vi": "Ai / tổ chức", "values": ["Many schools", "The government"] },
    "thing":   { "label_vi": "Điều được chú trọng", "item_refs": ["phrase:academic-performance"] } } } }
```

**Thì** (`grammar`) 🆕:

```jsonc
{ "kind": "grammar", "code": "grammar:present-perfect",
  "text": "Present perfect", "meaning_vi": "Hiện tại hoàn thành", "cefr_level": "A2",
  "payload": {
    "family": "tense", "time": "present", "aspect": "perfect",
    "forms": { "affirmative": "{subject} have/has + V3",
               "negative": "{subject} have/has not + V3",
               "question": "Have/Has + {subject} + V3?" },
    "signals": ["since", "for", "already", "yet", "over the past …"],
    "contrast_with": ["grammar:past-simple"],
    "check": { "aux": ["have", "has", "'ve", "'s"], "verb_form": "past_participle" } } }
```

Trường `check` 🆕 được server dùng để **tự kiểm tra thì** của câu AI sinh (mục 4.4).

### 3.3 Tình huống: dùng bảng `situations` ✅ và thêm nhãn 🔧

Bảng `situations` đã có `code`, `title_vi/en`, `description_en`, `level_code`, `audience`, `status`. Cần thêm:
- `situation_tags` 🆕: gắn chủ đề (`topic:education`…) để gợi ý tình huống hợp với item.
- `register` 🆕 (`casual` / `neutral` / `formal`): tránh ghép mẫu IELTS với tình huống đời thường.

Người học **chỉ chọn**, không tạo mới. Admin soạn tình huống trong `admin-web` như hiện nay.

### 3.4 Kho câu tổ hợp 🆕

```sql
-- Một câu trong kho, dùng chung cho mọi người học
CREATE TABLE combo_sentences (
  id               uuid PRIMARY KEY,
  item_id          uuid NOT NULL REFERENCES items,      -- từ / cụm từ / mẫu
  grammar_item_id  uuid NOT NULL REFERENCES items,      -- thì
  situation_id     uuid NOT NULL REFERENCES situations,
  subject_group    varchar(16) NOT NULL,  -- i | you | he_she | we | they | noun_phrase
  subject_text     varchar(80)  NOT NULL, -- 'I', 'She', 'Many schools'
  polarity         varchar(12)  NOT NULL DEFAULT 'affirmative', -- affirmative | negative | question
  text_en          varchar(300) NOT NULL,
  text_vi          varchar(400) NOT NULL,
  tokens           jsonb NOT NULL,   -- [{ "t": "has", "ipa": "/hæz/", "role": "aux" }, …]
  level_code       varchar(4)  NOT NULL,
  source           varchar(8)  NOT NULL,   -- admin | ai
  status           varchar(12) NOT NULL,   -- draft | auto_ok | published | flagged | archived
  checks           jsonb NOT NULL DEFAULT '{}', -- kết quả kiểm tra tự động
  prompt_version   varchar(32),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON combo_sentences (item_id, grammar_item_id, situation_id, lower(text_en));
CREATE INDEX ON combo_sentences (item_id, grammar_item_id, situation_id, subject_group, status);

-- Bộ câu người học đã mở: để "tải thêm" và học lại
CREATE TABLE combo_sets (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  item_id          uuid NOT NULL REFERENCES items,
  grammar_item_id  uuid NOT NULL REFERENCES items,
  situation_id     uuid NOT NULL REFERENCES situations,
  quota            jsonb NOT NULL,   -- hạn ngạch đã áp, ví dụ {"i":3,"he_she":3,"they":3}
  next_cursor      int  NOT NULL DEFAULT 0,  -- vị trí trong vòng chủ ngữ
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE combo_set_sentences (
  set_id      uuid REFERENCES combo_sets ON DELETE CASCADE,
  sentence_id uuid REFERENCES combo_sentences,
  position    int NOT NULL,
  batch       int NOT NULL,              -- đợt 1, 2 (tải thêm)…
  PRIMARY KEY (set_id, sentence_id)
);

-- Người học báo câu sai / không tự nhiên (giống lesson_item_reports)
CREATE TABLE combo_reports (
  id uuid PRIMARY KEY, sentence_id uuid REFERENCES combo_sentences,
  user_id uuid REFERENCES users ON DELETE SET NULL,
  reason varchar(24) NOT NULL, note varchar(300), created_at timestamptz DEFAULT now()
);
```

Câu bị báo sai ≥ 2 lần thì tự chuyển `flagged`, không phát nữa và vào hàng đợi admin duyệt.

### 3.5 Cấu hình (`admin_settings`) ✅ thêm key

Sửa trên web admin, xem mục 8.5.

| Key | Mặc định | Ý nghĩa |
|---|---|---|
| `combo.subject_quota` | `{"i":3,"he_she":3,"they":3}` | Hạn ngạch mỗi đợt. `he_she` xen kẽ He / She. |
| `combo.batch_sizes` | `[3, 6, 9, 12]` | Các mức người học được chọn |
| `combo.default_batch` | `9` | Số câu đợt đầu |
| `combo.max_per_set` | `27` | Tối đa sau nhiều lần "tải thêm" |
| `combo.daily_ai_generations` | `5` | Số lần **gọi AI** mỗi ngày cho một người học. Lấy từ kho thì không tính. |
| `combo.pronunciation_pass` | `0.8` | Ngưỡng độ khớp từ để coi là đọc đạt |
| `combo.max_words` | `{"A1":8,"A2":12,"B1":16,"B2":20}` | Độ dài câu tối đa theo cấp |

Item được ghi đè hạn ngạch qua `items.payload.combo_quota`. Ví dụ mẫu IELTS: `{"noun_phrase":3,"they":3,"we":3}`.

### 3.6 Khoá học ✅

```
Khoá "Oxford 3000 + IELTS"
 └─ Cấp A1 · A2 · B1 · B2
     └─ Unit = 1 chủ đề = 1 tuần (education, work, travel…)
         ├─ Bài 1–4: ≈ 12 từ + 1 mẫu + 1 thì + 1–2 tình huống của chủ đề
         └─ Nhiệm vụ tổng hợp: viết / nói đoạn ngắn
```

Mỗi bài khai báo sẵn tình huống và thì, nên bộ câu tổ hợp của bài được **sinh trước** khi publish bài.

---

## 4. Luồng tạo bộ câu tổ hợp

### 4.1 Người học chọn đầu vào

```mermaid
flowchart LR
  A["Mở từ: bài học · thẻ ôn · kho mẫu · bản đồ thì"] --> B["Item đã chọn sẵn"]
  B --> C["Chọn tình huống<br/>chip gợi ý theo chủ đề + cấp"]
  C --> D["Chọn thì<br/>ưu tiên thì đã học"]
  D --> E["Chọn số câu<br/>3 · 6 · 9 · 12"]
  E --> F["Tạo bộ câu"]
```

- Vào từ bài học: item, tình huống và thì đã điền sẵn theo bài, người học chỉ bấm "Luyện câu".
- Danh sách tình huống lấy từ `GET /v1/combo/situations?item=…`: `published`, đúng `audience`, cấp ≤ cấp người học + 1, trùng chủ đề và register hợp.
- Thì: các thì người học đã gặp được xếp trước. Thì chưa học có nhãn "Mới".

### 4.2 Server ghép bộ câu

```mermaid
sequenceDiagram
  actor U as Người học
  participant A as App
  participant S as Server
  participant DB as Kho câu
  participant AI as AI
  U->>A: item + tình huống + thì + 9 câu
  A->>S: POST /v1/combo/sets
  S->>S: Lập kế hoạch chủ ngữ: I×3, He/She×3, They×3
  S->>DB: Lấy câu published/auto_ok theo từng nhóm, bỏ câu người này đã học
  alt Kho đủ
    DB-->>S: 9 câu
  else Thiếu k câu
    S->>AI: Sinh phần thiếu (+2 câu dự phòng mỗi nhóm), đúng chủ ngữ, thì, độ dài
    AI-->>S: Câu + bản dịch + vai trò từ
    S->>S: Kiểm tra tự động (4.4), gắn IPA, lưu vào kho
  end
  S-->>A: Bộ câu (đủ, hoặc thiếu kèm lý do)
  U->>A: "Tải thêm"
  A->>S: POST /v1/combo/sets/:id/more
  S-->>A: Đợt 2, tiếp tục vòng chủ ngữ
```

- **Thứ tự phát:** gom theo nhóm chủ ngữ (3 câu *I*, rồi 3 câu *He/She*…) để người học thấy động từ đổi theo chủ ngữ. Có nút xem "trộn" khi ôn.
- **Tải thêm:** mỗi đợt lấy lại đúng hạn ngạch, không lặp câu đã phát trong bộ, dừng ở `combo.max_per_set`.
- **Hết lượt AI trong ngày:** chỉ phát câu đang có trong kho. Nếu kho không đủ, trả số câu có được và báo "Hôm nay đã hết lượt tạo câu mới".
- **Tài khoản trẻ em:** chỉ nhận câu `published` (đã được admin duyệt), không gọi AI.
- **Offline:** bộ câu đã mở được tải về máy, học lại được. Chưa từng tải thì không tạo được.

### 4.3 Prompt sinh câu (tóm tắt)

AI nhận: item (chữ, nghĩa, khung slot), tình huống (`description_en`, register), thì (`forms`, `signals`), danh sách chủ ngữ cần sinh, cấp, độ dài tối đa. AI trả JSON, mỗi câu gồm `subject_group`, `subject_text`, `text_en`, `text_vi`, vai trò của từng token (`subject` / `aux` / `verb` / `item` / `other`) và cờ `natural: true/false`.

Nội dung tình huống được nhúng như dữ liệu trong prompt, giống cách đang chống prompt injection cho Khoảnh khắc. Prompt quản lý trong `ai_prompts` ✅ với key mới `combo.generate`.

### 4.4 Kiểm tra tự động trước khi vào kho

| Kiểm tra | Cách làm | Sai thì |
|---|---|---|
| Có item | So token với chữ của item và các dạng biến đổi (`-s`, `-ed`, `-ing`, V3). Với mẫu câu thì khớp khung. | Bỏ câu |
| Đúng chủ ngữ | Token `role = subject` khớp `subject_group` | Bỏ câu |
| Đúng thì | Trợ động từ và dạng động từ khớp `grammar.payload.check` | Bỏ câu |
| Hoà hợp chủ–động từ | Luật cho he/she/it + hiện tại đơn (`-s`, `has`, `does`) | Bỏ câu |
| Độ dài, cấp từ | ≤ `combo.max_words`; từ ngoài Oxford 3000 hoặc trên cấp + 1 ≤ 2 từ | Bỏ câu |
| An toàn | `moderateText` ✅ | Bỏ câu, ghi log |
| IPA | cmudict cho từng token, thiếu thì dùng LLM như hiện nay ✅ | Thiếu IPA vẫn giữ câu, token đó hiện "—" |
| Tự nhiên | `natural = false` do AI tự báo | Bỏ câu |

Đạt hết thì câu nhận trạng thái `auto_ok` và được phát ngay. Admin duyệt thì chuyển `published`.

---

## 5. Học một câu: nghe · IPA · đọc theo · chấm

### 5.1 Thẻ câu

```
┌───────────────────────────────────────────────┐
│ ● She  ·  Hiện tại hoàn thành  ·  Ở trường     │
│                                               │
│ She has placed a heavy emphasis on her exams. │
│ /ʃi/ /hæz/ /pleɪst/ /ə/ /ˈhevi/ /ˈemfəsɪs/ …   │  ← IPA dưới từng từ (bật/tắt)
│ Cô ấy đã rất chú trọng vào các kỳ thi.         │
│                                               │
│  ▶ Nghe   🐢 Chậm   🎙 Đọc theo   ⚑ Báo sai     │
└───────────────────────────────────────────────┘
```

- **Tô màu theo vai trò:** item chính, trợ động từ + động từ (phần thể hiện thì), chủ ngữ.
- **Chạm vào một từ:** hiện IPA, nghĩa và nghe riêng từ đó. Nếu từ là item trong kho thì có nút "Thêm vào ôn".
- **Nghe:** TTS trên máy ✅, tốc độ thường và chậm (`DEFAULT_TTS_RATE`). Để sau: server tạo audio sẵn cho câu `published` để giọng đọc đồng nhất.

### 5.2 Đọc theo và chấm phát âm

```mermaid
flowchart LR
  L["Nghe câu mẫu"] --> R["Ghi âm<br/>RecorderPanel ✅"]
  R --> C{"Đã đồng ý<br/>chấm bằng máy?"}
  C -->|"có"| UP["Upload, mode = combo_shadowing 🔧"]
  UP --> STT["STT ✅ → so khớp từng từ ✅"]
  STT --> RES["Kết quả: % khớp + từng từ<br/>xanh = đúng · đỏ = sai · xám = thiếu"]
  C -->|"không / offline"| SELF["Tự đánh giá<br/>SelfCheckList ✅"]
  RES --> NEXT["Từ đỏ: chạm để nghe lại + xem IPA<br/>Đọc lại hoặc sang câu tiếp"]
  SELF --> NEXT
```

- Chế độ ghi âm mới `combo_shadowing` tham chiếu `combo_sentence_id`. Áp các luật hiện có: ghi âm ≤ 35 giây, file xoá sau 30 ngày, chữ nhận dạng không lưu.
- **Đạt** khi độ khớp từ ≥ `combo.pronunciation_pass`. Đọc lại thoải mái; lượt cao nhất được giữ.
- Gợi ý STT (hints) gồm câu mẫu và từ của item, giống `sttHints` đang dùng cho bước 5.
- `not_assessable` (lỗi âm thanh, lỗi server) **không tính là sai**.
- **Giới hạn:** chấm theo từ chỉ cho biết người nghe có hiểu được không. Không chấm được âm cuối, trọng âm hay ngữ điệu (xem 2.2 và mục 9).

### 5.3 Kết thúc bộ câu

Màn tổng kết hiện: số câu đã đọc đạt, các từ hay đọc sai (gộp theo từ), và so sánh động từ theo chủ ngữ (*I have placed* ↔ *she has placed*). Có 3 nút: "Tải thêm", "Đổi tình huống", "Đổi thì".

---

## 6. Tính năng

| # | Tính năng | Người học thấy gì | Dựa trên |
|---|---|---|---|
| **F1** | Lộ trình từ vựng | A1→B2 chia theo chủ đề, gói ≈ 12 từ, kiểm tra nhanh "đã biết" | `cefr_level`, tags, `item_memory` |
| **F2** | Kho mẫu câu theo chức năng | Tra theo ý muốn nói (nhấn mạnh, nguyên nhân…). Mỗi mẫu có nút "Luyện câu tổ hợp". | `pattern` + tag `function:*` |
| **F3** | Bản đồ thì 3 × 4 | Lưới thời gian × khía cạnh, tô màu theo mức nhớ. Chạm vào ô để xem công thức, dấu hiệu, thì hay nhầm, và nút "Luyện câu". | `grammar` |
| **F4** | Bài tuần chủ đề | Bài 6 bước. Bước 2–4 dùng bộ câu tổ hợp của bài. | `LessonFlowPlayer` ✅ |
| **F5** | **Bộ câu tổ hợp** | Chọn item + tình huống + thì + số câu. Server trả câu chia theo chủ ngữ. Có "Tải thêm". | Mục 3.4, 4 |
| **F6** | **Đọc theo + chấm phát âm** | Mỗi câu: nghe, IPA từng từ, ghi âm, kết quả từng từ | Shadowing ✅, STT ✅, mục 5 |
| **F7** | Ôn theo thang | Hàng ôn trộn 3 loại, dạng bài khó dần | `item_memory` ✅ |
| **F8** | Viết / nói đoạn cuối tuần | Bắt buộc dùng đủ số từ, mẫu và thì của tuần | `tasks` ✅ |
| **F9** | Bảng tiến độ | Đã nhớ x / 3.000 từ, lưới thì, tỷ lệ đọc đạt | `item_memory.stable_at` ✅ |

**Màn mới hoặc đổi:**

| Màn | Loại | Ghi chú |
|---|---|---|
| `WordPathScreen`, `QuickKnownCheck` | 🆕 | F1 |
| `PatternLibraryScreen`, `TenseMapScreen` | 🆕 | F2, F3 |
| `ComboSetupSheet` | 🆕 | Chọn tình huống, thì, số câu |
| `ComboSetScreen` | 🆕 | Danh sách thẻ câu theo nhóm chủ ngữ, nút "Tải thêm" |
| `ComboShadowingScreen` | 🔧 | Dùng lại `ShadowingSessionScreen`, thêm IPA và kết quả từng từ |
| `ItemReviewScreen` | 🔧 | Thêm dạng bài bậc 3 (mục 7) |

**API mới:**

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/combo/situations?item=` | Tình huống phù hợp |
| POST | `/v1/combo/sets` | `{item_code, grammar_code, situation_code, count}` |
| POST | `/v1/combo/sets/:id/more` | Đợt tiếp theo |
| GET | `/v1/combo/sets/:id` | Học lại / tải về offline |
| POST | `/v1/combo/sentences/:id/reports` | Báo câu sai |
| POST | `/v1/recordings` 🔧 | Thêm `mode = combo_shadowing` |

---

## 7. Ôn luyện

Giữ lịch ôn `1 · 3 · 7 · 14 · 30 · 60 · 120` ngày ✅ và luật **chỉ lượt `kind = review` mới dời lịch**. Luyện bộ câu tự do là `practice`, không làm lệch lịch.

Dạng bài thay đổi theo `item_memory.stage`, không cần thêm cột:

| Bậc | Từ / cụm từ | Mẫu câu | Thì | Chấm |
|---|---|---|---|---|
| **1 · Nhận ra** (1–3 ngày) | Nghe / đọc → chọn nghĩa | Chọn câu đúng khung | Nhìn câu → chọn tên thì | App, offline |
| **2 · Nhớ lại** (7–14 ngày) | Nghĩa VI → gõ từ; điền chỗ trống | Điền phần thiếu của khung | Chia động từ theo chủ ngữ cho sẵn | App, offline |
| **3 · Vận dụng** (30+ ngày) | **Nghe câu tổ hợp → đọc theo** | **Nhìn câu VI → nói câu EN** (câu lấy từ kho) | **Đổi chủ ngữ:** "I have placed…" → nói với *She* | Server chấm theo từ, hoặc tự đánh giá |

Câu cho bậc 3 lấy từ kho `combo_sentences` (những bộ người học đã mở), nên **không tốn thêm lượt AI**.

**Hàng ôn mỗi ngày:**
- Tối đa 20 thẻ (`DAILY_ITEM_REVIEW_LIMIT`).
- Tỷ lệ ~60% từ · ~25% mẫu · ~15% thì.
- Không để quá 2 thẻ cùng loại liền nhau.
- Item sai ≥ 4 lần: hiện thẻ so sánh hoặc lỗi hay gặp trước khi hỏi.
- Sai thì về ôn sau 1 ngày (luật hiện có).

---

## 8. Quản trị trên web admin

Mọi nội dung và tham số của tính năng này đều sửa được trên `admin-web`, không cần sửa code. Phần lớn là mở rộng trang đã có.

```mermaid
flowchart LR
  classDef old fill:#e6f7ea,stroke:#2e8b57,color:#123
  classDef new fill:#fff4e0,stroke:#d98b00,color:#321
  subgraph Content["Nội dung"]
    A1["Items 🔧<br/>từ · cụm từ · mẫu câu"]:::old
    A2["Thì & ngữ pháp 🆕<br/>lưới 3 × 4"]:::new
    A3["Tình huống 🔧"]:::old
    A4["Kho câu tổ hợp 🆕<br/>+ hàng đợi báo sai"]:::new
  end
  subgraph Config["Cấu hình"]
    B1["Cài đặt câu tổ hợp 🆕<br/>hạn ngạch chủ ngữ, số câu, hạn mức"]:::new
    B2["Prompt AI 🔧<br/>combo.generate"]:::old
  end
  subgraph Ops["Vận hành"]
    C1["Lô import 🆕<br/>tiến độ duyệt"]:::new
    C2["Sinh trước câu 🆕<br/>theo bài / unit"]:::new
  end
  C1 --> A1
  B2 --> A4
  B1 --> A4
  A1 --> A4
  A2 --> A4
  A3 --> A4
  C2 --> A4
```

Mọi thay đổi đều ghi vào `admin_audit_log` ✅, như trang cài đặt chấm bài hiện nay.

### 8.1 Items: từ, cụm từ, mẫu câu 🔧 (`ItemListPage`, `ItemEditPage`)

| Phần | Thêm gì |
|---|---|
| Bộ lọc | Cấp CEFR, nhãn (chủ đề / chức năng / kỳ thi), **danh sách nguồn** (`list:oxford-3000`, `list:oxford-5000`, `list:ielts-patterns`), lô import, "chưa duyệt" |
| Cột | Cấp, nhãn, số câu tổ hợp trong kho, số lần bị báo sai |
| Sửa item | `cefr_level`, `frequency_rank`, nhãn, liên kết (`item_links`: collocation, word family, đồng nghĩa, thì hay nhầm) |
| Mẫu câu | Khung `{slot}` (đã có) + **ghi đè hạn ngạch chủ ngữ** (`payload.combo_quota`) + ví dụ theo từng thì |
| **Thao tác hàng loạt** | Chọn nhiều item → duyệt + publish, gắn / gỡ nhãn, đổi cấp, archive. Cần cho khối lượng hàng nghìn từ. |
| Màn duyệt nhanh | Xem từng item, phím tắt **Duyệt / Sửa / Bỏ qua**, tự sang item tiếp theo trong lô |

### 8.2 Thì và ngữ pháp 🆕 (`GrammarPage`)

- Màn chính là **lưới 3 × 4** (quá khứ / hiện tại / tương lai × đơn / tiếp diễn / hoàn thành / HT tiếp diễn). Chạm vào ô để sửa item `grammar` của ô đó.
- Các trường sửa được: tên VI/EN, cách dùng, công thức (khẳng định / phủ định / câu hỏi), dấu hiệu nhận biết, thì hay nhầm, lỗi hay gặp, cấp CEFR, thứ tự dạy.
- **Luật kiểm tra thì** (`payload.check`): trợ động từ, dạng động từ. Có ô **"Thử câu"**: dán một câu vào, xem server nhận ra thì gì. Dùng để kiểm luật trước khi lưu.
- Ngữ pháp ngoài thì (bị động, câu điều kiện…) thêm sau, dùng cùng màn ở dạng danh sách.

### 8.3 Tình huống 🔧 (`SituationsPage`)

| Đã có | Thêm |
|---|---|
| code, tên VI/EN, mô tả EN, cấp, đối tượng, trạng thái, thứ tự | Nhãn chủ đề, `register` (casual / neutral / formal), **dùng cho câu tổ hợp: bật/tắt**, xem trước item phù hợp, số câu đã có trong kho |

Người học **chỉ thấy** tình huống `published` và có bật "dùng cho câu tổ hợp".

### 8.4 Kho câu tổ hợp 🆕 (`ComboSentencesPage`)

| Phần | Nội dung |
|---|---|
| Bộ lọc | Item, tình huống, thì, nhóm chủ ngữ, trạng thái (`draft / auto_ok / published / flagged / archived`), nguồn (`admin / ai`), phiên bản prompt |
| Bảng | Câu EN + VI, chủ ngữ, kết quả kiểm tra tự động, số lần phát, tỷ lệ đọc đạt, số lần bị báo |
| Thao tác | Duyệt (→ `published`), sửa câu (server chạy lại kiểm tra + IPA), archive, **thêm câu thủ công** (`source = admin`) |
| **Ma trận độ phủ** | Với 1 item + 1 thì: bảng tình huống × nhóm chủ ngữ, mỗi ô là số câu đang có. Ô thiếu bấm được để sinh thêm. |
| Hàng đợi báo sai | Giống `ItemReportsPage` ✅: lý do, câu, người báo (ẩn danh), nút sửa / archive / bỏ qua |
| Sinh trước | Chọn bài / unit / item → server liệt kê các tổ hợp còn thiếu, **ước tính số lần gọi AI** → bấm chạy (job nền, xem tiến độ) |

### 8.5 Cài đặt câu tổ hợp 🆕 (`ComboSettingsPage`)

Lưu trong `admin_settings` ✅. Các key mới được khai báo cạnh `LEARNING_SETTING_KEYS` (`src/common/settings/learningSettings.ts`), mỗi key có schema zod và giá trị mặc định.

| Nhóm | Key | Giao diện |
|---|---|---|
| **Hạn ngạch chủ ngữ** | `combo.subject_quota` | Bảng các dòng *nhóm chủ ngữ → số câu*: thêm / bớt dòng, kéo để đổi thứ tự phát. Nhóm có sẵn: `i`, `you`, `he_she` (xen kẽ He/She), `we`, `they`, `noun_phrase`. |
| | `combo.subject_quota_by_level` | Ghi đè theo cấp, ví dụ A1 chỉ dùng `I×3, He/She×3` |
| | `combo.polarity_mix` | Tỷ lệ khẳng định / phủ định / câu hỏi (mặc định 100 / 0 / 0) |
| Số câu | `combo.batch_sizes`, `combo.default_batch`, `combo.max_per_set` | Ô số |
| Hạn mức | `combo.daily_ai_generations` | Theo gói: free / trả phí |
| Chất lượng | `combo.max_words` theo cấp, `combo.max_offlevel_words`, `combo.auto_publish` (câu `auto_ok` có phát cho người lớn không), `combo.report_flag_threshold` | Ô số, công tắc |
| Chấm đọc | `combo.pronunciation_pass` | Thanh trượt 0.5–1.0 |

Ưu tiên khi áp hạn ngạch: **item** (`payload.combo_quota`) > **cấp** (`subject_quota_by_level`) > **mặc định** (`subject_quota`).

### 8.6 Prompt sinh câu 🔧 (dùng nguyên trang Prompt AI)

Hệ thống prompt đã có đủ: nhiều phiên bản, case mẫu (golden cases), chạy thử, kích hoạt, ghi lý do. Chỉ cần:
- Đăng ký key `combo.generate` vào `PROMPT_REGISTRY`, khai báo các biến: `item`, `situation`, `tense`, `subjects[]`, `level`, `max_words`, `polarity`.
- Thêm **case mẫu** bao các trường hợp khó: mẫu IELTS trang trọng, thì hoàn thành, he/she + hiện tại đơn, tình huống không hợp với item (phải trả `natural = false`).
- **Chạy thử** thì chạy cả phần kiểm tra tự động (mục 4.4) trên kết quả, và hiện tỷ lệ câu đạt. Phiên bản có tỷ lệ đạt thấp thì không kích hoạt được (giống luật `PromptRunsNotPassingError` hiện có).
- Mỗi câu lưu `prompt_version`, nên khi đổi prompt có thể lọc và duyệt lại câu do phiên bản cũ sinh.

### 8.7 Lô import 🆕 (`ImportBatchesPage`)

Chỉ để xem, vì việc import chạy bằng script (mục 9). Mỗi lô hiện: nguồn, ngày chạy, số item tạo mới / đã có / lỗi, **tiến độ duyệt** (đã duyệt x / y), và link sang danh sách item của lô đó (lọc sẵn).

---

## 9. Script import

Theo đúng khuôn script hiện có (`seed-curriculum.ts`, `canonical-lesson-import.ts`):
- Mặc định **dry-run** (chỉ báo cáo, không ghi). Phải có `--apply` mới ghi.
- **Chạy lại không tạo trùng** (khoá theo `code`).
- Chọn môi trường bằng `--env staging` / `--env-file`.
- Ghi qua store / service của server, nên đi qua cùng lớp kiểm tra dữ liệu như admin.
- Output chỉ gồm số lượng và mã item. Không có dữ liệu người học.

```mermaid
flowchart LR
  PDF["PDF Oxford 3000 / 5000"] -->|"① wordlist:extract"| CSV["CSV<br/>(người kiểm lại)"]
  CSV -->|"② wordlist:enrich<br/>AI + cmudict, có cache"| JSONL["JSONL đã làm giàu"]
  JSONL -->|"③ wordlist:import<br/>--dry-run / --apply"| DB[("items draft<br/>+ import_batches")]
  PAT["Bảng mẫu câu<br/>(CSV / JSON)"] -->|"patterns:import"| DB
  GR["tenses.json<br/>(trong repo)"] -->|"grammar:seed"| DB
  SIT["situations.json"] -->|"situations:import"| DB
  DB --> ADM["Admin duyệt theo lô"]
```

### 9.1 Từ vựng Oxford 3000 / 5000

Chia 3 bước, để mỗi bước kiểm lại được và chạy lại không mất công:

**① `yarn wordlist:extract --pdf <file> --list oxford-3000 --out scripts/data/wordlists/oxford-3000.csv`**

Đọc PDF ra CSV, mỗi dòng là một cặp *từ + loại từ*:

| headword | sense | pos | cefr | list | code (tự tính) |
|---|---|---|---|---|---|
| account | | n | B1 | oxford-3000 | `word:account-noun` |
| account | | v | B2 | oxford-3000 | `word:account-verb` |
| bank | money | n | A1 | oxford-3000 | `word:bank-money` |
| close | 1 | v | A1 | oxford-3000 | `word:close-verb` |
| all right | | adj/adv/exclam | A2 | oxford-3000 | `phrase:all-right` |

Luật tách:
- `account n. B1, v. B2` → 2 dòng.
- `bank (money)` → sense `money`.
- `close¹` / `close²` → sense theo số mũ.
- Mục có dấu cách (`all right`, `according to`) → `phrase`.
- Một từ có nhiều loại từ **cùng cấp** (`about prep., adv. A1`) → **1 item**, `part_of_speech = "prep, adv"`.

Dòng không đọc được thì ghi vào `*.rejects.csv` để người sửa tay. Bước này **không gọi AI và không ghi DB**.

**② `yarn wordlist:enrich --in …csv --out …jsonl [--level A1] [--limit 200]`**

Làm giàu từng từ:
- IPA lấy từ cmudict ✅; thiếu thì dùng LLM như hiện nay.
- AI soạn: nghĩa tiếng Việt **đúng loại từ và nghĩa phân biệt**, 2 câu ví dụ (EN + VI), nhãn chủ đề, tối đa 3 collocation.
- Chạy theo lô 50 từ. Có **cache** theo `code`, nên chạy lại chỉ làm phần chưa có.
- Dry-run in **ước tính số lần gọi AI và chi phí**.
- Prompt quản lý trong registry với key `wordlist.enrich`.

**③ `yarn wordlist:import --in …jsonl [--apply] [--list oxford-5000] [--only-level B2,C1]`**

| Trường hợp | Xử lý |
|---|---|
| `code` chưa có | Tạo item `draft`, `source = ai`, gắn nhãn `list:<list>`, chủ đề, cấp. Kèm ví dụ. |
| `code` đã có, **admin chưa duyệt** | Cập nhật các trường còn trống, thêm nhãn |
| `code` đã có, **admin đã duyệt** (`reviewed_at`) | **Không ghi đè gì**, chỉ thêm nhãn `list:*`. Khác biệt ghi ra báo cáo. |
| Collocation | Tạo `phrase` draft + `item_links (collocation)`. Phrase đã có thì chỉ nối liên kết. |

- **Oxford 5000** = Oxford 3000 + khoảng 2.000 từ B2–C1. Chạy cùng script với `--list oxford-5000`: từ đã có từ bản 3000 chỉ được thêm nhãn `list:oxford-5000`, **không tạo trùng**.
- Mỗi lần `--apply` tạo 1 dòng `import_batches` 🆕 (nguồn, file, số lượng, người chạy). Item lưu `import_batch_id` để admin lọc theo lô.

### 9.2 Mẫu câu có sẵn

**`yarn patterns:import --in scripts/data/patterns/ielts-writing.csv [--apply]`**

Định dạng đầu vào: mỗi dòng là một mẫu, đúng các cột của bảng bạn gửi:

| structure | meaning_vi | usage_vi | example_en | function | level | exam |
|---|---|---|---|---|---|---|
| S + place(s) a heavy emphasis on + N | Đặt sự chú trọng lớn vào… | Dùng khi một cá nhân/tổ chức coi một yếu tố là ưu tiên | Many schools place a heavy emphasis on academic performance | emphasis | B2 | ielts-writing |

Script tự chuyển **cấu trúc → khung `{slot}`**:

| Trong bảng | Thành |
|---|---|
| `S +` ở đầu | `{subject}` |
| `+ N` / `+ N/V-ing` | `{thing}` |
| `+ V` / `to V` / `V-ing` | `{verb}` / `to {verb}` / `{verb_ing}` |
| `place(s)`, `attach(es)` | dạng gốc `place`, ghi chú "chia theo chủ ngữ" |
| `one's` | giữ nguyên trong khung, khi sinh câu đổi thành my / his / her / their |

Mã sinh từ phần cố định: `pattern:place-heavy-emphasis-on`.

- Ví dụ trong bảng → `item_examples`. Script tự nhận thì của ví dụ bằng luật ở 8.2 và điền `grammar_code`.
- Các từ khoá trong mẫu (emphasis, importance…) được **nối với item `word` sẵn có** nếu tìm thấy.
- Mẫu không tự chuyển được (cấu trúc lạ, nhiều slot mơ hồ) → ghi vào `*.rejects.csv` để sửa tay.
- Gắn nhãn `function:<function>`, `exam:<exam>`, `list:ielts-patterns`, và ghi đè hạn ngạch mặc định cho mẫu trang trọng (`noun_phrase`, `they`, `we`).
- Bảng gốc là ảnh, nên cần chuyển sang CSV trước (gõ lại, hoặc OCR rồi người kiểm).

### 9.3 Thì và tình huống

| Script | Nguồn | Ghi chú |
|---|---|---|
| `yarn grammar:seed` | `scripts/grammar/content/tenses.json` (soạn trong repo, giống `curriculum/content`) | 12 thì, đủ công thức, dấu hiệu, luật kiểm tra, thì hay nhầm. Sau đó admin sửa trên web. |
| `yarn situations:import --in …json` | JSON danh sách tình huống | Bổ sung tình huống B1–B2 và nhãn chủ đề, `register` cho danh mục có sẵn |
| `yarn combo:prewarm --unit <slug> [--apply]` | Bài trong unit | Sinh trước câu tổ hợp cho các tổ hợp của bài; dry-run in số lần gọi AI. Cũng chạy được từ admin (8.4). |

### 9.4 Bảng phụ cho import 🆕

```sql
CREATE TABLE import_batches (
  id          uuid PRIMARY KEY,
  source      varchar(32) NOT NULL,   -- oxford-3000 | oxford-5000 | ielts-patterns | grammar | situations
  file_name   varchar(200) NOT NULL,
  file_sha256 char(64) NOT NULL,
  counts      jsonb NOT NULL,         -- {created, updated, unchanged, rejected}
  run_by      varchar(80) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE items ADD COLUMN import_batch_id uuid REFERENCES import_batches;  -- null được
```

---

## 10. Chia giai đoạn

| GĐ | Nội dung | Repo | Rủi ro |
|---|---|---|---|
| **P0** | Migration: cột `items` (`cefr_level`, `frequency_rank`, `import_batch_id`), `kind = grammar`, `tags`, `item_tags`, `item_links`, `situation_tags`, `situations.register`, `import_batches` | Server | ⚠️ Migration (chỉ thêm) |
| **P1a** | Script: `wordlist:extract / enrich / import`, `patterns:import`, `grammar:seed`, `situations:import` | Server | ⚠️ Chi phí AI khi làm giàu ~5.000 từ |
| **P1b** | Admin: Items mở rộng + thao tác hàng loạt + màn duyệt nhanh, trang Thì & ngữ pháp, Tình huống mở rộng, Lô import | Server, admin-web | Khối lượng duyệt lớn |
| **P2** | App: F1 lộ trình từ + ôn bậc 1–2 | App | Thấp |
| **P3a** | Kho câu tổ hợp: bảng `combo_*`, API, sinh + kiểm tra tự động, hạn ngạch, tải thêm | Server | ⚠️ Chi phí AI, chất lượng câu |
| **P3b** | Admin: Kho câu + ma trận độ phủ + báo sai + sinh trước, Cài đặt câu tổ hợp, prompt `combo.generate` | Server, admin-web | Thấp |
| **P4** | App: bộ câu, IPA từng từ, đọc theo `combo_shadowing`, kết quả từng từ | App, Server | Chấm nói chưa test máy thật |
| **P5** | App: F2 kho mẫu, F3 bản đồ thì, ôn bậc 3, F8, F9 | App | Thấp |
| **P6** (tuỳ chọn) | Chấm phát âm theo âm vị | Server | ⚠️ Dependency + chi phí mới |

---

## 11. Cần chốt trước khi làm

1. **Hạn ngạch chủ ngữ mặc định:** `I×3, He/She×3, They×3` đã đủ chưa? Có cần thêm *you*, *we*, và câu **phủ định / câu hỏi** (cột `polarity` đã chừa sẵn) không?
2. **Ai duyệt câu AI sinh?** Đề xuất: câu `auto_ok` phát ngay cho người lớn, trẻ em chỉ nhận câu `published`. Có cần admin duyệt hết trước khi phát không?
3. **Hạn mức AI mỗi ngày** (đề xuất 5 lần gọi AI / người / ngày, lấy từ kho thì không tính) và độ dài tối đa của bộ (27 câu)?
4. **Chấm phát âm:** dùng chấm theo từ hiện có (không tốn thêm), hay đầu tư dịch vụ chấm theo âm vị? Ví dụ Azure Speech Pronunciation Assessment hoặc SpeechAce: là **dependency mới, có chi phí theo phút audio**, cần bạn duyệt.
5. **Audio:** dùng TTS trên máy (miễn phí, giọng phụ thuộc máy), hay server tạo audio sẵn cho câu `published`?
6. **Bản quyền Oxford 3000 / 5000** khi dùng trong app thương mại. Phương án dự phòng: NGSL hoặc CEFR-J. Script import viết chung cho mọi danh sách, nên đổi nguồn không phải viết lại.
7. **File nguồn:** cần file **Oxford 5000** (PDF hoặc CSV) và **toàn bộ bảng mẫu câu** (ảnh hiện chỉ có 5 dòng; bảng gốc ghi "100+"). Nếu chỉ có ảnh thì cần người gõ lại hoặc OCR rồi kiểm lại.
8. **Import chạy bằng script (CLI) hay cần nút upload CSV trên admin?** Đề xuất làm script trước (theo khuôn hiện có), admin chỉ xem lô import. Nút upload để giai đoạn sau.
9. **Làm giàu từ bằng AI cho ~5.000 từ:** chạy một lần cho cả danh sách, hay theo cấp (A1–A2 trước)?
10. **Bắt đầu từ cấp nào?** Đề xuất A2–B1, vì 42 bài hiện có đã phủ A1–A2.
