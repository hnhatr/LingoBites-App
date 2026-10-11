# Lộ trình áp dụng "Tài liệu yêu cầu – Ứng dụng luyện tiếng Anh" (v1.0, 07/10/2026)

> Kế hoạch tổng 8 bước, theo đúng thứ tự tài liệu yêu cầu. Mỗi bước chỉ nêu **hiện trạng** và **mục tiêu cần đạt**.
> Khi bắt đầu từng bước sẽ phân tích sâu riêng: schema, API, màn hình, test.
> Phạm vi áp dụng: `LingoBites-App` (React Native), `LingoBites-Server` (Fastify + Prisma) và `admin-web`.

Ký hiệu hiện trạng: ✅ đã khớp · 🟡 có một phần / gần khớp · ❌ chưa có / khác hẳn

**Kết luận tổng quát:** hệ thống hiện lấy nội dung làm trung tâm (tạo bài từ text, ảnh, YouTube bằng AI, sau đó xem bài, ôn flashcard, shadowing). Tài liệu yêu cầu lấy đầu ra làm trung tâm (mục tiêu, vận dụng, đánh giá theo tiêu chí, ghi nhận mức hỗ trợ). Vòng lặp **Học → Vận dụng → Đánh giá → Ghi nhận → Ôn/bài tiếp** hiện **đứt ở khâu Vận dụng và Đánh giá**.

---

## Bước 0 – Chốt cấu hình (tài liệu trang 09)

Đây là việc của team sản phẩm và nội dung, không phải việc code. Cần hoàn thành trước khi làm bước tương ứng.

| Nhóm | Cần chốt | Chặn bước |
|---|---|---|
| Lộ trình & đầu vào | Danh mục trình độ, nội dung kiểm tra đầu vào, cách xếp điểm bắt đầu, điều kiện chuyển cấp | 1 |
| Nội dung bài | Từ/mẫu câu trọng tâm, hoạt động bắt buộc, nhiệm vụ vận dụng, độ dài theo nhóm | 2, 3 |
| Đánh giá | Tiêu chí bắt buộc, ngưỡng đạt, lỗi chấp nhận, các mức gợi ý, xử lý lượt không đánh giá được | 3, 4, 5 |
| Ôn & ghi nhớ | Khoảng cách ôn, số lần kiểm tra, điều kiện "ghi nhớ ổn định", cách điều chỉnh khi quên | 6 |
| Tỷ lệ luyện tập | Cách áp dụng 70/25/5, phạm vi cụm bài, cách thay phần viết cho trẻ | 2 |
| Tiến độ & báo cáo | Chu kỳ báo cáo, chỉ số hiển thị, quyền xem của người học, phụ huynh, giáo viên | 7 |
| Khích lệ & game | Điều kiện thưởng, nhiệm vụ, mở khóa, cách tính kết quả trong game hoặc thi đấu | 8 |
| Nguồn bài mở rộng | Yêu cầu chất lượng bài tạo mới, mục tiêu và tiêu chí đi kèm | 8 |
| Kinh doanh & vận hành | Quyền từng gói, family, referral, ưu đãi, lịch thông báo, phạm vi admin | 8 |

---

## Bước 1 – Đối tượng người học & hồ sơ đầu vào (trang 02–03)

### Hiện trạng
- ❌ Không có trường tuổi hay nhóm đối tượng (trẻ 6–11 / người lớn) trong `Users` hoặc profile. Chỉ có theme `pastelKids`, thuần giao diện.
- ❌ Onboarding chỉ hỏi tên (`OnboardingNameScreen`). Không hỏi mục tiêu, sở thích, khả năng đọc/viết.
- ❌ Không có bài kiểm tra đầu vào.
- 🟡 Đã có cấu trúc Course → Level → Unit, nhưng chưa gắn với nhóm đối tượng.

### Mục tiêu cần đạt
- Hồ sơ HERO có: nhóm đối tượng, trình độ, mục tiêu giao tiếp, sở thích (dùng để chọn ngữ cảnh), khả năng đọc/viết (cho trẻ).
- Onboarding thu thập các thông tin trên và làm một bài kiểm tra đầu vào ngắn, sau đó đề xuất điểm bắt đầu trong lộ trình.
- Khóa học và chủ đề gắn được với nhóm đối tượng. Tuổi quyết định cách trình bày và chủ đề, trình độ quyết định độ khó.
- Hồ sơ được sync lên server và dùng được ở các bước sau.

### Lưu ý
Bước này cần migration DB (server) và thay đổi API profile.

---

## Bước 2 – Đặc tả bài học có mục tiêu & cấu trúc 6 bước (trang 02–03)

### Hiện trạng
- ✅ Bốn tầng Lộ trình → Chủ đề → Bài → Hoạt động gần như khớp: Course/Level → Unit → Lesson → LessonBlocks.
- ❌ `Lessons` chỉ có title, description, estimatedMinutes. Chưa có mục tiêu đầu ra, nội dung trọng tâm, tiêu chí đánh giá.
- 🟡 `LearningItems` mới có `word` và `grammar`. Chưa có mẫu câu, điểm phát âm (âm, trọng âm), nghe hiểu.
- 🟡 Block chưa được gắn nhãn thuộc bước nào trong 6 bước, cũng chưa có nhãn hình thức Speak/Listen/Write hay thời lượng.
- ❌ Chưa có cơ chế kiểm tra tỷ lệ 70/25/5.

### Mục tiêu cần đạt
- Mỗi bài khai báo: **mục tiêu giao tiếp**, **nội dung trọng tâm** (tham chiếu learning items), **tiêu chí bắt buộc**, **lỗi chấp nhận được**.
- Learning items bao phủ đủ 5 thành phần nội dung: từ/cụm từ, phát âm, mẫu câu/ngữ pháp, nghe hiểu, phản xạ/vận dụng.
- Mỗi hoạt động được gắn: bước trong bài (Ôn liên quan, Làm quen, Luyện có hướng dẫn, Luyện biến đổi, Vận dụng độc lập, Xem kết quả), hình thức Speak/Listen/Write, và thời lượng thiết kế.
- Admin-web soạn được các trường trên và cảnh báo khi một cụm bài lệch xa tỷ lệ 70/25/5 (tỷ lệ tham chiếu, không ép từng bài).
- Hỗ trợ phương án thay phần Write cho trẻ chưa đọc/viết (nói hoặc chọn hình).

### Lưu ý
Bước này thay đổi schema `Lessons`, `LessonBlocks`, `LearningItems`, contract delivery và admin-web.

---

## Bước 3 – Hoạt động tương tác, gợi ý & nhiệm vụ vận dụng (trang 03–04)

### Hiện trạng
- 🟡 Server đã định nghĩa `activityKind`: `listen_and_repeat`, `speaking_drill`, `role_play`, `fill_blank`, `multiple_choice`, `translation`.
- ❌ App hiển thị block `activity` ở chế độ **chỉ đọc** (`CanonicalBlockView.tsx`: "has no interaction… never submits attempts").
- 🟡 Có shadowing (ghi âm theo câu), quiz trong `practice`, Speaking Room. Tuy nhiên các phần này tách rời khỏi luồng bài học.
- ❌ Chưa có gợi ý nhiều mức, chưa ghi lại việc người học có dùng gợi ý hay xem đáp án.
- ❌ Chưa có loại nhiệm vụ "vận dụng độc lập" (cùng mục tiêu, đổi chi tiết, không hiện đáp án).

### Mục tiêu cần đạt
- Player chạy được bài theo đúng trình tự 6 bước.
- Mọi `activityKind` đều tương tác được và gửi lượt làm (attempt).
- Có **hệ thống gợi ý nhiều mức** (ví dụ: nghe lại, gợi ý từ khóa, hiện mẫu). Mỗi lượt ghi lại **mức hỗ trợ**: đọc mẫu, dùng gợi ý, hay tự trả lời.
- Có **nhiệm vụ vận dụng độc lập** với tình huống biến đổi. Ví dụ: đã luyện gọi sữa thì tự gọi nước cam; đã giới thiệu tên thì hỏi tên người đối diện.
- Có bước luyện biến đổi: thay từ, đổi đối tượng, trả lời câu hỏi khác.

---

## Bước 4 – Đánh giá lời nói & kết quả lượt làm (trang 04)

### Hiện trạng
- ❌ Chưa có speech-to-text hay chấm phát âm ở cả app và server. Feature `pronunciationSupport` mới chỉ là placeholder.
- ❌ Shadowing chỉ lưu bản ghi âm, không chấm. Ôn tập chỉ có hai rating `remembered` / `forgot`.
- 🟡 Có `errorNotebook`, nhưng lỗi được ghi thủ công.

### Mục tiêu cần đạt
- Chấm lượt nói theo 4 tiêu chí: **đúng mục đích**, **đúng nội dung trọng tâm**, **đủ rõ**, **độc lập**.
- Mỗi lượt có một trong 4 kết quả, kèm cách xử lý tương ứng:
  - **Đạt độc lập**: ghi nhận đạt và đưa kiến thức vào lịch ôn.
  - **Đạt khi có gợi ý**: ghi là còn cần hỗ trợ, luyện lại phần liên quan, rồi thử lại bằng lượt độc lập.
  - **Chưa đạt**: chỉ ra lỗi chính, đưa bài luyện phù hợp, cho thử lại.
  - **Không đánh giá được** (lỗi âm thanh hoặc xử lý): yêu cầu làm lại, **không tính là sai**.
- Không mặc định mọi lỗi nhỏ đều khiến người học trượt. Lỗi chấp nhận được lấy từ đặc tả bài (bước 2).
- Lưu kết quả đánh giá ở server, gắn với user, bài, learning item, ngữ cảnh, mức hỗ trợ và lỗi. Sync qua outbox giống `ActivityAttempts`.

### Lưu ý
Bước này cần chọn nhà cung cấp STT và chấm phát âm, nên sẽ **thêm dependency và chi phí AI** (phải xin duyệt). Cũng cần bảng DB mới và quy định quyền riêng tư cho dữ liệu giọng nói.

---

## Bước 5 – Các mức hoàn thành (trang 04)

### Hiện trạng
- ❌ Bài được tính "hoàn thành" bằng **một lần bấm** `complete` (`useLessonCompletion.ts`). Lần bấm này đồng thời cộng streak.
- 🟡 Có tiến độ unit (`unitProgress.ts`), nhưng dựa trên số bài đã complete.
- ❌ Chưa có nhiệm vụ tổng hợp cấp chủ đề.

### Mục tiêu cần đạt
Tách 5 mức và tính riêng từng mức:

| Mức | Điều kiện |
|---|---|
| Hoàn thành hoạt động | Đã làm và hệ thống ghi nhận được kết quả |
| Hoàn thành phần luyện | Đã làm các hoạt động luyện bắt buộc (có thể vẫn cần hỗ trợ) |
| Đạt bài học | Hoàn thành phần luyện **và** đạt vận dụng độc lập |
| Hoàn thành chủ đề | Đạt các bài bắt buộc **và** nhiệm vụ tổng hợp của chủ đề |
| Ghi nhớ ổn định | Tiếp tục đạt ở các lần ôn cách nhau theo cấu hình |

- Tạm dừng hoặc bỏ qua **không** được tính là đạt.
- Giữ "hoạt động học" (streak, thời gian) tách biệt với "đạt bài".

---

## Bước 6 – Ghi nhận kết quả, ôn tập & học tiếp (trang 05, sơ đồ 1)

### Hiện trạng
- ✅ Có ghi nhận hoạt động: ngày học, thời gian, streak, weekly goal.
- ✅ Có lịch ôn cố định 1/3/7/14/30/60/120 ngày (`reviewPolicy.ts`). Tuy nhiên lịch này chỉ áp cho flashcard và chỉ có hai mức remembered/forgot.
- 🟡 `today/adaptationEngine` gợi ý buổi học theo lý do (chữa lỗi gần đây, thiếu luyện nói…), nhưng chưa dùng dữ liệu đánh giá.
- 🟡 Có màn tổng kết cho shadowing và Daily Review, nhưng chưa có màn kết quả bài theo yêu cầu.
- ❌ Chưa có bước "ôn liên quan" ở đầu bài.

### Mục tiêu cần đạt
- Ghi đủ 6 nhóm dữ liệu: Hoạt động, Luyện tập (nội dung, số lần thử, ngữ cảnh), Kết quả, Mức hỗ trợ, Ôn tập, Tiến độ (bài, chủ đề, lộ trình).
- Lịch ôn áp cho **learning item và mẫu câu**, không chỉ flashcard. Lần ôn **dùng lại tiêu chí đánh giá** của bài. Nếu quên thì đánh dấu "cần ôn" nhưng **giữ lịch sử đã đạt bài**.
- **Màn kết quả sau bài**: mục tiêu đã đạt, nội dung còn yếu, mức hỗ trợ đã dùng, hành động tiếp theo. Chưa đạt thì dẫn về phần luyện liên quan. Đạt thì dẫn sang bài tiếp hoặc lượt ôn theo lịch.
- Đầu mỗi buổi và đầu mỗi bài: đưa lại kiến thức đến hạn hoặc hay sai. Kết quả ôn dùng để điều chỉnh nội dung luyện tiếp (adaptation engine đọc dữ liệu đánh giá).
- Tuân thủ nguyên tắc dữ liệu: số lượt luyện không tự động thành "thành thạo", lượt không đánh giá được tách khỏi lượt sai, điểm thưởng tách khỏi kết quả học.

---

## Bước 7 – Báo cáo tiến độ & vai trò phụ huynh/giáo viên (trang 05)

### Hiện trạng
- 🟡 Đã có `ProgressReportScreen` với các chỉ số như số câu nói không nhìn, tỷ lệ hiểu ở lần nghe đầu, tỷ lệ nhớ sau 7 và 30 ngày, so sánh bản ghi âm đầu và mới nhất.
- ❌ Chưa có báo cáo theo chu kỳ (tuần).
- ❌ Chưa có câu mô tả năng lực.
- ❌ Chưa có vai trò phụ huynh hay giáo viên, chưa có liên kết tài khoản và quyền xem.

### Mục tiêu cần đạt
- Báo cáo theo chu kỳ cấu hình được (tuần hoặc khoảng khác), trình bày: hoạt động, mục tiêu đã đạt, lỗi thường gặp, phần cần luyện tiếp.
- Tách rõ **"học thường xuyên"** với **"sử dụng tốt"**. Điểm tổng chỉ là thông tin phụ.
- Có câu mô tả năng lực, ví dụ: "Đã tự dùng mẫu câu gọi món trong hai tình huống; còn cần gợi ý khi hỏi giá."
- **Phụ huynh** (với trẻ 6–11) xem được tiến độ của con. Giáo viên và phụ huynh có thể đề xuất bài. Quyền xem theo cấu hình ở bước 0.

---

## Bước 8 – Các nhóm tính năng bổ trợ (trang 06, sơ đồ 2)

Cả bước này phải tuân thủ **rule liên kết**: game, câu chuyện, nhiệm vụ phải chỉ rõ hoạt động tiếng Anh đi kèm; thưởng và bảng xếp hạng không thay thế đánh giá năng lực; bài từ nguồn mở rộng vẫn phải có mục tiêu và tiêu chí; thông báo nhắc học phải dẫn tới bài hoặc nhiệm vụ phù hợp.

### 8.1 Hỗ trợ học trực tiếp
- **Hiện trạng:** ✅ song ngữ, IPA, TTS, giải thích câu, từ, ngữ pháp. 🟡 chỉnh tốc độ nghe còn hạn chế. ❌ chưa sửa phát âm tự động.
- **Mục tiêu:** đủ bộ hỗ trợ (sửa phát âm, gợi ý, song ngữ, giải thích, chỉnh tốc độ nghe). Mọi lần dùng hỗ trợ đều được ghi vào mức hỗ trợ khi đánh giá.

### 8.2 Động lực học tập
- **Hiện trạng:** 🟡 có pet (seed đến bloom, tưới bằng lượt ôn đúng hạn), XP, badge, streak, weekly goal. ❌ chưa có nhiệm vụ, câu chuyện, mở khóa.
- **Mục tiêu:** có rule thưởng riêng, gắn với hành động học và với "đạt bài". Thêm nhiệm vụ, câu chuyện có nhân vật đồng hành (đặc biệt cho trẻ), và mở khóa nội dung.

### 8.3 Thực hành mở rộng
- **Hiện trạng:** ❌ các flag mini game (`wordMatchGame`, `fillBlankGame`, `tenseQuizGame`, `sentenceOrderGame`) đã có nhưng chưa có UI. ❌ chưa có nhập vai AI, đấu bot hay người thật, nhiệm vụ đội.
- **Mục tiêu:** có nhập vai AI theo tình huống bài, mini game, chế độ đấu và nhiệm vụ đội để tạo thêm ngữ cảnh dùng lại kiến thức. Khi dùng để đánh giá thì phải áp tiêu chí của bài và ghi mức hỗ trợ.

### 8.4 Nguồn tạo bài học
- **Hiện trạng:** ✅ mạnh nhất hiện nay, gồm tạo bài từ text, OCR ảnh, YouTube qua pipeline AI. ❌ bài tạo ra không có mục tiêu, nội dung trọng tâm hay tiêu chí đánh giá. ❌ chưa hỗ trợ nguồn lời nói, bài hát, phim, nhân vật.
- **Mục tiêu:** pipeline AI sinh thêm mục tiêu, nội dung trọng tâm, tiêu chí đánh giá và nhiệm vụ vận dụng cho mọi bài tạo mới, theo trình độ và mục tiêu của người học. Bổ sung dần các nguồn mới.

### 8.5 Quản lý việc học
- **Hiện trạng:** 🟡 có hồ sơ và lịch sử bài. ❌ chưa có sở thích, chưa có phụ huynh/giáo viên đề xuất bài (phụ thuộc bước 1 và 7).
- **Mục tiêu:** hồ sơ, sở thích, lịch sử, báo cáo dùng để định hướng học tiếp. Phụ huynh và giáo viên giao hoặc đề xuất được bài.

### 8.6 Kinh doanh
- **Hiện trạng:** 🟡 có quyền theo từng khóa (`UserCourseEntitlements`: purchase/grant/promo, productId, giá). ❌ chưa có gói thuê bao, family, referral, ưu đãi.
- **Mục tiêu:** quản lý quyền sử dụng theo gói, có gói family (gắn với vai trò phụ huynh), referral, ưu đãi, và thanh toán qua store.

### 8.7 Vận hành
- **Hiện trạng:** ✅ admin-web quản lý course, level, unit, lesson, vocab, media, transcript YouTube, user. 🟡 nhắc học mới là thông báo local (notifee). ❌ admin chưa cấu hình được tiêu chí đạt, lịch ôn, rule thưởng, nội dung thông báo.
- **Mục tiêu:** admin quản lý bài, tiêu chí đạt, lịch ôn, rule thưởng và cấu hình từ bước 0. Thông báo nhắc học (push từ server) dẫn thẳng tới bài hoặc lượt ôn đến hạn, tách riêng khỏi thông báo marketing.

---

## Thứ tự & phụ thuộc

```
Bước 0 (chốt cấu hình)
  └─► 1 Hồ sơ ─► 2 Đặc tả bài ─► 3 Hoạt động & vận dụng ─► 4 Đánh giá ─► 5 Mức hoàn thành ─► 6 Ghi nhận & ôn ─► 7 Báo cáo
                                                                                                         └─► 8 Tính năng bổ trợ (8.1, 8.4 có thể làm song song từ bước 3)
```

## Rủi ro chung cần lưu ý
- **Migration DB** ở các bước 1, 2, 4, 5, 6, 7 và **thay đổi API công khai** giữa app và server. Phải giữ tương thích với app đang chạy.
- **Dependency và chi phí mới** ở bước 4 (STT, chấm phát âm), 8.3 (AI roleplay) và 8.6 (thanh toán). Cần xin duyệt trước.
- **Dữ liệu giọng nói và dữ liệu trẻ em**: cần chính sách quyền riêng tư, consent của phụ huynh, và không log nội dung nhạy cảm.
- Theo quy tắc VibeGuard: mỗi bước cần plan chi tiết riêng và được duyệt trước khi code.
