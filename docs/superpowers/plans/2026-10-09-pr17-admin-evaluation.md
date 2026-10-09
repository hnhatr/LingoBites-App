# PR 17 – Admin: cấu hình chấm, lượt làm, nghe lại, thống kê, preview

> Trạng thái: **CHỜ DUYỆT** (2026-10-09).
> Nền: `claude/funny-archimedes-gmioda` (đã có PR 12–16). Plan giai đoạn: `2026-10-09-phase1-stage3-plan.md` §9.
> Repo: **chỉ `LingoBites-Server`** (server + `admin-web`). App không đổi.

---

## 1. Phạm vi

| Có trong PR 17 | Không có (để sau) |
|---|---|
| Cấu hình ngưỡng mặc định (content / clarity) và khoảng ôn; chỉ admin sửa; mọi thay đổi ghi log (B11) | Nhiều tài khoản admin / phân quyền (hiện chỉ có một admin) |
| Tab "Lượt chấm" trong trang user: kết quả, tiêu chí, lỗi, nghe lại bản ghi ≤ 30 ngày | Sửa kết quả chấm bằng tay |
| Mỗi lần nghe bản ghi ghi log; không có nút tải (B12) | Chặn tải tuyệt đối (trình duyệt luôn có cách lưu luồng âm thanh) |
| Trang "Thống kê chấm": tỷ lệ đạt theo bài / task, lỗi hay gặp, `unscorable` theo lý do, chi phí STT ước tính | Biểu đồ theo thời gian |
| Preview 6 bước: nhãn kết quả giống app (2.10); bước 5 "Thử chấm" bằng chữ và ghi âm (2.11) | Thử chấm nhiệm vụ tổng hợp trong preview |
| Cảnh báo khi phần viết của unit = 0% (B13) | Bắt buộc tỷ lệ viết |

---

## 2. Quyết định cần xác nhận

B11, B12, B13 trong Bảng chốt còn trống → dùng đề xuất của bảng.

| # | Câu hỏi | Đề xuất |
|---|---|---|
| K1 | Lưu cấu hình ở đâu? | ⚠️ **Migration 010**: bảng `admin_settings (key text PK, value jsonb, updated_at)`. Hai khóa: `evaluation.thresholds` = `{content: 0.80, clarity: 0.60}`, `review.interval_days` = `[1, 3, 7, 14, 30]`. Không có dòng → dùng hằng số hiện tại (hành vi không đổi khi chưa ai sửa). |
| K2 | Ghi log thay đổi ở đâu? | Cùng migration: bảng `admin_audit_log (id, action, target_type, target_id, details jsonb, request_id, created_at)`, chỉ thêm, không sửa / xóa. `details` của đổi cấu hình = `{before, after}`; của nghe lại = `{user_id, recording_id, mode}`. Không ghi IP / user-agent. Chỉ có một admin nên không có cột "ai sửa"; khi có nhiều admin sẽ thêm. |
| K3 | Giới hạn giá trị | Ngưỡng: số trong `[0.3, 1]`, 2 chữ số thập phân. Khoảng ôn: đúng 5 số nguyên tăng dần trong `[1, 365]`. Sai → 400. |
| K4 | Bộ chấm đọc ngưỡng thế nào? | Đọc `admin_settings` có cache 60 giây trong process. Ngưỡng **riêng của task** (`task_criteria.threshold`) vẫn thắng ngưỡng mặc định. `scorer_version` không đổi (luật chấm không đổi, chỉ con số). |
| K5 | Đổi khoảng ôn áp cho ai? | Chỉ **lần ôn kế tiếp** (hạn mới tính theo khoảng mới); `due_at` đã có không bị tính lại. ⚠️ App đang tạm tính hạn trên máy bằng `[1,3,7,14,30]` (PR 16, G9): nếu admin đổi, hạn trên máy có thể lệch tới khi pull. Chấp nhận (pull luôn ghi đè); ghi chú trên trang cấu hình. |
| K6 | Xem lượt chấm ở đâu? | Tab mới "Evaluations" trong trang user: 50 lượt mới nhất, phân trang theo cursor. Mỗi dòng: thời gian, bài / unit, task, nguồn (chữ / nói / viết thay nói), kết quả, 4 tiêu chí, lỗi, lý do `unscorable`, STT model + `audio_ms`. **Không** có chữ người học viết hay lời STT nghe được (server không lưu, E3). |
| K7 | Nghe lại bản ghi | Dùng lại route sẵn có `GET /v1/admin/users/:id/recordings/:recordingId/content` (đã `no-store`), **thêm** ghi log mỗi lần gọi thành công. Trình phát dùng `controlsList="nodownload"`, không có link tải. Bản ghi quá 30 ngày đã bị xóa (PR 13) → hiện "Đã xóa sau 30 ngày". |
| K8 | Thống kê gồm gì? | `GET /v1/admin/evaluation-stats?from&to` (mặc định 30 ngày): theo task (kèm bài / unit) số lượt, % `pass_independent`, % `pass_with_support`, % `fail`, % `unscorable`; 10 mã lỗi hay gặp (từ `evaluations.errors`); `unscorable` theo lý do; tổng phút âm thanh và chi phí ước tính = phút × đơn giá. Tính bằng SQL trên `evaluations`, không thêm bảng. |
| K9 | Đơn giá STT | Biến môi trường `STT_COST_PER_MINUTE_USD` (mặc định `0.003`, giá `gpt-4o-mini-transcribe` lúc viết plan). Không đưa vào `admin_settings` (là thông số vận hành, không phải luật học). |
| K10 | Nhãn kết quả trong preview (2.10) | Preview dùng đúng 4 kết quả của app: `pass_independent` "Đạt, tự làm được", `pass_with_support` "Đạt sau khi làm lại", `fail` "Chưa đạt", `unscorable` "Chưa chấm được", chưa làm "Chưa làm" (chữ tiếng Việt như app, vì preview là để xem như người học). Thay `independent / with_hint / not_yet` hiện có. |
| K11 | "Thử chấm" ở bước 5 (2.11) | ⚠️ **Route admin mới**: `POST /v1/admin/evaluations/preview-text` (`{target, text}`) và `POST /v1/admin/evaluations/preview-speech` (multipart, ≤ 45 s, chỉ khi `STT_PROVIDER` khác `none`). Chấm bằng đúng bộ chấm + ngưỡng hiện tại, trả `EvaluationPayload` (kèm lời STT nghe được, chỉ trong response). **Không ghi** `evaluations`, `recordings`, không tính vào giới hạn lượt; âm thanh chỉ ở trong bộ nhớ khi chấm. Bài chưa publish vẫn thử được (để admin thử trước khi publish). Mỗi lần thử nói ghi log `action = preview_speech` (có chi phí STT). |
| K12 | Ghi âm trong admin-web | `MediaRecorder` của trình duyệt (không thêm thư viện), dừng tự động ở 45 s. |
| K13 | Cảnh báo viết = 0% (B13) | Thêm cảnh báo unit `SKILL_WRITE_MISSING` khi unit có bài có thời lượng nhưng `write_sec = 0`; hiện cạnh `SKILL_BALANCE_OFF` trong trang unit. Chỉ cảnh báo, không chặn publish. |

---

## 3. Thiết kế

### 3.1 Migration 010 (⚠️)

```sql
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(40) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
```

`010_admin_settings.down.sql` xóa hai bảng. Prisma: thêm 2 model bằng tay (không chạy `prisma format` cả file, như PR 15).

### 3.2 Server

- `src/modules/admin/model/settings.ts`: schema zod của hai khóa (K3), giá trị mặc định.
- `src/modules/admin/repository/settingsStore.ts`: `get`, `update(key, value, requestId)` (cùng transaction ghi `admin_audit_log`), `listAudit(cursor)`.
- `src/modules/admin/service/evaluationSettings.ts`: `currentThresholds()` / `currentIntervals()` có cache 60 s; xóa cache khi admin lưu.
- Route (đều `requireAdminSession`, route ghi cần CSRF):
  - `GET /v1/admin/settings`, `PUT /v1/admin/settings/:key`
  - `GET /v1/admin/audit-log`
  - `GET /v1/admin/users/:id/evaluations`
  - `GET /v1/admin/evaluation-stats`
  - `POST /v1/admin/evaluations/preview-text`, `POST /v1/admin/evaluations/preview-speech`
- `evaluateUtterance` nhận ngưỡng mặc định qua tham số (hiện là hằng số); `itemMemory.ts` nhận mảng khoảng ôn qua tham số. Chỗ gọi lấy từ `evaluationSettings`.
- Route nghe lại sẵn có: thêm ghi log (K7).
- `specValidator.ts`: cảnh báo `SKILL_WRITE_MISSING` (K13).

### 3.3 admin-web

- Trang mới `EvaluationSettingsPage` (menu "Evaluation"): sửa ngưỡng và khoảng ôn, xem 20 dòng log mới nhất.
- `EvaluationStatsPage`: bảng theo task, lỗi hay gặp, `unscorable`, chi phí.
- `UserTabs.tsx`: tab `EvaluationsTab` (trình phát không có nút tải).
- Preview: `previewModel.ts` / `PracticeEntry.tsx` / `StepSummary.tsx` đổi nhãn (K10); bước 5 thêm `PreviewEvaluate` (ô chữ + ghi âm + kết quả).
- `api/client.ts`, `api/types.ts`: hàm và kiểu mới.

---

## 4. File

**Server – tạo:** `src/common/database/migrations/010_admin_settings{,.down}.sql`, `src/modules/admin/model/settings.ts`, `src/modules/admin/repository/settingsStore.ts`, `src/modules/admin/service/evaluationSettings.ts`, `src/modules/admin/controller/adminEvaluation.ts`, `src/modules/admin/repository/evaluationStatsStore.ts`, test `test/adminEvaluation.test.ts`, `test/adminSettings.test.ts`.

**Server – sửa:** `prisma/schema.prisma`, `src/modules/evaluation/model/evaluateUtterance.ts` (+ chỗ gọi), `src/modules/curriculum/outcomes/model/itemMemory.ts` (+ chỗ gọi), `src/modules/admin/controller/adminUsers.ts` (log nghe lại), `src/modules/curriculum/spec/service/specValidator.ts`, đăng ký route, danh sách `test:db` trong `package.json`, đếm OpenAPI.

**admin-web – tạo:** `routes/EvaluationSettingsPage.tsx`, `routes/EvaluationStatsPage.tsx`, `components/users/EvaluationsTab.tsx`, `components/preview/PreviewEvaluate.tsx`, test Vitest tương ứng, Playwright `e2e/evaluation-admin.spec.ts`.

**admin-web – sửa:** `App.tsx` (route), `AdminShell.tsx` (menu), `UserTabs.tsx`, `UserDetailPage.tsx`, `previewModel.ts`, `PracticeEntry.tsx`, `StepSummary.tsx`, `StepRunner.tsx`, `api/client.ts`, `api/types.ts`, chỗ hiện cảnh báo unit.

**Không thêm thư viện.** Không xóa file.

---

## 5. Kiểm thử

| Phần | Test |
|---|---|
| Migration | lên / xuống 010; `prisma migrate diff` rỗng |
| Cấu hình | 401 khi chưa đăng nhập, 403 thiếu CSRF, 400 giá trị sai (K3), lưu → có dòng log `{before, after}`; không có dòng → giá trị mặc định |
| Bộ chấm | ngưỡng mới làm đổi kết quả của một câu biên; ngưỡng riêng của task vẫn thắng; unit test `evaluateUtterance` nhận ngưỡng qua tham số |
| Khoảng ôn | đổi `[2,4,8,16,32]` → lần ôn kế tiếp dùng khoảng mới; `due_at` cũ không đổi |
| Lượt chấm | danh sách đúng user, phân trang, không lộ chữ / lời STT; user khác → 404 |
| Nghe lại | mỗi lần gọi thành công ghi 1 dòng log; 404 không ghi |
| Thống kê | số đếm và phần trăm trên dữ liệu seed; lọc ngày; chi phí = phút × đơn giá |
| Preview chấm | chữ: kết quả giống `POST /v1/evaluations/text` cho cùng câu, không ghi `evaluations`; nói: STT mock (`MOCK_TRANSCRIPT:`), log `preview_speech`, không ghi `recordings`; bài nháp chấm được |
| B13 | unit không có phần viết → `SKILL_WRITE_MISSING` |
| admin-web | Vitest cho 4 màn mới + nhãn preview; Playwright: sửa ngưỡng → thấy log; mở tab lượt chấm; thử chấm chữ ở bước 5 |

Cổng kiểm: server `yarn tsc`, `yarn lint`, `yarn test`, `yarn test:db`; `yarn admin-web:test`, Playwright `e2e/` (mức hiện tại không được tụt).

---

## 6. Thứ tự commit (server)

1. `feat(admin): settings and audit log tables (migration 010)` + store + route cấu hình + test.
2. `feat(evaluation): scorer and review schedule read admin settings`.
3. `feat(admin): learner evaluations and logged recording playback`.
4. `feat(admin): evaluation stats`.
5. `feat(admin): preview grading routes`.
6. `feat(curriculum): warn when a unit has no writing (B13)`.
7. `feat(admin-web): evaluation settings, stats and user evaluations`.
8. `feat(admin-web): preview uses app outcome labels and can grade step 5`.
9. `docs`: đánh dấu plan ĐÃ CODE, tick §6 (repo app).

---

## 7. Rủi ro

- ⚠️ **Migration 010** (chỉ thêm bảng, có down).
- ⚠️ **Đổi hành vi chấm khi admin sửa ngưỡng**: áp ngay cho lượt sau (cache ≤ 60 s), không chấm lại lượt cũ. Trang cấu hình ghi rõ.
- ⚠️ **Route admin mới gửi âm thanh tới OpenAI** (preview nói): chỉ admin, ghi log, không lưu file.
- Khoảng ôn lệch tạm thời giữa app và server khi đổi (K5).
- `controlsList="nodownload"` chỉ là rào nhẹ; đây là giới hạn của trình duyệt.

---

## 8. Bước tiếp theo

1. Bạn duyệt plan (đặc biệt **K1–K2** migration, **K5** đổi khoảng ôn, **K11** route thử chấm).
2. Duyệt xong: code theo §6 trên `claude/funny-archimedes-gmioda` (server).
