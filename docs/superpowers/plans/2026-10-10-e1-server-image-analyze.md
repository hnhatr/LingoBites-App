# E1 – Server: phân tích ảnh (`POST /api/v1/images/analyze`)

> Trạng thái: **PLAN, chờ duyệt**. Chưa code.
> Bảng quyết định §2: **dùng đề xuất** (chốt 2026-10-10).
> Ngày lập: 2026-10-10. Repo: `LingoBites-Server` (chỉ server). Nhánh: `claude/beautiful-cerf-t6c9y1`.
> Thiết kế chung: `2026-10-10-everyday-learning-redesign.md` §4.2, §5. Thay một phần S5.7 (upload, kiểm duyệt ảnh).
> Cần trước: kết quả kiểm tay EXIF / HEIC của E0 (§7 plan E0). Chốt Q12, Q13 (bảng chốt `remaining-work-plan` §5.5b).
> ⚠️ **Migration** (bảng mới) và **API public mới**. Không đổi API cũ: `POST /v1/ocr` giữ nguyên.

## 1. Mục tiêu và phạm vi

Một endpoint nhận ảnh và trả về, **không gọi LLM**: chữ đọc được, loại ảnh, kết quả kiểm duyệt, các dòng có thông tin cá nhân, ý định gợi ý, và `image_id` (ảnh lưu tạm) để E2 / E4 dùng khi tạo bài.

| Trong E1 | Ngoài E1 |
|---|---|
| Endpoint mới, cùng giới hạn tốc độ với `/v1/ocr` | App gọi endpoint (E3) |
| Google Vision: thêm `SAFE_SEARCH_DETECTION` vào **cùng** request `TEXT_DETECTION` | Gọi LLM vision (E4) |
| Kiểm tra magic bytes, gỡ metadata EXIF / GPS (JPEG, PNG) bằng code thuần | Thư viện xử lý ảnh mới |
| Phân loại `text` / `scene` / `mixed` bằng luật | Phân loại bằng AI |
| Phát hiện thông tin cá nhân bằng luật (module dùng chung với app ở E3) | Chặn vì thông tin cá nhân (chỉ cảnh báo, Q-E3) |
| Lưu ảnh tạm 24 giờ, dọn tự động; xoá ảnh khi xoá tài khoản | Gắn ảnh vào bài (E4), xoá ảnh khi người học xoá bài (E5) |
| Provider mock có SafeSearch để test | |

## 2. Quyết định (dùng đề xuất nếu bạn không đổi)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| L1 | Ngưỡng từ chối SafeSearch | `adult`, `violence`, `racy` ở mức `LIKELY` hoặc `VERY_LIKELY` → `IMAGE_REJECTED`. `medical`, `spoof` **không** dùng (ảnh phòng khám, nhãn thuốc phải đi qua). Ngưỡng đặt bằng hằng số trong code, chỉnh được ở PR sau qua `admin_settings`. |
| L2 | Phân loại ảnh | Đếm từ có chữ Latin trong chữ đọc được: ≥ 8 từ → `text`; 1–7 từ → `mixed`; 0 → `scene`. Gợi ý ý định: `text` → `understand`, `scene` / `mixed` → `describe`. |
| L3 | Ảnh nào được lưu tạm | Mọi ảnh **qua kiểm duyệt** được lưu tạm 24 giờ và có `image_id`. Ảnh bị từ chối không lưu. |
| L4 | Nơi lưu | Cổng `ObjectStorage` có sẵn (GCS / thư mục local như recordings, curriculum media). Env mới `LEARNER_IMAGES_GCS_BUCKET` (+ `_ENDPOINT`, `_ACCESS_TOKEN`, `LEARNER_IMAGES_LOCAL_DIR`), cách chọn backend giống `createCurriculumMediaStorage`. Production thiếu bucket → endpoint vẫn chạy nhưng trả `image_id: null` (chỉ dùng được ý định Hiểu). **Không sửa file `.env`**; chỉ thêm biến vào `env.ts` và `docs`. |
| L5 | Khoá object | `learner-images/<userId>/<imageId>.<ext>` để xoá theo tiền tố khi xoá tài khoản. |
| L6 | Gỡ metadata | JPEG: bỏ các segment `APP1` (EXIF / XMP), `APP13` (IPTC), giữ `APP0`, `APP2` (ICC). PNG: bỏ chunk `eXIf`, `tEXt`, `iTXt`, `zTXt`. HEIC: theo kết quả E0; nếu app đã đổi sang JPEG thì server từ chối HEIC với `IMAGE_UNSUPPORTED` ("Hãy chọn ảnh JPEG hoặc PNG"); nếu chưa thì giữ chấp nhận HEIC và ghi rủi ro. |
| L7 | Thông tin cá nhân | Luật: số điện thoại VN (`0` + 9–10 số, `+84`), số quốc tế dạng `+<mã> …`, email, dãy ≥ 9 chữ số liên tiếp (CCCD, số thẻ, tài khoản). Trả số thứ tự dòng + loại. Không trả lại chính giá trị ở trường riêng. |
| L8 | Giới hạn tốc độ | Dùng chung `rateLimitOcrMax` của `/v1/ocr` (một bộ đếm cho cả hai route). |
| L9 | Log | Chỉ ghi kết quả (`kind`, số dòng PII, mã từ chối, thời gian). Không ghi chữ, không ghi nhãn SafeSearch chi tiết. |

## 3. Thay đổi server

### 3.1 Migration `013_learner_images.sql` (+ `.down.sql`)

> Số migration chốt lúc code (nhánh khác có thể đã dùng 013).

```sql
CREATE TABLE learner_images (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  width integer,
  height integer,
  kind text NOT NULL CHECK (kind IN ('text', 'scene', 'mixed')),
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL, -- E4 gắn vào bài
  expires_at timestamptz,                                   -- null khi đã gắn bài
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_images_lifetime_check
    CHECK ((lesson_id IS NULL) = (expires_at IS NOT NULL))
);
CREATE INDEX learner_images_expires_idx ON learner_images (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX learner_images_owner_idx ON learner_images (owner_user_id);
```

Cập nhật `prisma/schema.prisma` (model `learner_images`) và chạy `yarn prisma generate`.

### 3.2 File

| File | Thay đổi |
|---|---|
| `src/modules/ocr/provider/types.ts` | `OCRProviderResult` thêm `safeSearch?: {adult, violence, racy}` (giá trị `'UNKNOWN' \| 'VERY_UNLIKELY' \| … \| 'VERY_LIKELY'`). |
| `src/modules/ocr/provider/googleVision.ts` | `features` thêm `{type: 'SAFE_SEARCH_DETECTION'}`; đọc `safeSearchAnnotation`. Không đổi kết quả của `/v1/ocr`. |
| `src/modules/ocr/provider/mock.ts` | Trả `safeSearch` an toàn; ảnh test có byte đánh dấu đặc biệt → trả `LIKELY` để test từ chối. |
| `src/modules/images/model/imageAnalysis.ts` (mới) | Zod cho response: `{request_id, status: 'success', image_id \| null, kind, text, warnings[], pii_lines: [{line, type}], suggested_intent}`; mã lỗi `IMAGE_REJECTED`, `IMAGE_UNSUPPORTED`, `IMAGE_TOO_LARGE`, `OCR_PROVIDER_ERROR`. |
| `src/modules/images/service/imageBytes.ts` (mới) | `sniffImageType(buffer)` (magic bytes JPEG `FF D8 FF`, PNG `89 50 4E 47`, HEIC `ftypheic/heix/mif1`) và `stripImageMetadata(buffer, type)` (L6). Thuần, không I/O. |
| `src/modules/images/service/piiDetect.ts` (mới) | `detectPiiLines(text)` theo L7. Thuần. Có fixture `test/fixtures/pii-cases.json` để app chép dùng chung (E3). |
| `src/modules/images/service/imageClassify.ts` (mới) | `classifyImage(text)` và `suggestIntent(kind)` theo L2. Thuần. |
| `src/modules/images/service/imageAnalysisService.ts` (mới) | Thứ tự: sniff → so với `mimetype` khai báo (lệch → `IMAGE_UNSUPPORTED`) → strip metadata → `runOCR` mở rộng (chữ + SafeSearch) → từ chối nếu vượt L1 → classify → PII → lưu tạm (nếu có storage) → trả kết quả. Dùng lại `normalizeOCRText`, `assessOCRQuality`. |
| `src/modules/images/repository/learnerImageStore.ts` (mới) | `insertTemporary`, `findOwned(id, userId)`, `attachToLesson(id, lessonId)` (cho E4), `releaseForLesson(lessonId)` (cho E5), `purgeExpired(now)` trả object key đã xoá, `objectKeysForUser(userId)`. |
| `src/modules/images/repository/learnerImageStorage.ts` (mới) | `createLearnerImageStorage(env)` theo L4. |
| `src/modules/images/controller/imageAnalyze.ts` (mới) | Route `POST /api/v1/images/analyze`, `preHandler: requireAuth`, multipart (dùng lại `parseOcrMultipart`), giới hạn tốc độ L8, `logRequestOutcome`. |
| `src/modules/ocr/controller/ocr.ts` | Tách bộ giới hạn tốc độ ra hàm dùng chung để 2 route cùng một bộ đếm (L8). Hành vi `/v1/ocr` không đổi. |
| `src/app/service/cleanup.ts` | Thêm `startLearnerImageCleanup(store, storage)`: mỗi giờ `purgeExpired` rồi xoá object. Lỗi chỉ log. |
| `src/modules/admin/repository/adminUsersStore.ts` | Khi xoá tài khoản: lấy thêm `objectKeysForUser` **trước** khi xoá user, trả về cùng `objectKeys` để controller xoá object như recordings đang làm. |
| `src/common/config/env.ts` | Biến L4. |
| `src/app/server.ts` | Đăng ký route + job dọn. |
| `docs/` (server) | Ghi biến môi trường mới vào tài liệu cấu hình hiện có. |

## 4. Kiểm thử

| Loại | File | Nội dung |
|---|---|---|
| Unit | `test/imageBytes.test.ts` | Sniff đúng 3 loại; file giả mạo (đuôi `.jpg`, nội dung PNG / text) bị phát hiện; JPEG có `APP1` EXIF GPS → sau strip không còn `Exif\0\0`, ảnh vẫn giải mã được (so kích thước header SOF); PNG có `eXIf` → bị bỏ, CRC các chunk còn lại giữ nguyên. |
| Unit | `test/piiDetect.test.ts` | Theo `pii-cases.json`: số VN, `+84`, email, 12 số CCCD, 16 số thẻ có / không khoảng trắng; **không** bắt giá tiền `12.50`, năm `2024`, giờ `10:30`. |
| Unit | `test/imageClassify.test.ts` | Ngưỡng 0 / 1–7 / ≥ 8 từ; chữ không Latin → 0 từ. |
| Unit | `test/googleVisionOCRProvider.test.ts` | Request có `SAFE_SEARCH_DETECTION`; parse `safeSearchAnnotation`; thiếu trường → `UNKNOWN`. |
| Unit | `test/imageAnalyze.test.ts` (route, store giả) | 401 khi chưa đăng nhập; ảnh an toàn có chữ → `kind: text`, `suggested_intent: understand`, `image_id` có; ảnh `LIKELY` adult → `IMAGE_REJECTED`, không lưu; MIME lệch → `IMAGE_UNSUPPORTED`; quá cỡ → `IMAGE_TOO_LARGE`; không có storage → `image_id: null`; giới hạn tốc độ chung với `/v1/ocr`. |
| DB | `test/learnerImages.test.ts` | Ràng buộc `lifetime_check`; `purgeExpired` chỉ xoá ảnh hết hạn chưa gắn bài; xoá user → hàng bị xoá và trả object key. Thêm vào danh sách `test:db` trong `package.json`. |
| Không đổi | `test/ocr.test.ts`, `test/ocrService.test.ts` | Vẫn pass (hành vi `/v1/ocr` giữ nguyên). |

Lệnh: `yarn test`, `yarn test:db`, `yarn lint`, `yarn format`, `yarn tsc` (nếu có script typecheck).

## 5. Thứ tự commit

1. `feat(images): sniff image types and strip metadata` (+ test).
2. `feat(images): rule-based PII lines and image classification` (+ test, fixture).
3. `feat(ocr): request SafeSearch with text detection` (+ test).
4. `feat(db): learner_images table` (migration, prisma).
5. `feat(images): analyze route with temporary storage` (+ test).
6. `feat(cleanup): purge expired learner images; delete them with the account`.

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Strip metadata làm hỏng ảnh lạ | Chỉ bỏ segment / chunk đã liệt kê; ảnh không parse được → từ chối `IMAGE_UNSUPPORTED` thay vì gửi ảnh còn metadata |
| SafeSearch chặn nhầm | Ngưỡng `LIKELY`, không dùng `medical`; theo dõi tỷ lệ `IMAGE_REJECTED` (E6) |
| Chi phí Google Vision tăng do thêm feature | SafeSearch tính tiền riêng mỗi ảnh; ghi vào `docs/03-operations/01-cost-estimate.md` khi code |
| Object mồ côi (xoá DB thành công, xoá object lỗi) | Job dọn quét thêm tiền tố `learner-images/` để xoá object không có hàng (mỗi ngày một lần) |

## 7. Điểm lệch so với plan

_(điền khi code xong)_
