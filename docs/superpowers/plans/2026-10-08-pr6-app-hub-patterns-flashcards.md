# PR 6 – App: hub bài theo đặc tả, mẫu câu, phát âm / nghe hiểu, flashcard mẫu câu

> Trạng thái: **ĐÃ CODE**: G1–G6 đã duyệt; commit `407d045` → `1b8e6c1` (xem §9 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-App` (React Native CLI 0.85, Jest). Nhánh: `claude/optimistic-bell-mfgk44`.
> Thuộc Stage 1 của `2026-10-07-backward-design-curriculum-plan.md`, mục App 4 (UI). Dựng trên dữ liệu PR 5 đã đưa vào app: `spec`, `lesson_items`, `tasks` trong snapshot; `core/learning` có 5 kind; flashcard theo mã item.

## 1. Mục tiêu và phạm vi

Sau PR này, người học mở một bài curriculum sẽ thấy:
- bài này dạy để **làm được gì**;
- các item của bài theo **Từ & cụm / Mẫu câu / Phát âm / Nghe hiểu**;
- **mẫu câu** dạng khung có chỗ trống chạm để đổi giá trị;
- lưu được mẫu câu thành **flashcard** và ôn được trong Ôn tập.

Bài người học tự tạo (YouTube, văn bản, OCR) giữ nguyên trải nghiệm hiện tại.

| Trong PR 6 | Ngoài PR 6 |
|---|---|
| Thẻ **"Sau bài này bạn sẽ…"** trên hub: can-do, tình huống, thời lượng, bài nên học trước | Player 6 bước, hoạt động tương tác, gợi ý, vận dụng (Stage 2, PR 10–11) |
| Hàng khám phá theo loại bài: Câu / Từ & cụm / Mẫu câu / Phát âm / Nghe hiểu | Hiện nhiệm vụ (`tasks`) cho người học (Stage 2) |
| `LessonPatternSection` (mới): khung câu, chỗ trống đổi giá trị, biến thể, lỗi thường gặp, ví dụ | Ảnh và audio của item từ server (G1, cần endpoint media cho người học) |
| `LessonPronunciationSection`, `LessonListeningSection` (mới, dạng đọc + TTS) | Chấm phát âm, chấm nghe (Stage 3) |
| `LessonVocabularySection`: nhãn bắt buộc / mở rộng, mới / ôn lại | Ôn theo `item_memory`, lịch ôn theo item (Stage 3) |
| Block `item_cards` trong player hiện thẻ item thật thay vì danh sách chữ | Sửa server hoặc admin-web |
| Unit và bài trong `LevelUnitsScreen` / `UnitLessonsScreen` hiện can-do | Đổi `CanonicalLessonPlayer` thành `LessonFlowPlayer` |
| Lưu mẫu câu thành flashcard; `ReviewCardFaces` có mặt thẻ mẫu câu; Thư viện hiện thẻ mẫu câu | Lưu thẻ cho phát âm và nghe hiểu |

**Không cần sửa server:** API công khai `GET /v1/levels/:levelId/units` và `GET /v1/units/:unitId/lessons` đã trả `canDo` và `audience`. Zod hiện tại của app chỉ đang bỏ qua hai trường này.

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Ảnh và audio của item.** Snapshot có `item.image` và `item.audio` (chỉ có `object_key`). Server chưa có endpoint media cho người học, và app chưa hiển thị media ở đâu cả. | **PR 6 chưa hiện ảnh hay audio media.** Mọi nút nghe dùng TTS sẵn có (`handleSpeak`). Bài trẻ em chỉ hiện chip đối tượng. Endpoint media cho người học và việc tải media về để học offline tách thành một cặp PR riêng (server + app) sau PR 7. |
| G2 | **Hàng khám phá trên hub theo loại bài.** | Bài có `lesson_items` hiện **Câu · Từ & cụm · Mẫu câu · Phát âm · Nghe hiểu**. Ba hàng sau chỉ hiện khi có item thuộc kind đó; không còn hàng Ngữ pháp. Bài không có `lesson_items` (bài tự tạo) giữ **Câu · Từ vựng · Ngữ pháp** như cũ. **`LessonGrammarSection` được giữ, không xoá**, vì bài tự tạo vẫn dùng ngữ pháp từ phân tích câu (G5 của PR 5). Điều này khác §6 của master plan. |
| G3 | **Lưu mẫu câu thành flashcard.** | Có. Thẻ có `kind = 'pattern'`, `item_key` là mã item, và lưu: `word` = khung gốc (`Can I have a {size} {drink}, please?`), `meaning_vi`, `example` / `example_translation` = ví dụ đầu tiên. **Chiều ôn của mẫu câu là Việt → Anh:** mặt trước hiện nghĩa tiếng Việt và tình huống, người học tự nói; mặt sau hiện khung câu (chỗ trống thay bằng nhãn `…`) và một câu ví dụ có TTS. Thẻ từ và cụm giữ chiều Anh → Việt như cũ. Phát âm và nghe hiểu **không** lưu thẻ trong PR 6. |
| G4 | **Trạng thái "Đã lưu" theo mã item** thay vì theo chữ. | `VocabularySaveControl.isSaved` nhận **mã item**. Từ phân tích câu tính mã bằng `vocabularyItemKey(word)`. Lý do: từ PR 5 thẻ đã khoá theo `item_key`, nên so theo chữ sẽ sai với cụm có dấu câu hoặc viết hoa khác, và không áp dụng được cho mẫu câu. Các component đang gọi `isSaved(word)` đổi theo: `LessonVocabularySection`, `SentenceAnalysisPanel`. |
| G5 | **Nhãn bài tự tạo.** Hub đã có chip `hero_mine` ("Bài của bạn"). | Giữ chip, đổi chữ tiếng Việt thành **"Bài tự tạo"** cho khớp master plan. Chỉ đổi giá trị trong `vi.json`, không đổi key. |
| G6 | **Thông tin trên thẻ "Sau bài này bạn sẽ…".** | Hiện can-do (gạch đầu dòng), tình huống ("{speaker} nói với {listener} ở {place} để {purpose}"), thời lượng dự kiến, và bài nên học trước (chip; chạm để mở bài đó qua `appNavigation.openLesson`). **Không** hiện nhiệm vụ hay tiêu chí, vì chúng thuộc player Stage 2. Thẻ ẩn khi `spec` null hoặc `can_do` rỗng. |

## 3. Lớp logic (`src/features/lesson/player/logic/lessonHubContent.ts`)

Hàm thuần, đọc từ snapshot, có test riêng. Phần hiển thị đọc thẳng `snapshot.lesson_items` (ví dụ, biến thể, lỗi) thay vì nhồi thêm vào `LearningItem` của `core/learning`. `LearningItem` vẫn là mô hình gọn cho quiz và lưu thẻ.

1. **`collectLessonOutcome(snapshot)`** → `LessonOutcome | null`
   - Trả `{canDo[], situation | null, estimatedMinutes, audience, prerequisites[{lessonId, title, code}]}`.
   - Trả null khi không có `spec` hoặc `can_do` rỗng.
2. **`collectLessonVocabulary`** (sửa): mỗi entry thêm `role: 'required' | 'extended' | null` và `introduction: 'new' | 'recycled' | 'prerequisite' | null`. Thứ tự: bắt buộc trước, mở rộng sau; trong mỗi nhóm giữ thứ tự của bài. Bài tự tạo có `role = null`, thứ tự không đổi.
3. **`collectLessonPatterns(snapshot)`** → `LessonPatternEntry[]`. Với mỗi item `kind = 'pattern'`:
   - `key` (mã item), `itemId`, `frame` (text), `meaningVi`, `noteVi`, `role`, `introduction`;
   - `segments` lấy từ `parseFrame`;
   - `slots: {name, labelVi, choices[]}`. `choices` = `values` cộng với `item_refs` đã giải mã (§3.6);
   - `variants[]`, `errors[]` (kèm `severity`), `examples[]` (lọc theo đối tượng, §3.7);
   - payload hỏng (`parseItemPayload` lỗi) hoặc khung hỏng → bỏ qua item đó và không ném lỗi.
4. **`collectLessonPronunciation(snapshot)`** → `{key, text, meaningVi, focus, focusIpa, tipVi, minimalPairs[[a, b]], examples[]}[]`.
5. **`collectLessonListening(snapshot)`** → `{key, text, meaningVi, questionEn, questionVi, answer}[]`.
   - `answer` = `answer_text`, nếu không có thì ghép các `answer_item_refs` đã giải mã.
   - `text` là câu để nghe (đọc bằng TTS, G1).
6. **Giải mã item ref:**
   - Tìm item trong `lesson_items` theo `code` và lấy `text`.
   - Không thấy thì lấy phần thân của mã qua `parseItemCode` (`word:orange juice` → `orange juice`).
   - Mã không hợp lệ → bỏ qua.
7. **Lọc ví dụ theo đối tượng:** bài `kids` bỏ ví dụ `adults`, bài `adults` bỏ ví dụ `kids`; ví dụ `all` luôn giữ.
8. **`lessonHubSections(snapshot, analyses)`** → danh sách hàng khám phá kèm số lượng, theo G2. Hub và màn player dùng chung để không lệch nhau.

`LessonHubSection` mở rộng thành `'sentences' | 'vocabulary' | 'grammar' | 'patterns' | 'pronunciation' | 'listening'`.

## 4. UI

### 4.1 Hub (`CanonicalLessonHub.tsx`)
- Thẻ mới **`LessonOutcomeCard`** (`components/LessonOutcomeCard.tsx`), đặt giữa phần đầu bài và thẻ nội dung. Nội dung theo G6. Dùng `AppCard`, `AppText`, `Chip`, `SvgIcon`. Bài nên học trước là `Chip` có `onPress` (prop tuỳ chọn `onOpenLesson`).
- Chip đối tượng ("Trẻ em" / "Người lớn") khi `audience` khác `all`.
- Hàng khám phá dựng từ `lessonHubSections`:

  | Hàng | Icon | Tone |
  |---|---|---|
  | Câu | `menu_book` | teal |
  | Từ & cụm | `style` | coral |
  | Mẫu câu | `rule` | gold |
  | Phát âm | `record_voice_over` | teal |
  | Nghe hiểu | `hearing` | coral |

  Trước khi dùng hai icon mới, kiểm tra chúng có trong `iconRegistry`; nếu không có thì dùng icon sẵn có gần nghĩa nhất, **không** thêm icon mới.
- Hàng Luyện nhanh giữ nguyên.

### 4.2 Màn player (`CanonicalLessonPlayerScreen.tsx`)
- `SECTION_TITLE_KEYS` và `switch (view)` thêm `patterns`, `pronunciation`, `listening`.
- Truyền `onOpenLesson` cho hub (mở bài tiên quyết).
- Bài YouTube và luồng `sentences` không đổi.

### 4.3 `LessonPatternSection.tsx` (mới)
Mỗi mẫu câu là một `AppCard`:
- **Đầu thẻ:** chip "Mẫu câu", chip vai trò hoặc cách giới thiệu (Bắt buộc / Mở rộng · Mới / Ôn lại / Đã học), nghĩa tiếng Việt.
- **Khung câu:** chữ thường xen với **chỗ trống dạng chip**.
  - Chạm một chip để chuyển sang giá trị kế tiếp (vòng lại về đầu).
  - Nhấn giữ để mở danh sách giá trị.
  - Nhãn tiếng Việt của chỗ trống hiện dưới chip.
  - Câu đang ghép có nút nghe (TTS).
  - `accessibilityLabel` của chip là "{nhãn}: {giá trị}, chạm để đổi".
- **Cách nói khác:** liệt kê `variants` (kèm `note_vi`).
- **Lỗi thường gặp:** mỗi lỗi hiện `description_vi`, câu sai gạch ngang → câu đúng, và `feedback_vi`. Lỗi `tolerated` có nhãn "Chấp nhận được".
- **Ví dụ:** câu Anh / Việt, có nút nghe.
- **Nút "Lưu thẻ"** theo G3, dùng `SaveItemButton`.
- Trạng thái chỗ trống chỉ nằm trong state của component, không lưu xuống DB.

### 4.4 `LessonPronunciationSection.tsx` và `LessonListeningSection.tsx` (mới)
- **Phát âm:**
  - âm trọng tâm và IPA;
  - mẹo tiếng Việt;
  - các cặp tối thiểu, mỗi cặp hai nút nghe TTS;
  - ví dụ.
- **Nghe hiểu:**
  - nút nghe (TTS đọc `text`);
  - câu hỏi Anh / Việt;
  - nút **"Xem đáp án"** để hiện đáp án và lời thoại.
  - Không chấm điểm.
- Cả hai có trạng thái rỗng giống các section hiện có.

### 4.5 `LessonVocabularySection.tsx`
- Chia hai nhóm: **"Bắt buộc"** và **"Mở rộng"**, mỗi nhóm có `SectionHeader`. Chỉ chia khi bài có `role`; bài tự tạo giữ một danh sách.
- Chip "Mới" hoặc "Ôn lại" hiện trong vùng `actions` của `WordCard`, cạnh nút lưu, nên **không sửa `WordCard`**.
- `isSaved` theo mã item (G4).

### 4.6 Block `item_cards` (`CanonicalBlockView.tsx`)
- Thay danh sách chữ `text · meaning_vi` bằng các thẻ gọn: tên item, nghĩa, chip kind, nút nghe nếu có `onSpeakText`.
- `BlockItemLookup` thêm `kind`.
- Mẫu câu hiện khung với chỗ trống thay bằng nhãn, không tương tác; chỗ trống tương tác chỉ có trong section Mẫu câu.

### 4.7 Course (`courseClient.ts`, `LevelUnitsScreen.tsx`, `UnitLessonsScreen.tsx`)
- `UnitSchema` và `CurriculumLessonSchema` thêm `canDo: z.array(z.string()).default([])` và `audience: z.enum(['all', 'kids', 'adults']).default('all')`. Dùng `default` để server cũ hoặc mock thiếu trường vẫn parse được.
- **Unit:** dòng mô tả đổi thành can-do đầu tiên ("Bạn sẽ: …"). Nếu không có can-do thì giữ `description`.
- **Bài:** can-do đầu tiên đặt vào `footer` của `LessonCard` (prop đã có sẵn), không sửa `LessonCard`.

### 4.8 Lưu thẻ và ôn tập
- **`useLessonSavedItems.ts`:**
  - `savedWords` đổi khoá sang `itemKey ?? vocabularyItemKey(word)`;
  - thêm `patterns: PatternSaveControl {isSaved(itemKey), onToggle(entry)}`.
  - Lưu qua `saveFlashcard` với `item: {itemKey, itemId, kind: 'pattern'}`;
  - bỏ lưu bằng `removeFlashcardFromLesson`, như từ vựng.
- **`ReviewCardFaces.tsx`:** thêm `ReviewPatternFront` và `ReviewPatternBack` theo G3, dùng lại khung, blob và nút nghe của mặt thẻ hiện có. `ReviewCardContent` thêm `kind?`.
- **`DailyReviewScreen.tsx`:** `FlashcardFace` chọn mặt thẻ theo `card.kind === 'pattern'`. Mặt sau mẫu câu đọc ví dụ bằng TTS, nếu không có ví dụ thì đọc khung đã thay nhãn.
- **Thư viện (`VocabularyRowCard.tsx`):** thẻ mẫu câu hiện khung với chỗ trống thay bằng `…` và chip "Mẫu câu". Lọc và đếm không đổi.
- **Hàm thuần mới** `renderFrameWithLabels(frame, slots?)` trong `core/learning/patternFrame.ts`, dùng chung cho thẻ ôn, Thư viện và `item_cards`. Đây là **file copy của server**: thêm hàm ở cuối kèm ghi chú "app-only", không sửa các hàm đã copy.

### 4.9 Chuỗi giao diện (`src/core/i18n/vi.json`, `en.json`)
- Thêm key cho:
  - thẻ đặc tả: `lessonPlayer.outcome_*`;
  - các hàng và section mới: `lessonPlayer.explore_patterns_*`, `explore_pronunciation_*`, `explore_listening_*`, `pattern_*`, `pronunciation_*`, `listening_*`;
  - nhãn vai trò: `lessonPlayer.item_role_*`, `item_intro_*`;
  - mặt thẻ ôn mẫu câu: `review.pattern_*`;
  - can-do trong course: `course.unit_can_do`.
- Đổi giá trị `hero_mine` (G5).
- Hai file giữ đủ cặp key để test `i18n.test.ts` vẫn xanh.

## 5. Kiểm thử

| Test | Nội dung |
|---|---|
| `logic/__tests__/lessonHubContent.test.ts` (mở rộng) | - outcome null khi không có spec;<br>- vocabulary sắp bắt buộc trước mở rộng;<br>- pattern: segments, choices gồm `values` + ref đã giải mã (có và không có trong `lesson_items`);<br>- payload hỏng bị bỏ qua;<br>- lọc ví dụ theo đối tượng;<br>- `lessonHubSections` cho bài curriculum và bài tự tạo. Dùng fixture `valid-lesson-snapshot-with-spec-response.json` và `core/learning/__tests__/fixtures/items/*.json`. |
| `components/__tests__/LessonOutcomeCard.test.tsx` | Hiện can-do, tình huống, thời lượng; chạm bài tiên quyết gọi `onOpenLesson`; ẩn khi không có spec. |
| `components/__tests__/LessonPatternSection.test.tsx` | Chạm chip đổi giá trị và câu ghép; nhấn giữ mở danh sách; biến thể; lỗi `tolerated` có nhãn; lưu thẻ gọi `onToggle` với mã item; a11y label của chip. |
| `components/__tests__/LessonPronunciationSection.test.tsx`, `LessonListeningSection.test.tsx` | Nút nghe gọi `onSpeakText` đúng chữ; "Xem đáp án" hiện đáp án; trạng thái rỗng. |
| Test hub hiện có (`CanonicalLessonHub*.test.tsx`) | Bài curriculum: hàng Mẫu câu thay Ngữ pháp, hàng Phát âm / Nghe hiểu chỉ khi có. Bài tự tạo: giữ 3 hàng cũ và chip "Bài tự tạo". |
| Test player screen | Mở `patterns`, `pronunciation`, `listening` từ hub; nút back về hub. |
| `CanonicalBlockView` test | `item_cards` hiện thẻ có chip kind; mẫu câu hiện khung đã thay nhãn. |
| `courseClient` / course screen tests | `canDo` thiếu → `[]`; unit hiện "Bạn sẽ: …"; bài hiện can-do ở footer. |
| `useLessonSavedItems` test | Trạng thái đã lưu theo mã item (cùng từ khác hoa thường hoặc dấu câu vẫn là một thẻ); lưu và bỏ lưu mẫu câu. |
| `FlashcardRepository.schemaV5.real-sqlite.test.ts` | Thêm ca lưu mẫu câu với `kind = 'pattern'` và đọc lại. |
| `DailyReviewScreen` test, `flashcard-e2e.test.tsx` | Thẻ mẫu câu: mặt trước tiếng Việt, mặt sau khung + ví dụ, TTS đọc ví dụ. Thẻ từ không đổi. |
| `patternFrame` test | `renderFrameWithLabels` thay chỗ trống bằng nhãn hoặc `…`; khung hỏng trả nguyên văn. |

Kiểm tra cuối:
- `npx tsc --noEmit`;
- `yarn -s lint` (budget không tăng);
- `yarn -s format:check` (không chạy Prettier trên thư mục fixture);
- `npx jest`.

**Không chạy được simulator trong môi trường này.** Bạn cần tự xem trên máy các phần: chạm đổi chỗ trống, độ dài khung câu trên màn nhỏ, thẻ ôn mẫu câu.

## 6. Thứ tự commit

Mỗi commit tự chạy được, typecheck và test đều xanh.
1. `feat(lesson): hub content for lesson outcome, patterns, pronunciation and listening`: §3 và test logic.
2. `feat(lesson): lesson outcome card and explore rows by lesson kind`: §4.1, §4.2, i18n phần hub, G5.
3. `feat(lesson): pattern section with tappable slots, variants and common errors`: §4.3 và `renderFrameWithLabels`.
4. `feat(lesson): pronunciation and listening sections`: §4.4.
5. `feat(lesson): vocabulary roles and item cards block`: §4.5, §4.6.
6. `feat(course): show can-do on units and lessons`: §4.7.
7. `feat(review): save patterns as flashcards and review them Vietnamese-to-English`: §4.8, G3, G4.
8. `docs: mark PR 6 plan as implemented`: cập nhật plan và báo cáo phiên.

## 7. File tóm tắt

**Thêm:**
- `src/features/lesson/player/components/` `LessonOutcomeCard.tsx`, `LessonPatternSection.tsx`, `LessonPronunciationSection.tsx`, `LessonListeningSection.tsx`, cùng test của chúng.

**Sửa:**
- `src/features/lesson/player/logic/lessonHubContent.ts`, `useLessonSavedItems.ts`;
- `src/features/lesson/player/components/CanonicalLessonHub.tsx`, `LessonVocabularySection.tsx`, `CanonicalBlockView.tsx`, `CanonicalLessonPlayer.tsx` (truyền `kind` vào lookup), `SentenceAnalysisPanel.tsx` (G4);
- `src/features/lesson/player/screens/CanonicalLessonPlayerScreen.tsx`;
- `src/features/course/logic/courseClient.ts`, `screens/LevelUnitsScreen.tsx`, `screens/UnitLessonsScreen.tsx`;
- `src/features/review/components/ReviewCardFaces.tsx`, `screens/DailyReviewScreen.tsx`;
- `src/features/lesson/library/components/VocabularyRowCard.tsx`;
- `src/core/learning/patternFrame.ts` (thêm một hàm app-only), `src/core/learning/index.ts`;
- `src/core/i18n/vi.json`, `en.json`;
- các test liên quan ở §5.

**Xoá:** không có. `LessonGrammarSection.tsx` được giữ theo G2.

**Dependency mới:** không có.

## 8. Rủi ro

- **Bài curriculum không còn hàng Ngữ pháp.** Ngữ pháp từ phân tích câu của bài curriculum (nếu có) sẽ không hiện ở hub nữa; thay vào đó là mẫu câu do admin soạn. Phân tích từng câu trong phần Câu vẫn hiện ngữ pháp như cũ.
- **Không có ảnh và audio thật** (G1). Bài trẻ em sẽ thiếu hình cho tới PR media. TTS phát âm có thể khác giọng mẫu admin đã chọn.
- **Đổi khoá "Đã lưu" sang mã item** (G4) chạm vào `SentenceAnalysisPanel` dùng chung với bài YouTube. Có test real-SQLite và e2e flashcard kiểm tra.
- **Khung câu dài** (4 chỗ trống, giá trị dài) có thể xuống dòng xấu trên màn nhỏ. Chip chỗ trống dùng `flexWrap` và cần xem tay trên thiết bị.
- **`patternFrame.ts` là file copy của server.** Hàm mới thêm ở cuối kèm ghi chú app-only; phần copy không đổi để còn so được với server.
- **Khối lượng:** khoảng 20 file sửa, 4 component mới, không xoá file. Có thể tách **PR 6a** (commit 1–6: hub, section, course) và **PR 6b** (commit 7: flashcard mẫu câu).

## 9. Kết quả code và điểm lệch so với plan

**Kiểm tra cuối:**
- `tsc` sạch.
- Lint 0 lỗi, budget 178/281, không nâng.
- `format:check` sạch.
- Jest: 298 suite, 2147 test pass (3 skip).
- **Chưa chạy trên simulator hay thiết bị.**

Commit đúng thứ tự §6 (1–7), cộng commit docs này.

**Điểm lệch so với plan:**
- **Mặt thẻ ôn mẫu câu:**
  - Phân nhánh theo `kind` ngay trong `ReviewCardFront` / `ReviewCardBack`, không tách thành `ReviewPatternFront` / `ReviewPatternBack`, để không nhân đôi khung, blob và kệ thẻ.
  - Mặt trước hiện nghĩa tiếng Việt và lời nhắc "Nói câu tiếng Anh cho ý này". **Mặt trước không có tình huống**, vì bảng `flashcards` không có cột cho tình huống của bài.
  - **Mặt trước không có nút nghe**, vì nghe câu sẽ lộ đáp án.
  - Mặt sau hiện khung câu với chỗ trống là `…`. Thẻ không lưu payload nên không có nhãn chỗ trống.
- **Section Mẫu câu:**
  - Dưới khung câu là nghĩa tiếng Việt; câu ghép từ các giá trị đang chọn được đọc bằng nút nghe.
  - Mỗi đoạn chữ của khung là một `AppText` riêng nằm trong hàng `flexWrap`. Khung dài có thể xuống dòng theo từng đoạn chứ không theo từng từ, cần xem trên máy.
- **Item hỏng bị bỏ qua, không báo lỗi:** payload sai, khung sai, chỗ trống không có giá trị, hoặc bài nghe không có đáp án.
- **Kiểu `LessonHubSection`** chuyển sang `lessonHubContent.ts`; `CanonicalLessonHub` re-export lại.
- **Tiêu đề header** của từng section lấy từ `lessonSectionTitleKey`, nên bài curriculum hiện "Từ & cụm".
- **Hàng khám phá có testID** `canonical-hub-explore-<section>`.
- **Commit 2 là bước trung gian:** màn player trả `null` cho `patterns` / `pronunciation` / `listening` cho tới commit 3–4.
- **Can-do của bài** nằm trong `footer` của `LessonCard` và dùng chung key `course.unit_can_do` ("Bạn sẽ: …") với can-do của unit.
- **Nhãn "Bài tự tạo"** (G5) cũng hiện ở danh sách bài (`CanonicalLessonCatalogScreen`), vì màn đó dùng chung key `hero_mine`.
- **Thư viện:** tag "Mẫu câu" của thẻ mẫu câu đặt vào chỗ `pos` của `WordCard`, nên không sửa `WordCard`.
- **Block `item_cards`:** có nút nghe cho mọi kind trừ mẫu câu. Item nghe hiểu đọc `text`.
- **Icon:** `record_voice_over`, `hearing`, `flag`, `schedule`, `check_circle` đều đã có trong `iconRegistry`, không thêm icon mới.
