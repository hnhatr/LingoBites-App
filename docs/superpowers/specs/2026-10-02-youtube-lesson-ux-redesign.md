# Bài học YouTube: thiết kế lại UI/UX trên logic lesson mới — Design Specification

**Date:** 2026-10-02
**Status:** Design draft, chờ duyệt trước khi lập plan triển khai
**Design files:** [`docs/design/youtube-lesson/`](../../design/youtube-lesson/README.md)
**Liên quan:** LING-149 / PR #119 (squash `f295665`), LING-176 / PR #118

---

## 1. Mục đích

Commit `f295665` (01/10) chuyển bài YouTube sang pipeline lesson chung: tạo bài qua
`LessonCreationScreen`, học trong `CanonicalLessonPlayerScreen`. Logic mới đúng hướng, nhưng
phần giao diện YouTube cũ bị xoá theo mà không có bản thay thế. Người học mất thanh điều
khiển, lặp câu, lặp A–B, tốc độ, ẩn/hiện dịch và IPA, lưu câu ♥, màn hoàn thành, danh sách bài
đã lưu riêng. Các màn mới dùng chữ tiếng Anh viết cứng và hiện thông tin kỹ thuật
(`origin · source_type · revision`).

Spec này mô tả giao diện mới cho toàn bộ luồng YouTube:

- Lấy lại trải nghiệm học của luồng cũ.
- Chỉ dùng dữ liệu mà logic và contract hiện tại cung cấp.
- Dùng token theme sẵn có (`default`, `dark`) và icon Material Symbols.

## 2. Phạm vi

### Trong phạm vi

- Giao diện `LessonCreation` khi `initialSource = 'youtube'`, gồm các trạng thái idle, đang xử lý, quá thời gian, thất bại.
- Giao diện `CanonicalLessonPlayer` khi `snapshot.source_type === 'youtube'`, gồm màn học, 3 bottom sheet (phân tích, công cụ, transcript), màn hoàn thành, trạng thái ngoại tuyến và bản mới.
- Danh sách "Bài YouTube đã lưu" trên dữ liệu `CanonicalCatalog`.
- Chuỗi tiếng Việt qua i18n, theme Sáng và Tối.
- Các thay đổi logic phía app cần để giao diện hoạt động (mục 6).

### Ngoài phạm vi

- Đổi route hoặc params điều hướng: giữ `LessonCreation`, `CanonicalLessonPlayer`, `CanonicalCatalog`.
- Đổi contract server, schema `LessonSnapshot` hoặc schema SQLite.
- Giao diện bài văn bản và OCR: vẫn dùng player hiện tại.
- Quiz Luyện tập (module `practice` đã xoá): thay bằng lối vào ôn tập có sẵn (FR-09).
- Dán transcript tay, % tiến trình xử lý: cần đổi contract, xem mục 8.

## 3. Ràng buộc

| # | Ràng buộc | Nguồn |
|---|-----------|-------|
| C-1 | Body tạo bài YouTube chỉ có `{source: 'youtube', url}` (zod `.strict()`) | `src/core/schemas/lesson.ts` `LearnerLessonCreationRequestBodySchema` |
| C-2 | Trạng thái tạo bài chỉ gồm `queued`, `processing`, `succeeded`, `failed`. Lỗi gồm `code` và `retryable` | `LessonCreationStatusValues`, `LessonCreationErrorSchema` |
| C-3 | Câu có `text_en`, `text_vi`, `ipa`, `start_ms`, `end_ms` (có thể null) | `LessonSentenceSchema` |
| C-4 | Phân tích chỉ có `vocabulary` (word, pos, ipa, meaning) và `grammar` (name, description, formula, analysis), không có "từ chính" | `LessonAnalysisSchema` |
| C-5 | Catalog không có tên kênh, thời lượng video hay thumbnail; chỉ có `youtube_video_id`, `sentence_count` | `LessonCatalogItemSchema` |
| C-6 | Code đặt trong `src/features/lesson/player/`, không tạo lại `src/features/youtube` | `docs/architecture/module-boundaries.md` |
| C-7 | Không thêm dependency mới | CLAUDE.md §3 |

## 4. Màn hình và yêu cầu

Mỗi màn có file HTML độc lập trong `docs/design/youtube-lesson/screens/`. Khi yêu cầu và
thiết kế lệch nhau, yêu cầu trong spec này là chuẩn.

### FR-01 Nhập link YouTube — `01-nhap-link.html`

- Header: nút quay lại, tiêu đề "Học từ YouTube", nút "Bài đã lưu" mở FR-10.
- Ẩn hàng tab nguồn `text/ocr/youtube` khi `initialSource === 'youtube'`.
- Ô "Link YouTube" có nút xoá. Nút "Dán link" đọc clipboard (`@react-native-clipboard/clipboard` đã có trong dependencies).
- Khi link hợp lệ, hiện thẻ xem trước: thumbnail lấy theo video id và dòng "Đã nhận ra video YouTube". Phải lấy lại hàm parse video id vì `parseYouTubeVideoId` đã bị xoá.
- Nút "Tạo bài học" chỉ bật khi link là link YouTube hợp lệ.
- Hai dòng thông tin: yêu cầu có phụ đề tiếng Anh, và việc gửi phụ đề tới máy chủ và AI. Lần đầu tạo bài cần người dùng xác nhận quyền riêng tư (khôi phục hành vi `ensureYouTubeDisclosureAcknowledged`).

### FR-02 Đang tạo bài — `02-dang-tao-bai.html`

- Hiện khi `submitting` hoặc `processing`. Gồm thẻ video, tiêu đề "Đang tạo bài học", thanh tiến trình chạy liên tục (không có %), và 3 bước: "Đã gửi yêu cầu" (`queued`), "Đang lấy phụ đề và dịch" (`processing`), "Bài học sẵn sàng" (`succeeded`).
- Khi `succeeded`, tự `openLesson(navigation, lessonId)`, không cần bấm thêm.
- Nút "Về trang chủ trong lúc chờ". Câu "bài sẽ có trong Bài đã lưu khi xong" chỉ giữ nếu Q-4 được xác nhận.
- Tôn trọng "Giảm chuyển động": tắt animation thanh tiến trình và vòng quay.

### FR-03 Mất lâu hơn dự kiến — `03-qua-thoi-gian.html`

- Hiện khi `timedOut`. Nút "Kiểm tra lại" gọi `checkAgain()` (giữ `requestId` và idempotency key), nút "Quay lại sau".

### FR-04 Tạo bài thất bại — `04-that-bai.html`

- Hiện khi `failed` hoặc `error`. Đổi `code` sang thông điệp tiếng Việt qua bảng map, có thông điệp mặc định cho mã chưa biết. Mã gốc hiện nhỏ bên dưới để báo lỗi.
- Có mẹo chọn video và ô link để sửa ngay.
- "Thử lại video này" chỉ hiện khi `retryable`, gọi `retryWithFreshKey()`. "Tạo bài với link mới" gửi link trong ô.

### FR-05 Học bài YouTube — `05-hoc-bai.html`

- Header: tên bài (1 dòng), nút ẩn/hiện bản dịch, nút ẩn/hiện IPA, menu thêm.
- Video `YouTubePlayer` ở trên, có phụ đề câu đang phát đè lên video.
- Thanh điều khiển:
  - Thanh tua có vùng A–B tô màu.
  - "Câu i/N", nút câu trước, play/pause, phát lại câu.
  - Nút công cụ hiện trạng thái đang dùng (ví dụ "3× · 0.75×"), bấm mở FR-07.
- Thẻ câu vuốt ngang, mỗi thẻ một câu:
  - Mốc thời gian, nút nghe câu, nút ♥ lưu câu.
  - Câu tiếng Anh, IPA, bản dịch.
  - Tóm tắt từ vựng và ngữ pháp, nút "Xem phân tích chi tiết" mở FR-06.
- Thẻ câu và video đồng bộ hai chiều: video chạy thì thẻ tự chuyển (nếu bật), vuốt hoặc chạm thẻ thì video tua tới `start_ms`.
- Hàng dưới: câu trước, chỉ báo vị trí, nút "Transcript" mở FR-08, câu sau.
- Không hiện `origin · source_type · revision`.

### FR-06 Phân tích câu — `06-phan-tich-cau.html`

- Bottom sheet phủ dưới video, video vẫn thấy và vẫn phát.
- Từ vựng: word, pos, ipa, meaning, nút nghe, nút lưu từ.
- Ngữ pháp: name, formula, description, analysis, nút lưu ngữ pháp.
- Trạng thái đang tải, lỗi kèm "Thử lại", và chưa có trên máy (offline-missing), dùng lại state của `SentenceAnalysisPanel`.
- Cách tải phân tích theo Q-3.

### FR-07 Công cụ luyện nghe — `07-cong-cu.html`

- Lặp mỗi câu: Tắt, 1×, 3×, 5×, ∞.
- Lặp đoạn A–B: đặt A tại câu đang phát, đặt B, xoá. Hiện "Đang lặp câu a–b".
- Tốc độ: 0.5×, 0.75×, 1×, 1.25× (truyền vào prop `playbackRate` có sẵn).
- Bật/tắt "Tự chuyển thẻ theo video".
- Lối vào "Chép chính tả": nghe câu đang phát rồi gõ lại.

### FR-08 Transcript — `08-transcript.html`

- Danh sách toàn bộ câu: mốc thời gian, tiếng Anh, tiếng Việt (theo nút ẩn/hiện bản dịch), nút ♥.
- Câu đang phát tô màu `accentSoft`, đoạn A–B tô `tertiarySoft`. Chạm câu để tua video.
- Mở ra thì tự cuộn tới câu đang phát.

### FR-09 Học xong bài — `09-hoc-xong.html`

- Hiện khi video kết thúc hoặc người học qua câu cuối.
- Gọi `recordLessonEvent` để ghi hoàn thành (hiện player chưa ghi tiến độ).
- Số câu đã nghe, số từ đã lưu, số câu đã lưu trong bài.
- Nút chính "Ôn từ đã lưu" mở ôn tập hằng ngày có sẵn. Nút phụ "Xem lại" (về câu 1) và "Video khác" (FR-01).

### FR-10 Bài YouTube đã lưu — `10-bai-da-luu.html`

- Lấy từ catalog, lọc `youtube_video_id != null`.
- Nút "Tạo bài từ video mới". Bộ lọc Tất cả / Đang học / Đã xong theo `getLessonProgress`.
- Mỗi dòng: thumbnail theo video id, tên bài, số câu, tiến độ hoặc "Đã xong", nhãn "Có trên máy" nếu đã tải.
- Menu dòng: "Học lại từ đầu", "Xoá khỏi máy" (`removeLessonDownload`, chỉ hiện khi đã tải). Có xác nhận trước khi xoá.

### FR-11 Ngoại tuyến và bản mới — `11-ngoai-tuyen.html`

- Video không phát được (offline hoặc `videoAvailable = false`): thay khung video bằng thông báo và nút "Thử lại"; câu vẫn đọc được.
- `hasUpdate`: banner "Bài này có bản cập nhật" có nút "Cập nhật".
- Phân tích chưa có trên máy: thông báo trong thẻ câu.

### FR-12 Theme và ngôn ngữ — `12-hoc-bai-toi.html`

- Mọi màu lấy từ `useAppTheme()`. Bảng ánh xạ ở `docs/design/youtube-lesson/tokens.json`.
- Màu ♥ ở theme Tối chưa có token (`colors.secondary` của theme Tối là xám): cần quyết định Q-5.
- Mọi chuỗi qua i18n `vi.json`. Dùng lại khoá `youtube.*` còn trong file khi nghĩa còn đúng, xoá khoá không dùng sau khi xong.
- Vùng chạm tối thiểu 44×44. Nút chỉ có icon phải có `accessibilityLabel`.

## 5. Ánh xạ dữ liệu

| Giao diện | Nguồn |
|-----------|-------|
| Câu (EN / VI / IPA) | `snapshot.sentences[].text_en / text_vi / ipa`, sắp theo `position` |
| Thời điểm câu | `start_ms`; `end_ms` null thì lấy `start_ms` câu sau, câu cuối lấy `youtube.duration_ms` |
| Video | `snapshot.youtube.video_id` |
| Phân tích | `snapshot.analyses[sentence_id]`, `lateAnalyses`, `analysisStates` |
| Lưu từ / ngữ pháp / câu | `useBookmarkOptimistic` (`@features/review`) |
| Tiến độ | `recordLessonEvent`, `getLessonProgress` (`@core/sync/lessonProgress`) |
| Bản tải về | `lesson_downloads`, `removeLessonDownload` |
| Ngoại tuyến, bản mới | `state.offline`, `state.hasUpdate` của `useCanonicalLesson` |
| Trạng thái tạo bài | `useLessonCreation(submissionId).state` |

## 6. Thay đổi logic phía app

1. **Tua video thật:** gắn `ref` vào `YouTubePlayer` (đã có `forwardRef`, `seekTo`) trong `CanonicalLessonPlayerScreen`. Hiện `onSeek` chỉ gọi `setPositionMs`, nên chạm câu không tua được video.
2. **Bộ điều khiển phát:** lặp câu, lặp A–B, tốc độ, tự chuyển thẻ. Logic thuần, có test riêng. Có thể lấy lại `sentenceSeek`, `playbackRate`, `toolsLogic` từ `f295665^`.
3. **Ghi hoàn thành:** gọi `recordLessonEvent` khi học xong.
4. **Lưu câu và từ:** gắn `useBookmarkOptimistic` theo `lessonId` và `sentence.id` mới.
5. **Kiểm tra link và xác nhận quyền riêng tư:** lấy lại parse video id và cờ đã xác nhận.
6. **Map mã lỗi:** bảng `code → chuỗi i18n`, có mặc định.

## 7. Tiêu chí nghiệm thu

- [ ] Từ ô YouTube ở Tạo bài và Home vào FR-01, không thấy hàng tab nguồn.
- [ ] Link không phải YouTube thì nút "Tạo bài học" bị khoá.
- [ ] Tạo bài thành công thì tự mở bài; quá thời gian thì "Kiểm tra lại" không tạo bài trùng.
- [ ] Lỗi hiện tiếng Việt, mã chưa biết dùng thông điệp mặc định.
- [ ] Chạm câu ở thẻ hoặc transcript thì video tua đúng `start_ms`.
- [ ] Lặp câu, lặp A–B và tốc độ hoạt động; trạng thái hiện trên nút công cụ.
- [ ] Ẩn/hiện bản dịch và IPA áp dụng cho thẻ câu và transcript.
- [ ] ♥ và lưu từ đồng bộ với Thư viện và ôn tập.
- [ ] Học xong ghi `lesson_progress`; danh sách đã lưu hiện "Đã xong".
- [ ] Ngoại tuyến vẫn đọc được câu; có bản mới thì hiện banner.
- [ ] Theme Sáng và Tối đúng token; không còn chữ tiếng Anh viết cứng trong giao diện YouTube.
- [ ] Bài văn bản và OCR không đổi giao diện.
- [ ] `yarn lint`, `yarn typecheck`, `yarn test` đều qua.

## 8. Câu hỏi mở

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| Q-1 | Server có còn giới hạn độ dài video không, bao nhiêu phút? | Chữ `[X] phút` ở FR-01 |
| Q-2 | Danh sách mã lỗi `code` server trả cho nguồn YouTube | Bảng map FR-04 |
| Q-3 | Phân tích tự tải khi thẻ câu hiện ra, hay giữ nút bấm? Tự tải tăng lượt gọi AI | FR-05, FR-06 |
| Q-4 | Rời FR-02 thì server có tạo bài tiếp không, bài có hiện trong catalog không? | Câu chữ FR-02 |
| Q-5 | Màu ♥ ở theme Tối: thêm token mới hay dùng màu có sẵn? | FR-12, `tokens.json` |
| Q-6 | Có cần dán transcript tay và % tiến trình như luồng cũ không? Cần đổi contract server | Ngoài phạm vi hiện tại |

## 9. Rủi ro

- **Ghi tiến độ là ghi dữ liệu thật** (đi qua outbox sync), cần test đồng bộ.
- **Test hiện có tìm theo `testID`** `lesson-creation-*`, `canonical-player-*`: giữ các `testID` này hoặc cập nhật test.
- **Tự tải phân tích** có thể vượt rate limit hoặc tăng chi phí AI.
