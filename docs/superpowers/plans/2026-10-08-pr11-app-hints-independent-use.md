# PR 11 – App: gợi ý mở dần và màn vận dụng độc lập (bước 5)

> Trạng thái: **ĐÃ CODE**: G1–G8 đã duyệt; app `c6533aa` → `684fb8d` (xem §11 cho các điểm lệch).
> Ngày lập: 2026-10-08. Repo: `LingoBites-App` (không đổi server). Nhánh: `claude/optimistic-bell-mfgk44`.
> PR cuối của Stage 2 trong `2026-10-07-backward-design-curriculum-plan.md`, mục App 3 và 4. Dựng trên player của PR 10 và contract của PR 8 (`support_level`, `hint_levels` của task).

## 1. Mục tiêu và phạm vi

Sau PR này, người học:
- bấm **"Gợi ý"** ở các hoạt động luyện (bước 2–4) để mở dần từng mức gợi ý: nghe lại → từ khoá → câu mẫu. Dùng gợi ý thì lượt làm ghi `support_level` tương ứng và không còn là "tự làm được";
- ở **bước 5** gặp **màn vận dụng độc lập**:
  - thấy tình huống của task (ai nói với ai, ở đâu, để làm gì);
  - không có câu mẫu, không có gợi ý;
  - nói (ghi âm, nghe lại) hoặc viết;
  - tự đánh giá theo **tiêu chí** của task (mục đích, nội dung, rõ ràng, tự làm).
- xem lại câu mẫu **sau khi** đã tự đánh giá, để học. Việc xem không đổi kết quả.

Stage 2 xong sau PR này: học trọn unit mẫu theo 6 bước; mọi lượt làm có `support_level` và được sync.

| Trong PR 11 | Ngoài PR 11 |
|---|---|
| Gợi ý mở dần theo `hint_levels` của task, hoặc 3 mức cố định | Chấm nói tự động, STT (Stage 3) |
| `support_level` thật (`none` / `hint_1` / `hint_2` / `model`) trong lượt làm | Đổi luật "hoàn thành phần luyện" |
| Màn vận dụng độc lập cho block bước 5 chạy task `independent` | "Đạt bài" `passed_at`, phản hồi 4 trạng thái (PR 13–14) |
| Tự đánh giá theo tiêu chí của task | Lưu bản ghi hoặc câu viết của người học |
| Bước 6 tách riêng kết quả vận dụng | Thay đổi server, admin |

## 2. Quyết định cần bạn xác nhận

| # | Câu hỏi | Đề xuất |
|---|---|---|
| G1 | **Gợi ý lấy từ đâu?** | Block có `task_id` và task có `hint_levels`: dùng đúng các mức đó, theo thứ tự `level` 1 → 3. Mức `replay` vừa hiện chữ vừa đọc câu mẫu bằng TTS. Không có task, hoặc task không có mức nào: dùng **3 mức cố định**, giống preview của admin (PR 9):<br>- **mức 1**: từ đầu tiên của câu mẫu kèm "…", đồng thời đọc câu mẫu bằng TTS;<br>- **mức 2**: khung mẫu câu (nếu có pattern), nếu không thì nửa đầu câu mẫu;<br>- **mức 3**: câu mẫu đầy đủ. |
| G2 | **`support_level` của một lượt** (một block) | Lấy **mức cao nhất đã mở** trong cả block: mức 1 → `hint_1`, mức 2 → `hint_2`, mức 3 hoặc bất kỳ mức nào có `type = model` → `model`. Một câu đã dùng gợi ý mà làm đúng thì tính "đúng có hỗ trợ". Block có gợi ý thì `outcome` cao nhất là `pass_with_support` (ràng buộc của PR 8). |
| G3 | **Hoạt động nào có gợi ý?** | - **Có:** dịch, điền gõ tay, luyện mẫu câu, lượt người học trong nhập vai.<br>- **Không:** nghe nhắc lại, vì câu mẫu chính là nội dung cần nhắc lại. Nút "Nghe câu mẫu" giữ nguyên và không tính là hỗ trợ.<br>- **Câu chọn** (trắc nghiệm, điền có lựa chọn): chỉ một mức gợi ý là **"Loại bớt một phương án sai"**, tính là `hint_1`.<br>- **Đổi so với PR 10:** ở luyện mẫu câu và nhập vai, nút "Nghe câu mẫu" / "Xem câu mẫu" của PR 10 **gộp vào thang gợi ý** (mức 1 có nghe, mức 3 là câu mẫu). "Xem đáp án" ở câu gõ vẫn là bỏ qua, tính chưa đạt. |
| G4 | **Khi nào hiện màn vận dụng độc lập?** | Block `activity` ở **bước 5** chạy task có `kind = independent`. Block bước 5 không chạy task `independent` thì vẫn chạy như hoạt động luyện (spec-check của server đã cảnh báo trường hợp này). |
| G5 | **Màn vận dụng hiện gì, làm gì?** | - **Thẻ tình huống:** `task.situation`, nếu không có thì lấy `spec.situation`; kèm `task.prompt_vi`.<br>- **Không** câu mẫu, **không** gợi ý.<br>- Theo `task.response_mode`:<br>  - `speak`: nếu block là `role_play` thì đi qua hội thoại, lượt bên kia hiện chữ và nghe được, lượt người học chỉ ghi âm / nghe lại, không có chữ; loại khác thì một lần ghi âm cho cả tình huống.<br>  - `write`: ô viết tự do. Chữ chỉ nằm trong màn, không lưu, không gửi.<br>  - `choose`: chạy activity như thường nhưng không có gợi ý.<br>- Cuối màn là **checklist tiêu chí** của task. Tick đủ các tiêu chí `required` → `pass_independent`, thiếu → `fail`. `assessed_by = self`, `support_level = none`.<br>- Tự đánh giá xong mới mở **"Xem câu tham khảo"** (các câu mẫu của lượt người học / `modelEn`). Xem không làm đổi kết quả đã ghi. |
| G6 | **Nhãn tiêu chí** | 4 tiêu chí của server có nhãn tiếng Việt cố định trong i18n, mỗi tiêu chí là một câu hỏi tự kiểm, ví dụ:<br>- `purpose`: "Mình nói đúng mục đích (gọi được món)";<br>- `content`: "Mình dùng đúng mẫu câu / từ của bài";<br>- `clarity`: "Người nghe hiểu được";<br>- `independence`: "Mình không nhìn câu mẫu".<br>Tiêu chí `required` có dấu *. Tiêu chí không bắt buộc vẫn hiện nhưng không ảnh hưởng kết quả. |
| G7 | **Bước 6** | Tách hai phần:<br>- **"Luyện tập"**: kết quả các hoạt động bước 2–4, có thêm nhãn mức hỗ trợ (ví dụ "Đạt, có gợi ý").<br>- **"Vận dụng"**: kết quả bước 5 (Đạt / Chưa đạt / Chưa làm).<br>Vẫn **không** có "đạt bài" (Stage 3). |
| G8 | **Đọc `hint_levels` an toàn** | Snapshot của app vẫn để `hint_levels` là record lỏng. Thêm `parseHintLevels()` theo đúng schema server (`level` 1–3 liên tiếp, `type ∈ replay/keyword/model`, `content_vi`). Sai shape thì coi như task không có gợi ý và dùng 3 mức cố định, không crash. |

## 3. Logic (commit 1)

- `features/lesson/flow/logic/hints.ts`:
  - `parseHintLevels(task)` (G8);
  - `hintLadder({task, model, frame})` (G1), trả về `HintStep[]` gồm `{level, type, text, speak?}`;
  - `supportLevelOf(usedLevels)` (G2).
- `activityOutcome.ts`:
  - `EntryResult` thêm `'with_support'`;
  - `blockOutcome(results, support)`: có hỗ trợ thì không bao giờ là `pass_independent`;
  - test bảng đủ các tổ hợp.
- `useLessonFlow.finishActivity` nhận thêm `supportLevel` (bỏ giá trị cứng `none`).
- `independent.ts`:
  - `isIndependentBlock(block, task)` (G4);
  - `criteriaOutcome(criteria, ticked)` (G5);
  - `situationOf(task, spec)`.

## 4. Gợi ý trong hoạt động (commit 2)

- `components/HintLadder.tsx`: nút "Gợi ý (n/3)", hiện dần từng mức đã mở; mức có `speak` thì đọc bằng TTS. Báo mức cao nhất đã mở lên component cha.
- `EntrySequence` gom thêm mức hỗ trợ của từng câu, rồi `ActivityRunner` tính `supportLevel` cho cả block.
- `TypedEntry`: có thang gợi ý. Đúng sau khi đã mở gợi ý → `with_support`.
- `ChoiceEntry`: gợi ý một mức "Loại bớt một phương án sai" (G3).
- `SpeakSelfCheck` (luyện mẫu câu, nhập vai): thay "Nghe / Xem câu mẫu" bằng `HintLadder`. Bản dùng cho nghe nhắc lại giữ như PR 10.
- Test: mở 1 / 2 / 3 mức → `support_level` đúng, `outcome` đúng; payload hợp lệ với schema PR 8.

## 5. Màn vận dụng độc lập (commit 3)

- `components/IndependentTaskView.tsx`:
  - thẻ tình huống;
  - phần trả lời theo `response_mode` (G5);
  - `CriteriaChecklist`;
  - nút "Xem câu tham khảo" sau khi đã chấm.
- `StepView`: block bước 5 thoả G4 thì dùng `IndependentTaskView` thay `ActivityRunner`.
- `RolePlayActivity` có thêm chế độ `independent`: không có chữ câu mẫu, không có gợi ý.
- Test:
  - seed L01: bước 5 có tình huống "gọi nước cam cỡ lớn", không có nút gợi ý, không có câu mẫu;
  - tick đủ 4 tiêu chí → `pass_independent`, thiếu → `fail`;
  - xem câu tham khảo không ghi thêm lượt làm.

## 6. Bước 6, i18n, tài liệu (commit 4)

- `StepResult` tách "Luyện tập" / "Vận dụng" và hiện nhãn mức hỗ trợ (G7).
- i18n `lessonFlow.*`: gợi ý, tình huống, 4 tiêu chí, kết quả.
- Cập nhật plan (trạng thái, điểm lệch); session report; đánh dấu Stage 2 xong trong master plan.

## 7. Kiểm thử

| Test | Nội dung |
|---|---|
| `hints.test.ts` | Mức của task, mức cố định, `hint_levels` sai shape, `supportLevelOf`. |
| `activityOutcome.test.ts` | Bảng `outcome` × `support_level`; không bao giờ ra `pass_independent` khi có hỗ trợ. |
| `independent.test.ts` | `isIndependentBlock`, `criteriaOutcome`, lấy tình huống. |
| `ruleActivities` / `speakingActivities` (mở rộng) | Gợi ý trong từng loại; lượt làm mang `support_level`. |
| `IndependentTaskView.test.tsx` | Nói, viết, chọn; tiêu chí; xem câu tham khảo. |
| `LessonFlowPlayerScreen.real-sqlite.test.tsx` (mở rộng) | Đi trọn L01 có dùng gợi ý ở bước 4 và vận dụng ở bước 5; outbox có đúng `support_level`; bước 6 tách hai phần; phần luyện vẫn hoàn thành theo luật cũ. |

**Kiểm tra cuối:** `yarn -s tsc`, `yarn -s lint` (giữ 178/281), `yarn -s format:check`, Jest toàn bộ.

## 8. Thứ tự commit

1. `feat(lesson): hint ladder, support levels and independent-task rules`: §3.
2. `feat(lesson): progressive hints in practice activities`: §4.
3. `feat(lesson): independent use screen for step 5`: §5.
4. `feat(lesson): result step splits practice and independent use` + `docs: mark PR 11 plan as implemented`: §6.

## 9. File tóm tắt

**Thêm:**
- `features/lesson/flow/logic/hints.ts`, `independent.ts`;
- `components/HintLadder.tsx`, `IndependentTaskView.tsx`, `CriteriaChecklist.tsx`;
- test tương ứng.

**Sửa:**
- `activityOutcome.ts`, `useLessonFlow.ts`;
- `ActivityRunner`, `EntrySequence`, `TypedEntry`, `ChoiceEntry`, `SpeakSelfCheck`;
- `RolePlayActivity`, `SpeakingDrillActivity`, `StepView`, `StepResult`;
- i18n `vi.json` / `en.json`;
- `test/support/lessonFlow.tsx`.

**Xoá:** không. Hai nút "Xem câu mẫu" / "Nghe câu mẫu" của luyện mẫu câu và nhập vai được gộp vào thang gợi ý (G3); không xoá file nào.

**Dependency mới:** không.

## 10. Rủi ro

- ⚠️ **Đổi hành vi so với PR 10:** ở luyện mẫu câu và nhập vai, xem hoặc nghe câu mẫu giờ **tính là hỗ trợ**. Lượt làm cũ (`support_level = none`) không bị ảnh hưởng.
- **Tự đánh giá theo tiêu chí** dễ dãi hơn chấm máy. Chấp nhận trong Stage 2; Stage 3 thay bằng chấm tự động, giữ nguyên tiêu chí.
- **Câu viết ở màn vận dụng không được lưu.** Thoát giữa chừng là mất, và không ghi lượt làm (giống G3 của PR 10).
- **Ba nơi có luật gợi ý** (admin preview, app, sau này là server chấm): mức cố định giống preview admin, có test cùng ví dụ.

## 11. Kết quả và điểm lệch so với plan

**Commit (app, nhánh `claude/optimistic-bell-mfgk44`):**

| Commit | Nội dung |
|---|---|
| `c6533aa` | §3: thang gợi ý, mức hỗ trợ, luật vận dụng độc lập. |
| `eb36581` | §4: gợi ý trong các hoạt động luyện. |
| `75c3a77` | §5: màn vận dụng độc lập ở bước 5. |
| `684fb8d` | §6: bước 6 tách "Luyện tập" / "Vận dụng". |

**Kiểm tra cuối:**
- `yarn -s tsc` sạch;
- `yarn -s lint`: 0 lỗi, giữ 178/281 warning, module boundary sạch;
- `yarn -s format:check` sạch;
- Jest toàn bộ: 2198 pass, 3 skipped.

**Chưa kiểm được:** ghi âm, phát lại và TTS (kể cả TTS đọc ở gợi ý mức 1) trên máy thật; Jest dùng bản giả lập.

**Điểm lệch:**
1. **Không thêm `EntryResult = 'with_support'`.** Mỗi câu báo `{result, support}`; hàm `blockAttempt` thay `blockOutcome` và tính cả `outcome` lẫn `support_level` của block. Kết quả đúng như G2.
2. **Thang gợi ý của câu điền gõ tay** lấy đáp án của chỗ trống (không phải cả câu) làm câu mẫu.
3. **Task `response_mode = choose` ở bước 5** vẫn chạy như hoạt động luyện (còn gợi ý "loại bớt phương án"). Seed không có trường hợp này; sẽ làm riêng nếu cần.
4. **Nói ở màn vận dụng:**
   - một lần ghi âm cho cả tình huống;
   - với nhập vai: lượt bên kia hiện chữ và có nút nghe, lượt người học chỉ hiện "Lượt của bạn", không có chữ.
5. **Tách `RecorderControls`** dùng chung cho tự đánh giá phần nói và màn vận dụng.
6. **Checklist tiêu chí** dùng icon có sẵn `check_circle` / `circle` (không thêm icon mới vào registry).
7. **Khoá i18n `lessonFlow.show_model` / `show_model_hint`** của PR 10 không còn dùng. Vẫn giữ lại, chưa xoá khi chưa được duyệt.
