# Kế hoạch làm phần còn lại (file ghi nhớ)

> Lập ngày 2026-10-08. **Đây là file mở đầu khi quay lại làm tiếp.** Đọc file này trước, rồi mới mở các file chi tiết.
> - Danh sách đầy đủ theo độ ưu tiên: `2026-10-08-backlog-remaining-work.md`.
> - Thiết kế chốt cho âm thanh và chấm bài: `2026-10-08-stage3-audio-evaluation-analysis.md`.
> - Plan tổng: `2026-10-07-backward-design-curriculum-plan.md`. Lộ trình 8 bước: `2026-10-07-learning-cycle-requirements-roadmap.md`.
>
> Cập nhật mục 6 "Theo dõi tiến độ" mỗi khi xong một việc.

---

## 1. Đang ở đâu

| Hạng mục | Trạng thái |
|---|---|
| Stage 0–2 (PR 1–11): đặc tả bài, item, task, hoạt động, player 6 bước, gợi ý, vận dụng độc lập | ✅ Đã merge vào `develop` (server #114, app #221) |
| Stage 3: âm thanh, chấm bài, đạt bài, ghi nhớ, ôn | ⏳ Thiết kế đã chốt, **chưa code** |
| Stage 4: video / text / OCR / ảnh → bài 6 bước | ⏳ Đã mô tả, chưa có plan chi tiết |
| Stage 5: tình huống → bài 6 bước | ⏳ Đã mô tả, chưa có plan chi tiết |
| Bước 1 (hồ sơ, đầu vào), Bước 7 (báo cáo, phụ huynh), nhóm 8.x | ⏳ Chưa bắt đầu |

**Nhánh:**
- Nền phát triển là **`develop`**. **Không merge vào `main`** (bản ổn định).
- Nhánh làm việc của cả hai repo: `claude/optimistic-bell-mfgk44`, tạo từ `develop`.
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
4. Push lên `claude/optimistic-bell-mfgk44`.
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
Giai đoạn 3  Stage 4: S4.1 → S4.2 → S4.3 (→ S4.4 sau Stage 5)
     │
Giai đoạn 4  Stage 5: S5.1 → S5.2 → S5.3 → S5.4 → S5.5
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
- Chấm **trên server**, dựa trên **transcript** của OpenAI Speech-to-Text (sau cổng `SpeechToText`).
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
  - sync nhận lượt `outcome = pending`, `assessed_by = service`; collection pull `evaluations`.
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
  - cổng `SpeechToText` với adapter `openai` + `mock`;
  - env `STT_PROVIDER` / `STT_MODEL` / `STT_API_KEY`;
  - job `evaluation` (retry 2 lần);
  - `EVAL_DAILY_LIMIT`; chống chấm lại cùng file bằng SHA-256;
  - job dọn bản ghi sau 30 ngày;
  - script đo độ chính xác;
  - flag `speechEvaluation`.
- **Test:**
  - job với STT mock;
  - giới hạn lượt;
  - dọn bản ghi;
  - test tích hợp OpenAI tắt mặc định.
- **Xong khi:** upload file `.m4a` thì có `evaluations` trong khoảng 20 giây (STT mock); script đo chạy được trên bộ mẫu.
- **Trước khi bật flag:** chạy script trên ~40 bản ghi có nhãn (T2). Tỷ lệ **chấm oan phải dưới 10%**.

#### PR 14 – App: chấm bước 5

- **Cần trước:** PR 12–13, câu consent đã duyệt (T4).
- **Phạm vi:**
  - ghi âm AAC mono 16 kHz ~32 kbps;
  - consent "Chấm bài nói bằng máy" (`speaking.evaluation_consent`);
  - `IndependentTaskView`: có consent thì "Gửi chấm", không có thì giữ tự đánh giá;
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
  - `lesson_outcomes.passed_at`: xong phần luyện + bước 5 `pass_independent`;
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

| PR | Repo | Nội dung | Xong khi |
|---|---|---|---|
| S4.1 | server | `lessonComposer` lõi + test bằng AI mock và fixture | Bài mẫu qua validator |
| S4.2 | server + admin | Nút "Sinh bài 6 bước" trên bài từ text / YouTube / bài nhận từ người học. Kết quả là **bài nháp**; bước 2 phát đúng đoạn video. | Admin sửa được rồi publish |
| S4.3 | server + app | Bài tự tạo có nút "Học theo 6 bước". Snapshot trả `lesson_items` / spec / tasks. Bỏ điều kiện `origin = admin` của `isFlowLesson`. Gộp hub bài tự tạo (4.7). | Người học chạy trọn 6 bước trên bài tự tạo |
| S4.4 | server + app | Ảnh không chữ → AI mô tả thành tình huống → đi đường Stage 5 | Làm sau S5.3 |

- **Cần trước:** Giai đoạn 0 xong; Q5, Q8, Q9, Q11.
- **Nên làm sau Stage 3**, để bước 5 được chấm thật.

### Giai đoạn 4 – Stage 5: tình huống → bài 6 bước

| PR | Repo | Nội dung | Cần trước |
|---|---|---|---|
| S5.1 | server + admin | Danh mục tình huống chuẩn (có nhãn trình độ, đối tượng); gắn nhãn cho bài hiện có | Q10 |
| S5.2 | app | Màn "Học theo tình huống": duyệt, tìm, mở bài có sẵn | S5.1 |
| S5.3 | server + app + admin | Sinh bài từ tình huống (chọn hoặc tự gõ): AI viết hội thoại mẫu, `lessonComposer` sinh phần còn lại, ưu tiên item có sẵn | S4.1 |
| S5.4 | app + server | Gợi ý tình huống theo mục tiêu / sở thích | Bước 1 |
| S5.5 | app + server | Luyện lại tình huống: chỉ bước 5 / nhiệm vụ tổng hợp, đổi chi tiết, theo lịch ôn | PR 15 |

**Xong khi:** người học chọn hoặc gõ một tình huống, nhận bài 6 bước đúng trình độ và học trọn được. Admin sinh được bài nháp từ tình huống.

### Giai đoạn 5 – Mở rộng và dọn dẹp

| Việc | Ghi chú |
|---|---|
| **Bước 7 – Báo cáo + phụ huynh / giáo viên** (3.5), khoảng 3–4 PR | Cần Stage 3, Bước 0 |
| **Kinh doanh 8.6**: thuê bao, gói gia đình, referral, thanh toán store | ⚠️ Dependency thanh toán, cần duyệt |
| **Push từ server 8.7**: dẫn tới bài / lượt ôn đến hạn | Cần PR 15 |
| 8.1 sửa phát âm, tốc độ nghe · 8.2 động lực gắn "đạt bài" · 8.3 mini game (flag đã có, chưa UI), nhập vai AI · 8.4 nguồn mới · 8.5 quản lý việc học · vận hành | Làm dần theo ưu tiên sản phẩm |
| Dọn dẹp:<br>- xoá khoá i18n `lessonFlow.show_model*` (cần duyệt);<br>- giữ đồng bộ 3 bản `acceptedAnswers` bằng fixture;<br>- `getDueFlashcardsByItemKeys` chuyển sang SQL;<br>- giảm warning lint;<br>- ma trận lặp item cấp level. | Không gấp |

---

## 5. Team cần cung cấp / chốt

| # | Việc | Cần cho | Mặc định nếu chưa chốt |
|---|---|---|---|
| T1 | API key OpenAI cho STT (đặt trong env, không đưa vào repo) | PR 13 | Dùng chung `AI_API_KEY` |
| T2 | ~40 bản ghi mẫu có nhãn "đạt / chưa": người lớn + trẻ em, bài L01 | Bật flag sau PR 13 | Flag tắt |
| T3 | Khoảng ôn 1–3–7–14–30 ngày; "ổn định" = đạt 2 lần liên tiếp ở mức ≥ 7 ngày | PR 15 | Dùng đề xuất này |
| T4 | Duyệt câu consent + cập nhật chính sách quyền riêng tư (bên xử lý giọng nói, xoá sau 30 ngày) | PR 14 | Câu ở §5 file thiết kế |
| Q5 | Item `draft` do AI tạo có vào danh mục chung không | Stage 4 | Không, chờ admin duyệt |
| Q6 | Item dùng chung trẻ em / người lớn hay tách | Bước 1 | Dùng chung |
| Q7 | Bài `extended` có tính vào lịch ôn item không | PR 15 | Không |
| Q8 | Ai được tự sinh bài, giới hạn / ngày | S4.3 | — |
| Q9 | Admin có "nhận về" bài AI sinh từ người học không | S4.2 | — |
| Q10 | Danh mục tình huống chuẩn | S5.1 | — |
| Q11 | Nhà cung cấp AI + ngân sách sinh bài | Stage 4 | — |
| Bước 0 | Cấu hình sản phẩm (mục Giai đoạn 2) | Bước 1, 7, kinh doanh | — |

---

## 6. Theo dõi tiến độ

Đánh dấu `[x]` khi xong. Ghi số pull request bên cạnh.

**Giai đoạn 0**
- [ ] Test tay app trên máy thật
- [ ] Test tay admin-web
- [ ] Sửa lỗi phát sinh + 2 lỗi có sẵn của server
- [ ] Staging chạy migration mới + seed

**Giai đoạn 1 – Stage 3**
- [ ] PR 12 – bộ chấm + kết quả (server)
- [ ] PR 13 – âm thanh vào server
- [ ] Đo độ chính xác: chấm oan < 10%, bật flag `speechEvaluation`
- [ ] PR 14 – app chấm bước 5
- [ ] PR 15 – đạt bài, đạt unit, ghi nhớ (server)
- [ ] PR 16 – app kết quả, tiến độ, ôn
- [ ] PR 17 – admin

**Giai đoạn 2**
- [ ] Bước 0 chốt cấu hình
- [ ] Nội dung thật: ít nhất 1 level đủ unit
- [ ] Bước 1 – hồ sơ + kiểm tra đầu vào

**Giai đoạn 3 – Stage 4**
- [ ] S4.1 `lessonComposer`
- [ ] S4.2 admin "Sinh bài 6 bước"
- [ ] S4.3 người học "Học theo 6 bước"
- [ ] S4.4 ảnh không chữ

**Giai đoạn 4 – Stage 5**
- [ ] S5.1 danh mục tình huống
- [ ] S5.2 màn "Học theo tình huống"
- [ ] S5.3 sinh bài từ tình huống
- [ ] S5.4 gợi ý tình huống
- [ ] S5.5 luyện lại tình huống

**Giai đoạn 5**
- [ ] Bước 7 – báo cáo, phụ huynh / giáo viên
- [ ] Kinh doanh 8.6
- [ ] Push server 8.7
- [ ] Các mục 8.x khác
- [ ] Dọn dẹp kỹ thuật

---

## 7. Việc tiếp theo ngay

1. Team: test tay `develop` (Giai đoạn 0).
2. Code, song song với bước 1: viết **plan chi tiết PR 12** (bộ chấm + `evaluations`, chưa có âm thanh), chờ duyệt rồi code. PR này không cần gì từ team.
