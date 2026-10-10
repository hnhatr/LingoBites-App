# E3 – App: luồng "Học từ đời thường" (Hiểu / Dùng)

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Ngày lập: 2026-10-10. Repo: `LingoBites-App` (chỉ app). Nhánh: `claude/beautiful-cerf-t6c9y1`.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` §3.1–§3.5, §4.5, §5.3. Gộp S5.2 (bản tối thiểu) và phần app của S5.3.
> Cần trước: E0, E1, E2 (server đã deploy lên staging). Ý định **Tả** chỉ hiện khi E4 xong (capability).
> Không migration SQLite. Không thêm thư viện. ⚠️ Đổi schema zod theo contract mới của server (fixture chép từ server).

## 1. Mục tiêu và phạm vi

Người học đi trọn từ "chụp / chọn ảnh / kể tình huống" tới bài học, qua **một** câu hỏi ý định.

| Trong E3 | Ngoài E3 |
|---|---|
| `CreateScreen` mới: khối camera, các ô nguồn, gợi ý tình huống | Thư viện khoảnh khắc thật (E5): ở E3 phần "Khoảnh khắc gần đây" là danh sách bài tự tạo mới nhất có sẵn |
| Màn `MomentReviewScreen`: ảnh, chữ sửa được, tô dòng có thông tin cá nhân, chọn ý định, chip trình độ | Ý định Tả (E4) – thẻ ẩn khi capability tắt |
| Màn `SituationInputScreen`: chọn danh mục / gõ tự do | Luyện lại tình huống (E5) |
| Màn xác nhận tình huống AI hiểu (khi gõ tự do) | Hiện ảnh gốc trong hub bài (E4) |
| Màn đồng ý gửi ảnh lần đầu | |
| Theo dõi request "Dùng" chạy nền (mở rộng `composeTracker`) | |
| Hiển thị lỗi mới: bị từ chối, hết lượt, không phù hợp | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| P1 | Luồng sau khi có ảnh | `ImageCaptureScreen` chỉ chụp / chọn → gọi `analyzeImage` (E1) → `MomentReviewScreen`. Giữ `OCRReviewScreen` sau cờ cũ để quay về nếu cần (cờ mới `momentFlow` tắt → luồng cũ y như sau E0). |
| P2 | Ý định mặc định | Theo `suggested_intent` của server. Vào từ "Kể tình huống" → thẳng `SituationInputScreen` (ý định Dùng), không hỏi. |
| P3 | Ý định "Hiểu" gửi đi bằng gì | Route tạo bài có sẵn (`submitLessonCreation`, nguồn `ocr` / `text`) → không đổi luồng chờ hiện có (`LessonCreationScreen`). |
| P4 | Ý định "Dùng" gửi đi bằng gì | `submitMoment` (E2) → **không chặn**: thêm vào tracker, quay về màn trước, toast khi xong (giống S4.3, thiết kế chờ đã duyệt). |
| P5 | Ô "Bạn muốn làm gì ở đây?" trên thẻ Dùng | Tuỳ chọn, ≤ 200 ký tự, gợi ý theo loại ảnh ("vd: gọi một ly trà đá"). Có chữ → gửi `situation_note` (cần xác nhận, N5 của E2). Không có chữ và có ảnh → server dựa vào chữ trong ảnh; ảnh không chữ mà để trống → nút tắt với dòng "Hãy viết bạn muốn làm gì". |
| P6 | Xác nhận tình huống | Tracker thấy `awaiting_confirmation` → banner trên Home / Tạo bài "AI hiểu tình huống: …  [Đúng] [Sửa lại]". "Sửa lại" → `confirm(false)` rồi mở `SituationInputScreen` với chữ cũ. Thông báo nội bộ app, không push. |
| P7 | Thông tin cá nhân | Chạy `piiDetect` (chép luật từ server, cùng fixture) ngay khi người học sửa chữ; dòng có PII tô vàng + nút "Ẩn dòng này" (thay bằng `•••`). Không chặn gửi (Q-E3). |
| P8 | Màn đồng ý gửi ảnh | Lần đầu bấm chụp / chọn ảnh. Nội dung §5.3 của thiết kế. Lưu như `youtubeDisclosure` (AsyncStorage, có phiên bản để hỏi lại khi đổi nội dung). Từ chối → quay lại, gợi ý "Dán chữ" / "Kể tình huống". Đổi lại được trong Cài đặt. |
| P9 | Trình độ | Chip "Trình độ: A1 ▾" lấy `levelCode` từ `useLearnerProfileStore`; đổi chỉ áp cho lần tạo này. Không có hồ sơ → A1. |
| P10 | Trẻ em | `ageGroup = 'kids'`: không hiện ô gõ tự do; thẻ Dùng chỉ mở danh mục; ảnh chỉ dùng được ý định Hiểu. |
| P11 | Còn lượt | Thẻ Dùng / Tả hiện "Còn N lượt hôm nay" (`GET /lesson-creations/quota`). Hết lượt: thẻ mờ + "Mai bạn tạo tiếp được nhé"; Hiểu vẫn dùng được nếu còn lượt riêng. |
| P12 | Offline | Như hiện nay: khoá toàn bộ nguồn (`LockedFeature`). Danh mục tình huống được cache (ETag) nên vẫn xem được, nhưng không gửi. |

## 3. File thay đổi

### 3.1 Tạo mới

| File | Nội dung |
|---|---|
| `src/features/input/logic/momentClient.ts` | `analyzeImage(image, signal)` (multipart, timeout 30 giây, hủy được, map lỗi như `ocrClient.ts`); `submitMoment(body, idempotencyKey)`; `confirmMoment(requestId, accept)`; `fetchSituations(level)` (ETag + cache AsyncStorage); `fetchCreationQuota()`. |
| `src/features/input/logic/piiDetect.ts` | Luật P7, giống `src/modules/images/service/piiDetect.ts` của server. Test chạy trên fixture `pii-cases.json` chép từ server. |
| `src/features/input/logic/useMomentDraft.ts` | Trạng thái màn review: ảnh, chữ, dòng ẩn, ý định, trình độ, ghi chú, lỗi; `submit()` rẽ nhánh P3 / P4. |
| `src/features/input/logic/photoConsent.ts` | P8 (theo mẫu `youtubeDisclosure.ts`). |
| `src/features/input/screens/MomentReviewScreen.tsx` | §3.2 + §3.3 của thiết kế. |
| `src/features/input/screens/SituationInputScreen.tsx` | Danh mục (lọc theo trình độ, gợi ý theo `goals` / `interests` lên đầu) + ô gõ tự do (ẩn với trẻ em); bộ đếm ký tự. |
| `src/features/input/components/IntentCard.tsx` | Thẻ ý định (chọn một). |
| `src/features/input/components/PiiHighlightedText.tsx` | Chữ có dòng tô + nút ẩn. |
| `src/features/input/components/SituationConfirmBanner.tsx` | Banner P6. |
| `src/features/input/components/PhotoConsentSheet.tsx` | P8. |

### 3.2 Sửa

| File | Thay đổi |
|---|---|
| `src/features/input/screens/CreateScreen.tsx` | Bố cục §3.1 thiết kế: khối "Chụp thứ bạn thấy", ô Chọn ảnh / Kể tình huống / Dán chữ / YouTube, "Gợi ý tình huống" (3 tình huống đầu theo hồ sơ), "Gần đây" (3 bài tự tạo mới nhất). Ô "Kể tình huống" theo cờ `situationLearning` + capability `moments.use.enabled`. |
| `src/features/input/screens/ImageCaptureScreen.tsx` | Sau khi có ảnh: hỏi đồng ý (P8) → `analyzeImage` → `navigation.replace('MomentReview', …)`. Cờ `momentFlow` tắt → luồng OCR cũ. |
| `src/features/input/screens/navigationTypes.ts` | Route `MomentReview`, `SituationInput`. |
| `src/core/navigation/appNavigation.ts`, `src/app/navigation/appNavigationAdapter.ts`, `rootStackRoutes.ts`, `AppNavigator.tsx`, `ingestionRouteGate.ts` | `CreateEntry` thêm `{kind: 'situation'; situationId?: string}`; đăng ký 2 route; gate theo cờ. |
| `src/features/lesson/player/logic/composeTracker.ts` | Entry thêm `kind: 'compose' \| 'moment'`, `sourceLessonId` cho phép `null`, trạng thái `awaiting_confirmation` + `situationVi`. Khóa AsyncStorage giữ nguyên, entry cũ không có `kind` coi là `compose`. Poll dùng lại `fetchLessonCreationStatus`. |
| `src/features/lesson/player/logic/composeClient.ts` | Thêm `fetchActiveMoments()` gọi `GET /api/v1/lesson-creations?kind=moment&active=true` (E2 §3.2); tracker gộp kết quả với `fetchActiveComposes`. |
| `src/core/schemas/lesson.ts` | `LessonSourceType` thêm `learner_situation`; trạng thái `awaiting_confirmation`; `situation_vi`, `reason_vi`; header thêm `moment_intent?`, `situation_id?`; lỗi `CONTENT_REJECTED`, `IMAGE_REJECTED`, `MOMENT_*`, `CREATION_LIMIT_REACHED`. Chép fixture snapshot mới từ server. |
| `src/core/api/types.ts` | Kiểu response phân tích ảnh. |
| `src/core/release/feature-registry.ts`, `feature-dependencies.ts`, `configs/dev.ts`, `configs/production.ts`, `src/test/support/testFeatureFlagSets.ts` | Cờ mới `momentFlow` (phụ thuộc `imageInput`, `ocrScanner`); `situationLearning` → `ready`. Production: **tắt** cả hai cho tới khi test tay xong. |
| `src/features/lesson/library/logic/librarySections.ts`, `lesson.ts`, `src/ui/components/LessonCard.tsx` | Nhãn nguồn `learner_situation` ("Tình huống"). |
| `src/features/analytics/logic/types.ts` | Sự kiện §6 thiết kế: `moment_analyzed`, `moment_intent_chosen` (`intent`, `suggested`), `moment_rejected` (`code`), `moment_lesson_ready`, `pii_line_hidden`. Chỉ ghi mã / bucket, không ghi nội dung. |
| `src/core/i18n/vi.json`, `en.json` | Toàn bộ chữ mới (`moment.*`, `situation.*`, `consent.photo.*`, lỗi mới). |
| `src/features/profile/screens/DataSettingsScreen.tsx` | Dòng "Gửi ảnh để tạo bài" (xem lại / rút đồng ý). |

Không xoá file. `OCRReviewScreen` giữ cho luồng cũ (xoá ở PR dọn dẹp sau khi bật `momentFlow` ổn định, cần duyệt riêng).

## 4. Kiểm thử

| Loại | Nội dung |
|---|---|
| Unit | `piiDetect` theo fixture server; `momentClient` map lỗi (`IMAGE_REJECTED`, `CONTENT_REJECTED`, 429, timeout, hủy); `useMomentDraft`: ẩn dòng thay bằng `•••` trong chữ gửi đi, rẽ nhánh Hiểu / Dùng, kiểm tra P5. |
| Tracker | Entry cũ không có `kind` vẫn đọc được; `moment` đi `running → awaiting_confirmation → running → succeeded`; `confirm(false)` → entry `failed` `MOMENT_CANCELLED`, không báo lỗi đỏ. |
| Màn | `CreateScreen`: cờ tắt / bật, offline, trẻ em. `MomentReviewScreen`: ý định mặc định theo `suggested_intent`; Tả ẩn khi capability tắt; chip trình độ lấy từ hồ sơ; hết lượt. `SituationInputScreen`: gợi ý theo `goals`; trẻ em không có ô gõ; 200 ký tự. `ImageCaptureScreen`: chưa đồng ý → sheet; từ chối → quay lại. |
| Navigation | Test ma trận mount route có `MomentReview`, `SituationInput`; gate theo cờ. |
| Fixture | Parse snapshot mới (có `moment_intent`), trạng thái `awaiting_confirmation`. |
| Kiểm tay (máy thật) | Chụp thực đơn → Hiểu → bài có tóm tắt; cùng ảnh → Dùng + "gọi một ly trà đá" → xác nhận → bài 6 bước dùng đúng tên món; chọn "Hỏi đường" từ danh mục → bài; ảnh có số điện thoại → dòng bị tô, ẩn được; tắt mạng giữa chừng → bài vẫn về khi có mạng; tài khoản trẻ em. |

Lệnh: `yarn tsc`, `yarn lint` (không vượt ngân sách warning), `yarn format:check`, `yarn test`.

## 5. Thứ tự commit

1. `feat(schemas): moment contract and refreshed fixtures`.
2. `feat(input): moment client, PII rules and photo consent` (+ test).
3. `feat(lesson): track moment requests alongside composes` (+ test).
4. `feat(input): moment review screen with intent and level` (+ test).
5. `feat(input): situation input and confirmation banner` (+ test).
6. `feat(input): new create hub behind momentFlow` (+ test, i18n, analytics).
7. `chore(release): momentFlow flag, situationLearning ready (off in production)`.

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Nhiều màn mới, dễ vỡ luồng cũ | Mọi thứ sau cờ `momentFlow`; tắt cờ → giống hệt sau E0 |
| Người học không quay lại xác nhận tình huống | Banner hiện ở Home và Tạo bài; hết 24 giờ thì tự huỷ, không tính lượt |
| Luật PII app / server lệch nhau | Một fixture chung, test cả hai bên |

## 7. Điểm lệch so với plan

_(điền khi code xong)_
