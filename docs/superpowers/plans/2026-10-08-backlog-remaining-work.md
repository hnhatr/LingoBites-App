# Backlog: những việc chưa làm (sắp theo độ ưu tiên)

> Lập ngày 2026-10-08, sau khi xong **Stage 1 và Stage 2** (PR 1–11) của `2026-10-07-backward-design-curriculum-plan.md`.
> Mục đích: một chỗ duy nhất liệt kê mọi việc còn lại, để làm tiếp không bị sót.
> Cập nhật file này mỗi khi xong hoặc thêm một việc.
> **Khi quay lại làm tiếp, mở `2026-10-08-remaining-work-plan.md` trước** (thứ tự làm, checklist tiến độ).

**Trạng thái hiện tại:**
- Code PR 1–11 **đã merge vào `develop`** (server #114, app #221). Phát triển tiếp trên nền `develop`; `main` giữ bản ổn định.
- Plan chi tiết từng PR (kèm phần "điểm lệch") nằm trong thư mục này: `2026-10-07-pr1-…` → `2026-10-08-pr11-…`.
- Lộ trình 8 bước gốc: `2026-10-07-learning-cycle-requirements-roadmap.md`. Stage 0–3 của plan curriculum ứng với bước 2–6 của lộ trình này.

**Thang ưu tiên:**

| Mức | Ý nghĩa |
|---|---|
| **P0** | Làm ngay: kiểm thử và đưa code đã viết vào nhánh chính |
| **P1** | Việc chặn Stage 3 (cần quyết định hoặc chuẩn bị trước) |
| **P2** | Stage 3: khép kín vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn |
| **P3** | Ra được sản phẩm cho người dùng thật |
| **Stage 4–5** | Sinh bài 6 bước tự động từ nội dung có sẵn và từ tình huống (sau khi xong P0–P2) |
| **P4** | Tính năng bổ trợ, làm dần |

Ở các mục còn việc, cột "Ai" chỉ người làm: **Team** = sản phẩm / nội dung, **Code** = lập trình, **Team + Code** = cả hai.

---

## P0 – Kiểm thử và đưa code vào nhánh chính

| # | Việc | Ai | Ghi chú |
|---|---|---|---|
| 0.1 | **Thử tay trên máy thật** phần app của PR 10–11. | Team | Hướng dẫn chạy và danh sách cần thử ở mục "Phụ lục A". Các phần sau **chưa kiểm được** trong test tự động (Jest dùng bản giả lập):<br>- ghi âm;<br>- nghe lại bản ghi;<br>- đọc câu mẫu bằng TTS, kể cả TTS ở gợi ý mức 1;<br>- quyền micro. |
| 0.2 | **Thử tay admin-web**: soạn item, đặc tả, nhiệm vụ, hoạt động; sinh nháp; preview 6 bước; publish; bảng 70/25/5. | Team | Playwright đã chạy 16/16; vẫn nên xem bằng mắt. |
| 0.3 | **Sửa lỗi tìm được** ở 0.1 và 0.2. | Code | Ghi lỗi kèm thiết bị, bước, thao tác, ảnh chụp. |
| 0.4 | **Mở pull request** từ nhánh `claude/optimistic-bell-mfgk44` (server và app), review, rồi merge. | Team + Code | ⚠️ PR rất lớn (11 PR con). Có thể review theo từng commit; danh sách commit nằm trong mục "Kết quả" của từng plan. |
| 0.5 | **Chạy migration trên staging / production.** | Team + Code | ⚠️ **Rủi ro cao:**<br>- Server: schema đã gộp thành baseline mới (PR 1) và có thêm migration 005 (xoá `learning_items`, `user_vocabulary_progress`, `vocabularies`), 006 (`lesson_outcomes`). DB staging cần `db:reset:staging` rồi `seed:sample-unit:staging`, và **mất dữ liệu cũ**.<br>- App: SQLite nâng v7 → v8. Máy còn ở bản cũ hơn v7 sẽ bị reset dữ liệu local. |
| 0.6 | **Hai lỗi có sẵn** (không do PR 1–11) trên server. | Code | - Lint lỗi `no-explicit-any` ở `test/ipa.test.ts:84`.<br>- Test "admin hard deletes cascade…" trong `test/adminContentDelete.test.ts` (không nằm trong `test:db`). |

---

## P1 – Chuẩn bị trước Stage 3

Hướng làm âm thanh và chấm bài **đã chốt** trong `2026-10-08-stage3-audio-evaluation-analysis.md`: chấm trên server bằng transcript (OpenAI STT), không chấm âm vị, chỉ chấm bước 5 và nhiệm vụ tổng hợp. Spec MVP cũ (2026-09-06) không còn hiệu lực cho phần này.

| # | Việc | Ai | Cần cho |
|---|---|---|---|
| 1.1 | API key OpenAI dùng cho STT (có thể dùng chung key AI hiện tại). | Team | PR 13 |
| 1.2 | Khoảng 40 bản ghi mẫu có nhãn "người chấm: đạt / chưa" (người lớn + trẻ em, bài L01) để đo độ chính xác. | Team | Bật tính năng sau PR 13 |
| 1.3 | Xác nhận khoảng ôn đề xuất 1 – 3 – 7 – 14 – 30 ngày, "ghi nhớ ổn định" = đạt 2 lần liên tiếp ở mức ≥ 7 ngày. | Team | PR 15 |
| 1.4 | Q7: bài `extended` (người học tự tạo) có tính vào lịch ôn item không. Mặc định: **không**. | Team | PR 15 |
| 1.5 | Duyệt câu consent "Chấm bài nói bằng máy" và cập nhật chính sách quyền riêng tư (bên xử lý giọng nói, xoá sau 30 ngày). | Team | PR 14 |
| 1.6 | Q5: item `draft` do AI tạo có được duyệt vào danh mục chung không. | Team | Stage 4 |
| 1.7 | Q6: một item dùng chung cho trẻ em và người lớn, hay tách theo đối tượng. | Team | Bước 1 của lộ trình |

---

## P2 – Stage 3 (6 PR, chi tiết ở file thiết kế §6)

Mỗi PR cần plan chi tiết riêng được duyệt trước (VibeGuard).

| # | PR | Repo | Nội dung | Cần trước |
|---|---|---|---|---|
| 2.1 | **PR 12** – bộ chấm + kết quả (chưa âm thanh) | server | `evaluateUtterance`, so khớp theo từ, bảng `evaluations`, chấm câu viết (test bằng nhiệm vụ viết bước 5 của bài L03), API kết quả, collection `evaluations`, lượt `pending` / `service`. | — (làm được ngay) |
| 2.2 | **PR 13** – âm thanh vào server | server | Recordings `lesson_task` + `attempt_id`, cổng `SpeechToText` + adapter OpenAI, job `evaluation`, giới hạn 30 lượt/ngày, xoá sau 30 ngày, script đo độ chính xác, feature flag `speechEvaluation`. | PR 12, 1.1 |
| 2.3 | **PR 14** – app chấm bước 5 | app | Cấu hình ghi âm (AAC mono 16 kHz), consent mới, gửi chấm nói / viết, màn "Đang chấm…", phản hồi 4 trạng thái. | PR 12–13, 1.5 |
| 2.4 | **PR 15** – đạt bài, đạt unit, ghi nhớ | server | `passed_at`, `unit_outcomes`, `item_memory` + lịch ôn, pull về app. | PR 12, 1.3, 1.4 |
| 2.5 | **PR 16** – app kết quả, tiến độ, ôn | app | Bước 6 "đạt bài", tiến độ unit "đã học / đã đạt", nhiệm vụ tổng hợp, ôn theo item, Today đọc `item_memory`. | PR 15 |
| 2.6 | **PR 17** – admin | admin | Cấu hình ngưỡng và khoảng ôn, xem lượt làm và kết quả chấm (nghe lại bản ghi trong 30 ngày), thống kê. | PR 12–15 |

**Việc nhỏ dời sang Stage 3** (ghi trong phần "điểm lệch" của các plan):

| # | Việc | Nguồn | Gộp vào |
|---|---|---|---|
| 2.7 | Lượt làm **kéo về từ máy khác** chưa tự ghi "complete" cho bài; nên dựa vào `lesson_outcomes` pull từ server. | PR 10 §13 | PR 15 / 16 |
| 2.8 | Task bước 5 có `response_mode = choose` vẫn chạy như hoạt động luyện (còn gợi ý). Seed chưa có trường hợp này. | PR 11 §11 | PR 14 |
| 2.9 | Màn vận dụng: phần nói chỉ ghi âm **một lần cho cả tình huống**, chưa ghi từng lượt. | PR 11 §11 | PR 14 (khi chấm nói) |
| 2.10 | Preview admin dùng nhãn kết quả riêng (`independent` / `with_hint` / `not_yet`), khác enum `outcome` của lượt làm (`pass_independent` …). Nên thống nhất khi preview hiện kết quả chấm thật. | PR 9 | PR 17 |
| 2.11 | Ghi âm và chấm nói trong preview admin. | PR 9 | PR 17 |
| 2.12 | Nhiệm vụ tổng hợp của unit chưa chặn publish unit, mới chỉ cảnh báo (D5). | PR 2 | PR 15 |

**Stage 3 xong khi:** unit mẫu đi trọn vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn; lượt `unscorable` không bị tính là sai; quên một item không xoá trạng thái đã đạt bài.

---

## P3 – Để ra sản phẩm cho người dùng thật

| # | Việc | Ai | Ghi chú |
|---|---|---|---|
| 3.1 | **Bước 0 của lộ trình – chốt cấu hình:**<br>- danh mục trình độ;<br>- nội dung bắt buộc từng bài;<br>- cách áp 70/25/5;<br>- quyền xem của phụ huynh / giáo viên;<br>- quy tắc thưởng;<br>- các gói kinh doanh. | Team | Chặn nhiều mục bên dưới |
| 3.2 | **Soạn nội dung thật** trên admin: đủ course → level → unit → lesson. Hiện mới có **một unit mẫu "Gọi đồ uống"**. | Team | Dùng "Sinh nháp từ mẫu câu" để tiết kiệm công |
| 3.3 | **Bước 1 – Hồ sơ người học và kiểm tra đầu vào** (khoảng 2–3 PR):<br>- nhóm đối tượng (trẻ 6–11 / người lớn), trình độ, mục tiêu, sở thích, khả năng đọc/viết;<br>- onboarding hỏi các thông tin trên + bài kiểm tra đầu vào ngắn → đề xuất điểm bắt đầu;<br>- course / unit gắn với nhóm đối tượng. | Code | ⚠️ Migration DB, đổi API profile; cần 1.8 |
| 3.4 | **Bài tự tạo chạy được 6 bước:** chuyển sang **Stage 4** (mục S4 bên dưới). | — | Xem S4 |
| 3.5 | **Bước 7 – Báo cáo tiến độ, phụ huynh / giáo viên** (khoảng 3–4 PR):<br>- báo cáo theo tuần: hoạt động, mục tiêu đã đạt, lỗi hay gặp, phần cần luyện;<br>- tách "học đều" với "dùng tốt"; câu mô tả năng lực;<br>- tài khoản phụ huynh / giáo viên, liên kết, quyền xem, đề xuất bài. | Code | Cần Stage 3 và 3.1 |
| 3.6 | **8.6 – Kinh doanh**: gói thuê bao, gói gia đình (gắn vai trò phụ huynh), referral, ưu đãi, thanh toán qua store. | Code | ⚠️ Dependency thanh toán, cần duyệt; hiện mới có quyền theo từng khoá |
| 3.7 | **8.7 – Thông báo push từ server** dẫn thẳng tới bài hoặc lượt ôn đến hạn, tách khỏi thông báo marketing. Hiện mới là thông báo local. | Code | Cần PR 15 (`item_memory`) |

---

## Stage 4 và Stage 5 – Sinh bài 6 bước tự động (làm sau khi xong phần nợ P0–P2)

Cả hai stage dùng **một bộ sinh bài 6 bước chung** (gọi là `lessonComposer`) và chỉ khác **đầu vào**:
- **Stage 4** xây bộ sinh, đầu vào là nội dung có sẵn (video, text, ảnh có chữ).
- **Stage 5** tái dùng bộ sinh, đầu vào là một tình huống.

### Đầu ra chung của `lessonComposer`

Một bài **đủ điều kiện publish** theo validator hiện có (0 vi phạm spec-check):

| Phần | Nguồn |
|---|---|
| Đặc tả: can-do, tình huống (ai / với ai / ở đâu / để làm gì), đối tượng, thời lượng | AI |
| Item trọng tâm: từ, cụm từ, **1–2 mẫu câu có chỗ trống** | Map vào danh mục có sẵn (PR 7) và rút mẫu câu mới bằng AI |
| Task hướng dẫn (bước 3–4) và task độc lập (bước 5) kèm 4 tiêu chí, `hint_levels` | AI viết, tiêu chí mặc định theo D4 |
| Hoạt động bước 2–4 | Bộ sinh nháp theo luật có sẵn (PR 8), không tốn AI |
| Bước 2 "Nghe hiểu" | Câu / đoạn gốc của nguồn; với video là đúng đoạn có mốc thời gian |
| Bước 5 nhập vai | AI viết hội thoại ngắn theo tình huống đã đổi chi tiết |
| Cảnh báo cân bằng 70/25/5 | Tự tính như hiện nay |

### Quy tắc chung

| Chủ đề | Quy tắc |
|---|---|
| Không phù hợp | AI được kết luận "không phù hợp" (nội dung không có tình huống giao tiếp rõ: bài hát, tin tức…). Khi đó bài giữ dạng hub như hiện nay, không ép thành 6 bước. |
| Kiểm duyệt | Bài do **admin** sinh thì vào trạng thái **nháp**: admin sửa trên các tab có sẵn rồi mới publish. Bài do **người học** sinh thì dùng ngay cho riêng người đó, có nhãn "AI tạo". |
| Item mới do AI tạo | Ở trạng thái `draft`. Có vào danh mục chung hay không do **Q5** quyết định. |
| Chi phí | Chỉ sinh khi bấm (admin "Sinh bài 6 bước" / người học "Học theo 6 bước"), có giới hạn lượt và cache. |
| Chấm bước 5 | Tự đánh giá cho tới khi Stage 3 xong; sau Stage 3 dùng chấm tự động như bài thường. |

### S4 – Stage 4: từ video, text, OCR, ảnh → bài 6 bước

| # | Việc | Repo | Ghi chú |
|---|---|---|---|
| S4.1 | `lessonComposer` phần lõi: từ một bài đã có câu và phân tích, sinh đặc tả, mẫu câu, task, tiêu chí; ghép với bộ sinh nháp hoạt động; chạy validator. Dùng lại kết quả phân tích sẵn có (hoặc gộp một lần gọi AI), không phân tích lại. | server | Có test bằng AI mock và fixture |
| S4.2 | **Admin:** nút "Sinh bài 6 bước" trên bài tạo từ text / transcript YouTube / bài nhận từ người học. Kết quả là bài nháp, sửa được trên các tab có sẵn. Bước 2 có thể phát đúng đoạn video. | server + admin | Làm trước, giúp có nhiều nội dung curriculum nhanh |
| S4.3 | **Người học:** bài tự tạo (text, OCR, YouTube) có nút "Học theo 6 bước". Snapshot trả `lesson_items` / spec / tasks cho bài người học. Player mở cho bài tự tạo có đủ đặc tả (bỏ điều kiện `origin = admin` của `isFlowLesson`). | server + app | Gộp mục 4.7 |
| S4.4 | **Ảnh không có chữ** (ảnh cảnh vật, đồ vật): AI mô tả ảnh thành một tình huống, rồi đi theo đường của Stage 5. | server + app | Phụ thuộc Stage 5; có thể để cuối |

- **Phụ thuộc:** P0 xong; Q5 đã chốt; chính sách chi phí AI. Không bắt buộc chờ Stage 3, nhưng nên làm sau để bước 5 được chấm thật.
- **Ước lượng:** 4–5 PR.
- **Xong khi:** một video YouTube và một đoạn text bất kỳ sinh ra được bài qua validator, chạy đủ 6 bước trên app, và admin sửa được trước khi publish.

### S5 – Stage 5: từ tình huống → bài 6 bước

| # | Việc | Repo | Ghi chú |
|---|---|---|---|
| S5.1 | **Danh mục tình huống chuẩn** (quán cà phê, sân bay, đi khám bệnh…), có nhãn trình độ và đối tượng; gắn nhãn cho bài / unit hiện có. | server + admin | Việc nội dung + 1 PR |
| S5.2 | **Màn "Học theo tình huống"** trên app: duyệt / tìm tình huống, mở bài có sẵn của tình huống đó. | app | Chưa cần AI |
| S5.3 | **Sinh bài từ tình huống:** đầu vào là tình huống (chọn từ danh mục, hoặc người học tự gõ "tôi sắp đi phỏng vấn xin việc") + trình độ + đối tượng. AI viết đoạn hội thoại mẫu làm "nguồn" cho bước 2, rồi `lessonComposer` sinh phần còn lại. Ưu tiên tái dùng item đã có trong danh mục. | server + app + admin | Tái dùng S4.1 |
| S5.4 | **Gợi ý tình huống** theo mục tiêu và sở thích của người học. | app + server | Cần Bước 1 của lộ trình (hồ sơ người học, mục 3.3) |
| S5.5 | **Luyện lại tình huống:** chỉ chạy bước 5 hoặc nhiệm vụ tổng hợp của tình huống đã học, đổi chi tiết mỗi lần, theo lịch ôn. Nối với nhập vai AI (mục 4.3) nếu đã có. | app + server | Cần Stage 3 (`item_memory`) |

- **Phụ thuộc:** S4.1; Q5; danh mục tình huống do team nội dung chốt.
- **Ước lượng:** 4–6 PR.
- **Xong khi:** người học chọn hoặc gõ một tình huống, nhận được bài 6 bước phù hợp trình độ và học trọn được; admin sinh được bài nháp từ tình huống để đưa vào curriculum.

### Quyết định cần chốt trước Stage 4–5

| # | Câu hỏi |
|---|---|
| Q8 | Bài người học tự sinh: ai được tạo (mọi gói hay gói trả phí), giới hạn bao nhiêu bài mỗi ngày? |
| Q9 | Bài do AI sinh từ người học có được admin "nhận về" làm nội dung chung không (giống chức năng chuyển bài hiện có)? |
| Q10 | Danh mục tình huống chuẩn gồm những gì, chia theo trình độ và đối tượng ra sao? |
| Q11 | Nhà cung cấp AI và ngân sách cho việc sinh bài (khác với ngân sách chấm nói ở Q4). |

---

## P4 – Tính năng bổ trợ (làm dần, theo ưu tiên sản phẩm)

| # | Việc | Ghi chú |
|---|---|---|
| 4.1 | **8.1 Hỗ trợ học:** sửa phát âm tự động, chỉnh tốc độ nghe. Mọi lần dùng hỗ trợ ghi vào mức hỗ trợ. | Dùng lại STT của Stage 3 |
| 4.2 | **8.2 Động lực:** nhiệm vụ, câu chuyện có nhân vật đồng hành (cho trẻ), mở khoá nội dung; thưởng gắn với "đạt bài", không chỉ với số lượt làm. | Hiện có pet, XP, badge, streak, weekly goal |
| 4.3 | **8.3 Thực hành mở rộng:**<br>- mini game: các flag `wordMatchGame`, `fillBlankGame`, `tenseQuizGame`, `sentenceOrderGame` đã có nhưng chưa có UI;<br>- nhập vai với AI theo tình huống bài;<br>- chế độ đấu, nhiệm vụ đội. | ⚠️ Chi phí AI |
| 4.4 | **8.4 Nguồn mới:** bài hát, phim, nhân vật, nguồn lời nói. | Sau Stage 4 |
| 4.5 | **8.5 Quản lý việc học:** dùng sở thích, lịch sử, báo cáo để định hướng học tiếp; phụ huynh / giáo viên giao bài. | Cần 3.3, 3.5 |
| 4.6 | **8.7 Vận hành:** admin cấu hình quy tắc thưởng và nội dung thông báo. | |
| 4.7 | **Hub bài tự tạo** hiện các hàng như bài curriculum (snapshot của bài người học đang trả `lesson_items: []`, G1 của PR 7). | Làm cùng Stage 4 |
| 4.8 | **Ma trận lặp lại item ở cấp level** (hiện mới có ở cấp unit). | Khi có nhu cầu thật (F3 của PR 4) |

---

## P5 – Dọn dẹp kỹ thuật nhỏ (không gấp)

| # | Việc | Nguồn |
|---|---|---|
| 5.1 | Khoá i18n `lessonFlow.show_model` / `show_model_hint` không còn dùng sau PR 11. Xoá khi được duyệt. | PR 11 §11 |
| 5.2 | Ba bản copy logic `acceptedAnswers` (server, admin, app) và luật gợi ý cố định (admin preview, app): giữ đồng bộ bằng fixture `accepted-answers.json`. Cân nhắc gom vào một package dùng chung nếu sau này có monorepo. | PR 8–11 |
| 5.3 | `getDueFlashcardsByItemKeys` đang lọc trong bộ nhớ; chuyển sang SQL nếu hàng đợi ôn lớn. | PR 10 §13 |
| 5.4 | Giảm dần ngân sách warning lint của app (đang 178/281) khi đụng tới file cũ. | Quy ước code |
| 5.5 | Route cũ `/v1/ai/analyses` (module `aiAnalysis`): chưa thấy app / admin gọi. Kiểm tra client và log production, xoá khi được duyệt. Luồng tạo bài và phân tích câu khi bấm **giữ nguyên** (Stage 4 cần). | Rà soát AI 2026-10-08 |

---

## Phụ lục A – Chạy thử local (cho P0)

**Server và admin:**
```sh
cd LingoBites-Server && git checkout claude/optimistic-bell-mfgk44
corepack enable && yarn install --frozen-lockfile
cp .env.example .env            # đặt ADMIN_USERNAME, ADMIN_CODE; AI_PROVIDER=mock
docker compose up -d db
export DATABASE_URL=postgresql://lingobites:lingobites@localhost:5432/lingobites
yarn prisma generate            # sinh lại Prisma client theo schema mới (bắt buộc sau khi đổi nhánh)
yarn db:reset                   # ⚠️ xoá sạch DB local
yarn admin-web:build
yarn dev                        # tự chạy migration khi khởi động
yarn seed:sample-unit           # chạy ở terminal khác: nạp unit mẫu "Gọi đồ uống"
```
Admin mở ở `http://localhost:3000/admin`.

**App:**
```sh
cd LingoBites-App && git checkout claude/optimistic-bell-mfgk44 && yarn install
# .env.development: API_BASE_URL = http://127.0.0.1:3000 (iOS sim) | http://10.0.2.2:3000 (Android emu) | IP LAN (máy thật)
yarn ios:dev                    # hoặc yarn android:dev
```

**Danh sách cần thử trên app:**

| Chỗ | Thao tác | Kết quả mong đợi |
|---|---|---|
| Hub | Mở unit "Gọi đồ uống" → bài L01 | Có nút "Học theo 6 bước", không có nút "Hoàn thành bài" |
| Mọi bước | Thoát giữa chừng rồi vào lại | Mở đúng bước đang học dở |
| Bước 3 | Nghe câu mẫu, ghi âm, nghe lại bản ghi, Đạt / Chưa đạt | **Quan trọng:** thử trên máy thật |
| Bước 4 | Mở gợi ý từng mức | Kết quả ghi "có gợi ý" |
| Bước 5 | Xem tình huống, ghi âm, tick tiêu chí, rồi "Xem câu tham khảo" | Không có câu mẫu và gợi ý trước khi tick tiêu chí |
| Bước 6 | Xem kết quả | Tách "Luyện tập" / "Vận dụng"; hub hiện "Đã hoàn thành phần luyện" |
| Mạng | Tắt mạng khi học, rồi bật lại | Lượt làm được sync lên server |
| Quyền micro | Từ chối quyền micro | Vẫn tự đánh giá được |

**Giai đoạn 2 – chạy thử (P2.5).** Staging: `yarn db:reset:staging` (⚠️ mất dữ liệu cũ) → deploy → `yarn seed:curriculum:staging`. Production: `yarn seed:curriculum --draft`, người phụ trách nội dung đọc lại rồi publish.

| Chỗ | Thao tác | Kết quả mong đợi |
|---|---|---|
| Onboarding | Tài khoản mới: nhập tên → 4 bước (nhóm tuổi, mục tiêu, sở thích, thời gian) | Qua từng bước được, "Quay lại" giữ lựa chọn |
| Onboarding | Bấm "Để sau" ở bước đầu | Vào app ngay; Hồ sơ học tập hiện A1, người lớn |
| Kiểm tra đầu vào | Làm đúng hết | Gợi ý A2; chọn "Bắt đầu A2" → Home có thẻ "Lộ trình của bạn: A2" |
| Kiểm tra đầu vào | Làm sai hết / thoát giữa chừng / tắt mạng | Gợi ý A1 hoặc vào thẳng A1, không kẹt màn hình |
| Kiểm tra đầu vào | Nghe câu hỏi (TTS) trên máy thật | Có tiếng; nút "Nghe lại" đọc lại |
| Offline | Tắt mạng rồi làm onboarding | Vào được app; bật mạng, mở lại app thì hồ sơ lên server |
| Trẻ em | Chọn "Trẻ em" | Không thấy unit "Khách sạn, du lịch"; bước 5 chỉ tự đánh giá |
| Hồ sơ học tập | Tab Hồ sơ → "Hồ sơ học tập": đổi trình độ, làm lại bài kiểm tra | Thẻ Home đổi theo trình độ mới |
| Nội dung | Học trọn 1 unit A1 và 1 unit A2 (6 bước + nhiệm vụ tổng hợp) | Không lỗi nội dung; chấm câu viết ở bước 5 bài 3 đúng |
| Ôn | Hôm sau mở Today | Có item của bài đã học trong lượt ôn |
