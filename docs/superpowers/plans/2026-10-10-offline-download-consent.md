# Kế hoạch: xin đồng ý trước khi tải dữ liệu offline

> Trạng thái: **ĐÃ LÀM** (2026-10-10). Các quyết định ở mục 5 được duyệt theo đề xuất: không có chế độ Wi-Fi, người dùng cũ được hỏi lại và giữ file đã tải, hỏi ở bài đầu tiên có media, chỉ xoá media, dung lượng chỉ hiện sau khi tải, phần hiển thị media tách việc riêng.
> Ngày lập: 2026-10-10. Phạm vi: `LingoBites-App`. Server không cần đổi (trừ Q5 nếu chọn phương án B).

---

## 1. Mục tiêu

Người học **biết và quyết định** app được lưu những gì lên máy, thay vì app tự tải:

- Nội dung chữ của bài (snapshot) vẫn tự lưu, vì đây là nền của chế độ offline và ôn tập. App phải **nói rõ** điều này.
- File media của bài (ảnh, audio…) **chỉ tải khi người học cho phép**: tự động (đã đồng ý) hoặc bấm tải từng bài.
- Người học xem được dung lượng, xoá được media đã tải, và đổi lựa chọn bất cứ lúc nào.

Ngoài phạm vi: tải video YouTube (app chỉ phát trực tuyến), bản ghi giọng nói (đã có đồng ý riêng ở `recordingConsent.ts`).

---

## 2. Hiện trạng trong source

| Dữ liệu | Ở đâu | Khi nào tải | Ghi chú |
|---|---|---|---|
| Snapshot bài (JSON) | bảng `lesson_downloads` (`canonicalDownloadRepository.ts`) | Mỗi lần mở bài khi có mạng (`useCanonicalLesson.open`), và khi tạo bài (`composeTracker.ts`) | Ôn tập (`itemReview.ts`), nói (`speakingModes.ts`), thư viện, Lesson Flow đều đọc bảng này |
| File media của khối `media` | `Documents/lesson-media/<lessonId>/<revision>/` (`stageLessonMedia`) | Cùng lúc với snapshot, **không hỏi** | ⚠️ **Hiện không màn nào đọc các file này.** `CanonicalBlockView` chỉ hiện chữ/URL, không mở file trong `media_dir`. Tức là app đang tải file người học chưa từng thấy |
| Audio chương | bảng `audio_assets` | Chuỗi tải đã gỡ (LING-249), chỉ còn phát file cũ | Không tải mới |
| Video YouTube | — | Không tải, chỉ phát trực tuyến | — |

Hệ quả khác: nếu tải media lỗi và máy chưa có bản cũ, **cả bài không mở được** (`useCanonicalLesson`, nhánh `catch`) dù phần chữ đã tải xong.

Hạ tầng dùng lại được:

- `app_settings` (key/value) + mẫu `recordingConsent.ts` (`'on' | 'off' | 'undecided'`, hỏi lại sau 7 ngày) → **không cần migration**.
- `ConsentSheet` (shadowing), `EvaluationConsentPrompt`, `SettingsOptionSheet`, `ProfileSettingsRow`, `SettingsGroup`.
- `sweepLessonMedia` (dọn thư mục không còn được tham chiếu), `getAudioCacheStats` (mẫu tính dung lượng).
- Màn `DataSettingsScreen` ("Dữ liệu & bộ nhớ").

---

## 3. Hướng đề xuất

| Loại | Đề xuất | Lý do |
|---|---|---|
| Snapshot chữ | Tự lưu như cũ + **thông báo rõ** | Nhỏ (vài chục KB); thiếu nó thì mất #10 (mở bài đã tải), ôn tập, tiến độ. Đây là dữ liệu cần để app chạy, không phải tải "thêm" |
| Media của bài | **Hỏi một lần**, lưu lựa chọn; mặc định khi chưa trả lời là **không tải** | Dữ liệu nặng, tốn dung lượng/4G; hiện còn chưa được dùng |
| Xoá | Xoá **media** từng bài hoặc tất cả | Xoá snapshot sẽ làm mất từ vựng trong ôn tập và tiến độ → không đưa vào đợt này (xem Q4) |

Lựa chọn lưu ở key `downloads.media_consent`: `'auto' | 'manual' | 'undecided'`.

- `auto`: mở bài khi có mạng thì tải media (như hiện nay).
- `manual`: chỉ tải khi bấm "Tải để học offline" trong bài.
- `undecided`: chưa hỏi → không tải; hỏi khi lần đầu mở một bài **có khối media**. Bài không có media thì không hỏi (tránh hỏi thừa).

---

## 4. Thiết kế chi tiết

### 4.1 Logic thuần — file mới `src/features/lesson/player/logic/mediaDownloadConsent.ts`

- `readMediaDownloadConsent()`, `setMediaDownloadConsent(value)`, `shouldAskMediaDownloadConsent(snapshot)` (chỉ `true` khi `undecided` và snapshot có khối media).
- `MEDIA_DOWNLOAD_CONSENT_KEY = 'downloads.media_consent'`, theo đúng mẫu `recordingConsent.ts`.

### 4.2 Tách tải media khỏi việc mở bài — sửa `useCanonicalLesson.ts`

- Luôn lưu snapshot. Chỉ gọi `stageLessonMedia` khi consent là `auto`, hoặc khi người học bấm tải (hàm mới `downloadMedia()` hook trả ra).
- Khi không tải media: giữ `media_dir` cũ nếu cùng revision (để `sweepLessonMedia` không xoá file đã tải), ngược lại `null`.
- **Sửa luôn lỗi ở mục 2:** tải media lỗi thì vẫn mở bài bằng snapshot vừa lưu, chỉ báo "Chưa tải được media".
- Sửa `canonicalDownloadRepository.ts`: thêm `setLessonMediaDir(lessonId, dir)` (cập nhật một cột, giữ tính nguyên tử của hàng) và `removeLessonMedia(lessonId)`.

### 4.3 Hỏi đồng ý — component mới `MediaDownloadConsentSheet.tsx`

Hiện khi mở bài lần đầu (consent `undecided`, bài có media). Nội dung đề xuất:

> **Lưu bài để học khi không có mạng?**
> Phần chữ của bài đã được lưu sẵn trên máy. Ảnh và âm thanh của bài cần tải thêm và sẽ chiếm dung lượng máy.
> [Tự động tải] · [Tôi tự chọn bài] · Để sau

- "Để sau" giữ `undecided`, hỏi lại sau 7 ngày (giống `shouldAskEvaluationConsent`).
- Dựa trên `ConsentSheet` có sẵn; không thêm thư viện.

### 4.4 Cài đặt — sửa `DataSettingsScreen.tsx`, `useDataSettings.ts`

Nhóm mới **"Học offline"**:

- "Tự động tải media bài học": Tự động / Tự chọn (dùng `SettingsOptionSheet`).
- "Bài đã tải": tổng dung lượng media → mở màn mới.
- Dòng mô tả: "Nội dung chữ của các bài bạn đã mở được lưu trên máy để học khi không có mạng."

### 4.5 Màn mới `OfflineDownloadsScreen.tsx` (stack Profile)

- Danh sách bài có media đã tải: tên bài, dung lượng, nút "Xoá media".
- Nút "Xoá tất cả media" (có hỏi xác nhận).
- Dung lượng: đọc kích thước file trong `lesson-media/` bằng `RNFS.stat` (đã có `@dr.pogodin/react-native-fs`).

### 4.6 Trong bài — sửa `CanonicalLessonHub.tsx` / `LessonStatusBanners.tsx`

- Consent `manual`/`undecided`, bài có media chưa tải → nút "Tải để học offline".
- Đã tải → nhãn "Có sẵn offline".
- Offline + chưa có media → "Cần mạng để tải ảnh và âm thanh của bài".

### 4.7 Tài liệu — sửa `docs/architecture/offline-mode.md`

Thêm nguyên tắc "Tải nặng cần đồng ý", dòng mới cho bảng tính năng, và cập nhật trạng thái.

---

## 5. Quyết định cần anh/chị chốt trước khi code

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Có chế độ "Chỉ khi dùng Wi-Fi" không? Cần thêm thư viện **`@react-native-community/netinfo`** (dependency mới, cần build lại native), và trái với nguyên tắc "không thêm NetInfo" trong `offline-mode.md` | **Chưa làm đợt này.** Chỉ có Tự động / Tự chọn; thêm Wi-Fi sau nếu cần |
| Q2 | Người dùng cũ (đã có media tải tự động) xử lý thế nào? | Coi là `undecided`, hỏi ở lần mở bài có media tiếp theo; **giữ** file đã tải, người học tự xoá ở màn "Bài đã tải" |
| Q3 | Hỏi lúc nào? | Lần đầu mở bài **có media** (đúng ngữ cảnh), không hỏi ở onboarding |
| Q4 | Cho xoá **cả bài** (snapshot) không? | **Không**, chỉ xoá media. Xoá snapshot làm mất từ trong ôn tập, mục nói và tiến độ; cần thiết kế riêng |
| Q5 | Hiện dung lượng **trước** khi tải? | A: chỉ hiện sau khi tải, không đổi Server (**đề xuất**). B: Server thêm `size_bytes` vào khối media, đổi contract snapshot (thay đổi public API) |
| Q6 | Media hiện chưa được hiển thị (mục 2). Có làm phần hiển thị ảnh/audio từ file đã tải không? | Tách việc riêng; đợt này chỉ lo đồng ý và quản lý dung lượng |

---

## 6. Các bước thực hiện (mỗi bước một commit, chạy được)

1. **Logic consent** — `mediaDownloadConsent.ts` + test. `feat(offline): media download consent setting`
2. **Tách tải media** — `useCanonicalLesson.ts`, `canonicalDownloadRepository.ts` (+ test real-sqlite, test hook). Kèm sửa lỗi "media lỗi làm hỏng mở bài". `fix(lesson): open lessons without media; download media only with consent`
3. **Sheet hỏi đồng ý** — `MediaDownloadConsentSheet.tsx`, nối vào `CanonicalLessonPlayerScreen.tsx` + test. `feat(offline): ask before downloading lesson media`
4. **Nút tải / nhãn trong bài** — `CanonicalLessonHub.tsx`, `LessonStatusBanners.tsx`, i18n `vi.json`/`en.json` + test.
5. **Cài đặt + màn Bài đã tải** — `DataSettingsScreen.tsx`, `useDataSettings.ts`, `OfflineDownloadsScreen.tsx`, `navigationTypes.ts` + navigator Profile + test.
6. **Tài liệu** — `offline-mode.md`.

Kiểm tra mỗi bước: `npx tsc --noEmit`, `npx prettier --check`, `npx jest src/features/lesson src/features/profile src/core/i18n`.

---

## 7. Rủi ro & lưu ý

- ⚠️ **Đổi hành vi mặc định:** sau bản này, người dùng chưa trả lời sẽ không được tải media. Hiện media chưa được hiển thị nên người học không thấy khác biệt.
- `sweepLessonMedia` xoá thư mục không còn được tham chiếu: bước 2 phải giữ `media_dir` đúng, nếu không file đã tải sẽ bị xoá nhầm. Cần test riêng cho trường hợp này.
- Không có migration (dùng `app_settings`, cột `media_dir` có sẵn).
- `LocalDataDeletionService` ("Xoá dữ liệu") phải xoá cả thư mục `lesson-media/`. Kiểm tra lại ở bước 5.
- Không có dependency mới (nếu Q1 giữ "chưa làm").

## 8. Ước lượng

Khoảng 6 commit nhỏ; bước 2 và 5 lớn nhất. Không đụng Server.
