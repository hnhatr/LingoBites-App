# Kế hoạch làm phần còn lại (file ghi nhớ)

> Lập ngày 2026-10-08. **Đây là file mở đầu khi quay lại làm tiếp.** Đọc file này trước, rồi mới mở các file chi tiết.
> - Danh sách đầy đủ theo độ ưu tiên: `2026-10-08-backlog-remaining-work.md`.
> - Thiết kế chốt cho âm thanh và chấm bài: `2026-10-08-stage3-audio-evaluation-analysis.md`.
> - Plan tổng: `2026-10-07-backward-design-curriculum-plan.md`. Lộ trình 8 bước: `2026-10-07-learning-cycle-requirements-roadmap.md`.
>
> Cập nhật mục 6 "Theo dõi tiến độ" mỗi khi xong một việc. Mục 5 "Bảng chốt" là nơi team ghi quyết định; ô trống thì dùng đề xuất.

---

## 1. Đang ở đâu

| Hạng mục | Trạng thái |
|---|---|
| Stage 0–2 (PR 1–11): đặc tả bài, item, task, hoạt động, player 6 bước, gợi ý, vận dụng độc lập | ✅ Đã merge vào `develop` (server #114, app #221) |
| Stage 3: âm thanh, chấm bài, đạt bài, ghi nhớ, ôn | ⏳ Thiết kế đã chốt, **chưa code** |
| Stage 4: video / text / OCR / ảnh → bài 6 bước | ⏳ Đã mô tả, chưa có plan chi tiết |
| Stage 5: tình huống / ảnh → bài 6 bước | ⏳ Đã mô tả; phần ảnh có thiết kế ở `2026-10-10-stage5-9-image-lesson-game-hub.md`, chưa có plan chi tiết |
| Stage 6–9: Game Hub + 3 nhóm game (hỏi–đáp, ghép / sắp xếp, nghe) | ⏳ Có thiết kế (cùng file), chưa có plan chi tiết |
| Bước 1 (hồ sơ, đầu vào), Bước 7 (báo cáo, phụ huynh), nhóm 8.x | ⏳ Chưa bắt đầu |

**Nhánh:**
- Nền phát triển là **`develop`**. **Không merge vào `main`** (bản ổn định).
- Nhánh làm việc của cả hai repo: `claude/optimistic-bell-mfgk44` (PR 1–11), từ Giai đoạn 1 là `claude/funny-archimedes-gmioda`, tạo từ `develop`.
- Khi PR trước đã merge, tạo lại nhánh từ `develop` mới nhất rồi làm tiếp.

---

## 2. Cách làm mỗi PR (giữ nguyên quy trình đã dùng cho PR 1–11)

1. Viết plan chi tiết `docs/superpowers/plans/<ngày>-prNN-<tên>.md` (repo app). Plan gồm:
   - file tạo / sửa / xoá;
   - các bước làm;
   - test;
   - dependency mới, nếu có.
2. **Chờ duyệt** ("ok") rồi mới code.
3. Code theo commit nhỏ. Trước khi push, chạy các bước kiểm (mục 2.1).
4. Push lên nhánh làm việc hiện tại (mục 1).
5. Đánh dấu plan **"ĐÃ CODE"**, thêm mục **"Điểm lệch so với plan"**.
6. Ghi vào báo cáo phiên `.ai-logs/reports/<session_id>.md`.
7. Mở pull request vào `develop` khi được yêu cầu.

**Luật cần nhớ:**
- Không thêm thư viện khi chưa hỏi.
- Không xoá code hoặc file khi chưa được duyệt.
- Không sửa file `.env`.
- Không force push.
- Không hardcode key.
- Cảnh báo rõ khi có migration hoặc khi đổi API public.

### 2.1 Các bước kiểm trước khi push

| Repo | Lệnh | Mức hiện tại |
|---|---|---|
| App | `yarn tsc`, `yarn lint` (ngân sách warning), `yarn format:check`, `yarn test` | lint 178/281, Jest 2198 pass |
| Server | `yarn test` (unit), `yarn test:db` | unit 431, db 245 |
| Admin | `yarn admin-web:test` (Vitest), Playwright `e2e/` | Vitest 160, Playwright 16/16 |

**Chạy local:** xem Phụ lục A của backlog. Sau khi đổi nhánh server **phải** chạy `yarn prisma generate`. Nếu không, `seed` sẽ lỗi `reading 'findUnique'`.

---

## 3. Thứ tự làm

```
Giai đoạn 0  Test tay develop, sửa lỗi
     │
Giai đoạn 1  Stage 3: PR 12 → 13 → 14  (chấm bài)
     │                 PR 15 → 16 → 17  (đạt bài, ghi nhớ, admin)
     │
Giai đoạn 2  Ra sản phẩm: Bước 0 (cấu hình), soạn nội dung, Bước 1 (hồ sơ + đầu vào)
     │
Giai đoạn 3  Stage 4: S4.1 → S4.2 → S4.3 (S4.4 chuyển sang Stage 5, phần ảnh)
     │
Giai đoạn 4  Stage 5: S5.1 → S5.2 → S5.3 → S5.4 → S5.5
     │                 phần ảnh: S5.6 → S5.7 → S5.8 → S5.9
     │
Giai đoạn 4b Stage 6: Game Hub → Stage 7: hỏi–đáp → Stage 8: ghép / sắp xếp → Stage 9: nghe
     │
Giai đoạn 5  Bước 7 (báo cáo, phụ huynh), kinh doanh, push, các mục 8.x, dọn dẹp
```

PR 15 chỉ cần PR 12, nên có thể làm song song với PR 13–14 nếu có hai người.

---

## 4. Chi tiết từng giai đoạn

### Giai đoạn 0 – Test tay bản `develop`

| Việc | Ai | Xong khi |
|---|---|---|
| Thử app trên **máy thật** theo bảng "Danh sách cần thử" ở Phụ lục A của backlog. Trọng tâm: ghi âm, nghe lại, TTS, quyền micro. Đây là các phần test tự động chưa kiểm được. | Team | Đã đi hết bảng; lỗi ghi kèm thiết bị, bước, thao tác, ảnh |
| Thử admin-web: soạn bài, sinh nháp, preview 6 bước, publish, bảng 70/25/5. | Team | Như trên |
| Sửa lỗi tìm được. Kèm hai lỗi có sẵn của server: lint `test/ipa.test.ts:84`, test cascade trong `test/adminContentDelete.test.ts`. | Code | Kiểm xanh, lỗi đóng |
| ⚠️ Migration staging: `db:reset:staging` + `seed:sample-unit:staging`. **Mất dữ liệu cũ.** App SQLite v7 → v8. | Team + Code | Staging chạy được unit mẫu |

### 4.1 Phần viết trong unit mẫu (đã thêm 2026-10-08)

Trước đây cả 3 bài mẫu chỉ có nói và nghe. Seed (`scripts/sampleUnit/content.ts`, repo server) nay có thêm:

| Bài | Bước | Hoạt động viết |
|---|---|---|
| L02 | 4 | `translation` "Viết câu gọi đồ uống": dịch 2 câu Việt → Anh theo mẫu `Can I have a {size} {drink}, please?` (60 giây, kỹ năng `write`) |
| L03 | 5 | Nhiệm vụ độc lập **viết**: "Nhắn tin gọi đồ ăn" (`response_mode = write`, kỹ năng `write`); app hiện ô nhập thay cho ghi âm |

- Tỷ lệ kỹ năng của unit sau khi thêm: nói ~63% / nghe ~27% / viết ~10%, vẫn trong ngưỡng 70/25/5 ± 10.
- Seed **không ghi đè** bài đã có. Muốn thấy nội dung mới trên DB local phải `yarn db:reset` rồi `yarn seed:sample-unit`. ⚠️ Lệnh reset xoá sạch DB local.
- Hiện thiếu viết **không bị cảnh báo** (0% vẫn nằm trong dung sai). Nếu muốn bắt buộc có phần viết thì làm trong PR 17 (admin chỉnh tỷ lệ).

### Giai đoạn 1 – Stage 3: âm thanh và chấm bài (6 PR)

Hướng làm đã chốt, xem đầy đủ trong `2026-10-08-stage3-audio-evaluation-analysis.md`. Tóm tắt:
- **OpenAI chỉ làm speech-to-text** (nghe → ra chữ). **Việc chấm do bộ chấm của LingoBites trên server** làm theo luật, không dùng AI. Nhận dạng nằm sau cổng `SpeechToText`, đổi nhà cung cấp chỉ cần thêm adapter.
- Chấm 4 tiêu chí: content 0.80, clarity 0.60, purpose = đủ item bắt buộc, independence = không dùng gợi ý.
- **Không** chấm âm vị.
- Chỉ chấm **bước 5** và **nhiệm vụ tổng hợp của unit**.
- `unscorable` không tính là sai.
- Bản ghi xoá sau 30 ngày; không lưu transcript.
- Tối đa 30 lượt chấm / user / ngày.
- Toàn bộ nằm sau flag `speechEvaluation`, mặc định tắt.

#### PR 12 – Server: bộ chấm + kết quả (chưa có âm thanh)

- **Làm được ngay**, không cần gì từ team.
- **Phạm vi:**
  - hàm thuần `evaluateUtterance` và so khớp theo từ (dùng `normalizeAnswer` sẵn có);
  - migration `007`: bảng `evaluations`;
  - `POST /v1/evaluations/text` (câu viết, không lưu chữ);
  - `GET /v1/evaluations/:attemptId`;
  - sync nhận lượt `outcome = pending`, `assessed_by = service`; collection pull `evaluations`;
  - lượt **viết thay nói** (A13): chấm như câu viết, lưu `source = text` kèm đánh dấu `substitute = true`.
- **Test:**
  - bảng câu đúng / sai / thiếu / có lỗi `blocking` / có lỗi `tolerated`;
  - route;
  - DB.
- **Dữ liệu test câu viết:** nhiệm vụ bước 5 của **bài L03** "Nhắn tin gọi đồ ăn" (`response_mode = write`, mẫu `pattern:can-i-have-food`). Seed mẫu đã có từ 2026-10-08, xem mục 4.1.
- **Xong khi:** gửi tin nhắn viết ở bước 5 bài L03 thì nhận về kết quả đúng luật chấm (§3.2 của file thiết kế). Thử cả câu đúng ("Can I have a sandwich, please?"), câu thiếu món, câu sai mẫu.
- ⚠️ Có migration; contract sync thay đổi (app cần cập nhật schema ở PR 14).

#### PR 13 – Server: âm thanh vào server

- **Cần trước:** PR 12, **API key OpenAI** (T1).
- **Phạm vi:**
  - recordings thêm mode `lesson_task` + `attempt_id` / `block_id` / `evaluate_by` (migration);
  - cổng `SpeechToText` với adapter `openai` (mặc định `gpt-4o-mini-transcribe`) + `mock`. Adapter `google` chỉ viết nếu team muốn so khi đo (A1);
  - env `STT_PROVIDER` / `STT_MODEL` / `STT_API_KEY`;
  - job `evaluation` (retry 2 lần);
  - `EVAL_DAILY_LIMIT`; chống chấm lại cùng file bằng SHA-256;
  - trần phút STT mỗi tháng `STT_MONTHLY_BUDGET_MINUTES` (A15): 80% cảnh báo admin, 100% chuyển về tự đánh giá;
  - job dọn bản ghi sau 30 ngày;
  - script đo độ chính xác;
  - flag `speechEvaluation`.
- **Test:**
  - job với STT mock;
  - giới hạn lượt;
  - dọn bản ghi;
  - test tích hợp OpenAI tắt mặc định.
- **Xong khi:** upload file `.m4a` thì có `evaluations` trong khoảng 20 giây (STT mock); script đo chạy được trên bộ mẫu.
- **Trước khi bật flag:** chạy script trên ~40 bản ghi có nhãn (T2). Phải đạt ngưỡng A3 (mục 5.2): **chấm oan dưới 10%**, chấm lọt dưới 15%.

#### PR 14 – App: chấm bước 5

- **Cần trước:** PR 12–13, câu consent đã duyệt (T4).
- **Phạm vi:**
  - ghi âm AAC mono 16 kHz ~32 kbps;
  - consent "Chấm bài nói bằng máy" (`speaking.evaluation_consent`), **tách riêng** consent tải bản ghi hiện có (`speaking.recording_upload_consent`). Nội dung theo T4. Từ chối thì hỏi lại tối đa 1 lần / 7 ngày (A12). Bật / tắt được trong Cài đặt;
  - `IndependentTaskView`: có consent thì "Gửi chấm", không có thì giữ tự đánh giá (ghi âm và nghe lại trên máy, không gửi đi);
  - nút **"Không nói được lúc này"** (A13): tắt hoạt động nói ở bước 3–4 trong 15 phút; bước 5 chuyển sang viết và gửi chấm như câu viết;
  - giữ file cho hàng đợi upload (mode `lesson_task`);
  - màn "Đang chấm…" (hỏi kết quả mỗi 2 giây, tối đa ~20 giây);
  - phản hồi 4 trạng thái;
  - nhận `evaluations` qua sync pull;
  - schema sync: `pending`, `service`, `recording_client_id`.
- **Gộp việc nợ:**
  - task `response_mode = choose` (2.8);
  - ghi âm từng lượt trong nhập vai (2.9).
- **Xong khi:** trên máy thật, ghi âm bước 5 → nhận kết quả đúng. Tắt mạng thì kết quả về sau qua sync.

#### PR 15 – Server: đạt bài, đạt unit, ghi nhớ

- **Cần trước:** PR 12; khoảng ôn đã chốt (T3); Q7.
- **Phạm vi:**
  - `lesson_outcomes.passed_at`: xong phần luyện + bước 5 `pass_independent` (máy chấm, hoặc tự đánh giá có ghi `assessed_by = self`, theo B3). Lượt **viết thay nói** (A13) chưa tính là đạt bài. Bỏ qua bước 5 thì bài dừng ở "đã xong phần luyện" (A14);
  - bảng `unit_outcomes`;
  - `item_memory` + lịch ôn 1–3–7–14–30;
  - pull về app;
  - nhiệm vụ tổng hợp **chặn** publish unit (2.12).
- **Xong khi:** quên một item **không** xoá trạng thái đã đạt bài; lượt `unscorable` không làm trượt.
- ⚠️ Có migration.

#### PR 16 – App: kết quả, tiến độ, ôn

- **Cần trước:** PR 15.
- **Phạm vi:**
  - bước 6 hiện "đạt bài";
  - tiến độ unit "đã học / đã đạt";
  - màn nhiệm vụ tổng hợp;
  - ôn theo item;
  - Today đọc `item_memory`;
  - lượt kéo về từ máy khác ghi "complete" dựa vào `lesson_outcomes` (2.7).
- **Xong khi:** unit mẫu đi trọn vòng **Học → Vận dụng → Đánh giá → Ghi nhận → Ôn**. Đây là điều kiện xong Stage 3.

#### PR 17 – Admin

- **Cần trước:** PR 12–15.
- **Phạm vi:**
  - cấu hình ngưỡng và khoảng ôn;
  - xem lượt làm + kết quả chấm, nghe lại bản ghi trong 30 ngày;
  - thống kê tỷ lệ đạt, lỗi hay gặp;
  - preview admin thống nhất nhãn kết quả (2.10), có ghi âm và chấm (2.11).

### Giai đoạn 2 – Để ra sản phẩm

| Việc | Ai | Ghi chú |
|---|---|---|
| **Bước 0 – chốt cấu hình** (3.1):<br>- danh mục trình độ;<br>- nội dung bắt buộc từng bài;<br>- cách áp 70/25/5;<br>- quyền phụ huynh / giáo viên;<br>- quy tắc thưởng;<br>- các gói. | Team | Chặn Bước 1, Bước 7, kinh doanh |
| **Soạn nội dung thật** (3.2): đủ course → level → unit → lesson. Hiện mới có unit "Gọi đồ uống". | Team | Dùng "Sinh nháp từ mẫu câu"; sau Stage 4 dùng "Sinh bài 6 bước" |
| **Bước 1 – Hồ sơ người học + kiểm tra đầu vào** (3.3), khoảng 2–3 PR:<br>- nhóm đối tượng, trình độ, mục tiêu, sở thích;<br>- onboarding + bài kiểm tra ngắn;<br>- course gắn đối tượng;<br>- consent phụ huynh để trẻ dùng chấm máy. | Code | ⚠️ Migration, đổi API profile; cần Q6 |

### Giai đoạn 3 – Stage 4: video / text / OCR / ảnh → bài 6 bước

Bộ sinh chung `lessonComposer` cho ra bài **qua validator** (0 vi phạm spec-check). Đầu ra gồm:
- đặc tả;
- item + 1–2 mẫu câu;
- task + tiêu chí;
- hoạt động bước 2–4 (bộ sinh nháp PR 8);
- bước 2 là câu / đoạn gốc;
- bước 5 nhập vai đổi chi tiết.

Nội dung không có tình huống giao tiếp thì giữ dạng hub.

**Phương án chốt 2026-10-09: "chọn câu → bài 6 bước".** Người dùng chọn 2–8 câu trong một bài. Server sinh **một bài mới** liên kết về bài gốc, chỉ gọi AI **1 lần** (dịch / IPA lấy lại từ DB, hoạt động bước 2–4 sinh theo luật). Item AI tạo được tự publish, có `reviewed_at` để admin rà. Enrich lúc tạo bài giữ bật (tắt được bằng env `CREATION_ENRICH_ENABLED=false`); composer dùng lại phân tích đã lưu. Plan chi tiết:
- `2026-10-09-s4-1-server-lesson-composer.md`
- `2026-10-09-s4-2-admin-compose-six-step.md`
- `2026-10-09-s4-3-learner-compose-six-step.md`

| PR | Repo | Nội dung | Xong khi |
|---|---|---|---|
| S4.1 | server | `lessonComposer` lõi + test bằng AI mock và fixture. **Dùng lại** kết quả dịch / phân tích từ, ngữ pháp / IPA mà luồng tạo bài hiện có đã sinh, hoặc gộp vào cùng một lần gọi AI. Không gọi AI phân tích lại câu. | Bài mẫu qua validator; số lần gọi AI mỗi bài ghi trong plan S4.1 |
| S4.2 | server + admin | Nút "Sinh bài 6 bước" trên bài từ text / YouTube / bài nhận từ người học. Kết quả là **bài nháp**; bước 2 phát đúng đoạn video. | Admin sửa được rồi publish |
| S4.3 | server + app | Bài tự tạo có nút "Học theo 6 bước". Snapshot trả `lesson_items` / spec / tasks. Bỏ điều kiện `origin = admin` của `isFlowLesson`. Gộp hub bài tự tạo (4.7). | Người học chạy trọn 6 bước trên bài tự tạo |
| S4.4 | — | Chuyển sang Stage 5, phần ảnh (S5.6–S5.9) | — |

- **Cần trước:** Giai đoạn 0 xong; Q5, Q8, Q9, Q11.
- **Nên làm sau Stage 3**, để bước 5 được chấm thật.

### Giai đoạn 4 – Stage 5: tình huống / ảnh → bài 6 bước

| PR | Repo | Nội dung | Cần trước |
|---|---|---|---|
| S5.1 | server + admin | Danh mục tình huống chuẩn (có nhãn trình độ, đối tượng); gắn nhãn cho bài hiện có | Q10 |
| S5.2 | app | Màn "Học theo tình huống": duyệt, tìm, mở bài có sẵn | S5.1 |
| S5.3 | server + app + admin | Sinh bài từ tình huống (chọn hoặc tự gõ): AI viết hội thoại mẫu, `lessonComposer` sinh phần còn lại, ưu tiên item có sẵn | S4.1 |
| S5.4 | app + server | Gợi ý tình huống theo mục tiêu / sở thích | Bước 1 |
| S5.5 | app + server | Luyện lại tình huống: chỉ bước 5 / nhiệm vụ tổng hợp, đổi chi tiết, theo lịch ôn | PR 15 |

**Xong khi:** người học chọn hoặc gõ một tình huống, nhận bài 6 bước đúng trình độ và học trọn được. Admin sinh được bài nháp từ tình huống.

**Phần ảnh** (thiết kế: `2026-10-10-stage5-9-image-lesson-game-hub.md` §2):

| PR | Repo | Nội dung | Cần trước |
|---|---|---|---|
| S5.6 | server + app | Endpoint media cho người học (ảnh / audio của bài, tải offline) | — |
| S5.7 | server | Nguồn `learner_image`: upload, kiểm duyệt, vision → văn bản nguồn, pipeline + `lessonComposer`, task "tả lại bức ảnh", job, giới hạn lượt | S5.3, Q12–Q15 |
| S5.8 | app | "Tả bức ảnh" trong luồng Tạo bài; chọn trình độ / mục tiêu; hub bài hiện ảnh | S5.6, S5.7 |
| S5.9 | server + admin | Admin xem / nhận về bài sinh từ ảnh, xem lượt bị từ chối | S5.7 |

**Xong khi:** chụp một ảnh ra được bài đúng trình độ có ảnh, đoạn đọc, từ vựng, mẫu câu, nhiệm vụ viết / nói; ảnh không phù hợp bị từ chối, không tính lượt.

### Giai đoạn 4b – Stage 6–9: Game Hub và 3 nhóm game

Thiết kế: `2026-10-10-stage5-9-image-lesson-game-hub.md` §3–4. Chỉ app; không migration, không sửa server (`activity_attempts` đã nhận `kind = 'game'`).

| PR | Repo | Nội dung | Cần trước |
|---|---|---|---|
| S6 | app | Game Hub: `features/games`, contract hai mức, registry theo flag, host ghi attempt + kết quả chung, `GameHubScreen`, route + intent, test chung | M1, M2 |
| S7 | app | Hỏi–đáp theo lượt: chọn nghĩa, điền chỗ trống, đúng / sai; hoạt động `game` trong Today | S6 |
| S8 | app | Sắp xếp, ghép cặp: ghép từ–nghĩa, xếp câu, kéo thả mẫu câu | S6 |
| S9 | app | Nghe: nghe TTS rồi chọn / gõ | S6 |

**Xong khi (mỗi stage):** chơi được offline với bài đã tải, item đến hạn, thẻ đã lưu; kết quả lên server; từ sai lưu được thành flashcard.

### Giai đoạn 5 – Mở rộng và dọn dẹp

| Việc | Ghi chú |
|---|---|
| **Bước 7 – Báo cáo + phụ huynh / giáo viên** (3.5), khoảng 3–4 PR | Cần Stage 3, Bước 0 |
| **Kinh doanh 8.6**: thuê bao, gói gia đình, referral, thanh toán store | ⚠️ Dependency thanh toán, cần duyệt |
| **Push từ server 8.7**: dẫn tới bài / lượt ôn đến hạn | Cần PR 15 |
| 8.1 sửa phát âm, tốc độ nghe · 8.2 động lực gắn "đạt bài" · 8.3 mini game (flag đã có, chưa UI), nhập vai AI · 8.4 nguồn mới · 8.5 quản lý việc học · vận hành | Làm dần theo ưu tiên sản phẩm |
| Dọn dẹp:<br>- xoá khoá i18n `lessonFlow.show_model*` (cần duyệt);<br>- giữ đồng bộ 3 bản `acceptedAnswers` bằng fixture;<br>- `getDueFlashcardsByItemKeys` chuyển sang SQL;<br>- giảm warning lint;<br>- ma trận lặp item cấp level;<br>- kiểm tra route cũ `/v1/ai/analyses` (module `aiAnalysis`, pipeline nhiều giai đoạn): chưa thấy app / admin gọi tới. Xác nhận không còn client nào dùng, rồi **xoá khi được duyệt** (E5). | Không gấp |

---

## 5. Bảng chốt (team điền trước khi làm)

**Cách dùng:**
- Mỗi dòng là một điều sẽ phải hỏi khi code. Cột **"Đề xuất"** là phương án tôi khuyên.
- Team ghi vào cột **"Chốt"**: `OK` (theo đề xuất) hoặc ghi phương án khác.
- **Ô "Chốt" còn trống lúc bắt đầu PR thì dùng "Đề xuất"**, không dừng lại để hỏi. Ghi lại phương án đã dùng vào phần "điểm lệch" của plan PR.
- Dòng có ⚠️ là việc chỉ team cung cấp được (key, dữ liệu, chữ pháp lý). Thiếu thì PR vẫn code được, nhưng chưa bật cho người dùng.

### 5.1 Dữ liệu và đầu vào team cung cấp

| # | Cần gì | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| T1 ⚠️ | API key OpenAI cho STT (đặt trong env server, không đưa vào repo) | Dùng chung `AI_API_KEY` hiện có | PR 13 | |
| T2 ⚠️ | ~40 bản ghi mẫu có nhãn "người chấm: đạt / chưa": **bộ đề kiểm tra máy chấm**, không dùng để huấn luyện AI (xem mục 5.7.1) | 20 người lớn + 20 trẻ em trên bài L01, chia 4 nhóm: đúng rõ / đúng nhưng ấp úng / sai mẫu, thiếu món / lạc đề, im lặng, ồn. Thêm 10 câu viết cho L03. Kèm bảng nhãn. | Bật flag sau PR 13 (PR 12–13 code được khi chưa có) | OK – 2026-10-08 |
| T4 ⚠️ | Câu consent "Chấm bài nói bằng máy" + mục giọng nói trong chính sách quyền riêng tư + khai báo dữ liệu trên store (xem mục 5.7.2) | Câu consent ở mục 5.7.2; bên xử lý: OpenAI; xoá sau 30 ngày; người hiểu luật xem lại trước khi phát hành | PR 14 (câu consent); bật flag (chính sách, store) | OK – 2026-10-08 (câu chữ team có thể sửa) |
| T5 ⚠️ | Người duyệt nội dung (ai bấm publish bài / unit) | 1 người phụ trách nội dung; dev không publish nội dung thật | Giai đoạn 2 | |

### 5.2 Stage 3 – chấm bài (PR 12–14)

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| A1 | Nhà cung cấp và model STT | **OpenAI `gpt-4o-mini-transcribe`** (~$0.003/phút, nhận thẳng `.m4a`). Khi đo bằng bộ T2 chạy thêm `gpt-4o-transcribe`; chỉ chuyển nếu bản mini chấm oan ≥ 10%. Google Speech-to-Text chế độ chấm ngay đắt hơn ~5 lần (~$0.016/phút): chỉ đo thêm nếu team muốn giữ dữ liệu trong Google Cloud. Đặt bằng env `STT_PROVIDER` / `STT_MODEL`. Giá tham khảo, kiểm lại trang giá chính thức (mục 5.7.3). | PR 13 | OK – 2026-10-08 |
| A2 | Ngưỡng content / clarity mặc định | 0.80 / 0.60; purpose = đủ item bắt buộc; independence = không dùng gợi ý | PR 12 | |
| A3 | Ngưỡng để bật cho người dùng | Chấm oan < 10% **và** chấm lọt < 15%; `unscorable` < 10% | Bật flag | |
| A4 | Giới hạn lượt chấm nói | 30 lượt / user / ngày, tính theo giờ Việt Nam | PR 13 | |
| A5 | Câu viết có tính vào giới hạn A4 không | Không (không tốn STT); giới hạn riêng 100 lượt / ngày để chống spam | PR 12 | |
| A6 | Độ dài tối đa một bản ghi | Bước 5: 45 giây; nhiệm vụ tổng hợp: 90 giây. Dưới 1 giây thì `unscorable`. | PR 13–14 | |
| A7 | Thời gian giữ bản ghi | 30 ngày rồi tự xoá; không lưu transcript | PR 13 | |
| A8 | Chờ kết quả trên màn | Hỏi mỗi 2 giây, tối đa 20 giây; quá thì "Kết quả sẽ có khi có mạng" | PR 14 | |
| A9 | Số lần làm lại bước 5 | Không giới hạn (đã có giới hạn A4); lấy **kết quả tốt nhất** | PR 12, 15 | |
| A10 | Bật cho ai trước | Flag `speechEvaluation` tắt mặc định → bật cho tài khoản nội bộ → bật cho mọi người lớn khi đạt A3 | PR 13–14 | |
| A11 | Tài khoản trẻ em | Không chấm máy cho tới khi có consent phụ huynh (Bước 1); trẻ dùng tự đánh giá | PR 14 | |
| A12 | Người học không đồng ý consent | Giữ tự đánh giá như hiện nay: vẫn ghi âm và nghe lại **trên máy**, không gửi đi. Không cho micro thì nói thành tiếng rồi tự tick. Hỏi lại tối đa 1 lần / 7 ngày; đổi được trong Cài đặt. | PR 14 | OK – 2026-10-08 |
| A13 | Người học **không tiện nói** lúc này | Nút **"Không nói được lúc này"**: tắt hoạt động nói bước 3–4 trong 15 phút; bước 5 chuyển sang **viết**, server chấm như câu viết (chữ chỉ lên server LingoBites, không gửi bên thứ ba). Kết quả ghi "đạt (viết thay nói)", **chưa tính đạt bài**; nói lại sau mới tính. | PR 12 (server), PR 14 (app), PR 15 | OK – 2026-10-08 |
| A14 | Có cho **bỏ hẳn** bước 5 không | Không. Bỏ qua thì bài dừng ở "đã xong phần luyện", chưa "đạt bài". | PR 15–16 | OK – 2026-10-08 |
| A15 | Trần chi phí nhận dạng giọng nói mỗi tháng (ngoài giới hạn từng người ở A4) | Env `STT_MONTHLY_BUDGET_MINUTES`. Dùng tới 80% thì cảnh báo admin; tới 100% thì tự chuyển mọi người về tự đánh giá tới hết tháng (không lỗi, không mất dữ liệu). Con số cụ thể do team đặt theo ngân sách (ví dụ 40.000 phút ≈ $120 với OpenAI mini). | PR 13 | OK – 2026-10-08 (con số team điền) |

### 5.3 Stage 3 – đạt bài, đạt unit, ôn (PR 15–17)

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| T3 | Khoảng ôn và "ghi nhớ ổn định" | 1 – 3 – 7 – 14 – 30 ngày; "ổn định" = đạt 2 lần liên tiếp ở mức ≥ 7 ngày | PR 15 | |
| B1 | Thế nào là "đạt bài" | Xong phần luyện (bước 2–4) **và** bước 5 `pass_independent` | PR 15 | |
| B2 | `pass_with_support` ở bước 5 có tính là đạt bài không | Không: hiện "Đạt, nhưng còn cần gợi ý" + nút "Thử lại không gợi ý" | PR 15–16 | |
| B3 | Tự đánh giá (không có consent / trẻ em) có tính là đạt bài không | Có, nhưng lưu `assessed_by = self`. Báo cáo sau này tách "tự đánh giá" với "máy chấm". | PR 15 | |
| B4 | Khi nào mở nhiệm vụ tổng hợp của unit | Khi mọi bài của unit đã xong phần luyện | PR 15–16 | |
| B5 | Thế nào là "đạt unit" | Mọi bài đạt (B1) **và** nhiệm vụ tổng hợp `pass_independent` | PR 15 | |
| B6 | Item nào vào lịch ôn | Item `required` của bài đã xong phần luyện; không tính item `extended` và bài người học tự tạo (Q7) | PR 15 | |
| Q7 | Bài `extended` (người học tự tạo) có tính vào lịch ôn item không | Không | PR 15 | |
| B7 | Ôn sai thì sao | Lùi **một** mức khoảng ôn (không về 0); không ảnh hưởng "đã đạt bài" | PR 15 | |
| B8 | Tối đa bao nhiêu item ôn mỗi ngày | 20 item; quá thì dời sang hôm sau, ưu tiên item quá hạn lâu nhất | PR 15–16 | |
| B9 | Thứ tự trên màn Today | Ôn đến hạn → bài đang học dở → bài tiếp theo | PR 16 | |
| B10 | Nhiệm vụ tổng hợp chặn publish unit | Có: unit thiếu nhiệm vụ tổng hợp thì không publish được (đang chỉ cảnh báo) | PR 15 | |
| B11 | Ai sửa ngưỡng / khoảng ôn trong admin | Chỉ tài khoản admin; mọi thay đổi ghi log | PR 17 | |
| B12 | Ai nghe lại bản ghi của user trong admin | Chỉ admin, mỗi lần nghe ghi log; không tải file về | PR 17 | |
| B13 | Có bắt buộc unit có phần viết không | Không bắt buộc; chỉ cảnh báo khi viết = 0% (thêm vào PR 17) | PR 17 | |

### 5.4 Ra sản phẩm (Bước 0, Bước 1)

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| C1 | Danh mục trình độ | Pre-A1, A1, A2, B1 (theo CEFR); trẻ em và người lớn dùng chung thang | Bước 1, nội dung | |
| C2 | Nhóm đối tượng | 2 nhóm: trẻ 6–11, người lớn (≥ 16). Chưa làm nhóm 12–15. | Bước 1 | |
| Q6 | Item dùng chung cho trẻ em và người lớn, hay tách | Dùng chung item; tách ở **bài / unit** (ví dụ, tình huống) | Bước 1 | |
| C3 | Tỷ lệ 70/25/5 | Giữ nói 70 / nghe 25 / viết 5, sai lệch ±10, tính theo unit, chỉ cảnh báo | Nội dung | |
| C4 | Bài kiểm tra đầu vào | 10–12 câu nghe + chọn, không nói, khoảng 5 phút; bỏ qua được; kết quả chỉ **đề xuất** trình độ, người học tự đổi được | Bước 1 | |
| C5 | Hỏi gì ở onboarding | Nhóm tuổi, mục tiêu (giao tiếp / du lịch / công việc / trường học), sở thích (chọn tối đa 3), thời gian học mỗi ngày | Bước 1 | |
| C6 | Nội dung cần có khi ra mắt | A1 đủ 6 unit × 3 bài; Pre-A1 cho trẻ 4 unit | Giai đoạn 2 | |
| C7 | Quy tắc thưởng | XP khi xong phần luyện; thưởng thêm khi **đạt bài** và **đạt unit**; streak tính theo ngày có ít nhất 1 hoạt động | PR 16, 8.2 | |
| C8 | Tính năng miễn phí / trả phí | Miễn phí: toàn bộ curriculum + tự đánh giá + 5 lượt chấm máy / ngày. Trả phí: chấm máy 30 lượt / ngày + tự sinh bài (Q8). | Kinh doanh 8.6 | |

### 5.5 Stage 4–5 (sinh bài tự động)

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| Q5 | Item `draft` do AI tạo có vào danh mục chung không | Không tự vào; admin duyệt mới chuyển `published` | S4.1 | **Tự publish**, `source = ai` + `reviewed_at` để admin rà sau – 2026-10-09 |
| Q8 | Ai được tự sinh bài, giới hạn bao nhiêu | Gói trả phí: 5 bài / ngày; miễn phí: 1 bài / ngày; trẻ em: không tự sinh | S4.3 | |
| Q9 | Admin có "nhận về" bài AI sinh từ người học làm nội dung chung không | Có, dùng chức năng chuyển bài hiện có; vào trạng thái nháp, admin duyệt | S4.2 | Có: admin chọn câu trong bài người học → sinh bài nháp trong unit (plan S4.2) – 2026-10-09 |
| Q10 | Danh mục tình huống chuẩn | Bắt đầu 20 tình huống A1 (quán ăn, mua sắm, hỏi đường, sân bay, khách sạn, khám bệnh, trường học, giới thiệu bản thân…); team nội dung bổ sung | S5.1 | |
| Q11 | Nhà cung cấp AI + ngân sách sinh bài | OpenAI (đã tích hợp), model đặt bằng env; trần chi phí theo tháng do team đặt, vượt thì tắt nút sinh bài | S4.1 | |
| D1 | Đoạn video dùng cho bước 2 | Tối đa 30 giây mỗi đoạn, tối đa 3 đoạn mỗi bài | S4.2 | |
| D2 | Khi AI kết luận "không phù hợp" | Báo cho người dùng, giữ bài dạng hub, không tính lượt sinh bài | S4.1 | |
| D3 | Lọc nội dung tình huống người học tự gõ | Chạy kiểm duyệt nội dung trước khi sinh; tài khoản trẻ chỉ chọn từ danh mục, không tự gõ | S5.3 | |
| D4 | Ngôn ngữ của bài sinh ra | Nội dung học bằng tiếng Anh; giải thích, gợi ý, phản hồi bằng tiếng Việt | S4.1 | |

### 5.5b Stage 5 phần ảnh và Stage 6–9 (game)

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| Q12 | Lưu ảnh người học gửi, xin đồng ý | Lưu cùng bài để hiện trong hub, xoá khi xoá bài / xoá dữ liệu; xin đồng ý lần đầu | S5.7 | |
| Q13 | Kiểm duyệt ảnh | Từ chối ảnh không phù hợp trước khi sinh; "không có tình huống" như H7, không tính lượt | S5.7 | |
| Q14 | Chi phí vision, ai được dùng | Chung hạn mức Q8; trẻ em không tự sinh (như D3) | S5.7 | |
| Q15 | Chấm bài viết "tả lại bức ảnh" | Tự đánh giá cho tới khi có chấm viết (PR 12) | S5.7 | |
| M1 | Game có dời lịch ôn `item_memory` không | Không; từ sai gợi ý lưu flashcard | S6 | |
| M2 | Lối vào Game Hub | Today, Home, hub bài, kết quả Practice; chưa thêm tab | S6 | |
| M3 | Game nặng đồ hoạ (Skia) / HTML5 (WebView) | Chưa; Stage 7–9 dùng thư viện đã có | sau S9 | |
| M4 | XP / thưởng cho game | Như practice, không thay "đạt bài" | S6 | |

### 5.6 Về sau (Bước 7, 8.x) – chốt khi tới lượt

| # | Câu hỏi | Đề xuất | Cần cho | Chốt |
|---|---|---|---|---|
| E1 | Báo cáo phụ huynh / giáo viên | Mỗi tuần một báo cáo, xem trong app; liên kết tài khoản bằng mã mời | Bước 7 | |
| E2 | Thông báo push | Tối đa 1 thông báo học / ngày, theo giờ người học chọn; không gửi 21:00–07:00 | 8.7 | |
| E3 | Thanh toán | Mua trong app qua App Store / Google Play (thư viện thanh toán sẽ hỏi duyệt riêng) | 8.6 | |
| E4 | Xoá khoá i18n `lessonFlow.show_model` / `show_model_hint` | Đồng ý xoá | Dọn dẹp | |
| E5 | Xoá route cũ `/v1/ai/analyses` và module `aiAnalysis` nếu không còn client nào gọi | Kiểm tra trước (app các bản đã phát hành, admin, log truy cập production); chỉ xoá khi 30 ngày không có lượt gọi. Luồng tạo bài và phân tích câu **giữ nguyên**, vì Stage 4 xây trên chúng. | Dọn dẹp | |

### 5.7 Giải thích các mục đã chốt

#### 5.7.1 Bộ 40 bản ghi mẫu (T2) dùng làm gì

- **Mục đích:** đo xem máy chấm có đúng không **trước khi** bật cho người dùng. Bộ này không dùng để huấn luyện AI; máy chấm chạy theo luật.
- **Máy có thể sai ở hai chỗ:**
  - nhận dạng nghe sai, ví dụ trẻ nói "small tea" thành "smart tea";
  - ngưỡng chấm chưa hợp lý, ví dụ quá khắt khe với câu ấp úng mà vẫn đúng.
- **Cách làm:**
  1. Team ghi khoảng 40 câu **bằng chính app**, trên bài L01.
  2. Một người nghe lại và ghi nhãn "đạt / chưa" theo 4 tiêu chí.
  3. Script (PR 13) cho cả bộ chạy qua máy chấm, so với nhãn của người rồi in:
     - **chấm oan:** máy chưa đạt, người đạt;
     - **chấm lọt:** máy đạt, người chưa đạt;
     - độ trễ;
     - tỷ lệ `unscorable`.
  4. Đạt ngưỡng A3 thì bật flag. Chưa đạt thì chỉnh ngưỡng rồi chạy lại trên **cùng bộ cũ**.
- **Nội dung cần ghi:**

  | Nhóm | Số câu | Ví dụ |
  |---|---|---|
  | Nói đúng, rõ | 10 | "Can I have a large coffee, please?" |
  | Đúng nhưng ấp úng, chậm, giọng Việt | 10 | "Can I… have a… small tea please" |
  | Sai mẫu hoặc thiếu món | 10 | "I want coffee", "Can I have a large, please?" |
  | Lạc đề, im lặng, ồn | 10 | Nói câu khác, ghi ở chỗ ồn |

  - Khoảng nửa người lớn, nửa trẻ em.
  - Thêm khoảng 10 câu **viết** cho L03.
- **Bảng nhãn**, mỗi dòng một câu: `tên file | người nói (lớn / trẻ) | câu định nói | nhãn đạt / chưa | ghi chú`.
- **Lưu ý:**
  - Người được ghi phải đồng ý; trẻ em thì cần phụ huynh đồng ý.
  - Bản ghi để nội bộ, **không đưa vào repo**.
  - 40 câu chỉ cho ước lượng thô (mỗi câu sai ≈ 2,5%). Số liệu thật lấy từ thống kê admin (PR 17).

#### 5.7.2 Consent và chính sách quyền riêng tư (T4)

- **Vì sao cần consent riêng:**
  - Giọng nói là dữ liệu cá nhân.
  - Khi chấm máy, bản ghi rời điện thoại, lên server rồi tới **bên thứ ba** (OpenAI).
  - Consent ghi âm hiện có (`speaking.recording_upload_consent`) được hỏi cho mục đích khác (lưu bản ghi luyện tập), nên không dùng lại được.
- **Câu consent** (hỏi lần đầu ở bước 5):
  > "Để chấm bài nói, LingoBites gửi bản ghi của bạn tới máy chủ và dịch vụ nhận dạng giọng nói. Bản ghi tự xoá sau 30 ngày và không dùng cho mục đích khác."
  >
  > **[Đồng ý]** **[Tự đánh giá]**
- **Mục giọng nói cần thêm** vào `docs/01-ba/07-release/02-privacy-policy-draft.md` (repo server). Bản nháp hiện chưa nói gì về ghi âm. Nội dung:

  | Câu hỏi | Nội dung |
  |---|---|
  | Thu gì | Bản ghi giọng nói ở bước 5 và nhiệm vụ tổng hợp, khi người học đồng ý |
  | Để làm gì | Chấm bài nói. Không dùng cho quảng cáo, không bán, không dùng để nhận diện người. |
  | Gửi cho ai | Server LingoBites và nhà cung cấp nhận dạng giọng nói (OpenAI). Chỉ gửi file âm thanh và từ vựng của bài, không gửi tên / email / mã người học. |
  | Giữ bao lâu | Bản ghi tự xoá sau 30 ngày. Không lưu chữ nhận dạng được. Chỉ giữ kết quả chấm. |
  | Trẻ em | Không chấm máy cho tài khoản trẻ khi chưa có đồng ý của phụ huynh |
  | Rút lại | Tắt trong Cài đặt bất kỳ lúc nào, quay về tự đánh giá |

- **Việc kèm theo:**
  - Cập nhật khai báo dữ liệu trên store (App Store "App Privacy", Google Play "Data safety"): thêm dòng **Audio / Voice recordings**.
  - Điền tên nhà cung cấp thật vào chỗ `[tên provider/model]` trong bản nháp.
  - Kiểm lại chính sách lưu dữ liệu API của OpenAI. Theo thông tin hiện biết: dữ liệu API không dùng để huấn luyện mặc định, có thể lưu tạm tới 30 ngày để chống lạm dụng, và có thể xin chế độ không lưu.
  - Người hiểu luật bảo vệ dữ liệu cá nhân ở Việt Nam xem lại trước khi phát hành, nhất là phần trẻ em.

#### 5.7.3 Chi phí nhận dạng giọng nói (A1)

Giá tham khảo tháng 10/2026, lấy từ trang tổng hợp giá. Kiểm lại trang giá chính thức trước khi lập ngân sách.

| Dịch vụ | Giá / phút | Trả kết quả ngay |
|---|---|---|
| OpenAI `gpt-4o-mini-transcribe` | ~$0.003 | Có |
| OpenAI `gpt-4o-transcribe` | ~$0.006 | Có |
| Google Speech-to-Text V2 thường (gồm Chirp) | ~$0.016 | Có |
| Google V2 dynamic batch | ~$0.003–0.004 | Không (có thể chờ tới 24 giờ) |

**Ước tính:** 1.000 người hoạt động × 5 lượt / ngày × 15 giây ≈ 37.500 phút / tháng.

| Dịch vụ | Chi phí / tháng |
|---|---|
| OpenAI mini | ~$110 |
| OpenAI bản lớn | ~$225 |
| Google thường | ~$600 |

Google còn làm tròn mỗi lượt lên giây kế tiếp và vẫn tính tiền khi không nhận ra chữ nào.

---

## 6. Theo dõi tiến độ

Đánh dấu `[x]` khi xong. Ghi số pull request bên cạnh.

**Giai đoạn 0**
- [ ] Test tay app trên máy thật
- [ ] Test tay admin-web
- [ ] Sửa lỗi phát sinh + 2 lỗi có sẵn của server
- [ ] Staging chạy migration mới + seed

**Giai đoạn 1 – Stage 3**
- [x] PR 12 – bộ chấm + kết quả (server) — đã code, chưa mở pull request (plan: `2026-10-09-phase1-stage3-plan.md` §4)
- [x] PR 13 – âm thanh vào server — đã code, chưa mở pull request (plan: `2026-10-09-pr13-server-audio-stt.md`)
- [ ] Team: ghi bộ 40 bản ghi có nhãn (T2), viết mục giọng nói trong chính sách + khai báo store (T4)
- [ ] Đo độ chính xác: chấm oan < 10%, bật flag `speechEvaluation`
- [x] PR 14 – app chấm bước 5 — đã code, chưa test trên máy thật, chưa mở pull request (plan: `2026-10-09-pr14-app-step5-evaluation.md`)
- [x] PR 15 – đạt bài, đạt unit, ghi nhớ (server) — đã code, chưa mở pull request (plan: `2026-10-09-pr15-server-pass-unit-memory.md`)
- [x] PR 16 – app kết quả, tiến độ, ôn (+ route server `GET /v1/units/:unitId/summative-task`) — đã code, chưa test trên máy thật, chưa mở pull request (plan: `2026-10-09-pr16-app-result-progress-review.md`)
- [x] PR 17 – admin (cấu hình chấm, lượt chấm, nghe lại có log, thống kê, preview thử chấm, cảnh báo B13) — đã code, chưa mở pull request (plan: `2026-10-09-pr17-admin-evaluation.md`)

**Giai đoạn 2** (plan: `2026-10-09-phase2-product-trial-plan.md`; bỏ phần phụ huynh / giáo viên)
- [x] Bước 0 chốt cấu hình — `2026-10-09-phase2-step0-config.md` (P2.0)
- [x] Nội dung: A1 8 unit + A2 6 unit = 14 unit / 42 bài, bản nháp kỹ thuật, **chờ người phụ trách nội dung đọc lại** (P2.1, P2.2; `yarn seed:curriculum`) — server, nhánh `claude/zen-babbage-njiyn1`, chưa mở PR
- [x] Bước 1 – hồ sơ + kiểm tra đầu vào: server (P2.3, migration `012`) + app (P2.4) — nhánh `claude/zen-babbage-njiyn1`, chưa mở PR, **chưa test trên máy thật**
- [ ] Chạy thử: reset + seed staging, test tay theo Phụ lục A của backlog (P2.5)

**Giai đoạn 3 – Stage 4**
- [x] S4.1 `lessonComposer` + kho prompt backend – server, nhánh `claude/affectionate-darwin-krszil` (2026-10-09; chưa mở PR)
- [x] S4.2b admin "Prompt AI" (quản lý phiên bản prompt, chạy thử, rollback) – server + admin-web, nhánh `claude/affectionate-darwin-krszil` (2026-10-09; chưa mở PR, chưa chạy thử với AI thật)
- [x] S4.2 admin "Sinh bài 6 bước" – server + admin-web, nhánh `claude/affectionate-darwin-krszil` (2026-10-09; chưa mở PR)
- [x] S4.3 người học "Học theo 6 bước" – server + app, nhánh `claude/affectionate-darwin-krszil` (2026-10-09; chưa mở PR, chưa test tay trên máy thật)
- [ ] ~~S4.4 ảnh không chữ~~ → chuyển sang Stage 5 (S5.6–S5.9)

**Giai đoạn 4 – Stage 5**
- [ ] S5.1 danh mục tình huống
- [ ] S5.2 màn "Học theo tình huống"
- [ ] S5.3 sinh bài từ tình huống
- [ ] S5.4 gợi ý tình huống
- [ ] S5.5 luyện lại tình huống
- [ ] S5.6 endpoint media cho người học
- [ ] S5.7 server: nguồn `learner_image`
- [ ] S5.8 app: "Tả bức ảnh"
- [ ] S5.9 admin: bài sinh từ ảnh

> 2026-10-10: Stage 5 được thiết kế lại thành luồng "Học từ đời thường" (`2026-10-10-everyday-learning-redesign.md`), làm theo các PR E0–E6 dưới đây. Mỗi PR có plan riêng, **chờ duyệt** rồi mới code. Các mục S5.x ở trên được gộp vào E (ghi trong từng plan).
- [ ] E0 app: sửa nhanh luồng nhập hiện có (`2026-10-10-e0-app-input-quick-fixes.md`)
- [ ] E1 server: phân tích ảnh, kiểm duyệt ảnh, lưu tạm (`2026-10-10-e1-server-image-analyze.md`)
- [ ] E2 server: "Dùng" theo tình huống, kiểm duyệt text, hạn mức "Hiểu" – gồm S5.1 tối thiểu, S5.3 (`2026-10-10-e2-server-situation-moment.md`)
- [ ] E3 app: luồng mới Hiểu / Dùng – gồm S5.2 (`2026-10-10-e3-app-moment-flow.md`)
- [ ] E4 server + app: "Tả" từ ảnh, ảnh trong bài – gồm S5.6, S5.7, S5.8 (`2026-10-10-e4-image-describe.md`)
- [ ] E5 server + app: thư viện Khoảnh khắc, luyện lại, xoá bài – gồm S5.5 (`2026-10-10-e5-moments-library.md`)
- [ ] E6 server + admin: theo dõi, danh mục, báo sai – gồm S5.9 (`2026-10-10-e6-admin-moments.md`)

**Giai đoạn 4b – Stage 6–9**
- [ ] S6 Game Hub
- [ ] S7 game hỏi–đáp
- [ ] S8 game ghép / sắp xếp
- [ ] S9 game nghe

**Giai đoạn 5**
- [ ] Bước 7 – báo cáo, phụ huynh / giáo viên
- [ ] Kinh doanh 8.6
- [ ] Push server 8.7
- [ ] Các mục 8.x khác
- [ ] Dọn dẹp kỹ thuật

---

## 7. Việc tiếp theo ngay

1. Team: test tay `develop` (Giai đoạn 0) và điền cột "Chốt" ở mục 5 (ít nhất 5.1–5.3 cho Stage 3).
2. Code, song song với bước 1: viết **plan chi tiết PR 12** (bộ chấm + `evaluations`, chưa có âm thanh), chờ duyệt rồi code. PR này không cần gì từ team.
