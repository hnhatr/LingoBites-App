# Stage 5 (phần ảnh) và Stage 6–9: ảnh → bài, Game Hub, 3 nhóm game

> Trạng thái: **THIẾT KẾ**, chưa code. Cần chốt các câu hỏi ở §5 trước khi viết plan chi tiết từng PR.
> Ngày lập: 2026-10-10. Repo: `LingoBites-App` + `LingoBites-Server` (+ admin-web nếu cần).
> Liên quan: `2026-10-08-backlog-remaining-work.md` (Stage 4–5, mục 4.3), `2026-10-08-remaining-work-plan.md` (thứ tự làm).

## 1. Nguyên tắc chung: app có 3 "ổ cắm"

Một tính năng mới chỉ cần biết nó thuộc ổ nào và trả ra đúng dạng dữ liệu chung của ổ đó. Khi đó player, từ vựng, flashcard, ôn tập, practice, game, engagement dùng được ngay mà không phải sửa.

| Ổ cắm | Gắn gì vào | Đầu ra chung |
|---|---|---|
| **1. Nguồn tạo bài** | dán chữ, OCR, YouTube, tình huống (S5.3), **ảnh → bài (Stage 5)** | một **bài học** chuẩn: câu, dịch, IPA, phân tích, `lesson_items`, `spec`, `tasks` |
| **2. Hoạt động trong bài** | đọc, nghe, nói, viết, chọn… trong player 6 bước | `activity_attempts` với `kind = 'lesson'` |
| **3. Luyện ngoài bài** | **game (Stage 6–9)**, ôn tập, practice | `activity_attempts` với `kind = 'game' / 'review' / 'practice'` |

Hiện trạng làm nền (đã có, không phải làm lại):
- `activity_attempts` đã nhận `kind = 'game'` ở cả app (`core/schemas/sync.ts`) và server (`modules/sync/model/sync.ts`); ghi qua `recordActivityAttempt` (`core/sync/activityAttempts.ts`), sync qua outbox.
- Server chỉ cho `kind = 'review'` dời `item_memory` (`modules/sync/repository/store.ts`), nên game không làm lệch lịch ôn.
- `core/learning/practice.ts` có bộ sinh câu hỏi tất định theo seed, chạy offline (`meaning_choice`, `cloze_choice`, `translation_choice`).
- Feature flag đã khai báo, đang `not_implemented`: `miniGame` (cờ cha), `wordMatchGame`, `fillBlankGame`, `sentenceOrderGame`, `tenseQuizGame`, `flashcardChallenge` (`core/release/feature-registry.ts`).
- Server có pipeline tạo bài theo nguồn (`LessonSourceType`: `admin_text`, `learner_text`, `learner_ocr`, `youtube`) và nhánh `compose` / `lessonComposer` (S4.1).

---

## 2. Stage 5 – phần ảnh: tạo bài từ một tấm ảnh

Thay cho mục S4.4 cũ ("ảnh không có chữ"). Người học chụp hoặc chọn một ảnh cảnh vật / đồ vật / tình huống; AI sinh ra một bài tiếng Anh tả hoặc nói về bức ảnh, có đọc, từ vựng, mẫu câu, viết, nói.

### 2.1 Luồng

```text
App: Tab Tạo bài → Chụp / chọn ảnh
        ├─ "Lấy chữ trong ảnh"   → OCR (đã có, learner_ocr)
        └─ "Tả bức ảnh"   (MỚI)  → upload ảnh + chọn trình độ, mục tiêu (tả cảnh / hội thoại tình huống)
                                        │
Server: source_type = 'learner_image' (MỚI)
   1. Kiểm duyệt ảnh; AI đọc ảnh (vision) → mô tả + tình huống + đoạn văn / hội thoại theo trình độ   ← MỚI
   2. Đoạn văn đó là "nguồn" → pipeline sẵn có: tách câu, dịch, IPA, phân tích                         ← dùng lại
   3. lessonComposer (S4.1): spec can-do, từ vựng, mẫu câu, tasks                                       ← dùng lại
   4. Task riêng cho ảnh: "Tả lại bức ảnh" (viết / nói)                                                 ← MỚI (prompt)
        │
App: finishCreate(lessonId) → mở bài như mọi bài khác                                                 ← dùng lại
     → hub bài hiện ảnh gốc; Đọc, Từ vựng, Mẫu câu, Practice, Game, Flashcard đều có sẵn
```

Đối chiếu kỹ năng:
- **Đọc:** đoạn mô tả / hội thoại AI sinh chính là phần câu của bài.
- **Từ vựng:** `lesson_items` (đồ vật, hành động trong ảnh) → flashcard, ôn tập, game.
- **Viết / nói:** `tasks` trong spec ("Viết 3 câu tả bức ảnh", "Nói bạn sẽ làm gì nếu ở đó"). Nói dùng khung ghi âm / chấm của Stage 3. Viết: tự đánh giá cho tới khi có chấm viết (PR 12).

### 2.2 Việc cần làm

| # | Việc | Repo | Ghi chú |
|---|---|---|---|
| S5.6 | **Endpoint media cho người học** (G1 của PR 6): đọc ảnh / audio của bài theo quyền sở hữu, tải về để học offline. | server + app | Dùng lại module `media`. Game cũng cần. |
| S5.7 | **Server – nguồn `learner_image`:** thêm vào `LessonSourceTypeValues`; upload ảnh; kiểm duyệt; bước vision → văn bản nguồn (prompt mới trong `aiPrompts/registry.ts`); đưa văn bản vào pipeline sẵn có + `lessonComposer`; task "tả lại bức ảnh"; job bất đồng bộ như YouTube; giới hạn lượt (Q8, H12: chỉ tính lượt khi tạo thành công). | server | ⚠️ Đổi contract công khai (`source_type`): app phải cập nhật zod cùng lúc. Có test bằng AI mock và fixture. |
| S5.8 | **App – "Tả bức ảnh":** sau khi chụp / chọn ảnh hỏi "Lấy chữ" hay "Tả bức ảnh"; màn chọn trình độ và mục tiêu; intent `startCreate({kind: 'image_scene', ...})`; màn chờ job; `finishCreate`. Hub bài hiện ảnh gốc (cần S5.6). | app | Dùng lại `imagePicker`, luồng tạo bài, `useAppNavigation`. |
| S5.9 | **Admin:** xem bài sinh từ ảnh, "nhận về" làm nội dung chung (Q9), xem lượt từ chối do kiểm duyệt. | server + admin | Có thể để cuối |

- **Phụ thuộc:** S4.1 (đã code); nên làm sau S5.3 vì dùng chung phần "AI viết nguồn → composer". Q12–Q15 (§5).
- **Xong khi:** người học chụp một ảnh quán cà phê, nhận được bài đúng trình độ có ảnh, đoạn đọc, từ vựng, mẫu câu, nhiệm vụ viết / nói, và học trọn được; ảnh không phù hợp bị từ chối, không tính lượt.

---

## 3. Stage 6 – Game Hub

### 3.1 Cấu trúc thư mục (luật `app → features → ui → core`, xem `docs/architecture/module-boundaries.md`)

```text
src/core/learning/games/          # thuần, không UI, không I/O
  contract.ts                     # GameMeta, RoundGame, GameSource, GamePool, GameGrade
  pool.ts                         # gom item thành bộ dữ liệu cho game

src/features/games/               # feature MỚI (không gộp vào engagement)
  index.ts                        # barrel công khai
  logic/registry.ts               # danh sách game; lọc theo flag + đủ dữ liệu + quyền
  logic/useGameSession.ts         # HOST: seed, đếm giờ, ghi attempt, sync, kết quả
  logic/gamePool.ts               # lấy item: bài đã tải / item đến hạn / thẻ đã lưu
  screens/GameHubScreen.tsx       # sảnh game
  screens/GameSessionScreen.tsx   # khung chung: tiến độ, tạm dừng, màn kết quả
  games/<gameId>/…                # mỗi game chỉ có UI của nó
```

Các cờ game trong `feature-registry.ts` đổi `module` sang `src/features/games`.

### 3.2 Contract: hai mức

```ts
type GameSource =
  | {kind: 'lesson'; lessonId: string}   // chơi với một bài đã tải
  | {kind: 'due'}                        // item đến hạn ôn (item_memory)
  | {kind: 'saved'};                     // flashcard đã lưu

type GamePool = {
  words: WordLearningItem[];
  sentences: {id: string; textEn: string; textVi: string}[];
  patterns: CatalogLearningItem[];
};

type GameGrade = {correct: boolean; itemKeys: string[]; score?: number};

// Phần chung của mọi game
type GameMeta = {
  id: string;                  // = `activity` của attempt, khớp /^[a-z0-9_]+$/
  flag: FeatureKey;
  genre: 'quiz' | 'match' | 'order' | 'listening' | 'arcade' | 'board' | 'speaking' | 'story';
  skills: Array<'vocab' | 'pattern' | 'listening' | 'speaking' | 'grammar'>;
  requires: Array<'tts' | 'mic' | 'network' | 'ai'>;  // Hub tự kiểm tra, xin quyền, báo offline
  isEligible(pool: GamePool): boolean;
};

// Mức 1 – game theo lượt: chỉ viết generate + grade + UI một lượt.
type RoundGame<R, A> = GameMeta & {
  mode: 'rounds';
  generate(pool: GamePool, seed: string): R[];   // tất định, offline
  grade(round: R, answer: A): GameGrade;
  Round: React.FC<{round: R; onAnswer(answer: A): void; feedback: GameGrade | null}>;
};

// Mức 2 – game tự do (arcade, lưới, nói, truyện…): game tự chạy vòng chơi.
type FreeGame = GameMeta & {mode: 'free'; Screen: React.FC<{ctx: GameContext}>};

type GameContext = {
  pool: GamePool;
  seed: string;
  report(itemKey: string | null, result: 'correct' | 'incorrect' | 'skipped', score?: number): void;
  finish(summary?: {score?: number}): void;
  speak(text: string): void;
  pause(): void;
  quit(): void;
};
```

- Host bọc `RoundGame` thành `FreeGame`, nên chỉ có **một đường chạy** để test.
- Host làm mọi việc chung: `sessionId`, seed (như `practiceSeed`), `recordActivityAttempt({kind: 'game', activity: id, itemKey, sessionId, result, durationMs})` cho từng item, `recordGameSessionActivity` (thêm vào engagement), `requestSync()`, màn kết quả chung (điểm, từ sai, "Lưu thành flashcard" qua `saveFlashcard`, chơi lại / đổi game).
- Stage 7–9 chỉ dùng **mức 1**. Mức 2 có sẵn để sau này gắn arcade, ô chữ, game nói, nhập vai AI mà không phải sửa khung.

### 3.3 Sảnh game và điều hướng

- **Sảnh:** "Gợi ý hôm nay" (item đến hạn + item hay sai từ `activity_attempts`), "Chơi với bài vừa học" (bài đã tải gần nhất), "Tất cả game" (từ registry; tắt cờ thì ẩn, chưa đủ dữ liệu thì mờ kèm lý do).
- **Route:** `GameHub` và `GameSession {gameId, source}` đăng ký một lần trên root stack, nhóm "Luyện" (`docs/architecture/navigation.md`).
- **Intent mới** trong `core/navigation`: `openGames(source?)`, `openGame(gameId, source)`; chỉ `appNavigationAdapter` biết tên route.
- **Lối vào:** Today (`adaptationEngine` thêm loại hoạt động `game`), hub bài học ("Chơi game với bài này"), màn kết quả Practice, một ô trên Home (Q về tab riêng: M2).

### 3.4 Việc cần làm

| # | Việc | Repo |
|---|---|---|
| S6.1 | `core/learning/games` (contract, pool) + `features/games` (registry, host `useGameSession`, `GameSessionScreen`, màn kết quả chung) + `recordGameSessionActivity` | app |
| S6.2 | `GameHubScreen`, route + intent `openGames` / `openGame`, lối vào Home / hub bài / kết quả Practice; Today ở Stage 7 trở đi | app |
| S6.3 | Test chung chạy qua mọi game trong registry: `id` hợp lệ, `flag` có thật, `requires` hợp lệ; với `RoundGame`: cùng seed ra cùng kết quả, không sinh round khi `isEligible` false | app |

- **Không cần migration, không cần sửa server.**
- **Xong khi:** Hub mở được, có một game mẫu (`meaning_quiz`, làm sớm từ Stage 7) chạy hết vòng: ghi attempt `kind = 'game'`, sync lên server, màn kết quả lưu được flashcard.

---

## 4. Stage 7–9 – ba nhóm game đầu tiên (đều dùng mức 1)

| Stage | Nhóm | Game | Dữ liệu dùng lại | Cờ |
|---|---|---|---|---|
| **7** | **Hỏi–đáp theo lượt** | chọn nghĩa (`meaning_quiz`), điền chỗ trống (`blank_quiz`), đúng / sai (`true_false`) | bộ sinh `meaning_choice`, `cloze_choice` trong `core/learning/practice.ts` | `miniGame`, `fillBlankGame` |
| **8** | **Sắp xếp, ghép cặp** | ghép từ–nghĩa (`meaning_match`), xếp câu (`sentence_order`), kéo thả vào chỗ trống (`drag_fill`) | `words` + `snapshot.sentences`; mẫu câu (`parseFrame`) cho kéo thả | `wordMatchGame`, `sentenceOrderGame` |
| **9** | **Nghe** | nghe rồi chọn (`listen_choice`), nghe rồi gõ (`listen_type`) | TTS sẵn có (`react-native-tts`), `acceptedAnswers` / `normalizeAnswer` để chấm câu gõ | `miniGame` (+ cờ con mới nếu cần) |

Ghi chú:
- Mỗi game: `generate` / `grade` thuần ở `core/learning/games/<game>.ts` có unit test; UI một lượt ở `features/games/games/<game>/`.
- Stage 8: mỗi lượt là **một bảng** (ví dụ 5 cặp từ–nghĩa); `grade` trả nhiều `itemKeys`. Kéo thả dùng `react-native-gesture-handler` + `reanimated` (đã có), **không thêm dependency**.
- Stage 9: `requires: ['tts']`; máy không có giọng TTS tiếng Anh thì Hub hiện mờ kèm lý do. `listen_type` chấm theo cùng quy tắc chuẩn hoá của bài (fixture `accepted-answers.json`).
- Mỗi stage thêm một hoạt động `game` cho Today khi có item phù hợp.
- `tense_quiz` (`tenseQuizGame`) và `flashcard_challenge` để sau: chưa có dữ liệu ngữ pháp có cấu trúc; `flashcard_challenge` cần chốt M1.

| # | Việc | Repo |
|---|---|---|
| S7.1 | `meaning_quiz`, `blank_quiz`, `true_false` + Today | app |
| S8.1 | `meaning_match`, `sentence_order` | app |
| S8.2 | `drag_fill` (mẫu câu) | app |
| S9.1 | `listen_choice`, `listen_type` | app |

- **Xong khi (mỗi stage):** game chơi được offline với một bài đã tải, với item đến hạn và với thẻ đã lưu; kết quả lên server; từ sai lưu được thành flashcard.

---

## 5. Câu hỏi cần chốt

| # | Câu hỏi | Đề xuất | Cần cho |
|---|---|---|---|
| Q12 | Quyền riêng tư của ảnh: có lưu ảnh trên server không, bao lâu; có cần xin đồng ý như ghi âm không | Lưu cùng bài để hiện trong hub, xoá khi xoá bài / xoá dữ liệu; xin đồng ý lần đầu; cảnh báo không chụp giấy tờ, mặt người lạ | S5.7 |
| Q13 | Kiểm duyệt ảnh | Từ chối ảnh không phù hợp trước khi sinh; ảnh "không có tình huống" trả về như H7 của compose, không tính lượt | S5.7 |
| Q14 | Chi phí vision, giới hạn | Dùng chung hạn mức Q8; trẻ em không tự sinh (giống D3) | S5.7 |
| Q15 | Chấm bài viết "tả lại bức ảnh" | Tự đánh giá cho tới khi PR 12 (chấm câu viết) xong | S5.7 |
| M1 | Game có dời lịch ôn (`item_memory`) không | **Không.** Game nhiều lựa chọn quá dễ, sẽ đẩy item lên stage sai thực tế. Item sai → gợi ý lưu flashcard. Nếu sau này muốn tính, chỉ tính game bắt gõ / tự nhớ lại (cần sửa `store.ts` phía server) | S6.1 |
| M2 | Lối vào chính của Game Hub | Today, Home, hub bài, kết quả Practice; **chưa thêm tab mới** | S6.2 |
| M3 | Có mở đường cho game nặng đồ hoạ (`@shopify/react-native-skia`) hoặc game HTML5 (WebView) ngay không | Chưa. Stage 7–9 chỉ cần gesture-handler + reanimated + svg đã có. Skia là dependency mới, cần duyệt riêng | sau Stage 9 |
| M4 | XP / thưởng cho game | Tính như practice (một lần mỗi ván xong), không thay "đạt bài" (quy tắc liên kết của lộ trình) | S6.1 |
