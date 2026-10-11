# Kế hoạch hoàn thiện tính năng Practice / Quiz (Luyện tập nhanh)

> Trạng thái: **BẢN NHÁP — chờ duyệt** (theo VibeGuard §1: chưa code cho tới khi chốt các quyết định ở mục 5).
> Ngày lập: 2026-10-05. Phạm vi: `LingoBites-App` (chính) + `LingoBites-Server` (chỉ ở Phase 5, tùy chọn).

---

## 1. Mục tiêu

Sau khi học xong (hoặc bất kỳ lúc nào với bài đã tải), người học làm một bài quiz ngắn
(~10 câu trắc nghiệm) sinh từ chính nội dung bài: chọn nghĩa của từ, điền từ vào chỗ trống.
Bài quiz phải:

- chạy **offline** với bài học đã tải (snapshot canonical trong `lesson_downloads`);
- chấm điểm ngay trên máy, có giải thích tiếng Việt;
- có màn kết quả, cho làm lại, và đề xuất lưu từ sai vào flashcard (nối với SRS hiện có);
- được bật/tắt bằng flag `shortPractice` (đang `ready` + `true` ở production nhưng **chưa có code nào đọc**).

Ngoài phạm vi (đợt này): mini-game (`wordMatchGame`, `fillBlankGame`, …), câu hỏi sinh bằng AI, chấm phát âm.

---

## 2. Hiện trạng trong source

### 2.1 Còn sống trong App (nhưng không được nối)

| File | Dòng | Tình trạng | Dùng lại? |
|---|---|---|---|
| `src/ui/components/QuizOption.tsx` | 157 | Component lựa chọn A/B/C, 4 trạng thái `default/selected/correct/wrong`, có test. Không ai import. | **Có** — dùng nguyên |
| `src/core/schemas/practice.ts` | 210 | Zod schema đầy đủ: `MeaningChoice`, `ClozeChoice`, `PracticeSet`, `PracticeSession`, `AnswerEvent`, `ResultSummary`, … Chỉ `PRACTICE_CONTRACT_VERSION` được dùng. | **Có** — giữ phần câu hỏi/kết quả, nới các trường gắn với server (`provenance`, `generator`, `config_hash`) |
| `src/core/api/practiceClient.ts` | 134 | Gọi `POST /v1/lessons/:id/practice-sets`, `GET /v1/practice-sets/:id`. **Server đã gỡ 2 route này** (test `legacySystemsRetired.test.ts` khẳng định trả 404). | **Không** — xoá (cần duyệt) |
| `src/features/sync/logic/api/practiceEventsClient.ts` | 137 | Gửi `POST /v1/practice-events:batch`; vẫn được `outboxSync.ts` gọi khi outbox có hàng `event_type='practice'`. **Server không còn route này.** Hiện không sinh hàng nào nên chưa lỗi. | Thay ở Phase 5 |
| `src/core/db/types.ts` `PRACTICE_EVENT_TYPE`, `PracticeEventPayload` | — | Kiểu outbox cho practice. | Xem Phase 5 |
| `src/core/release/feature-registry.ts` `shortPractice` | — | Flag `ready`, module ghi `src/features/review`. | **Có** — dùng làm cổng bật/tắt |
| `src/features/lesson/player/logic/lessonHubContent.ts` | — | `collectLessonVocabulary(snapshot, analyses)`, `sortedSentences()` — gom từ vựng + câu từ snapshot canonical. | **Có** — nguồn dữ liệu sinh câu hỏi |
| `src/features/review/logic/FlashcardRepository.ts` | — | `saveFlashcard()` — lưu từ vào SRS. | **Có** — "lưu từ sai" |

### 2.2 Đã bị xoá có chủ đích (LING-149, FR-027) — khôi phục được từ git

**App** — commit `f295665` (2026-10-01, "canonical lesson cutover") xoá toàn bộ `src/features/practice/` (~4.000 dòng kể cả test).
Lấy lại bằng `git show f295665^:<path>`:

| File cũ | Dòng | Ghi chú tái sử dụng |
|---|---|---|
| `logic/grader.ts` | 56 | Thuần, chấm theo `option id`. **Dùng gần như nguyên.** |
| `logic/resultSummary.ts` | 141 | Thuần, tính điểm/`review_candidates`. **Dùng gần như nguyên.** |
| `logic/sessionEngine.ts` | 305 | Logic phiên (thứ tự cố định, pause/resume/retry) nhưng gắn chặt `PracticeRepository`. Tách phần thuần ra. |
| `logic/data/PracticeRepository.ts` | 505 | SQLite cho bảng `practice_*` — các bảng này **đã bị DROP ở schema v3**. Viết lại gọn hơn. |
| `logic/practiceUiProjection.ts` | 86 | Map state → UI. Tham khảo. |
| `logic/usePracticeSessionScreen.ts` | 89 | Hook màn hình. Tham khảo. |
| `screens/PracticeScreen.tsx` | 597 | UI cũ đã dùng `QuizOption`, `HandoffProgressTrack`, `AppScreen`… Tham khảo bố cục; viết lại theo design paper-cut hiện tại. |
| `logic/practiceEligibility.ts` | 59 | Ngưỡng tối thiểu (≥4 từ có nghĩa hoặc ≥1 câu có dịch). Viết lại cho `LessonSnapshot`. |
| `logic/quizEngine.ts`, `useQuiz.ts`, `practiceQuestion.ts`, `resolveQuickPractice.ts` | — | Đường "legacy" đã `@deprecated` từ trước. **Không khôi phục.** |
| `logic/validator.ts` | 836 | Kiểm định câu hỏi. Lấy bản server (bên dưới) làm chuẩn. |

**Server** — commit `9e61936` (2026-10-01) xoá `src/modules/practice/` (~4.700 dòng kể cả test), migration 024 DROP bảng `practice_*`.
Điểm quan trọng: **`service/generator.ts` (897 dòng) là bộ sinh câu hỏi tất định (deterministic), không dùng AI** — thuần, không I/O, seed bằng `xmur3 + mulberry32`. `service/validator.ts` (834 dòng) cũng thuần.
→ Hai file này **port được sang App** để sinh câu hỏi ngay trên máy.

### 2.3 Vì sao không "khôi phục nguyên trạng"

1. Mô hình bài học đã đổi: practice cũ đọc `LessonV2` (`vocabulary[].meaning_vi`, `sentences[].translation`, `status`), giờ là `LessonSnapshot` canonical (`sentences[].text_en/text_vi`, `analyses[sentence_id].vocabulary[].word/meaning`, block `vocabulary`/`grammar`).
2. Server đã gỡ route + bảng, và có test khóa việc đó (`test/legacySystemsRetired.test.ts`). Khôi phục server-side generation nghĩa là đảo quyết định FR-027.
3. Bộ sinh câu hỏi vốn tất định → không cần server để sinh; chạy trên máy đơn giản hơn, offline hoàn toàn, không tốn round-trip/poll.

---

## 3. Hướng đề xuất

**Phương án A (đề xuất): sinh câu hỏi trên máy từ snapshot đã tải, lưu cục bộ, sync kết quả sau.**

```
LessonSnapshot (lesson_downloads) + analyses
        │  collectLessonVocabulary / sortedSentences
        ▼
buildPracticeSource()  ──► generatePracticeSet(source, seed)  (port generator.ts)
        │                          │
        │                          ▼ validateQuestionSet (port validator.ts)
        ▼
PracticeScreen (QuizOption) ──► grader ──► practice_sessions/practice_answers (SQLite v5)
        │
        ▼
PracticeResult ──► resultSummary ──► "Lưu từ sai" → saveFlashcard() ; gamification event
        │
        ▼ (Phase 5, tùy chọn)
sync collection `practice_attempts` → Server
```

| | A. Sinh trên máy (đề xuất) | B. Khôi phục server-side |
|---|---|---|
| Offline | Hoàn toàn | Cần mạng lần đầu |
| Thay đổi server | Không (trừ Phase 5 tùy chọn) | Khôi phục ~4.700 dòng, migration mới, sửa test retired |
| Phù hợp kiến trúc hiện tại | Giống Shadowing (local-first + sync collection) | Đi ngược FR-027 |
| Nhất quán giữa các máy | Seed tất định theo `lessonId + content_revision + attempt` → giống nhau | Server là nguồn duy nhất |
| Mở rộng câu hỏi AI sau này | Thêm nguồn server sau, schema giữ nguyên | Sẵn |

---

## 4. Thiết kế chi tiết (phương án A)

### 4.1 Loại câu hỏi (v1)

| Variant | Nguồn | Đáp án nhiễu | Điều kiện tối thiểu |
|---|---|---|---|
| `meaning_choice` | Từ vựng (`word` → chọn `meaning`) | 3 nghĩa của từ khác trong bài | ≥4 từ có nghĩa |
| `cloze_choice` | Câu `text_en` có chứa một từ vựng của bài → đục lỗ | 2 từ khác trong bài | ≥1 câu chứa từ vựng + ≥3 từ |
| `translation_choice` *(mới, tùy chọn — quyết định Q3)* | Câu `text_en` → chọn `text_vi` | `text_vi` của 2–3 câu khác | ≥3 câu |

Mặc định 10 câu, trộn loại; nếu không đủ nguồn → giảm số câu; dưới ngưỡng → nút Luyện tập bị ẩn/disabled kèm lý do.

### 4.2 Nguồn dữ liệu

- `getLessonDownload(lessonId)` → `snapshot` + `analyses` đã lưu; gộp thêm analyses tải muộn nếu có (`mergeAnalyses`).
- Từ vựng: `collectLessonVocabulary()` (block `vocabulary` trước, rồi analyses theo thứ tự câu, đã khử trùng).
- Câu: `sortedSentences(snapshot)`.
- Chỉ bài **đã tải**. Bài chưa tải → nút Luyện tập dẫn tới tải bài trước (tái dùng flow hiện có ở player).

### 4.3 Seed & tính tất định

`seed = sha256Hex(lessonId + ':' + content_revision + ':' + attemptNo)` — dùng lại `src/core/utils/sha256.ts` (hiện là file chết, sẽ được dùng lại). Cùng bài + cùng lượt → cùng bộ câu; "Làm lại" tăng `attemptNo` → đổi thứ tự/đáp án nhiễu.

### 4.4 Lưu trữ cục bộ (schema SQLite v5) — ⚠️ thay đổi DB, cần duyệt

Bảng mới (không đụng bảng cũ; tên mới để không va với bảng `practice_*` đã DROP ở v3):

```sql
CREATE TABLE IF NOT EXISTS practice_sessions_v5 (
  id TEXT PRIMARY KEY NOT NULL,
  lesson_id TEXT NOT NULL,
  content_revision INTEGER NOT NULL,
  attempt_no INTEGER NOT NULL,
  seed TEXT NOT NULL,
  questions_json TEXT NOT NULL,      -- bộ câu đã sinh, đóng băng cho phiên
  status TEXT NOT NULL,              -- in_progress | completed | abandoned
  current_index INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  owner_user_id TEXT
);
CREATE TABLE IF NOT EXISTS practice_answers_v5 (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  selected_option_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  UNIQUE (session_id, sequence)
);
```

- Thêm `schemaV5.ts` theo khuôn `schemaV4.ts`, nâng `APP_SCHEMA_VERSION` = 5, có down-migration + test real-sqlite.
- Bổ sung 2 bảng vào `localDataWipe.ts` và luồng cô lập tài khoản (account switch) — đã có test harness `src/test/support/accountIsolation`.
- *Phương án nhẹ hơn (Q2):* v1 chỉ giữ phiên trong bộ nhớ, không resume, chỉ lưu điểm tốt nhất vào `AsyncStorage` → không cần migration.

### 4.5 Điều hướng & điểm vào

- Route mới `Practice` trong `RootStack` (`AppNavigator.tsx`, `app/navigation/types.ts`), mount khi flag `shortPractice` bật.
- Thêm `openPractice(lessonId)` vào port `AppNavigation` (`core/navigation/appNavigation.ts`) + adapter (`appNavigationAdapter.ts`) + mock test (`src/test/support/appNavigationMock.ts`).
- Điểm vào (theo thứ tự ưu tiên):
  1. Màn hoàn thành bài trong `CanonicalLessonPlayerScreen` (`useLessonCompletion`) — nút "Luyện tập nhanh".
  2. Thẻ bài trong Thư viện (`LessonsTabContent`) — action phụ.
  3. Chip "Luyện tập" trong `LessonsHistoryScreen` (cạnh Ôn tập / Luyện nói) → mở bài đã tải gần nhất đủ điều kiện.
  4. *(sau)* Activity `quick_practice` trong `today/adaptationEngine`.

### 4.6 UI

- `PracticeScreen`: header tiến độ (`HandoffProgressTrack`), đề bài tiếng Việt, 3–4 `QuizOption`, sau khi chọn → tô `correct/wrong` + `explanation_vi`, nút "Tiếp".
- `PracticeResultView`: điểm %, số đúng/sai, danh sách từ sai + nút "Lưu vào flashcard" (từng từ / tất cả), "Làm lại", "Về bài học".
- Chuỗi hiển thị qua i18next (`vi.json`/`en.json`), mặc định tiếng Việt. Tôn trọng `useReducedMotion`.

### 4.7 Gắn với hệ thống hiện có

- Từ sai → `saveFlashcard()` (đi qua `confirmFirstFlashcardSave` nếu muốn tái dùng disclosure — file `flashcardDisclosure.ts` hiện đang chết).
- Ghi một `gamification_events` (XP) khi hoàn thành phiên — xem `engagement/logic/gamificationPolicy.ts`.
- Analytics: `practice_started`, `practice_completed` (chỉ id + điểm, **không log nội dung câu/từ**).

---

## 5. Quyết định cần anh/chị chốt trước khi code

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Chọn phương án A (sinh trên máy) hay B (khôi phục server)? | **A** |
| Q2 | v1 có cần lưu phiên vào SQLite (resume khi thoát giữa chừng) hay chỉ in-memory? | SQLite v5 (an toàn cho mở rộng); nếu muốn ra nhanh → in-memory |
| Q3 | Có thêm `translation_choice` (chọn nghĩa cả câu) ở v1 không? | Có — rẻ, dữ liệu `text_vi` luôn có |
| Q4 | Có sync kết quả lên server (Phase 5) trong đợt này không? | Để đợt sau |
| Q5 | Được phép xoá `practiceClient.ts` và đường `practice-events:batch` trong `outboxSync`? | Có (xoá ở Phase 0/5) |
| Q6 | Điểm vào nào bắt buộc cho v1? | 4.5 (1) + (2) |

---

## 6. Các bước thực hiện

Mỗi phase là một PR nhỏ, chạy được độc lập. Lệnh kiểm tra chung: `yarn lint && yarn typecheck && yarn test <pattern>`.

### Phase 0 — Chuẩn bị & dọn (nhỏ)
- [ ] Tạo nhánh `feat/practice-quiz`.
- [ ] Xoá `src/core/api/practiceClient.ts` (+ test) — *cần duyệt Q5*.
- [ ] Đổi `module` của `shortPractice` trong `feature-registry.ts` thành `src/features/practice`.
- [ ] Thêm `src/features/practice` vào ranh giới module (`scripts/check-module-boundaries.js`, `docs/architecture/module-boundaries.md`).
- Commit: `chore(practice): drop retired practice-set client and register practice module`

### Phase 1 — Logic thuần (không UI, không DB)
Tạo trong `src/features/practice/logic/`:
- [ ] `practiceSource.ts` — `buildPracticeSource(snapshot, analyses)` → `{vocabulary[], sentences[]}` từ `collectLessonVocabulary`/`sortedSentences`.
- [ ] `practiceEligibility.ts` — viết lại cho `PracticeSource` (ngưỡng như cũ).
- [ ] `generator.ts` — port từ server `9e61936^:src/modules/practice/service/generator.ts`: giữ PRNG + logic `meaning_choice`/`cloze_choice`, thêm `translation_choice` (nếu Q3), bỏ phụ thuộc store.
- [ ] `validator.ts` — port phần cần thiết từ server `validator.ts` (đáp án duy nhất, không trùng đáp án nhiễu, placeholder hợp lệ, không lộ nhãn meta).
- [ ] `grader.ts`, `resultSummary.ts` — khôi phục từ `f295665^`, chỉnh kiểu.
- [ ] Cập nhật `core/schemas/practice.ts`: thêm variant mới, cho `provenance`/`generator` phù hợp nguồn `device`.
- [ ] Test unit: tất định (cùng seed → cùng output), đủ/thiếu nguồn, không đáp án trùng, chấm điểm, tổng kết. Port test cũ: `practiceGenerator.test.ts`, `practiceValidator.test.ts` (server), `grader.test.ts`, `resultSummary.test.ts` (app).
- Commit: `feat(practice): on-device deterministic practice generator`

### Phase 2 — Lưu trữ cục bộ (nếu Q2 = SQLite) ⚠️ migration
- [ ] `src/core/db/schemaV5.ts` + nâng `APP_SCHEMA_VERSION`; down-migration.
- [ ] `src/features/practice/logic/data/PracticeSessionRepository.ts`: create/resume/answer/complete/abandon, list theo bài.
- [ ] `sessionEngine.ts` — khôi phục phần thuần từ `f295665^`, nối repository mới.
- [ ] Thêm vào `localDataWipe.ts` + kiểm tra account isolation.
- [ ] Test real-sqlite: migrate v4→v5, v5 idempotent, wipe, resume giữa chừng, `UNIQUE(session_id, sequence)`.
- Commit: `feat(practice): local practice sessions (schema v5)`

### Phase 3 — Màn hình & điều hướng
- [ ] `screens/PracticeScreen.tsx`, `components/PracticeQuestionCard.tsx`, `components/PracticeResultView.tsx` (dùng `QuizOption`).
- [ ] `logic/usePracticeSession.ts` — hook điều phối (tải snapshot → sinh → phiên → chấm).
- [ ] `screens/navigationTypes.ts` (`PracticeRouteParams = {lessonId: string}`), `features/practice/index.ts`.
- [ ] Route `Practice` trong `AppNavigator.tsx` + `types.ts`, gate bằng `useFeatureEnabled('shortPractice')`; cập nhật `rootStackRoutes.ts` + snapshot test điều hướng.
- [ ] `openPractice` trong `AppNavigation` + adapter + mock.
- [ ] i18n keys `practice.*` trong `vi.json`/`en.json`.
- [ ] Test component: trả lời đúng/sai, hết câu → kết quả, làm lại, bài không đủ điều kiện.
- Commit: `feat(practice): practice screen and route`

### Phase 4 — Điểm vào & liên kết
- [ ] Nút "Luyện tập nhanh" ở màn hoàn thành bài (`CanonicalLessonPlayerScreen`).
- [ ] Action ở thẻ bài thư viện (`LessonsTabContent`) và/hoặc chip ở `LessonsHistoryScreen`.
- [ ] "Lưu từ sai" → `saveFlashcard()`; XP qua gamification event; analytics events.
- [ ] Test: điểm vào ẩn khi flag tắt / bài không đủ điều kiện.
- Commit: `feat(practice): entry points, flashcard handoff and XP`

### Phase 5 — (Tùy chọn, Q4) Đồng bộ kết quả lên server
- [ ] Server: sync collection mới `practice_attempts` (khuôn `speaking_attempts`, commit `2fbb2df`): `src/modules/sync/model/sync.ts`, `repository/store.ts`, migration Prisma + down, test `syncPracticeAttempts.test.ts`. **Không** khôi phục route `/practice-sets`; giữ nguyên `legacySystemsRetired.test.ts`.
- [ ] App: thêm `practice_attempts` vào `SyncCollectionSchema` (`core/schemas/sync.ts`), ghi outbox khi hoàn thành phiên, pull-apply.
- [ ] Gỡ `practiceEventsClient.ts` + nhánh practice trong `outboxSync.ts`, `PRACTICE_EVENT_TYPE`/`PracticeEventPayload` (thay bằng collection mới).
- Commit (mỗi repo): `feat(sync): practice_attempts collection`

### Phase 6 — QA & dọn
- [ ] Chạy trên iOS/Android: bài YouTube, bài text, bài curriculum; offline (chế độ máy bay).
- [ ] Kiểm tra tất cả theme, cỡ chữ lớn, reduced motion, VoiceOver/TalkBack (`accessibilityLabel` cho option).
- [ ] Cập nhật `docs/MOBILE_APP_FEATURES_AUDIT.md`, `docs/architecture/navigation.md`.
- [ ] Viết báo cáo `.ai-logs/reports/<session_id>.md`.

---

## 7. Rủi ro & lưu ý

| Rủi ro | Giảm thiểu |
|---|---|
| Bài có ít từ vựng (analyses chưa tải hết) → không đủ câu | Ngưỡng eligibility + fallback `translation_choice`; hiện lý do khi disabled |
| Đáp án nhiễu trùng nghĩa/đồng nghĩa với đáp án đúng | Port `isEquivalentToAnswer`/`normalizeOptionText` từ validator server; test riêng |
| Migration v5 trên máy người dùng thật | Chỉ `CREATE TABLE IF NOT EXISTS`, không sửa bảng cũ; test real-sqlite v4→v5; down-migration |
| Lẫn dữ liệu giữa tài khoản | Cột `owner_user_id` + wipe + test accountIsolation |
| `content_revision` đổi khi bài cập nhật | Phiên `in_progress` của revision cũ → đánh dấu `abandoned`, tạo phiên mới |
| Log lộ nội dung học | Analytics chỉ gửi id, điểm, thời lượng |
| Bundle size | Không thêm dependency mới (zod, sha256, i18next đã có) |

**Dependency mới:** không.
**Thay đổi rủi ro cần duyệt:** migration SQLite v5 (Phase 2); xoá `practiceClient.ts` (Phase 0); xoá đường `practice-events:batch` + thêm sync collection (Phase 5, đụng contract App↔Server).

---

## 8. Ước lượng

| Phase | Khối lượng |
|---|---|
| 0 | ~0.5 ngày |
| 1 | ~2 ngày (phần lớn là port + test) |
| 2 | ~1.5 ngày |
| 3 | ~2 ngày |
| 4 | ~1 ngày |
| 5 | ~2 ngày (2 repo) |
| 6 | ~1 ngày |
