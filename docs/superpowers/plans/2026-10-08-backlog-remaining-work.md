# Backlog: những việc chưa làm (sắp theo độ ưu tiên)

> Lập ngày 2026-10-08, sau khi xong **Stage 1 và Stage 2** (PR 1–11) của `2026-10-07-backward-design-curriculum-plan.md`.
> Mục đích: một chỗ duy nhất liệt kê mọi việc còn lại, để làm tiếp không bị sót.
> Cập nhật file này mỗi khi xong hoặc thêm một việc.

**Trạng thái hiện tại:**
- Code PR 1–11 nằm trên nhánh `claude/optimistic-bell-mfgk44` của cả hai repo (`LingoBites-App`, `LingoBites-Server`), **chưa merge vào main, chưa mở pull request**.
- Plan chi tiết từng PR (kèm phần "điểm lệch") nằm trong thư mục này: `2026-10-07-pr1-…` → `2026-10-08-pr11-…`.
- Lộ trình 8 bước gốc: `2026-10-07-learning-cycle-requirements-roadmap.md`. Stage 0–3 của plan curriculum ứng với bước 2–6 của lộ trình này.

**Thang ưu tiên:**

| Mức | Ý nghĩa |
|---|---|
| **P0** | Làm ngay: kiểm thử và đưa code đã viết vào nhánh chính |
| **P1** | Việc chặn Stage 3 (cần quyết định hoặc chuẩn bị trước) |
| **P2** | Stage 3: khép kín vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn |
| **P3** | Ra được sản phẩm cho người dùng thật |
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

## P1 – Quyết định và chuẩn bị trước Stage 3

| # | Việc | Ai | Chặn |
|---|---|---|---|
| 1.1 | **Q4: chọn nhà cung cấp STT và chấm phát âm**, ngân sách mỗi lượt. ⚠️ Dependency và chi phí mới, cần duyệt. | Team | Spike, PR 12b |
| 1.2 | **Spike STT**: so sánh 2–3 nhà cung cấp trên câu của unit mẫu, giọng Việt, người lớn và trẻ em. Đo độ chính xác, độ trễ, chi phí. Cần API key thật. | Code | PR 12b |
| 1.3 | **Q1: ngưỡng đạt từng tiêu chí**; lỗi nào mặc định là `blocking` hay `tolerated`. | Team | PR 12, 13 |
| 1.4 | **Q3: khoảng ôn và điều kiện "ghi nhớ ổn định"**, cách điều chỉnh khi quên. | Team | PR 13, 15 |
| 1.5 | **Q7: bài `extended`** (người học tự tạo) có tính vào lịch ôn item không. | Team | PR 13 |
| 1.6 | **Chính sách dữ liệu giọng nói và dữ liệu trẻ em**: consent của phụ huynh, thời hạn lưu, không log nội dung. App đã có luồng upload bản ghi kèm consent của shadowing để tái dùng. | Team | Spike, PR 12b, 14 |
| 1.7 | **Q5: item `draft` do AI tạo** từ bài người học: admin có duyệt để đưa vào danh mục chung không. | Team | Không chặn Stage 3; cần trước khi mở rộng danh mục |
| 1.8 | **Q6: một item dùng chung** cho trẻ em và người lớn, hay tách theo đối tượng (ảnh, ví dụ khác nhau). | Team | Bước 1 của lộ trình |

---

## P2 – Stage 3 (khoảng 7 PR)

Mỗi PR cần plan chi tiết riêng được duyệt trước (VibeGuard).

| # | PR | Repo | Nội dung | Phụ thuộc |
|---|---|---|---|---|
| 2.1 | **PR 12a** – `evaluationService` phần luật | server | Chấm câu viết và câu chọn theo tiêu chí:<br>- content: khớp mẫu câu hoặc biến thể (đã có `acceptedAnswers`);<br>- purpose: dùng luật;<br>- independence: lấy từ `support_level`;<br>- khớp lỗi thường gặp: lỗi `tolerated` không làm trượt.<br>Lượt lỗi → `unscorable`. Payload lượt làm thêm `assessed_by: service`, mã lỗi và tiêu chí. | 1.3 |
| 2.2 | **PR 12b** – chấm nói | server | STT + chấm phát âm (clarity); purpose dùng AI khi luật không đủ; nhận bản ghi âm. | 1.1, 1.2, 1.6 |
| 2.3 | **PR 13** – mức hoàn thành và ghi nhớ | server | - `lesson_outcomes.passed_at` = xong phần luyện **và** có lượt `pass_independent` ở task `independent`;<br>- `unit_outcomes` = đạt các bài bắt buộc **và** nhiệm vụ tổng hợp;<br>- bảng `item_memory` và lịch ôn theo item: quên → `needs_review`, giữ `passed_at`;<br>- collection pull `lesson_outcomes` / `item_memory` về app. | 2.1, 1.4, 1.5 |
| 2.4 | **PR 14** – phản hồi và kết quả | app | - Màn vận dụng gửi bản ghi hoặc câu viết để chấm;<br>- **phản hồi 4 trạng thái**: Đạt / Đạt có gợi ý / Chưa đạt (chỉ lỗi chính, dẫn về bài luyện) / Không chấm được;<br>- màn kết quả bài thật sự;<br>- tiến độ unit tách "đã học" với "đã đạt";<br>- màn nhiệm vụ tổng hợp của unit. | 2.1–2.3 |
| 2.5 | **PR 15** – ôn tập và gợi ý học tiếp | app | - Ôn theo item: với mẫu câu, người học nói và được chấm;<br>- `today/adaptationEngine` đọc kết quả chấm và `item_memory` thay cho số bài đã làm;<br>- bước 1 "Ôn liên quan" dùng `item_memory`. | 2.3 |
| 2.6 | **PR 16** – admin cấu hình và thống kê | admin | - Cấu hình ngưỡng đạt, khoảng ôn, điều kiện ghi nhớ;<br>- xem lượt làm của từng user (tiêu chí, lỗi, mức hỗ trợ, nghe lại bản ghi);<br>- thống kê theo bài: tỷ lệ đạt độc lập, lỗi hay gặp. | 2.1–2.3 |

**Việc nhỏ dời sang Stage 3** (ghi trong phần "điểm lệch" của các plan):

| # | Việc | Nguồn | Gộp vào |
|---|---|---|---|
| 2.7 | Lượt làm **kéo về từ máy khác** chưa tự ghi "complete" cho bài; nên dựa vào `lesson_outcomes` pull từ server. | PR 10 §13 | PR 13 / 14 |
| 2.8 | Task bước 5 có `response_mode = choose` vẫn chạy như hoạt động luyện (còn gợi ý). Seed chưa có trường hợp này. | PR 11 §11 | PR 14 |
| 2.9 | Màn vận dụng: phần nói chỉ ghi âm **một lần cho cả tình huống**, chưa ghi từng lượt. | PR 11 §11 | PR 14 (khi chấm nói) |
| 2.10 | Preview admin dùng nhãn kết quả riêng (`independent` / `with_hint` / `not_yet`), khác enum `outcome` của lượt làm (`pass_independent` …). Nên thống nhất khi preview hiện kết quả chấm thật. | PR 9 | PR 16 |
| 2.11 | Ghi âm và chấm nói trong preview admin. | PR 9 | PR 16 |
| 2.12 | Nhiệm vụ tổng hợp của unit chưa chặn publish unit, mới chỉ cảnh báo (D5). | PR 2 | PR 13 |

**Stage 3 xong khi:** unit mẫu đi trọn vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn; lượt `unscorable` không bị tính là sai; quên một item không xoá trạng thái đã đạt bài.

---

## P3 – Để ra sản phẩm cho người dùng thật

| # | Việc | Ai | Ghi chú |
|---|---|---|---|
| 3.1 | **Bước 0 của lộ trình – chốt cấu hình:**<br>- danh mục trình độ;<br>- nội dung bắt buộc từng bài;<br>- cách áp 70/25/5;<br>- quyền xem của phụ huynh / giáo viên;<br>- quy tắc thưởng;<br>- các gói kinh doanh. | Team | Chặn nhiều mục bên dưới |
| 3.2 | **Soạn nội dung thật** trên admin: đủ course → level → unit → lesson. Hiện mới có **một unit mẫu "Gọi đồ uống"**. | Team | Dùng "Sinh nháp từ mẫu câu" để tiết kiệm công |
| 3.3 | **Bước 1 – Hồ sơ người học và kiểm tra đầu vào** (khoảng 2–3 PR):<br>- nhóm đối tượng (trẻ 6–11 / người lớn), trình độ, mục tiêu, sở thích, khả năng đọc/viết;<br>- onboarding hỏi các thông tin trên + bài kiểm tra đầu vào ngắn → đề xuất điểm bắt đầu;<br>- course / unit gắn với nhóm đối tượng. | Code | ⚠️ Migration DB, đổi API profile; cần 1.8 |
| 3.4 | **8.4 – Bài tự tạo có mục tiêu và tiêu chí**: pipeline AI (text, ảnh, YouTube) sinh thêm can-do, item trọng tâm, nhiệm vụ vận dụng, tiêu chí, để bài tự tạo cũng chạy được player 6 bước. | Code | Cần 1.7; có thể làm song song Stage 3 |
| 3.5 | **Bước 7 – Báo cáo tiến độ, phụ huynh / giáo viên** (khoảng 3–4 PR):<br>- báo cáo theo tuần: hoạt động, mục tiêu đã đạt, lỗi hay gặp, phần cần luyện;<br>- tách "học đều" với "dùng tốt"; câu mô tả năng lực;<br>- tài khoản phụ huynh / giáo viên, liên kết, quyền xem, đề xuất bài. | Code | Cần Stage 3 và 3.1 |
| 3.6 | **8.6 – Kinh doanh**: gói thuê bao, gói gia đình (gắn vai trò phụ huynh), referral, ưu đãi, thanh toán qua store. | Code | ⚠️ Dependency thanh toán, cần duyệt; hiện mới có quyền theo từng khoá |
| 3.7 | **8.7 – Thông báo push từ server** dẫn thẳng tới bài hoặc lượt ôn đến hạn, tách khỏi thông báo marketing. Hiện mới là thông báo local. | Code | Cần PR 13 (`item_memory`) |

---

## P4 – Tính năng bổ trợ (làm dần, theo ưu tiên sản phẩm)

| # | Việc | Ghi chú |
|---|---|---|
| 4.1 | **8.1 Hỗ trợ học:** sửa phát âm tự động, chỉnh tốc độ nghe. Mọi lần dùng hỗ trợ ghi vào mức hỗ trợ. | Dùng lại STT của Stage 3 |
| 4.2 | **8.2 Động lực:** nhiệm vụ, câu chuyện có nhân vật đồng hành (cho trẻ), mở khoá nội dung; thưởng gắn với "đạt bài", không chỉ với số lượt làm. | Hiện có pet, XP, badge, streak, weekly goal |
| 4.3 | **8.3 Thực hành mở rộng:**<br>- mini game: các flag `wordMatchGame`, `fillBlankGame`, `tenseQuizGame`, `sentenceOrderGame` đã có nhưng chưa có UI;<br>- nhập vai với AI theo tình huống bài;<br>- chế độ đấu, nhiệm vụ đội. | ⚠️ Chi phí AI |
| 4.4 | **8.4 Nguồn mới:** bài hát, phim, nhân vật, nguồn lời nói. | Sau 3.4 |
| 4.5 | **8.5 Quản lý việc học:** dùng sở thích, lịch sử, báo cáo để định hướng học tiếp; phụ huynh / giáo viên giao bài. | Cần 3.3, 3.5 |
| 4.6 | **8.7 Vận hành:** admin cấu hình quy tắc thưởng và nội dung thông báo. | |
| 4.7 | **Hub bài tự tạo** hiện các hàng như bài curriculum (snapshot của bài người học đang trả `lesson_items: []`, G1 của PR 7). | Làm cùng 3.4 |
| 4.8 | **Ma trận lặp lại item ở cấp level** (hiện mới có ở cấp unit). | Khi có nhu cầu thật (F3 của PR 4) |

---

## P5 – Dọn dẹp kỹ thuật nhỏ (không gấp)

| # | Việc | Nguồn |
|---|---|---|
| 5.1 | Khoá i18n `lessonFlow.show_model` / `show_model_hint` không còn dùng sau PR 11. Xoá khi được duyệt. | PR 11 §11 |
| 5.2 | Ba bản copy logic `acceptedAnswers` (server, admin, app) và luật gợi ý cố định (admin preview, app): giữ đồng bộ bằng fixture `accepted-answers.json`. Cân nhắc gom vào một package dùng chung nếu sau này có monorepo. | PR 8–11 |
| 5.3 | `getDueFlashcardsByItemKeys` đang lọc trong bộ nhớ; chuyển sang SQL nếu hàng đợi ôn lớn. | PR 10 §13 |
| 5.4 | Giảm dần ngân sách warning lint của app (đang 178/281) khi đụng tới file cũ. | Quy ước code |

---

## Phụ lục A – Chạy thử local (cho P0)

**Server và admin:**
```sh
cd LingoBites-Server && git checkout claude/optimistic-bell-mfgk44
corepack enable && yarn install --frozen-lockfile
cp .env.example .env            # đặt ADMIN_USERNAME, ADMIN_CODE; AI_PROVIDER=mock
docker compose up -d db
export DATABASE_URL=postgresql://lingobites:lingobites@localhost:5432/lingobites
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
