# PR 9 – Admin: editor theo loại hoạt động, sinh nháp từ mẫu câu, preview 6 bước, cân bằng 70/25/5

> Trạng thái: **ĐÃ CODE**: G1–G8 đã duyệt; server `1f5503b` → `09c79d6` (xem §9 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-Server` (chủ yếu `admin-web`, cộng một phần nhỏ server). Nhánh: `claude/optimistic-bell-mfgk44`.
> PR 2 của Stage 2 trong `2026-10-07-backward-design-curriculum-plan.md`, mục Admin-web 1–3. Dựng trên contract của PR 8: `data.content`, `acceptedAnswers`, route sinh nháp, `skill_balance`.

## 1. Mục tiêu và phạm vi

Sau PR này, admin:
- soạn được **nội dung từng loại hoạt động** bằng form riêng: chọn item và giá trị chỗ trống thay vì gõ tự do;
- bấm **"Sinh nháp từ mẫu câu"** ở bước 2–4 rồi sửa nháp và thêm vào bài;
- **chạy thử bài theo 6 bước** giống player trên app: có gợi ý, có kiểm tra đáp án;
- thấy **tỷ lệ nói / nghe / viết** của unit so với 70/25/5.

Server bỏ hai trường cũ của activity và **bắt buộc** activity bước 2–5 phải có `content`.

| Trong PR 9 | Ngoài PR 9 |
|---|---|
| Server: bỏ `lines` / `dialogueTurns` của activity; `ACTIVITY_CONTENT_MISSING` thành **vi phạm**; kiểm chỗ trống trong `content` (`ACTIVITY_CONTENT_INVALID`) | Player, hoạt động tương tác trên app (**PR 10**) |
| Admin: 6 editor theo loại, thay khung "lines" | Ghi âm và chấm nói trong preview (Stage 3) |
| Admin: "Sinh nháp từ mẫu câu" ở bước 2–4 | Sinh nháp `role_play`, sinh bằng AI |
| Admin: preview 6 bước có tương tác, không lưu lượt làm | Xem lượt làm của người học (Stage 3) |
| Admin: bảng cân bằng kỹ năng trên trang unit | Cấu hình ngưỡng 70/25/5 (Stage 3) |
| Admin: bản copy `acceptedAnswers` khoá bằng fixture của server | Thay đổi app |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Bỏ `lines` / `dialogueTurns` của activity** (G1 của PR 8 hẹn làm ở PR 9). | **Bỏ khỏi schema server và khỏi editor.** DB làm lại từ đầu; seed đã không dùng hai trường này. Block `context` vẫn giữ `dialogueTurns` (không phải activity). Phía app: `CanonicalBlockView` đang đọc `lines` / `dialogueTurns` của activity, nên từ PR 9 tới PR 10 activity trên app chỉ hiện tiêu đề và hướng dẫn. Chấp nhận, vì PR 10 thay bằng player mới. |
| G2 | **Thiếu `content` có chặn publish không?** | **Có:** `ACTIVITY_CONTENT_MISSING` từ cảnh báo thành **vi phạm** cho activity bước 2–5, vì từ PR 9 admin đã soạn được. |
| G3 | **Kiểm chỗ trống trong `content`** (phần PR 8 để lại). | Vi phạm mới **`ACTIVITY_CONTENT_INVALID`** (kèm `reason`), kiểm trong spec-check vì item có thể đổi sau khi soạn:<br>- `speaking_drill`: mỗi tổ hợp phải đủ đúng các chỗ trống của khung (`slot_missing` / `slot_unknown`), và mọi giá trị phải nằm trong lựa chọn của chỗ trống (`value_not_allowed`);<br>- `fill_blank` có `patternItemId` + `slot`: `slot` phải có trong khung, `answer` phải là một lựa chọn của chỗ trống đó.<br>Validator nhận thêm `payload` của item trong bài. |
| G4 | **Sinh nháp hiện ra thế nào?** | Mỗi nhóm bước 2–4 ở tab Hoạt động có nút **"Sinh nháp từ mẫu câu"**. Bấm thì hiện danh sách nháp (loại, tiêu đề, số câu) với hai nút:<br>- **"Sửa rồi thêm"**: mở `BlockEditorDialog` đã điền sẵn, bấm Lưu mới tạo block;<br>- **"Thêm tất cả"**: tạo các block qua route có sẵn, nối tiếp cuối bước đó.<br>Nháp không được lưu nếu admin không bấm. |
| G5 | **Preview 6 bước làm tới đâu?** | Trang preview có thêm chế độ **"Chạy thử 6 bước"** (mặc định), giữ chế độ "Tất cả block" hiện có.<br>- Đi lần lượt bước 1 → 6, có thanh tiến độ.<br>- Câu chọn và câu gõ: chấm ngay bằng `acceptedAnswers` / `normalizeAnswer`.<br>- Câu nói (`listen_and_repeat`, `speaking_drill`, lượt người học trong `role_play`): **không ghi âm**; hiện câu mẫu, các đáp án chấp nhận và hai nút tự đánh giá Đạt / Chưa đạt, đúng cách Stage 2 trên app.<br>- **Gợi ý:** block chạy task thì mở dần `hint_levels` của task; block luyện tập thì 3 mức cố định (từ khoá đầu → nửa câu → câu mẫu).<br>- Bước 6 tổng hợp kết quả của lần chạy thử.<br>- **Không lưu lượt làm** nào. |
| G6 | **Đáp án chấp nhận ở admin** | Bản copy thứ ba `admin-web/src/utils/items/acceptedAnswers.ts`, test đọc thẳng `test/fixtures/accepted-answers.json` của server (giống cách `specRules.test.ts` đọc file server), nên ba phía luôn khớp. |
| G7 | **Đổi loại hoạt động trong editor** | Đổi `activityKind` thì **hỏi xác nhận** rồi đặt lại `content` rỗng cho loại mới, vì shape các loại khác nhau. Không cố chuyển đổi tự động. |
| G8 | **Bảng cân bằng kỹ năng** | Panel mới trên trang unit: 3 thanh nói / nghe / viết (cộng "chưa gắn" nếu có), số phút và %, vạch mục tiêu 70/25/5; lệch quá ±10 điểm thì tô cảnh báo (cùng ngưỡng server). Dữ liệu lấy từ `skill_balance` của spec-check unit, không tính lại ở client. |

## 3. Server (commit 1)

- `extendedBlockContent.ts`: **xoá** `lines`, `dialogueTurns` khỏi `ActivityBlockDataSchema`; hằng số không còn dùng thì giữ nếu `context` vẫn dùng.
- `specValidator.ts`:
  - `ACTIVITY_CONTENT_MISSING` chuyển từ `SpecWarningRule` sang `SpecViolationRule`;
  - thêm `ACTIVITY_CONTENT_INVALID` với `reason` ∈ `slot_missing | slot_unknown | value_not_allowed`;
  - `SpecLessonItemInput` thêm `payload?: unknown`, và loader trong `postgresLessonSpecStore` select thêm `payload`;
  - lựa chọn của chỗ trống = `values` + `item_refs` giải mã theo **code** (cần map code → text: loader đọc text các item được tham chiếu).
- Test: `activityContent.test.ts` (không còn `lines`), `specValidator.test.ts` (rule mới, đổi mức), `lessonSpecRoutes.test.ts` (publish bị chặn khi thiếu `content`), `seedSampleUnit.test.ts` (seed vẫn 0 vi phạm).
- Fixture snapshot **không đổi** (seed L01 không có `lines`).
- Admin-web cùng commit: nhãn `ACTIVITY_CONTENT_INVALID`, chuyển nhãn `ACTIVITY_CONTENT_MISSING` (đã có).

## 4. Admin-web

### 4.1 API và tiện ích (commit 2)
- `api/client.ts`: `getActivityDrafts(lessonId, step)` (POST, CSRF như các mutation khác).
- `api/types.ts`:
  - kiểu `ActivityContent` cho 6 loại (khớp `activityContent.ts`);
  - `ActivityDraft`;
  - `UnitSpecCheck` có `skill_balance`.
- `utils/items/acceptedAnswers.ts` (copy, G6) + test đọc fixture server.
- `utils/blocks/activityContent.ts`:
  - `emptyContent(kind)`;
  - `validateContent(kind, content)`: kiểm phía client giống zod server, để báo lỗi trước khi gửi;
  - `slotChoices(pattern, itemsByCode)`: lựa chọn của chỗ trống, dùng chung cho editor và preview.

### 4.2 Editor theo loại (commit 3)

Thư mục mới `components/blocks/activity/`. Mỗi editor nhận `{ content, onChange, items: SpecItemSummary[] }`:

| Editor | Giao diện |
|---|---|
| `ListenAndRepeatEditor` | Danh sách câu (EN / VI), mỗi câu chọn item gắn kèm (tuỳ chọn); thêm / xoá / đổi thứ tự. |
| `SpeakingDrillEditor` | Chọn **pattern** của bài; mỗi tổ hợp là một hàng `select` cho từng chỗ trống (chỉ các lựa chọn hợp lệ); xem trước câu ghép. |
| `FillBlankEditor` | Chọn pattern + chỗ trống → tự điền `beforeEn` / `afterEn` từ câu mẫu, `answer` chọn từ lựa chọn; tick "Cho chọn" để sinh `options` (đáp án + tối đa 3 lựa chọn khác, sửa được). Không chọn pattern thì nhập tay cả câu. |
| `MultipleChoiceEditor` | Câu hỏi VI / EN, 2–6 phương án, radio chọn đáp án đúng. |
| `TranslationEditor` | Câu VI + câu mẫu EN + pattern (tuỳ chọn); hiện danh sách đáp án chấp nhận (`acceptedAnswers`, lấy variants qua `getItem` khi cần). |
| `RolePlayEditor` | Chọn người học là A hay B; danh sách lượt; lượt của người học chọn được pattern; hiện đáp án chấp nhận. |

- `blockModel.ts`:
  - `BlockDraft` bỏ `lines`, thêm `activityContent: Record<string, unknown> | null`;
  - `buildData` ghi `data.content`, bỏ `lines`;
  - `validateDraft` gọi `validateContent`.
- `BlockFields.tsx`: khối activity thay `TurnsEditor` bằng editor theo loại; đổi loại thì xác nhận (G7).
- `LessonPreviewBlock.tsx` (chế độ "Tất cả block"): activity hiện tóm tắt `content` (số câu, câu đầu) thay cho `lines`.

### 4.3 Sinh nháp (commit 4)
- `LessonBlocksSection.tsx`: nút "Sinh nháp từ mẫu câu" ở đầu nhóm bước 2, 3, 4 (chỉ hiện với bài có ít nhất một pattern trong tab Item).
- `components/blocks/ActivityDraftsPanel.tsx`:
  - danh sách nháp, nút "Sửa rồi thêm" / "Thêm tất cả" (G4);
  - trạng thái rỗng "Bài chưa có mẫu câu bắt buộc";
  - lỗi mạng thì hiện thông báo, không mất nháp đã sinh.
- `BlockEditorDialog`: nhận `initialDraft` (block chưa lưu) để mở sẵn nháp.

### 4.4 Preview 6 bước (commit 5)
- `routes/LessonPreviewPage.tsx`: chuyển chế độ "Chạy thử 6 bước" / "Tất cả block".
- `components/preview/`:
  - `StepRunner`: điều hướng bước 1 → 6, thanh tiến độ, "Bước tiếp";
  - `PreviewActivity`: chọn renderer theo `activityKind`, giữ kết quả trong state;
  - 6 renderer nhỏ (`PreviewListenRepeat`, `PreviewDrill`, `PreviewFillBlank`, `PreviewChoice`, `PreviewTranslation`, `PreviewRolePlay`);
  - `HintButton` (G5);
  - `StepSummary` cho bước 6: số câu đạt độc lập / có gợi ý / chưa đạt, theo từng hoạt động.
- **Nguồn dữ liệu:** snapshot preview sẵn có (`lesson_items` có payload, variants; `tasks` có `hint_levels`).
- **Không gọi API ghi.**

### 4.5 Cân bằng kỹ năng (commit 6)
- `components/units/SkillBalancePanel.tsx` (G8), đặt cạnh `UnitSpecWarnings` trên `UnitEditPage`.
- Hàm thuần `skillShares()` trong `utils/spec/skillBalance.ts` dùng **cùng công thức làm tròn** với server, có test so với ví dụ của server.

## 5. Kiểm thử

| Test | Nội dung |
|---|---|
| Server `specValidator.test.ts` | `ACTIVITY_CONTENT_MISSING` là vi phạm; `ACTIVITY_CONTENT_INVALID` cho từng `reason`; giá trị lấy từ `item_refs` được chấp nhận. |
| Server `activityContent.test.ts` | `lines` / `dialogueTurns` bị từ chối ở activity; block `context` vẫn nhận `dialogueTurns`. |
| Server `lessonSpecRoutes.test.ts`, `seedSampleUnit.test.ts` | Publish bị chặn khi thiếu `content`; seed vẫn publish được. |
| `acceptedAnswers.test.ts` (admin) | Đọc fixture server, kết quả giống hệt. |
| `activityContent.test.ts` (admin utils) | `emptyContent`, `validateContent` đồng bộ các ca sai của server, `slotChoices` với `item_refs`. |
| `blockModel.test.ts` | Activity ghi `content`, không còn `lines`; giữ khoá lạ của `data` cũ (`source_metadata`). |
| Mỗi editor (`*.test.tsx`) | Thêm / xoá / đổi thứ tự; select chỗ trống chỉ có lựa chọn hợp lệ; `FillBlankEditor` tự điền trước / sau chỗ trống; đổi loại hỏi xác nhận. |
| `ActivityDraftsPanel.test.tsx` | Sinh nháp → "Sửa rồi thêm" mở dialog điền sẵn; "Thêm tất cả" gọi tạo block đúng số lần, đúng bước; bài không có pattern ẩn nút. |
| `LessonPreviewPage.test.tsx` (mở rộng) | Chạy qua 6 bước với snapshot seed; câu chọn đúng / sai; câu gõ chấp nhận biến thể; tự đánh giá; gợi ý mở dần theo `hint_levels`; tóm tắt bước 6; không gọi API ghi. |
| `SkillBalancePanel.test.tsx`, `skillBalance.test.ts` | Tỷ lệ, tô cảnh báo khi lệch > 10. |
| Playwright `lesson-spec.spec.ts` (mở rộng) | Ở bước 3 bấm "Sinh nháp" → "Thêm tất cả"; viết `role_play` ở bước 5 bằng editor; publish; mở preview, chạy hết 6 bước. |

**Kiểm tra cuối:**
- server: `tsc`, `yarn test`, `yarn test:db`;
- admin-web: lint / typecheck / format / Vitest / build;
- Playwright;
- app: `jest src/core/schemas` (fixture không đổi).

## 6. Thứ tự commit

1. `feat(spec): activity content required with slot checks; retire activity lines`: §3, server + nhãn admin.
2. `feat(admin-web): activity content types, drafts client and accepted answers`: §4.1.
3. `feat(admin-web): activity editors by kind`: §4.2.
4. `feat(admin-web): activity drafts from the lesson pattern`: §4.3.
5. `feat(admin-web): six-step lesson preview with hints and answer checks`: §4.4.
6. `feat(admin-web): unit skill balance panel`: §4.5.
7. `test(admin-web): authoring e2e with drafts and the six-step preview`: Playwright.
8. `docs: mark PR 9 plan as implemented`.

## 7. File tóm tắt

**Thêm (admin-web):**
- `src/components/blocks/activity/*Editor.tsx` (6) + test;
- `src/components/blocks/ActivityDraftsPanel.tsx`;
- `src/components/preview/*` (`StepRunner`, `PreviewActivity`, 6 renderer, `HintButton`, `StepSummary`);
- `src/components/units/SkillBalancePanel.tsx`;
- `src/utils/items/acceptedAnswers.ts`, `src/utils/blocks/activityContent.ts`, `src/utils/spec/skillBalance.ts` + test.

**Sửa (admin-web):**
- `api/client.ts`, `api/types.ts`;
- `components/blocks/blockModel.ts`, `BlockFields.tsx`, `BlockEditorDialog.tsx`;
- `components/LessonBlocksSection.tsx`, `components/LessonPreviewBlock.tsx`;
- `routes/LessonPreviewPage.tsx`, `routes/UnitEditPage.tsx`;
- `utils/spec/specRules.ts`;
- `e2e/lesson-spec.spec.ts`.

**Sửa (server):**
- `lessonBlocks/model/extendedBlockContent.ts`;
- `spec/service/specValidator.ts`, `spec/repository/postgresLessonSpecStore.ts`;
- test liên quan.

**Xoá:**
- trường `lines` / `dialogueTurns` của activity (schema và editor);
- `TurnsEditor` **giữ** (block `context` vẫn dùng).

**Dependency mới:** không.

## 8. Rủi ro

- ⚠️ **Đổi contract (thu hẹp):** activity không còn nhận `lines` / `dialogueTurns`. Không có dữ liệu thật bị ảnh hưởng (DB làm lại, seed không dùng). App từ PR 9 tới PR 10 chỉ hiện tiêu đề activity.
- ⚠️ **Publish khó hơn:** mọi activity bước 2–5 phải có `content` hợp lệ. Bài admin cũ trong DB dev (nếu có) sẽ bị chặn tới khi soạn `content`.
- **Ba bản copy logic** (`acceptedAnswers` ở server, app, admin): giảm thiểu bằng một fixture duy nhất của server mà cả ba test cùng đọc.
- **Khối lượng UI lớn** (6 editor + preview tương tác). Có thể tách **PR 9a** (commit 1–4: soạn và sinh nháp) và **PR 9b** (commit 5–7: preview và cân bằng).
- **Preview không ghi âm**, nên phần nói chỉ tự đánh giá; không phản ánh độ khó thật của bước nói. Ghi rõ trên UI: "Bản chạy thử, phần nói tự đánh giá".

## 9. Kết quả và điểm lệch so với plan

**Commit (server, nhánh `claude/optimistic-bell-mfgk44`):**

| Commit | Nội dung |
|---|---|
| `1f5503b` | §3: `content` bắt buộc khi publish, kiểm chỗ trống, bỏ `lines` / `dialogueTurns` của activity. |
| `ca6b23c` | §4.1: kiểu, client sinh nháp, `acceptedAnswers` (copy), tiện ích `activityContent`. |
| `e5f92a6` | §4.2: 6 editor theo loại, xác nhận khi đổi loại, tóm tắt `content` trong preview block. |
| `44b5c85` | §4.3: nút "Draft from pattern", `ActivityDraftsPanel`, `initialDraft`. |
| `6147be8` | §4.4: preview chạy thử 6 bước. |
| `6fa3a07` | §4.5: `SkillBalancePanel`. |
| `09c79d6` | Playwright `lesson-spec` mở rộng. |

**Kiểm tra cuối:**
- server: `tsc` sạch; `yarn test` 431 pass; `yarn test:db` 245 pass;
- lint server: chỉ còn lỗi có sẵn ở `test/ipa.test.ts:84` (không do PR này);
- admin-web: `tsc`, eslint `--max-warnings=0`, prettier, Vitest 160 pass, build;
- Playwright 16/16;
- app: `jest src/core/schemas` 44 pass (fixture không đổi).

**Điểm lệch:**
1. **Props của editor:** ngoài `{ content, onChange, items }` mỗi editor nhận thêm `lookup` (`PatternLookup`): text của `item_refs` không nằm trong bài (lấy qua `getItemByCode`) và variants của pattern (lấy qua `getItem`). Nhờ vậy lựa chọn chỗ trống khớp đúng phép kiểm `ACTIVITY_CONTENT_INVALID` của server. Thêm các file phụ:
   - `activity/patternLookup.ts`;
   - `activity/shared.tsx` (nút thêm / xoá / đổi thứ tự, danh sách đáp án chấp nhận);
   - `activity/ActivityContentEditor.tsx` (chọn editor theo loại).
2. **Activity chưa viết `content` vẫn lưu được:** nội dung còn nguyên dạng rỗng thì không gửi `content`; spec check báo `ACTIVITY_CONTENT_MISSING` khi publish. Nội dung đã viết thì phải hợp lệ mới lưu (`validateContent`).
3. **Test editor gộp một file** `activity/ActivityEditors.test.tsx` (6 editor + đổi loại hỏi xác nhận), thay vì 6 file `*.test.tsx`.
4. **`ACTIVITY_KINDS` trong `blockModel.ts` được giữ** (không xoá export), nhưng giờ suy ra từ danh sách trong `utils/blocks/activityContent.ts` để không còn hai danh sách.
5. **Nút sinh nháp** hiện khi bài có ít nhất một pattern (danh sách item của editor không có `role`). Nếu server không trả nháp nào, panel giải thích: cần pattern bắt buộc (và ví dụ cho bước 4).
6. **"Add all"** thêm lần lượt từng nháp. Nếu một nháp lỗi, các nháp chưa thêm vẫn còn trong panel; thêm hết thì panel tự đóng.
7. **Preview 6 bước:**
   - Thêm `PracticeEntry` (dùng chung cho nói / gõ / chọn), `rendererProps.ts` và `previewModel.ts` (cách chấm, gợi ý, đáp án chấp nhận).
   - Chế độ mặc định vẫn là "All blocks"; nút "Run the 6 steps" chỉ hiện khi bài có block gắn bước.
   - Câu dịch chấp nhận cả câu mẫu lẫn mọi câu của pattern.
   - Trả lời sai rồi làm lại đúng tính là "With a hint".
   - Kiểu `PreviewItem` của admin có thêm `payload?` / `variants?`; snapshot có thêm `tasks?` (server vốn đã gửi).
8. **Test preview** đọc fixture seed của server qua `components/preview/seedSnapshot.testutil.ts`.
9. **E2e:** bước 4 vẫn là block text, vì pattern tạo trong e2e không có ví dụ / lỗi thường gặp nên server không sinh nháp cho bước 4.
10. **`SkillBalancePanel`** dùng lại style bảng `courses-table` sẵn có.
