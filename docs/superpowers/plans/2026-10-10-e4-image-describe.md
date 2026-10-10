# E4 – Server + app: ý định "Tả" (bài từ ảnh cảnh vật) và ảnh trong bài

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Bảng quyết định §2: **dùng đề xuất** (chốt 2026-10-10).
> Ngày lập: 2026-10-10. Repo: `LingoBites-Server` + `LingoBites-App`. Nhánh: `claude/beautiful-cerf-t6c9y1` ở cả hai repo.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` §3.4.2, §4. Gộp S5.6, S5.7 (phần còn lại sau E1), S5.8.
> Cần trước: E1, E2, E3. Chốt Q15. Q14 đã chốt 2026-10-10 (trẻ em không tạo bài).
> ⚠️ **Migration** nhỏ và **đổi API public** (snapshot có ảnh nguồn, route ảnh mới, `intent = 'describe'`).

## 1. Mục tiêu và phạm vi

Người học chụp một cảnh / đồ vật, chọn **Tả**, nhận bài 6 bước: đoạn tả cảnh vừa trình độ, từ vựng là đồ vật / hành động thấy trong ảnh, mẫu câu, nhiệm vụ "Tả lại bức ảnh". Hub bài hiện ảnh gốc, tải về học offline được. Ảnh của bài "Hiểu" và "Dùng" (nếu có) cũng hiện trong hub.

| Trong E4 | Ngoài E4 |
|---|---|
| Gọi AI có ảnh (vision) trong `callProviderJson` | Chấm bài viết / nói "tả lại" bằng máy (Q15: tự đánh giá) |
| Prompt `moment.describe` | Báo "từ sai" từng từ (E6) |
| `intent = 'describe'` trong `POST /api/v1/moments`, nguồn `learner_image` | |
| Gắn ảnh vào bài (cả 3 ý định), route ảnh cho người học bằng URL ký | |
| App: thẻ Tả, hub hiện ảnh, tải ảnh offline | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| R1 | Model vision | Model của provider đang dùng (`AI_PROVIDER`), đặt trong `params.model` của prompt `moment.describe` (chỉnh ở admin "Prompt AI"). Ảnh gửi dạng base64 trong request, **đã gỡ metadata** (E1). Kích thước gửi AI: cạnh dài ≤ 1024 px. Nếu cần thu nhỏ trên server mà không có thư viện ảnh → app gửi ảnh đã thu nhỏ ở bước chọn ảnh (đổi `maxWidth/maxHeight` của `imagePicker` từ 2000 xuống 1600 chỉ khi đo thấy OCR vẫn tốt) – chốt khi code, ghi ở §7. |
| R2 | Đầu ra `moment.describe` | `{suitable, reason_vi, suggestion_vi, scene_vi, sentences: [4..8 câu tả], objects: [{text, meaning_vi, confidence: 'high'\|'medium'}], situation: {speaker, listener, place, purpose}}`. Câu theo N3 của E2 (≤ 12 từ A1, ≤ 18 từ A2). |
| R3 | Chống "AI tả sai" (R1 thiết kế) | Chỉ giữ `objects` có `confidence = 'high'`; prompt yêu cầu chỉ nhắc thứ **nhìn thấy rõ**, không đoán thương hiệu, không đoán người (tuổi, dân tộc, tên), không đọc chữ nhỏ không rõ. |
| R4 | Ảnh không có gì để học / có người là chính | `suitable = false` → `MOMENT_NOT_SUITABLE` + `reason_vi` + gợi ý ("Hãy chụp gần hơn đồ vật bạn muốn học"), **không tính lượt**. |
| R5 | Pipeline | Như E2 N1: chặng (1) vision viết nguồn (thay vì hội thoại) → (2) bài nguồn ẩn → (3) composer. `objects` truyền vào composer như `catalog_items` gợi ý (composer ưu tiên dùng). Không có bước xác nhận (ảnh là nguồn rõ ràng). |
| R6 | Nhiệm vụ "Tả lại bức ảnh" | Thêm task cố định vào bài sau composer: viết 3 câu tả ảnh (`assessed_by = self` theo Q15) + nói 30 giây (khung ghi âm Stage 3, tự đánh giá nếu chưa bật chấm). Không gọi thêm AI. |
| R7 | Hạn mức | Như "Dùng": chung hạn mức compose (Q8 / Q14), chỉ tính khi thành công. Trẻ em: không tạo bài (đã chặn chung ở E2 N7). |
| R8 | Gắn ảnh vào bài | Khi bài tạo **thành công**: `learner_images.lesson_id = <bài 6 bước>` (hoặc bài "Hiểu"), `expires_at = NULL` (E1 §3.1). Bài thất bại → ảnh giữ hạn 24 giờ cũ. "Hiểu" nhận `image_id` tuỳ chọn trong body tạo bài có sẵn. |
| R9 | Phục vụ ảnh cho người học | `GET /api/v1/learner-images/:id?exp=<unix>&sig=<hmac>`: URL ký HMAC-SHA256 (khoá env mới `LEARNER_IMAGE_URL_SECRET`), hạn 7 ngày, chỉ trả ảnh **đã gắn bài** của chính chủ. Lý do: app tải media bằng `fs.downloadFile(url)` không kèm header đăng nhập. Snapshot luôn trả URL ký mới; URL hết hạn thì app lấy lại snapshot. `Cache-Control: private, max-age=86400`. |
| R10 | Ảnh trong snapshot | Header snapshot thêm `source_image: {url, width, height} \| null`. Không thêm block `media` (block là nội dung admin soạn); app gộp `source_image.url` vào danh sách tải media. |
| R11 | Chi phí | Ghi số lần gọi vision vào `ai_calls` như compose; trần tháng chung. Ghi ước tính giá vision vào `docs/03-operations/01-cost-estimate.md` khi code. |

## 3. Server

### 3.1 Migration `015_learner_image_source.sql`

Không cần bảng mới (`learner_images.lesson_id` đã có ở E1). Chỉ:
```sql
CREATE INDEX learner_images_lesson_idx ON learner_images (lesson_id) WHERE lesson_id IS NOT NULL;
```
(Có thể gộp vào E1 nếu E1 chưa merge – ghi ở §7.)

### 3.2 File

| File | Thay đổi |
|---|---|
| `src/modules/canonicalLesson/service/creationAi.ts` | `callProviderJson` nhận `images?: Array<{mimeType, base64}>`: OpenAI → phần `image_url` dạng data URL trong `messages`; Gemini → `inline_data` trong `parts`. Không ảnh → giữ nguyên request cũ (byte-for-byte). |
| `src/modules/moments/prompts/momentDescribePromptSpec.ts`, `momentDescribeDefaultV1.ts`, `momentDescribeCases.ts` (mới) | Spec `moment.describe` (R2, R3). Thêm vào `PROMPT_REGISTRY`. Cases dùng ảnh fixture nhỏ trong `test/fixtures/images/`. Mock deterministic khi `AI_PROVIDER=mock`. |
| `src/modules/moments/service/momentService.ts` | Nhận `intent = 'describe'` (bắt buộc `image_id`; trẻ em đã bị chặn chung ở E2). |
| `src/modules/moments/service/momentPipeline.ts` | Nhánh describe (R5), task R6, gắn ảnh R8. |
| `src/modules/canonicalLesson/model/contract.ts` | `LessonSourceTypeValues` thêm `learner_image`. |
| `src/modules/canonicalLesson/controller/lessonCreations.ts` + `creationRequest.ts` | Body tạo bài "Hiểu" nhận `image_id` tuỳ chọn; gắn ảnh khi thành công (R8). |
| `src/modules/images/controller/learnerImages.ts` (mới) | Route R9. |
| `src/modules/images/service/imageUrlSigner.ts` (mới) | Ký / kiểm tra URL (so sánh hằng thời gian). |
| `src/modules/curriculum/lessonDelivery/repository/*` | Header snapshot `source_image` (R10). |
| `src/app/controller/capabilities.ts` | `moments.describe.enabled` (env `MOMENT_DESCRIBE_ENABLED` + trần tháng). |
| `src/common/config/env.ts` | `LEARNER_IMAGE_URL_SECRET` (bắt buộc ở production khi bật describe; thiếu thì capability tắt), `MOMENT_DESCRIBE_ENABLED`. |
| Fixture snapshot | Làm mới + SHA, chép sang app. |

## 4. App

| File | Thay đổi |
|---|---|
| `src/core/schemas/lesson.ts` | `learner_image`; header `source_image?`; chép fixture. |
| `src/features/input/screens/MomentReviewScreen.tsx` | Thẻ Tả hiện khi capability `moments.describe.enabled` (trẻ em không vào được màn này, E3 P10); gửi `submitMoment({intent: 'describe', image_id, level})`; "Hiểu" gửi kèm `image_id`. |
| `src/features/lesson/player/logic/mediaDownloadConsent.ts` | `lessonMediaUrls` thêm `snapshot.source_image?.url` (đứng đầu). |
| `src/features/lesson/player/logic/canonicalDownloadRepository.ts` | Không đổi cách tải; URL ký tải được bằng `fs.downloadFile`. Khi tải lỗi 403 (hết hạn) → lấy lại snapshot rồi thử 1 lần. |
| `src/features/lesson/player/components/CanonicalLessonHub.tsx` (hoặc hub tương ứng) | Ảnh nguồn đầu hub (file local nếu đã tải, không thì URL); chạm để xem lớn. Chip "Từ ảnh" / "Tình huống". |
| `src/features/lesson/library/logic/lesson.ts`, `librarySections.ts`, `src/ui/components/LessonCard.tsx` | Nhãn `learner_image` ("Từ ảnh"); thẻ bài hiện ảnh thu nhỏ khi có. |
| `src/core/i18n/vi.json`, `en.json` | Chữ mới (thẻ Tả, lỗi R4, nhiệm vụ R6). |

## 5. Kiểm thử

| Repo | Loại | Nội dung |
|---|---|---|
| Server | Unit | `callProviderJson` có ảnh: đúng shape OpenAI / Gemini; không ảnh → request cũ không đổi (so snapshot JSON). Spec `moment.describe` lint + cases; lọc `confidence`; số câu, số từ. `imageUrlSigner`: đúng, sai chữ ký, hết hạn. |
| Server | DB `test/momentDescribe.test.ts` | Ảnh hợp lệ → bài 6 bước `learner_image` có `source_image`, ảnh `expires_at = NULL`; `suitable=false` → không tính lượt, ảnh vẫn hạn 24 giờ; trẻ em → 403 `CREATION_NOT_ALLOWED`; ảnh người khác → 404; route ảnh: chủ + chữ ký đúng → 200, người khác / sai chữ ký / ảnh chưa gắn bài → 404; "Hiểu" kèm `image_id` gắn ảnh. |
| App | Jest | Schema có `source_image`; `lessonMediaUrls` gồm ảnh nguồn; hub hiện ảnh; thẻ Tả theo capability; tải lại khi 403. |
| App | Kiểm tay | Chụp góc bếp → Tả → bài có từ đồ vật đúng; tắt mạng sau khi tải → ảnh vẫn hiện; ảnh selfie → không phù hợp, không mất lượt. |

## 6. Thứ tự commit

**Server**: (1) `feat(ai): image parts in provider JSON calls`; (2) `feat(prompts): moment.describe`; (3) `feat(images): signed learner image route`; (4) `feat(moments): describe intent, image attach, retell task`; (5) `feat(delivery): source image in snapshot; refresh fixtures`.
**App**: (6) `feat(schemas): source image and learner_image`; (7) `feat(input): describe intent card`; (8) `feat(lesson): show and download the source photo`.

## 7. Điểm lệch so với plan

_(điền khi code xong)_
