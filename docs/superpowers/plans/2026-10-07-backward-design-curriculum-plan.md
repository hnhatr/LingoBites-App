# Kế hoạch: curriculum thiết kế ngược (đầu ra → bằng chứng → hoạt động)

> Trạng thái: **ĐÃ DUYỆT** (2026-10-07). Plan chi tiết từng PR nằm ở file riêng, ví dụ `2026-10-07-pr1-db-baseline-and-items.md`.
> Ngày lập: 2026-10-07. Phạm vi: `LingoBites-Server` (+ `admin-web`) và `LingoBites-App`.
> Cụ thể hoá Bước 2–6 của `2026-10-07-learning-cycle-requirements-roadmap.md`.
> Thay thế mô hình `learning_items` suy ra theo bài của `2026-10-06-learning-items-architecture.md`.

## 0. Tiền đề đã chốt

| # | Tiền đề |
|---|---|
| T1 | App chưa public, không có người dùng. **DB server và SQLite trên máy được xoá làm lại.** Không cần tương thích ngược, không cần versioning contract, không cần migration dữ liệu. |
| T2 | Làm cả **mức A** (lõi curriculum: danh mục item, đặc tả bài, nhiệm vụ, tiêu chí) và **mức B** (player 6 bước, đánh giá, mức hoàn thành, ôn theo item). |
| T3 | Chiều soạn bài đổi thành: **Đặc tả bài → Item → Nhiệm vụ & tiêu chí → Hoạt động 6 bước**. AI chỉ gợi ý trong khung đặc tả. |
| T4 | Bài người học tự tạo (YouTube, văn bản, OCR) vẫn đi chiều xuôi, gọi là **"nguồn mở rộng"**. Item AI tìm được sẽ được map vào danh mục. Bài loại này không có điều kiện "đạt bài". |

## 1. Mô hình dữ liệu đích (server)

```
DANH MỤC ITEM (dùng chung mọi bài)
  items
    id uuid · code text UNIQUE  (vd "pattern:can-i-have", "word:coffee")
    kind: word | phrase | pattern | pronunciation | listening
    text (dạng hiển thị) · meaning_vi · ipa? · pos?
    audio_media_id? · image_media_id? · audience: kids | adults | all
    payload jsonb theo kind:
      pattern       → { frame: "Can I have a {size} {drink}, please?",
                        slots: { size: { values: [small, medium, large] },
                                 drink: { item_refs: [word:milk, word:orange juice, …] } } }
      pronunciation → { focus: "final /t/", minimal_pairs: [[ "eight", "ate" ]], tip_vi }
      listening     → { question_en, question_vi, audio_media_id, answer_item_refs }
    source: admin | ai · status: draft | published | archived
  item_examples   (item_id, en, vi, audio_media_id?, position)
  item_variants   (item_id, text, note_vi?, position)          ← "I'd like…", "Could I get…"
  item_errors     (item_id, code, description_vi, feedback_vi,
                   severity: blocking | tolerated, position)    ← bỏ âm cuối, "I want" cộc, thiếu "a"

LỘ TRÌNH
  courses / levels  + audience
  units             + can_do text[] · audience
  lessons           + code UNIQUE · audience · can_do text[] (1–2 câu)
                    + situation jsonb { speaker, listener, place, purpose }
                    + kind: curriculum | extended   (extended = bài người học tự tạo)
  lesson_prerequisites (lesson_id, prerequisite_lesson_id)
  lesson_items         (lesson_id, item_id, role: required | extended,
                        introduction: new | recycled | prerequisite, position)

BẰNG CHỨNG
  tasks
    id · lesson_id? · unit_id?  (đúng một trong hai; unit_id = nhiệm vụ tổng hợp chủ đề)
    kind: guided | variation | independent | summative
    prompt_vi · situation jsonb (tình huống đã đổi chi tiết)
    response_mode: speak | write | choose      (choose/speak thay write cho trẻ chưa đọc-viết)
    hint_levels jsonb [{ level: 1, type: replay|keyword|model, content }]
  task_items      (task_id, item_id)            ← item trọng tâm mà nhiệm vụ kiểm tra
  task_criteria   (task_id, criterion: purpose | content | clarity | independence,
                   required bool, threshold numeric?, note_vi?)
  Đáp án chấp nhận = frame + slots + item_variants của task_items (không viết lại cho từng task).

HOẠT ĐỘNG
  lesson_blocks + step (1..6) · skill: speak | listen | write · duration_sec
    type: text | example | media | context | item_cards | activity
    item_cards.data   → { item_ids: [...] }                         (thay vocabulary + grammar)
    activity.data     → { activityKind, item_refs, task_id?, expected, distractors?, … }

NGƯỜI HỌC
  activity_attempts (mở rộng) + task_id · step · item_ids · support_level: none | hint_1 | hint_2 | model
                              + outcome: pass_independent | pass_with_support | fail | unscorable
                              + criteria jsonb · error_codes text[]
  lesson_outcomes  (user_id, lesson_id, practice_completed_at?, passed_at?, last_attempt_at)
  unit_outcomes    (user_id, unit_id, completed_at?)
  item_memory      (user_id, item_id, state: learning | passed | stable | needs_review,
                    interval_days, next_review_at, consecutive_passes, first_passed_at)
```

**Bị thay thế hoặc xoá (cần duyệt, §6):** `learning_items`, `vocabularies`, `lesson_block_vocabularies`, block `vocabulary` và `grammar`, `user_vocabulary_progress`. Chuỗi migration 001–029 gộp thành một baseline mới.

## 2. Chia giai đoạn

```
Stage 0  Chốt contract + wireframe                (cả team, ngắn)
   │
   ├─► Stage 1  Lõi curriculum (mức A)            ── server ║ admin ║ app chạy song song
   │
   ├─► Stage 2  Player 6 bước + lượt làm          ── bắt đầu thiết kế/khung ngay khi Stage 0 xong,
   │                                                  nối dữ liệu thật khi Stage 1 xong phần server
   └─► Stage 3  Đánh giá + mức hoàn thành + ôn    ── spike STT/chấm phát âm chạy ngay từ đầu,
                                                      ráp vào khi Stage 2 có lượt làm
```

Ba stage **chạy chồng nhau** được nhờ Stage 0 chốt trước contract (fixture JSON). Mỗi bên code theo fixture, không chờ nhau. Phụ thuộc cứng duy nhất là: phần dữ liệu thật của Stage 2 và 3 cần các bảng của Stage 1 có trên server.

---

## Stage 0 – Chốt contract và wireframe

**Cả team**
- Chốt cấu hình Bước 0 của roadmap: ngưỡng đạt, cách xử lý lỗi `tolerated`, các mức gợi ý, khoảng ôn, điều kiện "ghi nhớ ổn định".
- Viết **1 unit mẫu đầy đủ** trên giấy, ví dụ "Gọi đồ uống" gồm 3 bài và 1 nhiệm vụ tổng hợp. Dùng làm seed và làm test end-to-end.

**Server**
- Viết schema (§1) dạng bản nháp Prisma.
- Viết fixture JSON:
  - `lesson-snapshot.json`: đặc tả bài, items, lesson_items, tasks, criteria, blocks có step.
  - `unit-detail.json`.
  - `item.json`: một mẫu cho mỗi kind.
  - `activity-attempt.json`.
  - `evaluation-result.json`.
- Copy các fixture sang App và admin-web để test cả ba bên trên cùng dữ liệu, như cách đang làm với `learning-item-keys.json`.

**App và Design**
- Wireframe các màn: hub bài mới, player từng bước, 6 loại hoạt động, gợi ý, màn vận dụng độc lập, phản hồi 4 trạng thái, màn kết quả bài, tiến độ unit.

**Admin**
- Wireframe các màn: danh mục item, tab Đặc tả / Item / Nhiệm vụ của bài, ma trận lặp lại item.

**Xong khi:** các fixture được duyệt và unit mẫu được duyệt.

---

## Stage 1 – Lõi curriculum (mức A)

### Server
1. **DB mới:** gộp migration thành baseline. Thêm các bảng ở §1, trừ nhóm "Người học" (thuộc Stage 2–3). Xoá các bảng và module bị thay thế.
2. **Module `items`** (thay `learningItems` và `vocabulary`):
   - CRUD và tìm kiếm theo `kind`, `code`, `text`, `status`.
   - Validate theo kind: mọi `{slot}` trong frame phải có trong `slots`; `item_refs` phải tồn tại.
   - Quản lý examples, variants, errors.
3. **Curriculum:**
   - Thêm các trường đặc tả vào lesson và unit.
   - Thêm `lesson_prerequisites`, `lesson_items`, `tasks`, `task_items`, `task_criteria`.
   - API admin cho tất cả, theo đúng cấu trúc controller / model / repository / service hiện có.
4. **Block:**
   - Thêm `step`, `skill`, `duration_sec`.
   - Thêm block `item_cards`, bỏ block `vocabulary` và `grammar`.
   - Schema `activity.data` mới có `item_refs`, `task_id`, `expected`.
5. **Kiểm tra độ đủ đặc tả** (`lessonSpecValidator`): bài `curriculum` chỉ được publish khi có:
   - can-do,
   - ít nhất 1 item `required`,
   - ít nhất 1 task `independent` có criteria,
   - block phủ đủ step 1–6.
6. **Delivery:**
   - Snapshot bài học theo fixture mới.
   - Catalog của unit trả về `can_do`.
7. **Pipeline AI tạo bài** (`canonicalLesson/service`):
   - Bước enrich chuyển sang map vào danh mục: tìm item theo `code`. Không có thì tạo item `source=ai, status=draft`.
   - Ghi `lesson_items` cho bài `extended`.
   - Bỏ `rebuildLearningItems` ở cả 4 chỗ gọi.
8. **Seed:** script nạp unit mẫu của Stage 0.

### Admin-web
1. **Danh mục item** (mới, thay `VocabularyListPage` và `VocabularyEditPage`):
   - Danh sách có lọc theo kind và status. Item `draft` do AI tạo thì có nút duyệt.
   - Form theo kind:
     - từ / cụm: nghĩa, IPA, audio, ảnh;
     - **pattern**: soạn khung, các chỗ trống và giá trị cho từng chỗ trống (chọn item hoặc nhập tay), xem trước câu sinh ra;
     - pronunciation: âm trọng tâm, cặp tối thiểu;
     - listening: câu hỏi, audio, đáp án.
   - Tab biến thể, lỗi thường gặp (mức chặn hay chấp nhận), ví dụ.
2. **Sửa bài** (`LessonEditPage`) chia tab:
   - **Đặc tả:** mã bài, đối tượng, can-do, tình huống, bài tiên quyết, thời lượng.
   - **Item:** chọn từ danh mục, đặt bắt buộc hay mở rộng, mới / lặp lại / tiên quyết. Gợi ý tự động: item của bài tiên quyết nằm trong khung câu của bài này.
   - **Nhiệm vụ:** soạn task, gợi ý theo mức, 4 tiêu chí, chọn item trọng tâm. Hiển thị tập đáp án chấp nhận được sinh từ khung câu và biến thể.
   - **Hoạt động:** block editor hiện tại, thêm `step`, `skill`, thời lượng, block `item_cards`.
   - **Thanh kiểm tra:** liệt kê điều kiện còn thiếu (validator ở mục 5 phía server). Nút Publish bị khoá cho tới khi đủ.
3. **Unit** (`UnitEditPage`): thêm can-do và nhiệm vụ tổng hợp. Level và Course thêm trường đối tượng.
4. **Ma trận lặp lại** (mới): bảng item × bài của một unit hoặc level. Đánh dấu item chỉ xuất hiện 1 lần và item tiên quyết chưa từng được dạy.
5. Bỏ khỏi `BlockEditorDialog` và `blockModel` các form block `vocabulary` và `grammar`.

### App
1. **Contract:** viết lại `core/schemas/lesson.ts` theo fixture mới, bỏ versioning v1/v2.
2. **SQLite:** gộp `migrations.ts` thành một schema khởi tạo, xoá chuỗi v5 (`schemaV5.ts`, bảng backup).
   - Flashcard và `review_schedule` chuyển sang theo `item_id`.
   - Bỏ cơ chế gộp thẻ trùng theo lemma, vì item đã duy nhất từ server.
3. **`core/learning`:** viết lại `items.ts`, `itemKey.ts`, `practice.ts` cho 5 kind, đọc item từ snapshot thay vì suy ra từ analyses. Quiz chỉ lấy các kind nó hỗ trợ.
4. **UI:**
   - `CanonicalLessonHub`: thẻ **"Sau bài này bạn sẽ…"** (can-do và tình huống). Các mục khám phá đổi thành Câu / Từ & cụm / Mẫu câu (+ Phát âm, Nghe hiểu nếu có).
   - `LessonGrammarSection` thay bằng **`LessonPatternSection`**: khung câu với chỗ trống chạm để đổi giá trị, biến thể, lỗi thường gặp.
   - `LessonVocabularySection`: đọc từ item, hiện ảnh cho bài trẻ em, nhãn bắt buộc hay mở rộng.
   - `UnitLessonsScreen` và `LevelUnitsScreen`: hiện can-do.
   - `ReviewCardFaces`: thêm mặt thẻ cho mẫu câu (tình huống → người học nói → xem khung câu).
   - Bài `extended`: nhãn "Bài tự tạo". Hub giữ như hiện nay.

**Stage 1 xong khi:** soạn được unit mẫu hoàn toàn trên admin; validator chặn bài thiếu đặc tả; app hiển thị đúng hub, mẫu câu và flashcard theo item; tạo bài YouTube vẫn chạy và sinh item `draft`.

---

## Stage 2 – Player 6 bước và lượt làm (mức B, phần 1)

Chưa có chấm tự động trong stage này. Bước nói dùng **tự đánh giá** (nghe lại bản ghi của mình cạnh câu mẫu, tự chọn Đạt / Chưa đạt). Kết quả được ghi là `self_assessed` để Stage 3 thay bằng chấm máy.

### Server
1. **`activity.data` theo từng `activityKind`:**
   - `listen_and_repeat`: item_refs và audio.
   - `speaking_drill`: frame và các tổ hợp slot cần luyện.
   - `role_play`: các lượt hội thoại, lượt nào của người học.
   - `fill_blank`: câu, vị trí trống, đáp án lấy từ slot.
   - `multiple_choice`: đáp án và phương án nhiễu.
   - `translation`: câu nguồn, đáp án chấp nhận lấy từ khung câu và biến thể.
2. **Sinh dữ liệu hoạt động:** service `activityGenerator` gợi ý block bước 3–4 (luyện có hướng dẫn, luyện biến đổi) từ frame và slots của item. Admin bấm để sinh nháp, sau đó sửa.
3. **Bảng `activity_attempts` mở rộng** (§1) và collection sync tương ứng. Thêm `lesson_outcomes.practice_completed_at`.
4. **Cảnh báo tỷ lệ 70/25/5** theo unit: tổng `duration_sec` theo `skill`. Chỉ cảnh báo, không chặn.

### Admin-web
1. Editor riêng cho từng `activityKind`. Chọn item và giá trị slot thay vì gõ tự do. Nút **"Sinh nháp từ mẫu câu"**.
2. `LessonPreviewPage`: chạy thử bài theo 6 bước giống player trên app, có hiện gợi ý.
3. Hiển thị cảnh báo tỷ lệ 70/25/5 trên trang unit.

### App
1. **Player mới `LessonFlowPlayer`**, thay `CanonicalLessonPlayer` cho bài `curriculum`:
   - Điều hướng theo step 1 → 6, thanh tiến độ theo bước, tạm dừng và học tiếp.
   - Bước 1 "Ôn liên quan" lấy item tiên quyết và item lặp lại đang đến hạn trong lịch ôn (dữ liệu local).
2. **6 component hoạt động** tương tác thật. `CanonicalBlockView` không còn ở chế độ chỉ đọc.
3. **Hệ thống gợi ý:** nút gợi ý mở dần từng mức (nghe lại → từ khoá → hiện mẫu). Ghi `support_level` vào mọi lượt làm.
4. **Màn vận dụng độc lập** (bước 5): hiện tình huống đã đổi chi tiết, không có đáp án; ghi âm hoặc chọn đáp án; tạm thời tự đánh giá.
5. **Lượt làm:** ghi vào `activity_attempts` qua outbox (repository đã có sẵn).
6. **Bỏ nút "Hoàn thành bài"** (`useLessonCompletion`). Thay bằng trạng thái "Hoàn thành phần luyện". Streak và thời gian học tính theo hoạt động, không theo việc đạt bài.
7. Bài `extended` vẫn dùng hub và player hiện tại.

**Stage 2 xong khi:** học trọn unit mẫu theo 6 bước trên app; mọi lượt làm có `support_level` và được sync lên server.

---

## Stage 3 – Đánh giá, mức hoàn thành, kết quả và ôn theo item (mức B, phần 2)

> ⚠️ **Cần duyệt dependency và chi phí:** dịch vụ chuyển giọng nói thành chữ (STT) và chấm phát âm. Cần thêm chính sách dữ liệu giọng nói và dữ liệu trẻ em.
> Phần **spike** (mục 1 Server) nên chạy ngay khi Stage 0 xong để có kết luận trước khi Stage 2 hoàn tất.

### Server
1. **Spike STT và chấm phát âm:** so sánh 2–3 nhà cung cấp trên chính các câu của unit mẫu, giọng Việt, cả người lớn và trẻ em. Đo độ chính xác, độ trễ, chi phí trên mỗi lượt.
2. **`evaluationService`:** nhận bản ghi âm hoặc văn bản cùng task. Đầu ra:
   - **content:** câu nói khớp khung câu (slot nhận giá trị hợp lệ) hoặc khớp một biến thể;
   - **purpose:** đúng ý định của tình huống. Dùng luật trước, AI chỉ khi luật không đủ;
   - **clarity:** điểm phát âm trên ngưỡng;
   - **independence:** lấy từ `support_level`;
   - **lỗi:** khớp với `item_errors`. Lỗi `tolerated` không làm trượt;
   - lỗi âm thanh hoặc lỗi xử lý → `unscorable` (không tính là sai).
3. **Tính mức hoàn thành:** `lesson_outcomes.passed_at` (đã hoàn thành phần luyện **và** có lượt `pass_independent` ở task `independent`) và `unit_outcomes` (đạt các bài bắt buộc **và** nhiệm vụ tổng hợp).
4. **`item_memory` và lịch ôn theo item**, theo cấu hình Stage 0:
   - lượt ôn dùng lại tiêu chí của task;
   - quên → `needs_review`, giữ nguyên `passed_at`;
   - sync về app.
5. Dữ liệu cho bước 1 "Ôn liên quan" và cho `today/adaptationEngine`: item hay sai và item đến hạn.

### Admin-web
1. Cấu hình: ngưỡng đạt từng tiêu chí, khoảng ôn, điều kiện "ghi nhớ ổn định".
2. **Xem lượt làm** của một user (`UserDetailPage`): kết quả, tiêu chí, lỗi, mức hỗ trợ, nghe lại bản ghi. Dùng để kiểm tra chất lượng chấm.
3. Thống kê theo bài: tỷ lệ đạt độc lập, lỗi hay gặp nhất. Dùng để sửa đặc tả và danh sách lỗi.

### App
1. Màn vận dụng độc lập gửi bản ghi để chấm. Hiện **phản hồi 4 trạng thái**:
   - Đạt;
   - Đạt khi có gợi ý → luyện lại rồi thử lượt độc lập;
   - Chưa đạt → chỉ lỗi chính và dẫn về bài luyện liên quan;
   - Không đánh giá được → làm lại.
2. **Màn kết quả bài** (bước 6): mục tiêu đã đạt, item còn yếu, mức hỗ trợ đã dùng. Hành động tiếp theo là "Luyện lại phần X" hoặc "Bài tiếp / Ôn theo lịch".
3. **Tiến độ unit** (`UnitProgressBar`, `unitProgress.ts`): tách "đã học" với "đã đạt"; thêm màn nhiệm vụ tổng hợp của chủ đề.
4. **Ôn tập** (`DailyReviewScreen`): ôn theo item; với mẫu câu thì người học nói và được chấm bằng tiêu chí của task.
5. **`today/adaptationEngine`**: đọc kết quả đánh giá và `item_memory` thay cho số bài đã làm.

**Stage 3 xong khi:** unit mẫu đi trọn vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn; lượt `unscorable` không bị tính là sai; quên một item không xoá trạng thái đã đạt bài.

---

## 3. Bảng phân việc tổng hợp

| | Server | Admin-web | App |
|---|---|---|---|
| **S0** | Schema nháp, fixture JSON | Wireframe danh mục item, các tab của bài | Wireframe player, gợi ý, kết quả |
| **S1** | DB baseline, module `items`, đặc tả bài, task và criteria, validator, delivery, map item từ AI, seed | Danh mục item và form theo kind, tab Đặc tả / Item / Nhiệm vụ, ma trận lặp lại | Contract, SQLite baseline, `core/learning`, hub, mẫu câu, flashcard theo item |
| **S2** | Schema activity theo kind, sinh nháp hoạt động, attempts, cảnh báo 70/25/5 | Editor hoạt động, preview 6 bước | `LessonFlowPlayer`, 6 hoạt động, gợi ý, vận dụng (tự đánh giá), bỏ nút complete |
| **S3** | Spike STT, `evaluationService`, outcomes, `item_memory` | Cấu hình ngưỡng và lịch ôn, xem lượt làm, thống kê | Phản hồi 4 trạng thái, màn kết quả, tiến độ unit, ôn mẫu câu, adaptation |

**Chạy song song tối đa:** sau Stage 0, ba nhóm (server, admin, app) cùng làm Stage 1 theo fixture. Trong lúc đó, Design làm UI cho Stage 2 và server làm spike cho Stage 3.

## 4. Thứ tự PR đề xuất

1. `server`: DB baseline và module `items` (kèm test).
2. `server`: đặc tả bài, lesson_items, tasks và criteria, validator, delivery.
3. `admin`: danh mục item. **Có thể làm song song với PR 2.**
4. `admin`: các tab Đặc tả / Item / Nhiệm vụ của bài, ma trận lặp lại.
5. `app`: contract, SQLite baseline, `core/learning`. **Có thể làm song song từ PR 1**, nhờ code theo fixture.
6. `app`: UI hub, mẫu câu, flashcard.
7. `server`: map item từ AI, seed unit mẫu. → **Hết Stage 1.**
8. PR 8–11 (Stage 2): server activity và attempts → admin editor và preview → app player và hoạt động → app gợi ý và vận dụng.
9. PR 12–16 (Stage 3): server evaluation → outcomes và `item_memory` → app phản hồi và kết quả → app ôn và adaptation → admin cấu hình và thống kê.

Mỗi PR có test riêng và chạy được độc lập. Theo VibeGuard, mỗi PR cần plan chi tiết riêng được duyệt trước khi code.

## 5. Quyết định còn mở

| # | Câu hỏi | Chặn |
|---|---|---|
| Q1 | Ngưỡng đạt từng tiêu chí; lỗi nào `blocking` hay `tolerated` theo mặc định | S3 |
| Q2 | Các mức gợi ý cố định (3 mức?) hay mỗi task tự đặt | S1 (schema task) |
| Q3 | Khoảng ôn và điều kiện "ghi nhớ ổn định" | S3 |
| Q4 | Nhà cung cấp STT và chấm phát âm, ngân sách mỗi lượt | S3 |
| Q5 | Item `draft` do AI tạo từ bài người học: admin có duyệt để đưa vào danh mục chung không | S1 |
| Q6 | Một item dùng chung cho cả trẻ em và người lớn, hay tách theo đối tượng (ảnh, ví dụ khác nhau) | S1 |
| Q7 | Bài `extended` có được dùng làm "nguồn mở rộng" để tính ôn item không | S3 |

## 6. Xoá hoặc thay thế (cần duyệt rõ trước khi làm)

**Server**
- `src/modules/learningItems/**`: thay bằng `items`.
- `src/modules/vocabulary/**`: gộp vào `items`.
- Bảng `learning_items`, `vocabularies`, `lesson_block_vocabularies`, `user_vocabulary_progress`.
- Block type `vocabulary` và `grammar`, cùng phần xử lý trong `lessonBlocks` (`blockData.ts`, `extendedBlockContent.ts`, `lessonContentValidator.ts`, `views.ts`).
- Các lời gọi `rebuildLearningItems` trong `lessonContentTransaction.ts`, `creationRequestStore.ts`, `lessonSentenceStore.ts`, `adminLessonMove.ts`.
- `src/common/database/migrations/001–029`: gộp thành baseline.
- Versioning contract (`LESSON_CONTRACT_VERSION_ITEMS`).

**Admin-web**
- `VocabularyListPage.tsx`, `VocabularyEditPage.tsx` và test của chúng: thay bằng trang danh mục item.
- Phần `vocabulary` và `grammar` trong `components/blocks/*`.

**App**
- `src/core/db/schemaV5.ts` và chuỗi migration trong `src/core/db/migrations.ts`: thay bằng một schema khởi tạo.
- `LessonGrammarSection.tsx`: thay bằng `LessonPatternSection`.
- Phần suy ra item từ analyses trong `src/core/learning/items.ts`.
- `useLessonCompletion.ts` (nút complete) cho bài `curriculum`.

## 7. Rủi ro

- **Khối lượng lớn ở App Stage 2–3:** player mới và 6 loại hoạt động. Nên có wireframe được duyệt trước.
- **Chấm nói (Stage 3):** độ chính xác với giọng Việt và giọng trẻ em chưa được kiểm chứng. Nếu spike không đạt, giữ cách tự đánh giá của Stage 2 lâu hơn.
- **Chi phí AI:** mỗi lượt chấm tốn tiền. Cần giới hạn số lượt và cache kết quả.
- **Dữ liệu giọng nói và dữ liệu trẻ em:** cần consent của phụ huynh, thời hạn lưu, không log nội dung.
- **Công soạn nội dung:** mỗi bài cần nhiều trường hơn hẳn trước. Nên dùng AI gợi ý nháp cho đặc tả, item và hoạt động, có người duyệt.
