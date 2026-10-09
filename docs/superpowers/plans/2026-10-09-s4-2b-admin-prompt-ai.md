# S4.2b – Server + admin-web: trang "Prompt AI"

> Trạng thái: **CHỜ DUYỆT**. Ngày lập: 2026-10-09. Repo: `LingoBites-Server` (server + `admin-web`). Nhánh: `claude/affectionate-darwin-krszil`.
> Dựa trên thiết kế đã duyệt `2026-10-09-s4-ai-prompt-config-design.md` §6, §8, §9 (R1–R4). Backend kho prompt đã có từ S4.1 (`promptStore`, `promptRuntime`, `tryComposeVersion`, script `yarn ai-prompt`); S4.2b đưa các việc đó lên trang admin.

## 1. Mục tiêu và phạm vi

Admin xem, sửa, chạy thử, bật và quay lại phiên bản prompt `lesson.compose` **trên web**, không cần script hay deploy.

| Trong S4.2b | Ngoài S4.2b |
|---|---|
| Route `/v1/admin/ai-prompts/*`: danh sách, chi tiết, phiên bản, tạo / sửa bản nháp, lint, xem trước, chạy thử, kết quả chạy thử, bật / bật lại, ca mẫu, số liệu | Chia lưu lượng thử nghiệm (R5 – làm sau) |
| Trang admin "Prompt AI": danh sách, chi tiết + phiên bản + số liệu, sửa bản nháp, xem trước, chạy thử + so với bản active, ca mẫu | Chuyển prompt cũ (dịch, IPA, enrich, phân tích) vào kho (R6 – sau Stage 4) |
| Dọn `raw_output` của lượt chạy thử quá 30 ngày | Nút "Lưu thành ca mẫu" từ một request thật (K5) |
| Dòng "Đang sinh: N bài" trên trang unit (M3 còn nợ của S4.2, K6) | |

Không thêm dependency, **không thêm migration** (dùng các bảng của migration 007).

## 2. Quyết định cần chốt (dùng cột Đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| K1 | Chạy thử 6 ca với AI thật có thể mất vài phút; HTTP không chờ được | Bấm "Chạy thử" → server chạy **nền** trong tiến trình, trả 202 ngay; trang poll kết quả từng ca (ca nào xong hiện ca đó). Mỗi phiên bản chỉ một lượt chạy thử cùng lúc. Server khởi động lại giữa chừng thì lượt đó dừng, các ca đã xong vẫn còn, bấm chạy lại. |
| K2 | Giới hạn chạy thử (R3: 10 lần / giờ) | Đếm **lượt chạy** (một lần bấm) trong 60 phút qua theo `ai_prompt_runs`; vượt → 429. Tính vào trần chi phí tháng như S4.1. |
| K3 | Số liệu theo phiên bản (§8) | Lấy từ `lesson_creation_requests` theo `prompt_version_id`: số lượt, tỷ lệ "không phù hợp", tỷ lệ gọi lại (`ai_calls > 1`), tỷ lệ hỏng (`COMPOSE_AI_INVALID` / `COMPOSE_SPEC_INVALID`), thời gian p50 / p95, kèm cờ vượt ngưỡng. **Không có số token** (token chỉ nằm trong log, thêm cột thì cần migration). |
| K4 | Dọn `raw_output` > 30 ngày (§10) | Dọn **mỗi lần bắt đầu chạy thử** (một câu `UPDATE … SET raw_output = NULL`), không thêm cron. |
| K5 | "Lưu thành ca mẫu" từ request thật | Chưa làm: request chỉ lưu id câu, tạo ca phải đọc lại câu của người học. Admin thêm ca bằng form (dán JSON đầu vào hoặc chọn bài + câu). |
| K6 | M3 "Đang sinh: N bài" trên trang unit | Làm luôn (nhỏ): đếm request compose admin đang chạy của unit, hiện trên trang unit, tự làm mới khi còn > 0. |
| K7 | So với bản active (§6) | Không gọi AI thêm: hiện kết quả chạy thử **gần nhất** của bản active trên cùng ca, cạnh kết quả bản nháp. |
| K8 | Ca mẫu: xoá được không | Không xoá (giống phiên bản); chỉ bật / tắt và sửa. |

## 3. Server

Route mới (đều sau phiên admin; route ghi có CSRF; log `admin_actor`, không log nội dung prompt):

| Route | Việc |
|---|---|
| `GET /v1/admin/ai-prompts` | Danh sách key trong `PROMPT_REGISTRY`: mô tả, bản active (số, ngày bật, người bật), số bản nháp, số liệu tóm tắt của bản active |
| `GET /v1/admin/ai-prompts/:key` | Chi tiết: các phiên bản (số, trạng thái, người tạo, ghi chú, ngày), số liệu mỗi bản (K3), danh sách model cho phép, trần tham số (`paramsSchema` → min / max để form hiển thị), tên biến hợp lệ |
| `GET /v1/admin/ai-prompts/versions/:id` | Nội dung một bản (`PromptContent`), lint, kết quả chạy thử gần nhất từng ca |
| `POST /v1/admin/ai-prompts/:key/versions` | Tạo bản nháp từ bản `from_version_id` (hoặc bản mặc định trong code); lỗi lint → 400 kèm danh sách lỗi |
| `PATCH /v1/admin/ai-prompts/versions/:id` | Sửa bản nháp; bản đã bật / đã nghỉ → 409 `PROMPT_VERSION_LOCKED` |
| `POST /v1/admin/ai-prompts/:key/lint` | Lint nội dung đang gõ (không lưu) → `{ errors, warnings, token_estimate }` |
| `POST /v1/admin/ai-prompts/versions/:id/preview` | Render system / user với một ca mẫu (không gọi AI) + ước lượng token |
| `POST /v1/admin/ai-prompts/versions/:id/try` | Bắt đầu chạy thử nền (K1, K2) → 202; đang chạy → 409; vượt giới hạn → 429 |
| `GET /v1/admin/ai-prompts/versions/:id/runs` | Kết quả chạy thử gần nhất mỗi ca + cờ `running` + kết quả bản active cùng ca (K7) |
| `POST /v1/admin/ai-prompts/versions/:id/activate` | Bật / bật lại (rollback); chưa pass hết ca mà không có `override_reason` → 409 `PROMPT_RUNS_NOT_PASSING` kèm ca lỗi; xong thì `runtime.invalidate()` để cache 60 giây không giữ bản cũ |
| `GET` / `POST /v1/admin/ai-prompts/:key/cases`, `PATCH /v1/admin/ai-prompts/cases/:id` | Ca mẫu: danh sách, thêm, sửa, bật / tắt (input kiểm theo biến của prompt; `expect` kiểm theo `ComposeCaseExpect`) |
| `GET /v1/admin/units/:id/compose-running` | Số request compose admin đang chạy của unit (K6) |

| File | Thay đổi |
|---|---|
| `src/modules/aiPrompts/controller/aiPromptRoutes.ts` (mới) | Các route trên |
| `src/modules/aiPrompts/service/promptAdminService.ts` (mới) | Ghép store + spec + runtime; chạy thử nền (map `versionId → Promise` trong tiến trình); lint / preview |
| `src/modules/aiPrompts/repository/promptStore.ts` | Thêm `listPrompts`, `latestRuns(versionId)`, `runsInLastHour`, `createCase`, `updateCase`, `clearOldRawOutput`; `metricsFor(versionIds)` (SQL `percentile_cont`) |
| `src/modules/curriculum/composer/prompts/composePromptSpec.ts` | Xuất mô tả form (trần tham số, biến) cho route chi tiết |
| `src/app/server.ts` | Đăng ký route; dùng chung `promptRuntime` với compose service để `invalidate()` có tác dụng |
| `src/modules/admin/service/adminCourseWeb.ts` | Thêm đường dẫn SPA `/ai-prompts`, `/ai-prompts/:key`, `/ai-prompts/versions/:id` |
| `scripts/ai-prompt.ts` | Giữ nguyên (vẫn dùng được) |

⚠️ **Đổi API public:** chỉ thêm route admin (OpenAPI tăng khoảng 13 path / 15 operation); không đổi route người học.

## 4. Admin-web

| Chỗ | Thay đổi |
|---|---|
| Menu `AdminShell.tsx` | Mục "Prompt AI" |
| `routes/AiPromptListPage.tsx` (mới) | Bảng prompt: key, mô tả, bản active, ngày bật, số liệu tóm tắt |
| `routes/AiPromptDetailPage.tsx` (mới) | Bảng phiên bản + số liệu (cờ đỏ khi vượt ngưỡng §8); nút "Tạo bản mới từ bản này", "Bật lại"; tab Ca mẫu |
| `routes/AiPromptVersionPage.tsx` (mới) | Bản nháp: 3 ô system / user / retry (đếm ký tự, liệt kê biến dùng được, lint khi gõ – gọi route lint có debounce), form `params` có min / max, chọn model trong danh sách cho phép, temperature, max tokens, ví dụ (JSON, kiểm ngay), ghi chú bắt buộc. Bản đã khoá: chỉ đọc. Tab "Xem trước" (chọn ca → prompt đã render + ước lượng token). Tab "Chạy thử" (từng ca: pass / fail / error, lỗi, token, thời gian, JSON AI trả về; cột bản active bên cạnh). Nút "Bật" (hộp xác nhận; khi chưa pass hết thì bắt nhập lý do). |
| `components/aiPrompts/*` (mới) | `PromptTemplateField`, `PromptParamsForm`, `PromptRunTable`, `PromptCaseEditor`, `PromptMetricsCells` |
| `routes/UnitEditPage` (hoặc trang unit hiện có) | Dòng "Đang sinh: N bài" (K6) |
| `api/types.ts`, `api/client.ts` | Kiểu + hàm gọi các route trên |
| `App.tsx` | 3 route mới |

Chỉ tài khoản có quyền ghi (`canMutate`) mới thấy nút tạo / sửa / chạy thử / bật.

## 5. Kiểm thử

| Repo | Nội dung |
|---|---|
| Server DB `aiPromptRoutes.test.ts` | Danh sách / chi tiết; tạo nháp từ bản active; sửa nháp; sửa bản active → 409; lint lỗi → 400 có danh sách lỗi; preview không gọi AI; chạy thử (AI giả lập) → 202, poll tới khi xong, có kết quả từng ca; chạy trùng → 409; quá 10 lần / giờ → 429; bật khi chưa pass → 409, có lý do → được; bật lại bản cũ (rollback) và runtime đổi bản ngay; ca mẫu thêm / sửa / tắt; số liệu từ request compose giả; dọn `raw_output` cũ; đếm "đang sinh" theo unit; route cần phiên admin + CSRF |
| Server unit | Số path / operation OpenAPI; đường dẫn SPA mới |
| Admin Vitest | Danh sách; chi tiết + số liệu + cờ ngưỡng; form sửa (lint hiển thị lỗi, params ngoài min / max, ví dụ JSON sai); xem trước; chạy thử (API giả lập, poll); bật cần lý do khi chưa pass; rollback; ca mẫu; trang unit "Đang sinh" |
| Playwright | Mở "Prompt AI" → tạo bản nháp từ v1 → sửa ghi chú → chạy thử (mock AI) → bật → bật lại v1 |

Lệnh: `yarn test`, `yarn test:db`, `yarn typecheck`, `yarn format`, `yarn admin-web:test`, Playwright `e2e/`.

## 6. Thứ tự commit

1. `feat(ai-prompts): admin routes for prompts, versions, lint and preview`.
2. `feat(ai-prompts): background try-runs, activation and rollback over HTTP`.
3. `feat(ai-prompts): golden cases and per-version metrics`.
4. `feat(admin-web): Prompt AI list, detail and version editor`.
5. `feat(admin-web): try-run and activation; unit "Đang sinh" line`.
6. `test(e2e): edit, try and activate a prompt version`.
7. `docs: S4.2b results and progress`.

## 7. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Admin bật bản prompt kém → bài sinh ra kém | Cổng R2 (pass hết ca mẫu hoặc ghi lý do), số liệu cạnh từng bản, "Bật lại" một nút. |
| Chạy thử tốn tiền | 10 lần / giờ, tính vào trần tháng; mock khi `AI_PROVIDER=mock`. |
| Chạy thử nền mất khi server khởi động lại | Ca đã xong vẫn lưu; trang báo "đã dừng", bấm chạy lại. |
| Nhiều instance server: cờ "đang chạy" nằm trong bộ nhớ | Hiện chỉ một instance; nếu thêm instance thì chuyển sang hàng đợi (ghi vào backlog). |
