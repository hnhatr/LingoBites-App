# Bài tự tạo có hoạt động tương tác thật (hướng B + C)

> Trạng thái: **ĐÃ CODE** (duyệt 2026-10-11, dùng các đề xuất D1–D7). Commit: PR 1 `89be3a3`, PR 2 `ec498ca`, PR 3 `53960f6`. Ngày lập: 2026-10-11. Repo: `LingoBites-App` (không đổi server).
> Nhánh: `claude/loving-ptolemy-qns04i`.

## 1. Vấn đề

Bài tạo từ **văn bản / ảnh chữ / YouTube** (`lessonCreationPipeline`) chỉ có câu, bản dịch, IPA, từ vựng, ngữ pháp. Không có `spec` và block có `step`, nên `isFlowLesson()` trả `false`:

- Nút chính "Bắt đầu học" chỉ mở danh sách câu để đọc (`CanonicalLessonPlayerScreen`, `openView('sentences')`).
- Hoàn thành bài = **một lần bấm ✓** trên header (`useLessonCompletion.complete`), cộng luôn streak.
- Tương tác thật nằm ở hai nhánh phụ khó thấy: **Practice** (quiz 3 dạng, `core/learning/practice.ts`) và **"Học theo 6 bước"** (chọn 2–8 câu, AI sinh bài mới, 1 lượt/ngày).

Bài **Khoảnh khắc** (ảnh mô tả, kể tình huống) không thuộc phạm vi này: server đã tự dựng bài 6 bước.

## 2. Mục tiêu

- **B:** Mọi bài tự tạo chưa phải bài 6 bước đều có một **chuỗi luyện tập tương tác** sinh ngay trên máy từ dữ liệu sẵn có. Không gọi AI, chạy offline, có ngay khi tạo xong, áp dụng cả cho bài cũ.
- Bài chỉ **hoàn thành** khi làm xong chuỗi này (bỏ nút ✓ một chạm).
- **C:** Màn kết quả gợi ý "Học sâu theo 6 bước" với các câu **chọn sẵn**, một chạm là gửi.

Ngoài phạm vi: chấm máy giọng nói, đổi giới hạn compose, đổi server, bài Khoảnh khắc và bài giáo trình.

## 3. Quyết định (dùng đề xuất nếu bạn không đổi)

| #   | Câu hỏi                                   | Đề xuất                                                                                                                                                                           |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Điều kiện hoàn thành                      | Làm hết các phần của chuỗi. **Không** đặt ngưỡng điểm; điểm chỉ để hiển thị và chọn từ cần ôn.                                                                                    |
| D2  | Phần nói                                  | Có phần "Nghe và nhắc lại" với **tự đánh giá** (như bước 5 hiện nay), không chấm máy. Khi người học tắt luyện nói (`noSpeaking`) thì phần này bị bỏ qua và không chặn hoàn thành. |
| D3  | Bài cũ                                    | Áp dụng luôn: chuỗi sinh lúc mở bài, không cần migration. Bài đã "hoàn thành" trước đây giữ nguyên trạng thái.                                                                    |
| D4  | Màn Practice hiện có                      | **Nâng cấp** màn `Practice` thành chuỗi nhiều phần (giữ tên route, giữ `kind = 'practice'`) để không có hai lối vào gần giống nhau.                                               |
| D5  | Bài quá ít nội dung (dưới 3 câu hỏi được) | Không hiện chuỗi, giữ nút ✓ như hiện nay.                                                                                                                                         |
| D6  | Bài dài (transcript YouTube)              | Chuỗi lấy tối đa **8 câu**: đoạn câu liền nhau có nhiều từ vựng nhất. Mỗi lần "Làm lại" vẫn cùng đoạn; đổi seed chỉ xáo câu hỏi.                                                  |
| D7  | Gợi ý C chọn câu nào                      | Cùng đoạn 2–8 câu liền nhau ở D6, lọc theo `composePickIssue()`. Người học vẫn sửa được lựa chọn trước khi gửi.                                                                   |

## 4. Thiết kế chuỗi luyện tập

Thứ tự cố định, đi từ nhận biết đến tự tạo câu:

| Phần                | Activity (component có sẵn)                  | Nguồn dữ liệu                                                          | Số mục  |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------- | ------- |
| 1. Nghe và nhắc lại | `ListenRepeatActivity` (`listen_and_repeat`) | câu EN + VI, TTS; bài YouTube phát đúng đoạn video (`startMs`/`endMs`) | 3–4 câu |
| 2. Nghĩa của từ     | `MultipleChoiceActivity` (`multiple_choice`) | `meaning_choice` của `practice.ts`                                     | 3–5     |
| 3. Điền từ          | `FillBlankActivity` (`fill_blank`)           | `cloze_choice` của `practice.ts`                                       | 3–5     |
| 4. Dịch câu         | `TranslationActivity` (`translation`)        | câu VI → EN, đáp án mẫu là câu gốc                                     | 2–3     |

Phần nào không đủ dữ liệu thì bỏ (ví dụ bài không có từ vựng thì không có phần 2–3). Chuỗi cần ít nhất 2 phần, nếu không thì rơi vào D5.

**Màn kết quả:** điểm từng phần, danh sách từ sai kèm "Lưu thành thẻ ôn" (đã có ở Practice), nút "Hoàn thành bài", và thẻ C "Học sâu theo 6 bước".

## 5. Thay đổi theo file

### PR 1 – Bộ sinh chuỗi (logic thuần, không UI)

| File                                                       | Thay đổi                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/learning/lessonPractice.ts` (mới)                | `buildLessonPracticePlan(snapshot, analyses, seed)` → `{sections: Array<{kind: ActivityKind; content: ActivityContentByKind[kind]}>}` hoặc `null` (D5). Tái dùng `buildPracticeSource`, `generatePracticeSet`, `createRandom`. Hàm `pickStudyWindow(snapshot)` dùng chung cho D6 và D7. Nội dung sinh ra phải qua `ActivityContentSchemas[kind].parse()`. |
| `src/core/learning/practice.ts`                            | Export thêm helper cần dùng lại (nếu có), không đổi hành vi.                                                                                                                                                                                                                                                                                              |
| `src/core/learning/index.ts`                               | Export API mới.                                                                                                                                                                                                                                                                                                                                           |
| `src/core/learning/__tests__/lessonPractice.test.ts` (mới) | Cùng seed thì cùng kết quả; bài ít nội dung thì trả `null`; bài YouTube giữ `startMs`/`endMs`; giới hạn 8 câu; nội dung hợp lệ theo schema.                                                                                                                                                                                                               |

### PR 2 – Màn luyện tập nhiều phần và cách tính hoàn thành

| File                                                                      | Thay đổi                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/practice/logic/usePracticeSession.ts`                       | Chạy theo `sections`: phần hiện tại, báo cáo từng mục (`EntryReport`), ghi `recordActivityAttempt({kind: 'practice', activity: <activity kind>, ...})` cho từng mục, tổng kết cuối.                                                                   |
| `src/features/practice/screens/PracticeScreen.tsx`                        | Thanh tiến độ theo phần; render activity component tương ứng; màn kết quả (điểm, từ sai, "Hoàn thành bài", thẻ C).                                                                                                                                    |
| `src/features/lesson/flow/index.ts` (hoặc `src/features/lesson/index.ts`) | Export 4 activity component để `features/practice` dùng. **Cần kiểm tra** `yarn lint:boundaries` có cho feature import feature không. Nếu không cho thì chuyển 4 component (và `EntrySequence`) sang `src/ui` hoặc gộp màn này vào `features/lesson`. |
| `src/features/lesson/player/screens/CanonicalLessonPlayerScreen.tsx`      | Bài không phải flow lesson và có chuỗi: nút chính → `openPractice(lessonId)` ("Bắt đầu luyện" / "Luyện tiếp"); bỏ nút ✓ trên header; đọc câu vẫn là một mục trong hub. Bài không có chuỗi (D5) giữ nguyên hành vi cũ.                                 |
| `src/features/lesson/player/logic/useLessonCompletion.ts`                 | Không đổi logic; màn Practice gọi `complete()` khi xong chuỗi (cộng streak, mục tiêu tuần như cũ).                                                                                                                                                    |
| `src/features/lesson/player/components/CanonicalLessonHub.tsx`            | Bỏ hàng "Luyện tập" riêng nếu đã thành nút chính (tránh hai lối vào).                                                                                                                                                                                 |
| `src/core/i18n/vi.json`, `en.json`                                        | Chuỗi mới: tên phần, tiến độ, kết quả, nút.                                                                                                                                                                                                           |
| Tests                                                                     | `usePracticeSession` (chạy hết chuỗi thì gọi complete; tắt nói thì bỏ phần 1); `PracticeScreen.real-sqlite.test.tsx` cập nhật; test player: nút chính mở Practice, không còn ✓ khi có chuỗi, còn ✓ khi D5.                                            |

### PR 3 – Gợi ý "Học sâu theo 6 bước" (C)

| File                                                                                                                | Thay đổi                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/lesson/player/logic/composePick.ts`                                                                   | `suggestComposePick(snapshot)` dùng `pickStudyWindow` + `composePickIssue`; trả `null` nếu không có đoạn hợp lệ.                                           |
| `src/features/lesson/player/logic/useComposePick.ts`                                                                | Nhận lựa chọn ban đầu.                                                                                                                                     |
| `src/features/lesson/player/components/ComposeSheet.tsx`                                                            | Prop `initialPicks`.                                                                                                                                       |
| `src/core/navigation/appNavigation.ts`, `src/app/navigation/appNavigationAdapter.ts`, `src/app/navigation/types.ts` | `openLesson(id, {compose: true})` mở bài và bật sheet compose với câu chọn sẵn.                                                                            |
| `src/features/practice/screens/PracticeScreen.tsx`                                                                  | Thẻ C trên màn kết quả: hiện số lượt còn lại (`useComposeAvailable`), ẩn khi offline / hết lượt / bài đã là bài sinh ra / `suggestComposePick` trả `null`. |
| Tests                                                                                                               | `composePick.test.ts` cho `suggestComposePick`; test adapter điều hướng; test thẻ C.                                                                       |

## 6. Server và dữ liệu

- **Không đổi server.** Lượt làm ghi vào `activity_attempts` với `kind = 'practice'` (đã có), `activity` theo regex `^[a-z0-9_]+$` nên nhận được `listen_and_repeat`, `fill_blank`…
- **Cần kiểm tra ở PR 2:** schema sync phía server chấp nhận các giá trị `activity` mới, và `ProgressReportScreen` / `adaptationEngine` đang lọc `activity` nào (có thể đang chỉ đếm 3 dạng quiz cũ).
- Không có migration.

## 7. Rủi ro

- **Đổi nghĩa "hoàn thành bài":** streak và mục tiêu tuần sẽ khó đạt hơn một chút. Bài đã hoàn thành giữ nguyên.
- **Ranh giới module:** nếu không cho `features/practice` import `features/lesson`, phải dời component sang `src/ui`. Đây là phần diff lớn nhất có thể phát sinh.
- **`TranslationActivity`:** cần xác nhận cách chấm (tự đánh giá hay so đáp án) khi không có `patternItemId`.
- **Chất lượng câu hỏi** phụ thuộc phần enrich lúc tạo bài; bài không có từ vựng chỉ còn phần 1 và 4.

## 8. Kiểm tra trước mỗi PR

`yarn typecheck`, `yarn lint` (gồm `lint:boundaries`), `yarn test` cho các file liên quan; chạy thử trên máy với một bài văn bản, một bài YouTube và một bài cũ đã tải offline.

## 9. Ghi chú khi code

- Chỉ áp dụng cho bài `origin = learner` chưa phải bài 6 bước (`hasLessonPracticeRun`). Bài giáo trình cũ không có 6 bước vẫn giữ quiz nhanh và nút ✓.
- Bài YouTube (bố cục video, không có hub) mở chuỗi luyện bằng nút trên header.
- Phần trắc nghiệm nghĩa hỏi theo chiều nghĩa tiếng Việt → chọn từ tiếng Anh (khớp schema `multiple_choice`).
- Phần dịch chỉ lấy câu 2–8 từ để gõ trên điện thoại được.
- `features/practice` dùng component của player 6 bước qua barrel `@features/lesson` (luật module không cho import `@features/lesson/flow`).
- Thẻ C mở lại bài và dùng cơ chế `requestComposeSheet` có sẵn, thêm danh sách câu chọn sẵn; không đổi API điều hướng.
