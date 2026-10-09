# Giai đoạn 2 – Ra bản chạy thử (plan)

> Lập 2026-10-09. Duyệt "ok" 2026-10-09. **ĐÃ CODE** P2.0–P2.4 (nhánh `claude/zen-babbage-njiyn1`, cả hai repo); P2.5 (chạy thử trên staging) do team làm. Xem mục 7.
> Nguồn: `2026-10-08-remaining-work-plan.md` mục "Giai đoạn 2", backlog 3.1–3.3, bảng chốt 5.4.
> Phạm vi do người dùng chốt: **bỏ qua quyền phụ huynh / giáo viên** (cả consent phụ huynh ở Bước 1); làm sẵn nội dung mẫu **A1 + A2** gồm các chủ đề người học hay cần.

---

## 0. Mục tiêu và "xong khi"

**Mục tiêu:** có một bản app + server chạy thử được với người dùng thật (nội bộ / nhóm nhỏ):

1. Người mới mở app → onboarding (tên, nhóm tuổi, mục tiêu, sở thích, thời gian học) → bài kiểm tra đầu vào ngắn (bỏ qua được) → app đề xuất điểm bắt đầu (A1 hoặc A2).
2. Có **14 unit / 42 bài** A1 + A2 đã publish trên staging, mỗi bài đủ 6 bước, mỗi unit có nhiệm vụ tổng hợp.
3. Học trọn vòng Học → Vận dụng → Đánh giá → Ghi nhận → Ôn trên nội dung đó (dùng Stage 3 đã có).

**Xong khi:**
- `yarn seed:curriculum` trên DB trống nạp đủ 14 unit, **0 vi phạm** spec-check, tỷ lệ kỹ năng từng unit nằm trong 70/25/5 ± 10.
- Tài khoản mới đi hết onboarding + kiểm tra đầu vào trên máy thật, được đưa tới đúng unit đầu tiên của trình độ đề xuất.
- Đổi trình độ / mục tiêu được trong Cài đặt.

**Không làm trong giai đoạn này:**
- quyền phụ huynh / giáo viên, liên kết tài khoản, consent phụ huynh;
- gói trả phí, thanh toán (C8 chỉ chốt trên giấy);
- nội dung Pre-A1 cho trẻ (C6), nhóm 12–15 tuổi;
- gợi ý tình huống theo sở thích (S5.4: dữ liệu sở thích được lưu sẵn ở PR P2.3 để dùng sau).

---

## 1. Chia việc (5 PR + 1 tài liệu)

| # | Repo | Nội dung | Cần trước | Ước lượng |
|---|---|---|---|---|
| **P2.0** | app (docs) | Chốt cấu hình Bước 0 thành tài liệu `2026-10-09-phase2-step0-config.md` | Duyệt plan này | nhỏ |
| **P2.1** | server | Khung seed curriculum (dùng chung cho mọi unit) + **unit A1** (7 unit mới + unit "Gọi đồ uống" sẵn có) | P2.0 (C1, C3) | lớn (chủ yếu là nội dung) |
| **P2.2** | server | **Unit A2** (6 unit) + bộ câu hỏi kiểm tra đầu vào | P2.1 | lớn (nội dung) |
| **P2.3** | server | Hồ sơ người học + API kiểm tra đầu vào + lọc course theo nhóm tuổi. ⚠️ migration `012` | P2.0 (C2, C4, C5) | vừa |
| **P2.4** | app | Onboarding 4 màn + kiểm tra đầu vào + màn kết quả + sửa hồ sơ trong Cài đặt + điểm bắt đầu trên Today | P2.3 | vừa–lớn |
| **P2.5** | cả hai | Chuẩn bị chạy thử: seed staging, checklist test tay, đánh dấu tiến độ | P2.1–P2.4 | nhỏ |

P2.1–P2.2 (nội dung) và P2.3 (hồ sơ) độc lập nhau, nên làm song song được. P2.4 chỉ cần P2.3.

Thứ tự đề xuất nếu một người làm: **P2.0 → P2.1 → P2.3 → P2.4 → P2.2 → P2.5**. Có A1 trước thì chạy thử sớm được; A2 thêm vào sau, không đổi code.

---

## 2. P2.0 – Chốt cấu hình Bước 0 (bỏ phần phụ huynh / giáo viên)

Viết `docs/superpowers/plans/2026-10-09-phase2-step0-config.md`. Mỗi dòng dùng đề xuất ở bảng 5.4 nếu team không ghi khác:

| # | Mục | Giá trị dùng cho bản chạy thử |
|---|---|---|
| C1 | Trình độ | A1, A2 có nội dung; B1 để sau. Pre-A1 có trong danh mục nhưng chưa có bài. Mã level = `A1`, `A2`. |
| C2 | Nhóm tuổi | `kids` (6–11), `adults` (≥ 16). Dùng giá trị `audience` sẵn có trong DB (`all` / `kids` / `adults`). |
| Q6 | Item chung hay tách | Dùng chung item; tách ở unit. Toàn bộ 14 unit để `audience = all`, trừ những unit ghi `adults` ở mục 3. |
| C3 | 70/25/5 | Nói 70 / nghe 25 / viết 5, ± 10, tính theo unit, chỉ cảnh báo (đúng như validator hiện tại). |
| C4 | Kiểm tra đầu vào | 12 câu nghe + chọn (6 A1, 6 A2), không nói, ~5 phút, bỏ qua được, chỉ **đề xuất**. |
| C5 | Hỏi gì ở onboarding | Nhóm tuổi; mục tiêu (giao tiếp / du lịch / công việc / trường học); sở thích (tối đa 3); thời gian học mỗi ngày (5 / 10 / 15 / 20 phút). |
| C6 | Nội dung khi chạy thử | A1: 8 unit × 3 bài; A2: 6 unit × 3 bài (mục 3). |
| C7 | Thưởng | Giữ cơ chế XP / streak hiện có; **không code thêm** trong giai đoạn này. |
| C8 | Gói | Chỉ ghi lại đề xuất; chạy thử miễn phí toàn bộ. |
| T5 | Ai publish | Seed chạy trên **local / staging** thì tự publish. Trên **production**, seed chạy với `--draft` và người phụ trách nội dung bấm publish. |
| — | Phụ huynh / giáo viên | **Bỏ qua.** Tài khoản `kids` không được chấm máy (A11 giữ nguyên), chỉ tự đánh giá. |

---

## 3. Nội dung mẫu A1 + A2 (P2.1, P2.2)

### 3.1 Cấu trúc course

**Đề xuất (cần duyệt):** một course **"Tiếng Anh giao tiếp"** (`slug = tieng-anh-giao-tiep`) gồm 2 level `A1`, `A2`. Unit "Gọi đồ uống" sẵn có chuyển vào làm **unit 4 của A1**, giữ nguyên mã bài `A1-DRINKS-L01..03`.

- ⚠️ Phải sửa `SAMPLE_COURSE` của seed mẫu (đang là `a1-giao-tiep` / "A1 Giao tiếp"), nên DB đã seed trước đó phải `db:reset`. Staging cũng đã lên lịch reset ở Giai đoạn 0.
- Phương án khác: giữ course `a1-giao-tiep`, thêm course `a2-giao-tiep` riêng. Không cần reset, nhưng app sẽ hiện 2 course rời nhau và kiểm tra đầu vào phải chọn course thay vì chọn level.

### 3.2 Khuôn một bài (giữ như bài mẫu, để qua validator)

Mỗi bài có:
- can-do;
- tình huống;
- 1 mẫu câu `required` mới (hoặc 1 câu nghe `listening`);
- 3–6 từ / cụm `extended`;
- 1 nhiệm vụ độc lập (bước 5) kèm gợi ý 3 mức.

Các bước:

| Bước | Block | Kỹ năng | Thời lượng |
|---|---|---|---|
| 1 | thẻ item ôn (bài 2, 3 của unit) | nói | 60s |
| 2 | thẻ item mới | nghe | 120s |
| 3 | `listen_and_repeat` 3 câu | nói | 150–180s |
| 4 | `speaking_drill` đổi slot, **hoặc** `multiple_choice` / `fill_blank` nghe hiểu; mỗi unit có ≥ 1 `translation` (viết) | nói / nghe / viết | 150–180s |
| 5 | `role_play` theo nhiệm vụ độc lập (nói; mỗi unit 1 bài nhiệm vụ **viết** để đủ phần viết) | nói / viết | 120s |

Nhiệm vụ tổng hợp của unit gộp các mẫu câu `required` của 3 bài.

Nội dung bằng tiếng Anh. Tình huống, gợi ý, phản hồi bằng tiếng Việt (D4).

### 3.3 Danh mục A1 (8 unit, 24 bài; 21 bài mới)

| # | Unit (mã) | Bài 1 | Bài 2 | Bài 3 | Nhiệm vụ tổng hợp |
|---|---|---|---|---|---|
| 1 | **Chào hỏi và giới thiệu** (`A1-HELLO`) | Chào, nói tên: *Hi, I'm {name}. Nice to meet you.* | Quê quán: *Where are you from?* → *I'm from {country}.* | Nghề nghiệp: *What do you do?* → *I'm a {job}.* (bước 5 viết: tin nhắn tự giới thiệu) | Tự giới thiệu với người mới quen: tên, quê, nghề |
| 2 | **Số, tuổi, liên lạc** (`A1-NUMBERS`) | Tuổi: *I'm {age} years old.* | Số điện thoại: nghe *What's your phone number?* → *It's …* | Đánh vần: *Can you spell that?* → *It's T-A-M.* (viết: nhắn số điện thoại / email) | Trao đổi thông tin liên lạc với bạn mới |
| 3 | **Gia đình** (`A1-FAMILY`) | *This is my {family member}.* | *Do you have any brothers or sisters?* → *I have {number} {sibling}.* | Miêu tả: *He's / She's {adjective}.* | Giới thiệu gia đình qua một bức ảnh |
| 4 | **Gọi đồ uống** (`A1-DRINKS`, sẵn có) | Gọi đồ uống kèm cỡ | Nói cỡ, trả lời người bán | Gọi đồ ăn (viết) | Gọi đồ uống + đồ ăn |
| 5 | **Mua sắm, hỏi giá** (`A1-SHOP`) | *How much is this {item}?* | Nghe giá: *It's {price}.* → *I'll take it.* / *That's too expensive.* | *Do you have {item}?* (viết: nhắn shop hỏi hàng) | Mua một món: hỏi có hàng, hỏi giá, quyết định mua |
| 6 | **Giờ giấc, thói quen** (`A1-TIME`) | *What time is it?* → *It's {time}.* | *I {routine verb} at {time}.* | *What time do you {activity}?* (viết: kể lịch một ngày) | Kể một ngày của mình, hỏi lại bạn |
| 7 | **Hỏi đường** (`A1-DIRECTIONS`) | *Where is the {place}?* | Nghe chỉ đường: *Go straight. Turn left / right. It's next to …* | *Is there a {place} near here?* | Hỏi đường tới một nơi, nhắc lại chỉ dẫn |
| 8 | **Sở thích** (`A1-HOBBIES`) | *I like {activity}.* | *Do you like {activity}?* → *Yes, I do. / No, I don't.* | *I can {ability}.* / *Can you {ability}?* (viết) | Nói chuyện sở thích với bạn mới |

### 3.4 Danh mục A2 (6 unit, 18 bài)

| # | Unit (mã) | Bài 1 | Bài 2 | Bài 3 | Nhiệm vụ tổng hợp |
|---|---|---|---|---|---|
| 1 | **Kể chuyện cuối tuần** (`A2-PAST`) | *Yesterday I {past verb} …* | *What did you do last weekend?* | *It was {adjective}.* (viết: nhắn kể cuối tuần) | Kể cuối tuần, trả lời câu hỏi của bạn |
| 2 | **Hẹn gặp, kế hoạch** (`A2-PLANS`) | *Are you free on {day}?* | *Let's {activity} at {time}.* / *How about …?* | *I'm going to {plan}.* / *Sorry, I can't. I have to …* | Hẹn bạn đi chơi, thống nhất ngày giờ |
| 3 | **Nhà hàng** (`A2-RESTAURANT`) | Đặt bàn: *I'd like to book a table for {number} at {time}.* | Gọi món: nghe *Are you ready to order?* → *I'll have the {dish}.* | *Could we have the bill, please?* (viết: đặt bàn qua tin nhắn) | Đặt bàn, gọi món, thanh toán |
| 4 | **Khách sạn, du lịch** (`A2-HOTEL`, `adults`) | *I have a reservation under {name}.* | *Is breakfast included?* / *What time is check-out?* | *The {thing} in my room doesn't work.* (viết: email báo sự cố) | Nhận phòng, hỏi dịch vụ, báo sự cố |
| 5 | **Sức khoẻ** (`A2-HEALTH`) | *I have a {symptom}.* | Nghe bác sĩ: *How long have you had it?* → *For {duration}.* | Hiệu thuốc: *Do you have something for {symptom}?* | Đi khám: kể triệu chứng, trả lời, nghe lời khuyên |
| 6 | **Mua quần áo** (`A2-CLOTHES`) | *Do you have this in {size / colour}?* | *Can I try it on?* | *I'd like to return this. It's too {adjective}.* (viết) | Mua, thử, đổi một món đồ |

**Ước tính khối lượng:**
- ~42 mẫu câu, ~14 câu nghe, ~250 từ / cụm (đã tính dùng chung giữa các bài);
- ~42 nhiệm vụ độc lập + 14 nhiệm vụ tổng hợp.

Item dùng lại giữa các bài thì ghi `introduction = recycled`.

IPA: ghi tay cho từ đơn; cụm và mẫu câu để trống (đúng như bài mẫu hiện tại).

> ⚠️ Nội dung do kỹ thuật soạn là **bản nháp chất lượng chạy thử**. Người phụ trách nội dung (T5) cần đọc lại trước khi lên production.

### 3.5 Code cho P2.1 (repo server)

| File | Việc |
|---|---|
| `scripts/curriculum/types.ts` (mới) | Chuyển các kiểu `ItemSeed`, `LessonSeed` từ `sampleUnit/content.ts` sang đây; thêm `UnitSeed` (unit + bài + nhiệm vụ tổng hợp). |
| `scripts/curriculum/seedUnit.ts` (mới) | Tách thân hàm `seedSampleUnit` thành `seedCurriculum(prisma, course, levels[])`. Vẫn qua các store của admin, vẫn idempotent (item theo code, bài theo mã, unit theo slug). Thêm cờ `--draft`: không publish. |
| `scripts/curriculum/content/a1/*.ts` (mới) | Mỗi unit một file: `hello.ts`, `numbers.ts`, `family.ts`, `shop.ts`, `time.ts`, `directions.ts`, `hobbies.ts`. |
| `scripts/curriculum/content/a1/drinks.ts` | Chuyển nội dung từ `sampleUnit/content.ts` sang (giữ nguyên câu chữ và mã bài). |
| `scripts/curriculum/content/index.ts` (mới) | Khai báo course "Tiếng Anh giao tiếp" → level A1 (8 unit), A2. |
| `scripts/seed-curriculum.ts` (mới) + `package.json` | Lệnh `seed:curriculum`, `seed:curriculum:staging`. |
| `scripts/sampleUnit/*`, `scripts/seed-sample-unit.ts` | ⚠️ **Đề xuất xoá** sau khi đã chuyển sang khung mới; `seed:sample-unit` trỏ sang `seed:curriculum --only A1-DRINKS` để không gãy tài liệu cũ. **Cần duyệt riêng.** |
| `test/curriculumContent.test.ts` (mới, unit) | Chạy `checkLessonSpec` cho mọi bài, `checkUnitSpec` + `skillBalance` cho mọi unit, schema `ActivityContentSchemas` cho mọi block. Không cần DB. |
| `test/seedCurriculum.db.test.ts` (mới, db) | Seed 2 lần trên DB trống: lần 2 không tạo thêm gì; đủ số unit / bài; mọi bài `published`; `--draft` thì không publish. |

**P2.2** dùng lại khung này, chỉ thêm `scripts/curriculum/content/a2/*.ts` (6 file) và `scripts/curriculum/placement.ts` (bộ 12 câu hỏi, mục 4.2).

**Không** thêm thư viện mới.

---

## 4. Bước 1 – Hồ sơ người học + kiểm tra đầu vào (P2.3, P2.4)

### 4.1 P2.3 – Server

⚠️ **Migration `012_learner_profiles`** (có file `.down.sql`):

```sql
CREATE TABLE learner_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age_group        varchar(8)  NOT NULL CHECK (age_group IN ('kids','adults')),
  level_code       varchar(8)  NOT NULL,            -- A1 | A2 (C1)
  goals            text[]      NOT NULL DEFAULT '{}', -- communication|travel|work|school
  interests        text[]      NOT NULL DEFAULT '{}', -- tối đa 3
  daily_minutes    smallint    NOT NULL DEFAULT 10,
  placement_score  jsonb,                           -- {a1: 5, a2: 2, total: 12} | null nếu bỏ qua
  placement_at     timestamptz,
  onboarded_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

| File | Việc |
|---|---|
| `src/common/database/migrations/012_learner_profiles.sql` / `.down.sql` | Bảng trên. |
| `prisma/schema.prisma` | Model `LearnerProfiles`, quan hệ với `Users`. |
| `src/modules/learnerProfile/` (mới: `model`, `repository`, `service`, `routes`) | `GET /v1/me/learner-profile` (404 khi chưa có), `PUT /v1/me/learner-profile` (zod: tối đa 3 sở thích, mục tiêu trong danh sách C5). |
| `src/modules/learnerProfile/placement/` | `GET /v1/placement/test`: 12 câu (câu tiếng Anh để app đọc bằng TTS, 3–4 lựa chọn, **không** gửi đáp án). `POST /v1/placement/submit` `{answers}` → chấm trên server, trả `{ suggestedLevel, score }`, ghi `placement_score`. |
| Luật đề xuất trình độ | A1 đúng ≥ 5/6 **và** A2 đúng ≥ 4/6 → `A2`; còn lại → `A1`. Pre-A1 chưa có bài nên không đề xuất. |
| `/v1/courses`, `/v1/levels/:levelId/units` | Khi user có `age_group = kids`, ẩn course / unit `audience = adults`. Người lớn thấy hết. Chưa có hồ sơ thì giữ như hiện nay. |
| Evaluation capabilities | `age_group = kids` → chấm máy tắt (A11: chỉ tự đánh giá). |
| Test | Unit: luật đề xuất, zod. DB: migration lên / xuống, `GET` / `PUT`, lọc audience, kids không được chấm máy. |

⚠️ **Thêm API public** (`/v1/me/learner-profile`, `/v1/placement/*`); route cũ không đổi, chỉ thêm bộ lọc.

### 4.2 Bộ câu hỏi kiểm tra đầu vào (soạn trong P2.2)

- 12 câu: 6 A1, 6 A2, lấy từ chính mẫu câu của các unit (mục 3.3, 3.4).
- Mỗi câu: app đọc 1 câu hỏi hoặc 1 câu nói bằng TTS; người học chọn câu đáp đúng hoặc nghĩa đúng.
- Ví dụ:
  - A1: nghe *"Where are you from?"* → chọn *"I'm from Vietnam."*
  - A2: nghe *"What did you do last weekend?"* → chọn *"I visited my grandparents."*
- Ghi trong `scripts/curriculum/placement.ts`, server đọc lúc khởi động (không cần bảng DB). Sửa câu hỏi thì deploy lại.

### 4.3 P2.4 – App

| File | Việc |
|---|---|
| `src/features/account/screens/OnboardingNameScreen.tsx` | Sau khi nhập tên, đi tiếp sang các màn hồ sơ thay vì vào app ngay. |
| `src/features/onboarding/` (mới) | 4 màn ngắn: **Nhóm tuổi** → **Mục tiêu** → **Sở thích** (tối đa 3) → **Thời gian học / ngày**. Sau đó **"Làm bài kiểm tra 5 phút"** hoặc **"Bỏ qua, bắt đầu từ A1"**. |
| `src/features/onboarding/screens/PlacementTestScreen.tsx` | 12 câu, nghe bằng `ttsService` sẵn có, chọn đáp án, thanh tiến độ, thoát giữa chừng thì coi như bỏ qua. |
| `src/features/onboarding/screens/PlacementResultScreen.tsx` | "Đề xuất: A2". Hai nút: **"Bắt đầu A2"** / **"Học từ A1"** (C4: người học tự đổi được). |
| `src/features/profile/screens/LearningProfileScreen.tsx` (mới) | Trong Cài đặt: sửa nhóm tuổi, trình độ, mục tiêu, sở thích, thời gian học; làm lại bài kiểm tra. |
| `src/app/navigation/AppNavigator.tsx` | Thêm route cho onboarding; `BootGate` gửi người chưa có hồ sơ tới onboarding. |
| Today / course | Today ưu tiên "bài tiếp theo" trong **level đã chọn** (B9 giữ nguyên thứ tự: ôn → bài dở → bài tiếp). |
| Lưu cục bộ | Cache hồ sơ trong storage hiện có. Offline vẫn qua onboarding được: lưu tạm, gửi `PUT` khi có mạng. Kiểm tra đầu vào cần mạng; offline thì hiện "Bỏ qua, bắt đầu từ A1". |
| i18n | Chuỗi tiếng Việt cho các màn mới. |
| Test (Jest) | Từng màn, luồng đi hết onboarding, bỏ qua kiểm tra, offline, sửa hồ sơ. |

- Người dùng **cũ** (đã có tài khoản, chưa có hồ sơ): hiện onboarding hồ sơ một lần khi mở app, có nút "Để sau" (mặc định `adults`, A1).
- Không thêm thư viện mới.

---

## 5. P2.5 – Chạy thử

1. Staging: `db:reset:staging` → deploy → `seed:curriculum:staging`. ⚠️ Mất dữ liệu cũ trên staging.
2. Build app trỏ staging (iOS TestFlight / Android internal track theo quy trình hiện có).
3. Checklist test tay, bổ sung vào Phụ lục A của backlog:
   - onboarding người lớn / trẻ;
   - kiểm tra đầu vào: đúng hết, sai hết, bỏ qua;
   - đổi trình độ;
   - học trọn 1 unit A1 và 1 unit A2;
   - ôn hôm sau;
   - tắt mạng giữa onboarding.
4. Cập nhật mục 6 "Theo dõi tiến độ" của `2026-10-08-remaining-work-plan.md`, ghi báo cáo phiên.

---

## 6. Cần duyệt trước khi code

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | Cấu trúc course (mục 3.1) | Một course "Tiếng Anh giao tiếp", 2 level A1 / A2; unit "Gọi đồ uống" vào A1 vị trí 4. Cần reset DB đã seed. |
| G2 | Danh mục 14 unit / 42 bài (mục 3.3, 3.4) | Như bảng; team đổi / bớt chủ đề trước khi P2.1 bắt đầu. |
| G3 | Xoá `scripts/sampleUnit/*` sau khi chuyển sang khung mới | Xoá, giữ lệnh `seed:sample-unit` làm alias. |
| G4 | Luật đề xuất trình độ (mục 4.1) | A1 ≥ 5/6 **và** A2 ≥ 4/6 → A2; còn lại A1. |
| G5 | Unit chỉ cho người lớn | Chỉ `A2-HOTEL`; còn lại `all`. |
| G6 | Thứ tự PR | P2.0 → P2.1 → P2.3 → P2.4 → P2.2 → P2.5. |

Mỗi PR: code theo commit nhỏ, chạy đủ bước kiểm ở mục 2.1 của plan tổng trước khi push lên nhánh `claude/zen-babbage-njiyn1` (cả hai repo), đánh dấu "ĐÃ CODE" + "Điểm lệch so với plan".

---

## 7. Kết quả và điểm lệch so với plan

**Đã làm:**

| PR | Repo | Commit chính |
|---|---|---|
| P2.0 | app | `docs: phase 2 step 0 configuration` |
| P2.1 | server | `feat(curriculum): seed the A1 trial course` |
| P2.3 | server | `feat(learner-profile): onboarding profile, placement test…` |
| P2.4 | app | `feat(onboarding): learner profile, placement test and starting level` |
| P2.2 | server | `feat(curriculum): A2 level of the trial course` |

**Kiểm tra đã chạy:**
- Server: typecheck, lint, format; unit 524 + test mới; DB 288 (Postgres 16 local); `yarn seed:curriculum` trên DB trống → 14 unit / 42 bài published, chạy lần 2 không tạo thêm gì.
- App: `tsc`, `lint` (trong ngân sách warning), `format:check`, Jest 2324+ pass.
- `test/curriculumContent.test.ts` (không cần DB): mọi bài qua spec-check **không có cả warning**, mọi unit đúng 70/25/5 và có phần viết, mọi câu mẫu (nhắc lại, dịch, lượt nói của người học) nằm trong đáp án chấp nhận của mẫu câu.

**Điểm lệch:**
1. **Unit 2 A1** đổi thành "Tuổi, sinh nhật, liên lạc": bài 2 là *xin* số điện thoại / email (`Can I have your {contact}, please?`), bài 3 là *nói sinh nhật* thay cho đánh vần. Lý do: số điện thoại và chữ cái đánh vần được nhận dạng giọng nói viết ra rất thất thường, máy chấm theo từ sẽ chấm oan. Nghe số điện thoại vẫn có ở bài tập chọn đáp án.
2. **Nhiệm vụ bước 5 có "thẻ vai"** (ví dụ "Bạn là y tá…", "Bạn 25 tuổi…") khi mẫu câu ngắn: máy chấm so theo từ với ngưỡng 0.80, câu 3–4 từ sai một từ ngoài danh sách là trượt.
3. **Giờ và số** có cả dạng chữ và số trong giá trị slot (`seven thirty` / `7:30`), vì nhận dạng giọng nói viết kiểu nào cũng có.
4. **Bộ câu hỏi kiểm tra đầu vào** nằm trong server `src/modules/learnerProfile/model/placement.ts` (code chạy cần đọc được), không ở `scripts/curriculum/placement.ts`; làm cùng P2.3.
5. **Lọc unit cho trẻ em làm ở app**, không thêm bộ lọc vào API `/v1/levels/:levelId/units` (API đã trả `audience`); tuổi lưu ở `@core/learning/learnerAudience` để `course` và `onboarding` không import nhau.
6. **Kết quả kiểm tra đầu vào** chỉ được lưu khi đã có hồ sơ, nên onboarding lưu nháp hồ sơ trước khi vào bài kiểm tra (vẫn ở màn onboarding tới khi chọn trình độ).
7. **Today**: chưa sắp "bài tiếp theo" theo trình độ trong thuật toán Today (Today dựa trên bài đã tải về). Thay bằng thẻ "Lộ trình của bạn" trên Home mở danh sách unit của trình độ đã chọn.
8. Thêm intent điều hướng `openLearningProfile` (đổi interface `AppNavigation`).

**Cần team xem kỹ:**
- ⚠️ Migration `012_learner_profiles` (có `.down.sql`); API public mới `/v1/me/learner-profile`, `/v1/placement/*`.
- ⚠️ Course mẫu đổi từ `a1-giao-tiep` sang `tieng-anh-giao-tiep`: DB đã seed trước đây phải `db:reset` rồi seed lại.
- Nội dung 42 bài + 12 câu kiểm tra đầu vào là **bản nháp kỹ thuật**: người phụ trách nội dung (T5) đọc lại trước production.
- App chưa chạy trên máy thật (TTS ở bài kiểm tra, luồng onboarding offline).
