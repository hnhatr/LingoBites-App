# PR 10 – App: player 6 bước (`LessonFlowPlayer`), 6 hoạt động tương tác, lượt làm trong bài

> Trạng thái: **BẢN NHÁP — chờ duyệt** (VibeGuard §1).
> Ngày lập: 2026-10-08. Repo: `LingoBites-App` (không đổi server). Nhánh: `claude/optimistic-bell-mfgk44`.
> PR 3 của Stage 2 trong `2026-10-07-backward-design-curriculum-plan.md`, mục App 1, 2, 5, 6, 7. Dựng trên contract của PR 8: `data.content`, `acceptedAnswers`, lượt làm `kind: 'lesson'`, luật "hoàn thành phần luyện".
> PR 11 làm tiếp phần còn lại của Stage 2 trên app: **gợi ý** mở dần và **màn vận dụng độc lập** (bước 5 không có đáp án).

## 1. Mục tiêu và phạm vi

Sau PR này, người học mở một bài curriculum và:
- bấm **"Học theo 6 bước"** trên hub để vào player mới;
- đi lần lượt **bước 1 → 6**: có thanh tiến độ, thoát ra rồi vào lại thì học tiếp đúng chỗ;
- **làm thật 6 loại hoạt động**:
  - chọn, điền, dịch: app tự chấm;
  - nói: ghi âm, nghe lại cạnh câu mẫu, rồi tự đánh giá Đạt / Chưa đạt;
- mỗi lần làm xong một hoạt động, app ghi **một lượt làm** (`kind: 'lesson'`) và sync lên server;
- đi hết các hoạt động bước 2–4 thì bài chuyển sang **"Đã hoàn thành phần luyện"**. Không còn nút "Hoàn thành bài" cho bài curriculum.

Bài `extended` (bài người học tự tạo, YouTube) **giữ nguyên** hub, player và nút hoàn thành như hiện nay.

| Trong PR 10 | Ngoài PR 10 |
|---|---|
| Schema app: `data.content` theo 6 loại; lượt làm `kind: 'lesson'` (union, giống server) | Thay đổi server |
| Bản copy `acceptedAnswers` / `normalizeAnswer` + fixture `accepted-answers.json` (bản copy thứ ba, khoá SHA) | Chấm nói tự động, STT (Stage 3) |
| SQLite: nâng `activity_attempts` lên v8 (bước nâng cấp đầu tiên sau baseline) + pull lượt làm `lesson` | Pull `lesson_outcomes` từ server (PR 13) |
| Route và màn `LessonFlowPlayer`; nút vào từ hub | **Gợi ý** mở dần, `support_level ≠ none` (**PR 11**) |
| 6 component hoạt động có tương tác | **Màn vận dụng độc lập** bước 5: tình huống, ẩn đáp án (**PR 11**) |
| Bước 1 "Ôn liên quan" từ item ôn lại / tiên quyết và flashcard đến hạn | Lịch ôn theo item `item_memory` (Stage 3) |
| Bước 6 kết quả: kết quả từng hoạt động, trạng thái phần luyện | Mức "đạt bài" `passed_at` (Stage 3) |
| "Hoàn thành phần luyện" tính cục bộ theo luật G5 của PR 8; bỏ nút complete cho bài curriculum | Đổi cách tính phút học trên Home |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Bài nào dùng player mới, vào từ đâu?** | Bài **curriculum** = `origin = 'admin'`, có `spec` và ít nhất một block có `step`. Hub vẫn là màn mở đầu: thêm nút chính **"Học theo 6 bước"** (hoặc **"Học tiếp · Bước n"** nếu đã học dở), mở route mới `LessonFlow {lessonId}`. Các mục khám phá của hub (mẫu câu, từ vựng…) giữ nguyên. `CanonicalLessonPlayer` **không xoá**: vẫn dùng cho bài YouTube và bài người học. |
| G2 | **Học tiếp đúng chỗ lưu ở đâu?** | **Suy ra từ lượt làm**, không thêm bảng. Mở player thì vào **bước đầu tiên (2–5) còn activity chưa có lượt làm** của `content_revision` hiện tại. Chưa làm gì thì vào bước 1; làm hết thì vào bước 6. Người học vẫn bấm được vào bất kỳ bước nào trên thanh bước. |
| G3 | **Một lượt làm ứng với gì?** Payload PR 8 tính theo **block**, không theo từng câu. | **Một lượt = một lần làm trọn một block activity** (mọi câu hoặc lượt trong block đều đã có kết quả). Thoát giữa chừng thì không ghi gì. `outcome` của block:<br>- mọi câu **đúng ngay lần đầu** (hoặc tự đánh giá Đạt) → `pass_independent`;<br>- mọi câu cuối cùng đều đúng, nhưng có câu phải **làm lại** → `pass_with_support`;<br>- còn câu **Chưa đạt** hoặc **Bỏ qua** → `fail`.<br>`support_level` luôn là `none` trong PR 10 (gợi ý ở PR 11). `assessed_by`: `self` cho 3 loại nói, `rule` cho 3 loại còn lại. Làm lại block thì ghi thêm lượt mới. Lượt không chứa chữ người học nói hay viết (đúng PR 8). |
| G4 | **Ghi âm ở hoạt động nói** | Dùng `recordingService` sẵn có (`react-native-audio-recorder-player`): ghi → nghe lại cạnh câu mẫu (TTS `speak`) → tự đánh giá Đạt / Chưa đạt. **File chỉ lưu tạm trên máy**, xoá khi rời block, không upload, không ghi vào `speaking_recordings`. Xin quyền micro bằng `preflightMicrophonePermission` / `requestMicrophonePermission` có sẵn. **Từ chối quyền** thì vẫn tự đánh giá được, chỉ ẩn nút ghi âm. Cần thêm export `recordingService` và `RecorderPanel` vào barrel `@features/speaking` (không dùng `ConsentSheet` vì không lưu hay gửi giọng nói). |
| G5 | **Bước 1 "Ôn liên quan" có gì?** | Gom các item `introduction = recycled \| prerequisite` của bài, cộng flashcard **đến hạn** có `item_key` thuộc mã item của bài (hàm mới `getDueFlashcardsByItemKeys`). Mỗi item là một thẻ lật (`FlipCard`) có nút nghe. Thẻ đến hạn thì chấm bằng `recordFlashcardRating` như màn ôn hiện tại. Danh sách rỗng thì hiện "Không có gì cần ôn" và nút sang bước 2. Bài tiên quyết (`spec.prerequisites`) hiện thành dòng tên bài, bấm để mở. Bước 1 **không ghi lượt làm**. |
| G6 | **"Hoàn thành phần luyện" và nút complete** | Hàm thuần `practiceCompleted(snapshot, attempts)` theo **đúng luật G5 của PR 8**: mọi block `activity` ở bước 2–4 của nội dung hiện tại có ít nhất một lượt `kind = lesson` với `outcome ≠ unscorable`. Bài curriculum **ẩn nút "Hoàn thành bài"**. Lần đầu thỏa luật thì app tự gọi `recordLessonEvent({event: 'complete'})` + `recordLessonCompletedActivity`, nên tiến độ unit, Home và streak vẫn chạy như cũ. Bài `extended` giữ nút complete. |
| G7 | **Streak theo hoạt động** | Mỗi block activity làm xong ghi sự kiện gamification mới `lesson_activity_completed` (0 điểm), thêm vào `STREAK_EVENT_TYPES`. Nhờ vậy học một hoạt động trong ngày cũng giữ streak. **Không đổi** cách tính phút học trên Home (vẫn theo ước lượng kế hoạch). |
| G8 | **Nâng SQLite `activity_attempts`** | Bước nâng cấp **v7 → v8** (lần đầu có bước nâng cấp sau baseline), **giữ dữ liệu**: dựng lại bảng, cho `result` nhận NULL, thêm cột `block_id`, `content_revision`, `step`, `task_id`, `item_keys_json`, `support_level`, `outcome`, `assessed_by`, chép các dòng cũ sang. Pull map thêm các cột này. Phương án khác là đổi baseline thành 8 (xoá sạch DB trên máy dev): đơn giản hơn nhưng mất dữ liệu nên **không đề xuất**. |
| G9 | **Chấm câu gõ** | Dùng bản copy `normalizeAnswer` + `acceptedAnswers`, kết quả **giống hệt** server và admin (cùng fixture):<br>- `translation`: chấp nhận `modelEn` ∪ `acceptedAnswers(pattern)`;<br>- `fill_blank` gõ tay: so `normalizeAnswer(answer)`;<br>- `fill_blank` có `options` và `multiple_choice`: dùng `QuizOption`.<br>Gõ sai thì cho làm lại; đúng sau khi làm lại thì câu đó tính "làm lại" theo G3. Có nút **"Xem đáp án"**: bấm thì câu đó tính Chưa đạt. |

## 3. Contract và tiện ích (commit 1)

- `core/schemas/activityContent.ts` (mới): zod cho 6 loại, chép shape từ `lessonBlocks/model/activityContent.ts` của server (`strict`, 1–20 phần tử, `id` không trùng, các ràng buộc `superRefine`). Thêm `parseActivityContent(kind, data.content)` trả `null` nếu sai shape: player hiện "Hoạt động này chưa có nội dung", **không crash**.
- `core/schemas/sync.ts`: `ActivityAttemptPayloadSchema` thành **union theo `kind`**:
  - giữ nguyên `review | practice | game`;
  - thêm `LessonActivityAttemptSchema` đúng §6 của PR 8 (`.strict()`, kèm ràng buộc `support_level ≠ none` ⇒ `outcome ≠ pass_independent`).
- Test parse fixture `valid-sync-activity-attempt-lesson-push-request.json` (đang chỉ khoá SHA) và parse `content` của mọi activity trong fixture with-spec.
- `core/learning/acceptedAnswers.ts` (copy thứ ba) + `__tests__/fixtures/accepted-answers.json`: chép **byte-identical** từ server, khoá SHA trong `core/schemas/fixtures.ts`, có test chạy hết các ca của fixture.

## 4. Lượt làm, nâng DB, "hoàn thành phần luyện" (commit 2)

- `core/db/migrations.ts`:
  - `APP_SCHEMA_VERSION = 8`;
  - thêm cơ chế bước nâng cấp: DB ở v7 chạy step `7 → 8` trong transaction; DB cũ hơn v7 vẫn reset như hiện nay; DB mới tạo thẳng baseline đã gồm các cột mới;
  - `BASELINE_STATEMENTS` cập nhật bảng `activity_attempts` (G8).
- `core/sync/activityAttempts.ts`:
  - `recordLessonActivityAttempt(input)`: validate bằng schema lesson, INSERT + `enqueueSyncOutboxEvent` trong cùng transaction (như `recordActivityAttempt`);
  - `listLessonActivityAttempts(lessonId)`.
- `features/sync/logic/pullWorker.ts`: lượt `kind = lesson` pull về (từ máy khác) điền đúng các cột mới; `result` để NULL.
- `features/lesson/flow/logic/practiceCompletion.ts`: `practiceCompleted(snapshot, attempts)` (G6) và `resumeStep(snapshot, attempts)` (G2). Chỉ tính lượt có `content_revision` hiện tại và `block_id` còn trong bài.
- Test:
  - real-SQLite: nâng cấp v7 → v8 giữ dòng cũ; ghi lượt `lesson` và outbox; pull lượt `lesson`;
  - unit: luật hoàn thành, kể cả ca biên: bước 5 không tính; `unscorable` không tính; block đã xoá; revision cũ.

## 5. Player (commit 3)

Thư mục mới `features/lesson/flow/` (theo quy ước module: import file anh em bằng đường dẫn tương đối).

- Route `LessonFlow: {lessonId: string}` trong `navigationTypes` + `appNavigation.openLessonFlow`.
- `screens/LessonFlowPlayerScreen.tsx`: lấy snapshot bằng `useCanonicalLesson` có sẵn (giữ các trạng thái offline, cập nhật, archived…).
- `components/StepRail`: 6 ô bước + thanh tiến độ (`HandoffProgressTrack`); ô bước đã xong có dấu ✓.
- `components/StepView`: các block của bước, theo `position`:
  - block không phải activity: dùng lại `CanonicalBlockView`;
  - activity: dùng `ActivityRunner` (§6).
- Nút "Bước tiếp" / "Quay lại"; thoát bằng nút đóng (lượt dở không ghi, theo G3).
- `logic/useLessonFlow.ts`: bước hiện tại, lượt làm của bài, `session_id` cho mỗi lần mở player, gọi `requestSync()` sau mỗi lượt.
- **Bước 6** `components/StepResult`:
  - kết quả lượt gần nhất của từng activity (Độc lập / Làm lại mới đúng / Chưa đạt / Chưa làm);
  - trạng thái "Đã hoàn thành phần luyện" hoặc "Còn n hoạt động";
  - nút về hub, nút "Làm lại hoạt động chưa đạt".
- Hub (`CanonicalLessonHub`): nút "Học theo 6 bước" / "Học tiếp · Bước n" cho bài curriculum (G1).

## 6. Hoạt động (commit 4 và 5)

`components/activities/`. Mỗi component nhận `{content, items, onFinished(result)}`. `ActivityRunner` gom kết quả từng câu thành lượt làm (G3), đo `duration_ms`, lấy `item_keys` từ `item_refs` / `itemId` / `patternItemId` (đổi id → code qua `lesson_items`).

**Commit 4: chấm theo luật (`assessed_by: rule`)**

| Component | Giao diện |
|---|---|
| `MultipleChoiceActivity` | Câu hỏi VI (+ EN), các phương án `QuizOption`; chọn sai thì tô sai, cho chọn lại. |
| `FillBlankActivity` | Câu có chỗ trống. Có `options` thì chọn bằng `QuizOption`, không có thì gõ bằng `TextField`; nút "Kiểm tra", "Xem đáp án". |
| `TranslationActivity` | Câu VI, ô gõ EN, kiểm tra bằng đáp án chấp nhận (G9); đúng thì hiện câu mẫu `modelEn`. |

**Commit 5: phần nói (`assessed_by: self`)**

| Component | Giao diện |
|---|---|
| `ListenRepeatActivity` | Từng câu: nút nghe (TTS), ghi âm / nghe lại (G4), Đạt / Chưa đạt. |
| `SpeakingDrillActivity` | Khung câu với chỗ trống được tô; mỗi tổ hợp hiện các giá trị cần thay. Người học nói câu, rồi bấm "Nghe câu mẫu" (TTS câu đã ghép), ghi âm / nghe lại, tự đánh giá. |
| `RolePlayActivity` | Hội thoại theo lượt: lượt bên kia tự đọc bằng TTS và hiện chữ. Lượt của người học hiện nghĩa VI, nút "Xem câu mẫu", ghi âm, tự đánh giá. Bước 5 dùng chung component này trong PR 10; PR 11 thay bằng màn vận dụng ẩn đáp án. |

Thêm `components/SpeakSelfCheck` dùng chung cho 3 loại nói: ghi âm, nghe lại, Đạt / Chưa đạt.

## 7. Bước 1, hoàn thành, streak (commit 6)

- `components/StepReview` (G5) + `getDueFlashcardsByItemKeys(itemKeys, {today})` trong `FlashcardRepository` (export qua `@features/review`).
- Màn hub / player: bài curriculum ẩn nút complete (`useLessonCompletion` chỉ chạy cho bài `extended`). Hook mới `usePracticeCompletion` tự ghi sự kiện `complete` lần đầu thỏa luật (G6).
- `gamificationPolicy`: thêm `lesson_activity_completed` (G7), có test streak.

## 8. i18n và tài liệu (commit 7)

- Khoá mới trong `vi.json` / `en.json`, namespace `lessonFlow.*` (tên bước, nút, kết quả, trạng thái quyền micro). Thêm bằng helper sẵn có, không đổi khoá cũ.
- Cập nhật plan (trạng thái, điểm lệch), session report.

## 9. Kiểm thử

| Test | Nội dung |
|---|---|
| `activityContent.test.ts` | Parse `content` mọi activity trong fixture with-spec; các ca sai shape trả `null`. |
| `sync` schema | Parse fixture lượt `lesson`; từ chối `support_level ≠ none` + `pass_independent`; ba loại cũ không đổi. |
| `acceptedAnswers.test.ts` | Chạy hết `accepted-answers.json` (giống server và admin). |
| `migrations.real-sqlite.test.ts` | v7 → v8 giữ dòng cũ; DB mới có cột mới; DB < v7 vẫn reset. |
| `activityAttempts.real-sqlite.test.ts` | Ghi lượt `lesson` + outbox trong một transaction; payload sai bị từ chối. |
| `pullWorker` | Pull lượt `lesson` không vỡ ràng buộc NOT NULL. |
| `practiceCompletion.test.ts` | Luật G6 và `resumeStep` G2 với fixture seed. |
| Mỗi activity (`*.test.tsx`) | Đúng ngay / làm lại / xem đáp án / bỏ qua → `outcome` đúng; nói: không có quyền micro vẫn tự đánh giá được. |
| `LessonFlowPlayerScreen.real-sqlite.test.tsx` | Đi trọn bài L01 của seed: bước 1 → 6, lượt làm ghi vào outbox đúng payload, "Đã hoàn thành phần luyện", sự kiện `complete` ghi một lần. |
| Hub | Bài curriculum có nút "Học theo 6 bước" và không có nút complete; bài YouTube giữ như cũ. |

**Kiểm tra cuối:** `yarn -s tsc`, `yarn -s lint` (giữ ngân sách warning 178/281, không tăng), `yarn -s format:check`, Jest toàn bộ.

## 10. Thứ tự commit

1. `feat(schemas): typed activity content, lesson attempts and accepted answers`: §3.
2. `feat(sync): lesson activity attempts with schema v8 and practice completion`: §4.
3. `feat(lesson): six-step lesson flow player`: §5.
4. `feat(lesson): choice, fill-in and translation activities`: §6, commit 4.
5. `feat(lesson): speaking activities with self-check`: §6, commit 5.
6. `feat(lesson): related review step, practice completion and activity streak`: §7.
7. `docs: mark PR 10 plan as implemented` (+ i18n nếu còn sót).

## 11. File tóm tắt

**Thêm:**
- `src/core/schemas/activityContent.ts`;
- `src/core/learning/acceptedAnswers.ts` + fixture `accepted-answers.json`;
- `src/features/lesson/flow/**`: screen, `StepRail`, `StepView`, `StepReview`, `StepResult`, `ActivityRunner`, `SpeakSelfCheck`, 6 activity, `useLessonFlow`, `usePracticeCompletion`, `practiceCompletion`;
- test tương ứng.

**Sửa:**
- `core/schemas/sync.ts`, `core/schemas/fixtures.ts`;
- `core/db/migrations.ts`, `core/sync/activityAttempts.ts`;
- `features/sync/logic/pullWorker.ts`;
- `features/review/logic/FlashcardRepository.ts` + barrel;
- `features/speaking/index.ts` (export recorder);
- `features/engagement/logic/gamificationPolicy.ts`;
- navigation (`types.ts`, `navigationTypes.ts`, `appNavigationAdapter.ts`);
- `CanonicalLessonHub.tsx`, `CanonicalLessonPlayerScreen.tsx` (ẩn complete cho bài curriculum);
- i18n `vi.json` / `en.json`.

**Xoá:** không. `CanonicalLessonPlayer` và `useLessonCompletion` vẫn dùng cho bài `extended`.

**Dependency mới:** không: ghi âm, TTS, permission, SQLite đều đã có.

## 12. Rủi ro

- ⚠️ **Nâng cấp DB lần đầu (v7 → v8):** dựng lại bảng `activity_attempts`. Có test real-SQLite. Lỗi giữa chừng thì rollback cả transaction.
- ⚠️ **Đổi hành vi:** bài curriculum mất nút "Hoàn thành bài"; tiến độ unit chỉ tăng khi làm xong phần luyện bước 2–4.
- **Luật hoàn thành có hai bản** (server và app): dùng chung fixture seed và cùng ca biên trong test hai phía.
- **Bản copy thứ ba của `acceptedAnswers`:** khoá bằng một fixture, SHA pin.
- **Ghi âm trên máy thật** (quyền, file tạm) khó test trong Jest: mock `recordingService`; cần thử tay trên thiết bị. Tôi sẽ ghi rõ phần chưa kiểm được.
- **Khối lượng UI lớn** (player + 6 hoạt động). Có thể tách **PR 10a** (commit 1–4: contract, DB, player, 3 loại chấm luật) và **PR 10b** (commit 5–7: nói, bước 1, hoàn thành).
- **Bước 5 trong PR 10 vẫn hiện câu mẫu** của `role_play` (chưa phải vận dụng độc lập thật). PR 11 sửa.
