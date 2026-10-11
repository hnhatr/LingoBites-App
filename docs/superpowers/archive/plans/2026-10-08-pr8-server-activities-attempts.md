# PR 8 – Server: nội dung hoạt động theo loại, sinh nháp từ mẫu câu, lượt làm, mức "hoàn thành phần luyện", cân bằng 70/25/5

> Trạng thái: **ĐÃ CODE**: G1–G9 đã duyệt; server `c077dd7` → `3ee62e9`, app `4a0d949` (xem §14 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-Server` (+ nhãn nhỏ ở `admin-web`, + 1 commit chỉ chép fixture sang `LingoBites-App`). Nhánh: `claude/optimistic-bell-mfgk44`.
> PR đầu tiên của Stage 2 trong `2026-10-07-backward-design-curriculum-plan.md`, mục Server 1–4. PR 9 (admin editor, preview) và PR 10–11 (app player, gợi ý, vận dụng) code theo contract và fixture của PR này.

## 1. Mục tiêu và phạm vi

Hiện tại block `activity` chỉ có `activityKind`, tiêu đề, `lines` / `dialogueTurns` và `item_refs` / `task_id`, chưa đủ để app cho người học **làm** bài. Lượt làm (`activity_attempts`) cũng mới chỉ có loại review / practice / game.

Sau PR này:
1. Mỗi `activityKind` có **nội dung riêng, kiểm tra chặt** (`data.content`).
2. Có hàm **đáp án chấp nhận** dùng chung, sinh từ khung câu và biến thể.
3. Admin xin được **nháp hoạt động** sinh từ mẫu câu cho bước 2–4.
4. Server nhận **lượt làm trong bài**, có mức hỗ trợ và kết quả (`support_level`, `outcome`).
5. Server ghi lại **thời điểm hoàn thành phần luyện** cho từng người học.
6. Spec-check của unit cảnh báo khi tỷ lệ kỹ năng lệch **70/25/5**.

| Trong PR 8 | Ngoài PR 8 |
|---|---|
| Schema `data.content` cho 6 loại hoạt động | Form soạn từng loại trên admin, preview 6 bước (**PR 9**) |
| `acceptedAnswers()` + fixture dùng chung (app chép ở PR 10) | Chấm tự động, STT, chấm phát âm (Stage 3) |
| Route sinh nháp `POST /v1/admin/lessons/:id/activity-drafts`, không dùng AI | Sinh nháp `role_play` (admin tự viết hội thoại) |
| Payload `activity_attempts` loại `lesson` (mức hỗ trợ, kết quả, ai đánh giá) | Mã lỗi, tiêu chí trong lượt làm (Stage 3) |
| Bảng `lesson_outcomes` + tính `practice_completed_at` khi push | `passed_at`, `unit_outcomes`, `item_memory` (Stage 3) |
| Cảnh báo `SKILL_BALANCE_OFF` ở spec-check của unit (+ nhãn admin-web) | Màn hiển thị tỷ lệ chi tiết trên trang unit (**PR 9**) |
| Seed unit mẫu có nội dung hoạt động thật; làm mới fixture snapshot (+ chép sang app) | Thay đổi UI của app (PR 10–11) |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Nội dung hoạt động để ở đâu?** | Thêm trường `content` vào `ActivityBlockData`, có shape riêng theo `activityKind` (§3). **Giữ** `lines` / `dialogueTurns` tới PR 9, vì editor admin hiện tại còn ghi chúng; PR 9 chuyển editor sang `content` rồi xoá hai trường này. Snapshot giữ nguyên `data` như hiện nay; app đang đọc `data` dạng record nên không vỡ. |
| G2 | **Đáp án chấp nhận lưu sẵn hay tính lúc dùng?** | **Tính lúc dùng.** Hàm thuần `acceptedAnswers(pattern, variants)` trong `items/model` ghép khung câu + biến thể × giá trị chỗ trống, kèm `normalizeAnswer()` để so khớp. App có đủ dữ liệu (`lesson_items` mang khung, chỗ trống, biến thể) nên PR 10 chép hàm này sang app, khoá bằng fixture `accepted-answers.json`. Sửa item thì đáp án đổi theo, không phải cập nhật lại block. |
| G3 | **Sinh nháp hoạt động** dùng AI hay luật? | **Luật, không gọi AI**, chạy được offline, không tốn tiền, test được. Route **chỉ trả nháp, không lưu**; admin sửa rồi lưu bằng route tạo block có sẵn. Hỗ trợ 5 loại (§5); `role_play` không sinh vì cần kịch bản hội thoại. |
| G4 | **Lượt làm trong bài lưu ở đâu?** | **Giữ collection sync `activity_attempts`** (lưu ở `sync_records` như hiện nay), thêm `kind: 'lesson'` với payload chặt riêng (§6). **Không** tạo bảng attempts mới. Payload vẫn **không chứa chữ người học nói hay viết** (chỉ id, kết quả, thời gian), đúng nguyên tắc hiện tại. Có thêm trường `assessed_by`: `rule` (app tự chấm câu chọn hoặc điền) hoặc `self` (tự đánh giá phần nói, Stage 2). Stage 3 thêm `service`. |
| G5 | **"Hoàn thành phần luyện" tính thế nào?** | Mỗi block `activity` ở **bước 2–4** của bài (theo nội dung hiện tại) có ít nhất 1 lượt `kind = lesson` với `outcome ≠ unscorable`. Bước 5 (vận dụng độc lập) **không** tính vào đây: nó là điều kiện "đạt bài" của Stage 3. Server tính trong transaction push, ghi `lesson_outcomes.practice_completed_at` một lần và không lùi lại. App PR 10 dùng **đúng luật này** khi tính cục bộ. |
| G6 | **`lesson_outcomes` có sync về app không?** | **Chưa trong PR 8.** App tự tính cục bộ để chạy offline; server giữ bản ghi cho Stage 3 (đạt bài, admin xem lượt làm). Collection pull `lesson_outcomes` thêm ở PR 13 cùng `passed_at`. |
| G7 | **Cảnh báo 70/25/5** đo thế nào? | Cộng `duration_sec` theo `skill` của mọi block thuộc các bài chưa archive trong unit. Cảnh báo `SKILL_BALANCE_OFF` khi tổng > 0 và bất kỳ phần nào lệch quá **10 điểm %** so với nói 70 / nghe 25 / viết 5. Block không có skill tính riêng là `untagged`. Spec-check trả thêm `skill_balance` (số giây từng loại). Chỉ cảnh báo, không chặn publish. |
| G8 | **Kiểm tra `content` trong spec-check** | - Nội dung sai shape → **400 khi lưu block** (zod), như mọi block hiện nay.<br>- `content` tham chiếu item không có trong bài → **vi phạm** `ACTIVITY_ITEM_NOT_IN_LESSON`.<br>- Block `activity` ở bước 2–5 **thiếu `content`** → chỉ **cảnh báo** `ACTIVITY_CONTENT_MISSING` trong PR 8, vì admin chưa soạn được trước PR 9. PR 9 nâng thành vi phạm. |
| G9 | **Seed và fixture.** Fixture `valid-lesson-snapshot-with-spec-response.json` sinh từ bài L01 của seed và đang khoá SHA ở cả hai repo. | Seed mới có `content` cho mọi activity (nháp sinh từ generator, cộng `role_play` viết tay). Làm mới fixture và SHA, rồi **chép sang app** trong 1 commit chỉ gồm fixture + SHA pin (app chỉ test parse, không đổi code). Thêm fixture mới `valid-sync-activity-attempt-lesson-push-request.json` (cũng chép sang app) cho PR 10. |

## 3. `data.content` theo loại hoạt động

Model: `lessonBlocks/model/activityContent.ts`. Dùng camelCase như các trường khác của block data.

- Mọi danh sách: 1–20 phần tử, `id` không trùng.
- Chữ: theo các hằng `LESSON_BLOCK_*` sẵn có.
- Item tham chiếu bằng **id** (uuid), như `item_refs`.

| `activityKind` | `content` | Bước thường dùng |
|---|---|---|
| `listen_and_repeat` | `{ prompts: [{ id, textEn, textVi, itemId? }] }` | 2–3 |
| `speaking_drill` | `{ patternItemId, combos: [{ id, values: { [slot]: string } }] }`. Mỗi `values` phải đủ chỗ trống của khung, và giá trị phải nằm trong lựa chọn của chỗ trống đó (kiểm ở spec-check, vì item có thể đổi sau). | 3 |
| `fill_blank` | `{ questions: [{ id, beforeEn, afterEn, answer, options?: string[2..6] (phải chứa answer), textVi, patternItemId?, slot? }] }`. Có `options` thì là chọn, không có thì gõ. | 3 |
| `multiple_choice` | `{ questions: [{ id, promptVi, promptEn?, options: [{ id, text }] (2–6), correctOptionId }] }` | 3–4 |
| `translation` | `{ sentences: [{ id, textVi, modelEn, patternItemId? }] }`. Đáp án chấp nhận = `modelEn` ∪ `acceptedAnswers(pattern)` khi có `patternItemId`. | 4 |
| `role_play` | `{ learnerSpeaker: 'A' \| 'B', turns: [{ id, speaker, textEn, textVi, patternItemId? }] (2–20) }`. Lượt của người học: `textEn` là câu mẫu; có `patternItemId` thì chấp nhận theo khung. | 4–5 |

`superRefine` kiểm tra thêm:
- `correctOptionId` phải nằm trong `options`;
- `role_play` có ít nhất 1 lượt của người học;
- không trùng `id` trong cùng danh sách.

**Spec-check** (G8): `ACTIVITY_ITEM_NOT_IN_LESSON` gom mọi `itemId` / `patternItemId` trong `content` và so với `lesson_items` của bài. Nếu `patternItemId` không phải kind `pattern` thì cũng là vi phạm này (`reason: 'not_pattern'`).

## 4. Đáp án chấp nhận (`items/model/acceptedAnswers.ts`)

```ts
/** Every sentence the frame and its variants produce, normalised and unique. */
export function acceptedAnswers(
  pattern: { text: string; payload: PatternPayload },
  variants: ReadonlyArray<{ text: string }>,
  resolveRef: (code: string) => string | null,
  limit = 200,
): string[];

/** Lowercase, NFKC, curly → straight apostrophes, no surrounding punctuation, single spaces. */
export function normalizeAnswer(text: string): string;
```

- Dùng `expandPattern` có sẵn cho khung và cho từng biến thể (biến thể dùng cùng các chỗ trống; `variantSlotProblem` đã kiểm ở PR 1).
- Nếu bỏ chỗ trống mà dùng **đúng giá trị của lượt hỏi** (`values` trong `speaking_drill`), có hàm phụ `acceptedForValues(pattern, variants, values)` chỉ ghép đúng tổ hợp đó.
- Fixture `test/fixtures/accepted-answers.json`: vài ca (khung 2 chỗ trống + 2 biến thể, `item_refs`, giới hạn, chuẩn hoá dấu câu). Đây là fixture dùng chung; app chép ở PR 10.

## 5. Sinh nháp hoạt động (`lessonBlocks/service/activityDrafts.ts`)

**Route:** `POST /v1/admin/lessons/:id/activity-drafts`, body `{ step: 2 | 3 | 4 }`.
- Trả `{ drafts: [{ type: 'activity', step, skill, durationSec, data }] }`, mỗi `data` đã qua `ActivityBlockDataSchema`.
- **Không ghi DB.** Cần admin session + CSRF như mọi POST admin khác (`createAdminGuards`).
- Nguồn: `lesson_items` của bài (pattern + word / phrase, kèm examples / variants / errors).
- Bài chưa có pattern → `drafts: []`.

| Bước | Nháp | Luật sinh |
|---|---|---|
| 2 | `listen_and_repeat` (skill `listen`) | Câu ví dụ của các pattern bắt buộc, rồi từ / cụm bắt buộc (`textEn` = chữ, `textVi` = nghĩa). Tối đa 8 câu. |
| 3 | `speaking_drill` (skill `speak`) | 6 tổ hợp đầu của `expandPattern` (chỗ trống chạy như đồng hồ đo), lấy `values` thô. |
| 3 | `fill_blank` (skill `write`) | Với mỗi chỗ trống của pattern: một câu mẫu, khoét chỗ trống đó; `options` = đáp án + tối đa 3 giá trị khác của cùng chỗ trống; `textVi` = nghĩa của pattern. |
| 4 | `translation` (skill `write`) | Mỗi ví dụ của pattern: `textVi` → `modelEn`, có `patternItemId`. |
| 4 | `multiple_choice` (skill `listen`) | `promptVi` = nghĩa pattern; đáp án đúng = ví dụ đầu; phương án nhiễu = `wrong_example` của `item_errors` (lỗi `blocking` trước). Không có lỗi nào thì bỏ qua nháp này. |

`durationSec` mặc định: 30 giây × số câu, làm tròn lên bội số 30. `titleVi` theo mẫu, ví dụ "Nghe và nhắc lại", "Đổi chỗ trống", "Điền vào chỗ trống", "Dịch sang tiếng Anh", "Chọn câu đúng". Kết quả **xác định**: cùng đầu vào cho cùng nháp (id trong `content` sinh theo vị trí, ví dụ `p1`, `q2`).

## 6. Lượt làm trong bài (`sync/model/sync.ts`)

`ActivityAttemptPushPayloadSchema` thành union phân biệt theo `kind`. Ba loại cũ (`review`, `practice`, `game`) **giữ nguyên**. Thêm:

```ts
const LessonActivityAttemptSchema = z.object({
  kind: z.literal('lesson'),
  activity: z.enum(ActivityKindValues),      // the block's activityKind
  lesson_id: z.string().uuid(),
  block_id: z.string().uuid(),
  content_revision: z.number().int().min(1), // the lesson version answered
  step: z.number().int().min(1).max(6),
  task_id: z.string().uuid().nullable(),
  item_keys: z.array(itemCode).max(20),      // catalog codes practised
  session_id: z.string().uuid().nullable(),
  support_level: z.enum(['none', 'hint_1', 'hint_2', 'model']),
  outcome: z.enum(['pass_independent', 'pass_with_support', 'fail', 'unscorable']),
  assessed_by: z.enum(['rule', 'self']),
  duration_ms: z.number().int().min(0).max(3_600_000),
}).strict();
```

- **Ràng buộc chéo:** `support_level ≠ none` thì `outcome` không được là `pass_independent`.
- Vẫn **không có chữ trả lời**. Tombstone vẫn là `{}`.
- Fixture mới `valid-sync-activity-attempt-lesson-push-request.json`, khoá SHA, chép sang app.

## 7. `lesson_outcomes` và "hoàn thành phần luyện"

**Migration `006_lesson_outcomes.sql`** (+ `.down.sql`):

```sql
CREATE TABLE lesson_outcomes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    practice_completed_at timestamptz,
    passed_at timestamptz,               -- Stage 3
    last_attempt_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
```

Thêm model Prisma `LessonOutcomes`.

**Tính trong `PostgresSyncStore.push`**, cùng transaction, cho các bài có lượt `kind = lesson` vừa được nhận (không phải tombstone):
1. Upsert `last_attempt_at`.
2. Nếu `practice_completed_at` còn null:
   - lấy các block `activity` bước 2–4 hiện có của bài;
   - lấy tập `block_id` mà user đã có lượt `outcome ≠ unscorable` (đọc `sync_records` của user, collection `activity_attempts`, `payload->>'lesson_id'`);
   - đủ hết thì đặt `practice_completed_at = now()`.
   - Bài không có block nào ở bước 2–4 thì không bao giờ "hoàn thành phần luyện" theo cách này.
3. Lượt của bài người học, hoặc bài không còn hiển thị với user: vẫn lưu lượt (sync không mất dữ liệu) nhưng **không** ghi `lesson_outcomes`.

Không có route đọc trong PR 8 (G6). Có hàm store `getLessonOutcome(userId, lessonId)` cho test và Stage 3. Xoá tài khoản thì cascade theo user.

## 8. Cân bằng kỹ năng 70/25/5 (G7)

- Hàm thuần `skillBalance(blocks)` → `{ speak_sec, listen_sec, write_sec, untagged_sec, total_sec }`, cộng `checkSkillBalance(balance)` → cảnh báo hoặc không. Đặt trong `spec/service/specValidator.ts`, cạnh `checkUnitSpec`.
- `unitSpecCheck` đọc block của các bài chưa archive trong unit, trả thêm `skill_balance` và có thể thêm cảnh báo `SKILL_BALANCE_OFF` (kèm `shares`).
- Admin-web: thêm nhãn cho `SKILL_BALANCE_OFF` và `ACTIVITY_CONTENT_MISSING` / `ACTIVITY_ITEM_NOT_IN_LESSON` trong `utils/spec/specRules.ts` (test của file này đòi mọi rule server đều có nhãn). Không thêm màn mới (PR 9).

## 9. Seed và fixture (G9)

- `scripts/sampleUnit/content.ts`:
  - mọi block `activity` có `content`;
  - bước 3–4 dùng generator (gọi hàm thuần, không qua HTTP);
  - `role_play` bước 5 viết tay với `learnerSpeaker` và `patternItemId`;
  - bỏ `lines` ở seed (dùng `content`).
- Chạy seed vào DB test, sinh lại `valid-lesson-snapshot-with-spec-response.json` theo đúng cách PR 2 đã làm, rồi cập nhật SHA ở `fixtures.ts`.
- **App** (1 commit): chép fixture mới + fixture attempt sang `src/core/schemas/__tests__/fixtures/`, cập nhật `LESSON_CONTRACT_FIXTURE_SHA256`, chạy test contract. Không đổi code app.

## 10. Kiểm thử

| Test | Nội dung |
|---|---|
| `activityContent.test.ts` | Mỗi loại: ca hợp lệ, ca sai (thiếu lượt người học, `correctOptionId` lạ, `options` thiếu đáp án, trùng id); block thiếu `content` vẫn lưu được (G1). |
| `acceptedAnswers.test.ts` | Theo fixture dùng chung: khung + biến thể, `item_refs`, giới hạn, `normalizeAnswer`, `acceptedForValues`. |
| `activityDrafts.test.ts` | Trên item của seed: đúng loại, số câu, `options` chứa đáp án, `multiple_choice` bỏ qua khi không có lỗi; kết quả xác định; mọi nháp qua schema. |
| `activityDraftRoutes.test.ts` (`test:db`) | 401 khi không đăng nhập; 404 bài lạ; bài không có pattern → `[]`; không ghi DB. |
| `syncActivityAttempts.test.ts` (mở rộng) | `kind: lesson` hợp lệ được nhận; field lạ, `support_level` mâu thuẫn với `outcome`, `item_keys` sai mã → 400; ba loại cũ vẫn như trước. |
| `lessonOutcomes.test.ts` (mới, `test:db`) | - Đủ lượt bước 2–4 → có `practice_completed_at`;<br>- thiếu 1 block hoặc chỉ có `unscorable` → chưa;<br>- lượt bước 5 không tính;<br>- đặt một lần không lùi;<br>- bài người học không ghi;<br>- xoá user cascade;<br>- push lặp (idempotent) không đổi thời điểm. |
| `lessonSpecRoutes.test.ts` / validator | `ACTIVITY_ITEM_NOT_IN_LESSON` (kể cả `not_pattern`), `ACTIVITY_CONTENT_MISSING` là cảnh báo; unit `SKILL_BALANCE_OFF` và `skill_balance`. |
| `databaseBaseline.test.ts` | Migration 006 lên / xuống. |
| `seedSampleUnit.test.ts` | Seed vẫn publish cả 3 bài, không có vi phạm; spec-check unit không cảnh báo cân bằng (seed đặt thời lượng khớp 70/25/5). |
| Contract (2 repo) | SHA mới của fixture with-spec và fixture attempt. |
| admin-web `specRules.test.ts` | Có nhãn cho 3 rule mới. |

**Kiểm tra cuối:**
- `tsc`, `yarn test`, `yarn test:db`, `prisma migrate diff` rỗng;
- admin-web: lint / typecheck / format / Vitest, Playwright;
- app: `jest src/core/schemas`.

## 11. Thứ tự commit

1. `feat(lessons): kind-specific activity content and accepted answers`: §3, §4, fixture `accepted-answers.json`.
2. `feat(lessons): activity drafts generated from a lesson's pattern`: §5, route + test.
3. `feat(sync): lesson activity attempts with support level and outcome`: §6 + fixture attempt.
4. `feat(outcomes): lesson_outcomes with practice completion`: §7, migration 006, Prisma.
5. `feat(spec): activity content checks and unit skill balance`: §3 spec-check, §8, nhãn admin-web.
6. `feat(seed): sample unit activities with content; refresh snapshot fixture`: §9 (server).
7. App: `test(contract): sync PR 8 snapshot and attempt fixtures`.
8. `docs: mark PR 8 plan as implemented`.

## 12. File tóm tắt

**Thêm (server):**
- `src/modules/curriculum/lessonBlocks/model/activityContent.ts`, `…/service/activityDrafts.ts` (+ route trong controller lessonBlocks hoặc spec);
- `src/modules/items/model/acceptedAnswers.ts`;
- `src/modules/curriculum/outcomes/` (repository nhỏ cho `lesson_outcomes`);
- `src/common/database/migrations/006_lesson_outcomes.sql` + `.down.sql`;
- fixture `test/fixtures/accepted-answers.json`, `canonicalLesson/model/fixtures/valid-sync-activity-attempt-lesson-push-request.json`;
- test ở §10.

**Sửa (server):**
- `extendedBlockContent.ts` (thêm `content`);
- `specValidator.ts`, `postgresLessonSpecStore.ts`;
- `sync/model/sync.ts`, `sync/repository/store.ts`;
- `prisma/schema.prisma`, `fixtures.ts`, `scripts/sampleUnit/*`, `package.json` (danh sách `test:db`).

**Sửa (admin-web):** `src/utils/spec/specRules.ts` (+ test).

**Sửa (app):** 2 file fixture + `src/core/schemas/fixtures.ts` (SHA).

**Xoá:** không. `lines` / `dialogueTurns` của activity xoá ở PR 9.

**Dependency mới:** không.

## 13. Rủi ro

- ⚠️ **Đổi contract công khai (thêm, không phá):**
  - block `activity` có thêm `data.content`;
  - push `activity_attempts` nhận thêm `kind: lesson`;
  - spec-check của unit thêm `skill_balance` và một cảnh báo.
  - App hiện tại không đọc các trường này nên không vỡ. Fixture with-spec đổi byte, nên app phải chép lại (commit 7).
- ⚠️ **Migration 006** thêm bảng mới (không xoá gì).
- **Hai trường song song** (`lines` / `dialogueTurns` cũ và `content` mới) tồn tại tới PR 9. Editor admin hiện tại không biết `content`: sửa một activity có `content` bằng editor cũ có thể làm mất `content` nếu editor ghi đè cả `data`. PR 9 sửa editor; trong lúc chờ, chỉ seed mới có `content`.
- **Chi phí tính "hoàn thành phần luyện" khi push:** mỗi bài trong batch tốn 2 truy vấn (block bước 2–4 và lượt của user cho bài đó). Batch push vốn nhỏ, và khoá chính `sync_records (user_id, collection, entity_id)` đã lọc được theo user + collection. Lọc thêm theo `payload->>'lesson_id'` là quét trong tập lượt của một user. Nếu chậm, Stage 3 chuyển sang bảng attempts riêng.
- **Luật "hoàn thành phần luyện" phải giống hệt ở app** (PR 10). Giảm thiểu bằng việc ghi luật ở một chỗ (§7), có test hai phía, và đưa ca biên vào fixture attempt.
- **Tự đánh giá (`assessed_by: self`)** dễ "đạt" ảo. Chấp nhận trong Stage 2; Stage 3 chấm máy và không dùng lượt `self` để tính `passed_at`.

## 14. Kết quả code và điểm lệch so với plan

**Kiểm tra cuối:**
- Server:
  - `tsc` sạch;
  - unit 429 pass (726 test; phần cần DB tự skip);
  - `test:db` 245/245;
  - `prisma migrate diff` (DB đã migrate → schema): rỗng;
  - OpenAPI +1 path / +1 operation.
- admin-web: lint / typecheck / format sạch, Vitest `specRules` 13/13, Playwright 16/16.
- App: `tsc` sạch, lint 178/281 (không nâng budget), format sạch, Jest 2148 pass. Fixture with-spec và fixture lượt làm trùng byte với server.

**Điểm lệch so với plan:**
- **Nội dung hoạt động trong seed viết tay, không gọi generator.** Shape vẫn đúng `activityContent.ts`, và seed test kiểm tra mọi hoạt động đều có `content`. Generator được kiểm riêng trên fixture item dùng chung.
- **Đổi skill một block của seed để unit đạt 70/25/5:** bài L02, bước 3 (`listen_and_repeat`) đổi `listen` → `speak`, vì nghe và nhắc lại là nói. Unit đạt 72/28/0, không cảnh báo.
- **Spec-check chưa kiểm `values` của `speaking_drill`** (đủ chỗ trống, đúng lựa chọn). Để PR 9 làm cùng editor, vì cần đưa payload của pattern vào input của validator. Hiện chỉ kiểm item có trong bài và đúng kind pattern.
- **`ACTIVITY_ITEM_NOT_IN_LESSON` với `reason: not_pattern`** chỉ được báo khi biết kind của item. Input của validator có thêm `kind` cho item của bài.
- **Lượt làm của bài admin luôn được tính vào `lesson_outcomes`, bất kể trạng thái bài.** Plan nói "bài không còn hiển thị với user thì không ghi"; thực tế chỉ loại bài `origin = learner`. Vì sync không bao giờ bỏ lượt làm, lượt đến từ bài đã archive vẫn đóng dấu `last_attempt_at`.
- **Spec-check của unit dùng schema response riêng** (`UnitSpecCheckResponseSchema`, có `skill_balance`); spec-check của bài không đổi.
- **Route sinh nháp dùng admin session + CSRF**, như mọi POST admin.
- **Admin-web:** ngoài nhãn rule, kiểu `SpecFinding` có thêm `reason` và `shares`.
