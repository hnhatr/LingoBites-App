# Phân tích Stage 3: âm thanh và chấm bài

> Ngày lập: 2026-10-08. Trạng thái: **PHÂN TÍCH — chờ chốt quyết định** (chưa phải plan code).
> Phạm vi: phần **thu âm → nhận dạng → chấm → phản hồi** của Stage 3 trong `2026-10-07-backward-design-curriculum-plan.md` (bước 4 của lộ trình `2026-10-07-learning-cycle-requirements-roadmap.md`).
> Kết luận ở cuối file là đầu vào để viết plan chi tiết cho PR 12a / spike / 12b.

---

## 1. Hiện trạng (đã khảo sát code ngày 2026-10-08)

| Phần | Đang có | Chưa có |
|---|---|---|
| **Ghi âm trên app** | `react-native-audio-recorder-player` ghi file `.m4a` (AAC, cấu hình mặc định, chưa đặt sample rate hay bitrate). Quyền micro iOS / Android đã khai báo. | Thư viện nhận dạng giọng nói trên máy (`@react-native-voice/voice`…); khai báo `NSSpeechRecognitionUsageDescription`. |
| **Bản ghi trong player 6 bước** | Ghi tạm để tự nghe lại; xoá khi rời câu. | **Không upload**, không lưu vào `speaking_recordings`. |
| **Upload bản ghi** (của shadowing) | Hàng đợi upload trong SQLite: retry có backoff, có cổng consent. API `POST /v1/recordings` rồi `PUT …/content` (server kiểm SHA-256, tối đa 35 giây, 25 MB). Lưu ở GCS hoặc thư mục local. Xoá lẻ, xoá hàng loạt, dọn file rác mỗi giờ. | Liên kết bản ghi với **lượt làm** (hiện chỉ gắn `lesson_id`, `sentence_id`). Bản ghi đã hoàn tất không có thời hạn lưu. |
| **Consent** | Câu hỏi "Lưu bản ghi lên tài khoản?". Lưu theo từng máy, chỉ kiểm ở app. | Consent cho **xử lý bằng AI / bên thứ ba**; consent của **phụ huynh**. |
| **AI provider** | `openai`, `gemini`, `mock`. Chỉ nhận **text** và trả JSON. Có hàng đợi job trên Postgres (lease, retry 2 lần), rate limit theo cửa sổ thời gian. | Giao diện nhận **âm thanh** / STT. Đo chi phí, ngân sách theo user / ngày. |
| **Dữ liệu để chấm** | `acceptedAnswers` / `normalizeAnswer` (khung câu × biến thể × giá trị chỗ trống). `item_errors` có `wrong_example`, `severity blocking/tolerated`. Task có 4 tiêu chí + `threshold`. Từ điển IPA (CMUdict). Mỗi câu của bài có IPA. | So khớp theo từng từ (diff / Levenshtein). Code dùng `threshold`. |
| **Lượt làm** | `activity_attempts` loại `lesson`: `outcome`, `support_level`, `assessed_by: rule \| self`. Server tính `practice_completed_at`. | `assessed_by: service`. Bảng kết quả chấm. `passed_at`. Lượt làm chưa có id của **câu / lượt** cụ thể trong block. |

Nhận xét chính:
- Vòng thu âm → upload → lưu trữ đã có và chạy ổn (từ shadowing), **tái dùng được**.
- Thiếu hẳn khâu **nhận dạng** và **chấm**.
- Thiếu **consent cho AI** và **consent của phụ huynh**.

---

## 2. ⚠️ Mâu thuẫn cần chốt trước

Spec MVP cũ (`docs/superpowers/specs/2026-09-06-english-fullstack-learning-app-final-spec.md`), đang ở trạng thái **Approved**, ghi:
- **DEC-4:** STT của hệ điều hành chỉ là **hỗ trợ tuỳ chọn**, **không dùng để quyết định đạt / chưa đạt**.
- **REQ-22:** không tuyên bố **chấm giọng chính xác**. Phản hồi nói tập trung vào hoàn thành nhiệm vụ, dùng đúng cụm từ, thời gian phản hồi, tự kiểm, gợi ý STT.
- **Non-goal:** chấm phát âm ở mức âm vị (phoneme).
- **RISK-3:** chấm nói "nói quá" độ chính xác → mất lòng tin, rủi ro pháp lý.

Plan Stage 3 lại muốn máy chấm 4 tiêu chí, trong đó có **clarity = điểm phát âm**, và dùng kết quả để quyết định **đạt bài** (`passed_at`).

Cần chọn một trong ba hướng:

| Hướng | Ý nghĩa | Đánh giá |
|---|---|---|
| **A. Giữ DEC-4** | Máy chỉ đưa **gợi ý** (transcript, từ còn thiếu). Đạt / chưa đạt vẫn do người học tự chấm, kèm checklist tiêu chí. | An toàn, rẻ. Nhưng "đạt bài" vẫn dựa trên tự đánh giá. |
| **B. Máy chấm nội dung, không chấm giọng** (đề xuất) | Máy chấm **content** và **purpose** dựa trên transcript (nói đúng mẫu câu, đủ ý, đúng mục đích); **independence** lấy từ `support_level`. **Clarity** chỉ là "máy nghe ra được câu" (STT nhận được đủ từ khoá), **không** chấm âm vị. Thay DEC-4 bằng một quyết định mới. | Cân bằng: đủ tin cậy để quyết định đạt bài, không hứa hẹn chấm giọng, chi phí vừa phải. |
| **C. Chấm phát âm đầy đủ** | Thêm **pronunciation assessment** (điểm theo từ / âm vị, độ trôi chảy), ví dụ dịch vụ có tính năng này như Azure Speech. | Phản hồi chi tiết nhất. Nhưng đắt hơn, phụ thuộc một nhà cung cấp, độ chính xác với giọng Việt và trẻ em chưa rõ. Rủi ro đúng như RISK-3. |

**Đề xuất:** làm **B** trước. C để sau, như một tính năng "luyện phát âm" riêng (mục 8.1 của backlog), **không** dùng làm điều kiện đạt bài. Hướng nào cũng phải **cập nhật spec** (DEC-4, REQ-22) để hai tài liệu không còn mâu thuẫn.

---

## 3. Chấm cái gì, ở đâu, khi nào

### 3.1 Theo loại hoạt động

| Loại | Hiện nay | Stage 3 (hướng B) |
|---|---|---|
| Chọn, điền, dịch (gõ) | App chấm theo luật | **Giữ trên app** (offline, tức thì). Server **chấm lại** bằng đúng luật đó khi nhận lượt làm (PR 12a), để kết quả đáng tin. |
| Nghe nhắc lại, luyện mẫu câu (bước 2–4) | Tự chấm | **STT trên máy (tuỳ chọn)** làm gợi ý: hiện transcript và từ còn thiếu; người học vẫn tự chấm. **Không** gửi lên server, không tốn tiền. |
| Nhập vai luyện tập (bước 4) | Tự chấm | Như trên. |
| **Vận dụng độc lập (bước 5)** và **nhiệm vụ tổng hợp của unit** | Tự chấm theo tiêu chí | **Server chấm** (STT trên cloud + bộ chấm). Đây là các lượt quyết định "đạt bài" / "đạt unit". |
| Ôn mẫu câu (PR 15) | — | Mặc định STT trên máy; chỉ gửi server khi đó là lượt kiểm tra ghi nhớ quan trọng (tuỳ cấu hình). |

Lý do chỉ chấm trên server ở bước 5 và nhiệm vụ tổng hợp:
- **Chi phí:** khoảng 1–3 lượt mỗi bài, thay vì 20–30 lượt.
- **Quyền riêng tư:** ít bản ghi phải rời khỏi máy.
- **Offline:** phần luyện vẫn chạy được khi không có mạng.

### 3.2 Bộ chấm cho một lượt nói (hướng B)

**Đầu vào:**
- transcript (kèm confidence từng từ nếu nhà cung cấp trả về);
- task: tiêu chí, ngưỡng, `item_codes`;
- câu chấp nhận (`acceptedAnswers` của mẫu câu, câu mẫu của lượt);
- lỗi thường gặp của item;
- `support_level`.

**Chấm từng tiêu chí:**

| Tiêu chí | Cách chấm | Kết quả |
|---|---|---|
| **content** | Chuẩn hoá transcript (`normalizeAnswer`) rồi so với tập câu chấp nhận: khớp đúng, hoặc khớp gần (tỷ lệ từ trùng ≥ ngưỡng, các giá trị chỗ trống hợp lệ). | đạt / chưa |
| **purpose** | Luật trước: có đủ item bắt buộc và đúng loại câu (ví dụ câu hỏi gọi món). Chỉ gọi AI text khi luật không đủ, bằng prompt ngắn và trả JSON theo schema. | đạt / chưa |
| **clarity** | Tỷ lệ từ khoá của câu mẫu mà STT nhận ra, kèm confidence trung bình. Không chấm âm vị. | đạt / chưa |
| **independence** | `support_level = none` → đạt. | đạt / chưa |

**Lỗi thường gặp:** so khớp gần transcript với `wrong_example` của từng lỗi. Lỗi `blocking` làm trượt; lỗi `tolerated` chỉ hiện nhắc nhở.

**Gộp kết quả:**
- Đủ các tiêu chí **bắt buộc** → `pass_independent`, hoặc `pass_with_support` nếu đã dùng gợi ý.
- Thiếu tiêu chí → `fail`, kèm **lỗi chính** để hiện cho người học.
- Không chấm được → `unscorable`.

**Các trường hợp `unscorable`** (không tính là sai):
- im lặng hoặc quá ngắn (dưới khoảng 0,5 giây có tiếng);
- STT không trả chữ hoặc confidence quá thấp;
- nhà cung cấp lỗi hoặc quá thời gian chờ;
- định dạng file hỏng.

---

## 4. Luồng kỹ thuật đề xuất

```
App (bước 5)                    Server                                 Nhà cung cấp STT
───────────                     ──────                                 ────────────────
ghi âm .m4a ──► hàng đợi upload ──► POST /v1/recordings (mode=lesson_task, attempt_id)
                                    PUT  …/content  (SHA-256, ≤35s)
ghi lượt làm (outcome=pending) ─► sync push ─► tạo job "evaluation" (bảng job sẵn có)
                                               worker ──► STT ──────────► transcript
                                               bộ chấm (luật + AI text khi cần)
                                               ghi `evaluations`, cập nhật outcome,
                                               passed_at / unit_outcomes / item_memory
app kéo kết quả (pull `evaluations` hoặc gọi GET khi đang mở màn) ◄──
hiện phản hồi 4 trạng thái
```

**Chi tiết:**
- **Tái dùng hạ tầng sẵn có:**
  - API recordings và hàng đợi upload (thêm `mode = lesson_task` và trường `attempt_id`);
  - hàng đợi job trên Postgres (thêm loại job `evaluation`);
  - pattern provider (thêm giao diện `SpeechToTextProvider`, độc lập với `AIProvider` text).
- **Khi đang online:** app mở một màn chờ ngắn ("Đang chấm…", mục tiêu dưới 5–8 giây).
- **Khi offline hoặc quá lâu:** lượt làm hiện "Đang chờ chấm"; người học vẫn đi tiếp được. Kết quả đến sau, qua sync. Hết thời gian chờ (ví dụ 24 giờ) thì thành `unscorable`.
- **Server là nơi quyết định kết quả cuối** cho lượt nói ở bước 5. Lượt làm thêm `assessed_by: service`; `outcome` có thể là `pending` lúc đầu (thay đổi contract nhỏ, cần cập nhật schema cả hai phía).
- **Câu viết ở bước 5** (task `write`) đi cùng luồng, chỉ bỏ bước STT. Câu viết cần được **gửi lên** để chấm; hiện chữ người học viết không rời máy, nên đây là thay đổi chính sách cần ghi rõ.

**Dữ liệu mới (server):**
- `evaluations(id, user_id, attempt_id, recording_id?, task_id, criteria_json, errors_json, outcome, assessed_by, provider, model, latency_ms, cost_units, transcript?, created_at)`.
- Có lưu `transcript` hay không: xem mục 5.
- Collection sync `evaluations`, chỉ pull (server → app).

---

## 5. Quyền riêng tư và dữ liệu trẻ em (bắt buộc trước khi gửi giọng nói ra ngoài)

| Việc | Đề xuất |
|---|---|
| Consent | Thêm consent mới **"Cho phép chấm bài nói bằng máy"**: ghi rõ giọng nói được gửi tới server và nhà cung cấp nhận dạng giọng nói, giữ trong N ngày rồi xoá. Tách khỏi consent "lưu bản ghi lên tài khoản" hiện có. Không đồng ý thì bước 5 quay về tự đánh giá. |
| Trẻ em | Tài khoản trẻ (sau khi có hồ sơ người học, bước 1 của lộ trình) cần **consent của phụ huynh** trước khi bật chấm máy. Kiểm tra lại cấu hình "Made for Kids" trên store. |
| Thời hạn lưu | Bản ghi dùng để chấm: xoá sau **30 ngày** (đề xuất), hoặc ngay sau khi chấm nếu không cần cho admin xem lại. Thêm job dọn theo thời hạn (hiện chưa có). |
| Transcript | Mặc định **không lưu nguyên văn**, chỉ lưu kết quả từng tiêu chí và mã lỗi. Nếu cần để admin kiểm tra chất lượng chấm (PR 16), lưu có thời hạn và chỉ admin xem. |
| Log | Không log nội dung âm thanh hay transcript (theo quy tắc hiện có `LOG_SENSITIVE_CONTENT=false`). |
| Nhà cung cấp | Chọn nhà cung cấp cam kết **không dùng dữ liệu để huấn luyện** và cho chọn vùng lưu trữ. Ghi vào chính sách quyền riêng tư (`02-privacy-policy-draft.md`). |

---

## 6. Chi phí và kiểm soát

- Chấm server chỉ ở bước 5 và nhiệm vụ tổng hợp: khoảng **1–3 lượt × ≤35 giây** mỗi bài.
- **Giới hạn theo user / ngày** (ví dụ 30 lượt chấm), rate limit sẵn có, và trần ngân sách theo tháng (bảng đếm `cost_units`).
- **Không gửi lại** cùng một file đã chấm (khoá theo SHA-256 của bản ghi).
- Giá cụ thể của từng nhà cung cấp: **đo trong spike**, không ước từ trí nhớ.

---

## 7. Spike nhà cung cấp STT (làm trước PR 12b)

**Mục tiêu:** chọn nhà cung cấp và xác định ngưỡng chấm, bằng số liệu thật.

| Bước | Nội dung |
|---|---|
| Bộ dữ liệu | 60–100 bản ghi theo câu của unit "Gọi đồ uống": người lớn và trẻ em giọng Việt, cả câu đúng, câu sai (thiếu "a", "I want…", sai đồ uống), câu ấp úng, môi trường ồn. Ghi bằng chính app (`.m4a`). Người ghi phải đồng ý cho dùng giọng. |
| Nhà cung cấp | 2–3 lựa chọn. Ví dụ:<br>- STT trên máy (iOS / Android) qua thư viện React Native;<br>- một dịch vụ cloud phổ biến cho tiếng Anh;<br>- một dịch vụ có thêm chấm phát âm (để so sánh nếu sau này chọn hướng C). |
| Đo | - Tỷ lệ lỗi từ (WER).<br>- **Độ khớp với người chấm** (máy đạt/chưa so với người chấm đạt/chưa: tỷ lệ đúng, tỷ lệ chấm oan).<br>- Độ trễ.<br>- Chi phí mỗi lượt.<br>- Tỷ lệ `unscorable`. |
| Tiêu chí chọn | Chấm oan (máy nói "chưa đạt" khi người chấm nói "đạt") **dưới 10%**; độ trễ **dưới 5 giây**; chi phí trong ngân sách Q4. |
| Đầu ra | Báo cáo ngắn, ngưỡng mặc định cho `content` / `clarity`, quyết định nhà cung cấp. |

Cần: API key thật của nhà cung cấp cần thử, ngân sách nhỏ cho spike, người ghi âm mẫu (có consent).

---

## 8. Chia PR (thay cho dòng PR 12 trong backlog)

| PR | Nội dung | Phụ thuộc |
|---|---|---|
| **12a** | Server: bảng `evaluations`, chấm lại theo luật các lượt chọn / điền / dịch, `assessed_by: service`, collection pull `evaluations`, app nhận và hiện kết quả. **Chưa có âm thanh.** | Chốt ngưỡng (Q1) |
| **Spike** | Mục 7. | Q4, API key, consent người ghi mẫu |
| **12b** | Server:<br>- `SpeechToTextProvider`;<br>- job `evaluation`;<br>- recordings thêm `mode = lesson_task` và `attempt_id`;<br>- bộ chấm transcript (content, purpose, clarity, lỗi);<br>- thời hạn lưu bản ghi. | Spike, hướng ở mục 2, consent mục 5 |
| **12c** | App:<br>- upload bản ghi bước 5 qua hàng đợi sẵn có;<br>- consent mới;<br>- màn "Đang chấm…";<br>- lượt `pending`. | 12b |
| **12d** (tuỳ chọn) | App: STT trên máy làm **gợi ý** ở bước 2–4 (transcript, từ còn thiếu), không quyết định kết quả. | Dependency mới (thư viện STT), cần duyệt |
| 13–16 | Như backlog: `passed_at`, `item_memory`, phản hồi 4 trạng thái, ôn, admin. | 12a–12c |

---

## 9. Quyết định cần anh/chị chốt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D1 | Hướng chấm nói: A (chỉ gợi ý), B (máy chấm nội dung, không chấm giọng), hay C (chấm phát âm)? | **B**; C để sau làm tính năng luyện phát âm riêng. Cập nhật DEC-4 / REQ-22. |
| D2 | Chấm server ở những lượt nào? | Bước 5 + nhiệm vụ tổng hợp của unit. Bước 2–4 vẫn tự chấm, có thể kèm STT trên máy làm gợi ý. |
| D3 | Có lưu transcript không, lưu bao lâu? | Không lưu nguyên văn. Nếu cần cho admin thì tối đa 30 ngày. |
| D4 | Thời hạn lưu bản ghi dùng để chấm? | 30 ngày, rồi xoá tự động. |
| D5 | Câu viết ở bước 5 có được gửi lên server để chấm không? | Có, cùng consent "chấm bằng máy". |
| D6 | Danh sách nhà cung cấp đưa vào spike, ngân sách spike và ngân sách mỗi lượt (Q4). | Team chọn; tôi chuẩn bị khung đo. |
| D7 | Ngưỡng mặc định của từng tiêu chí (Q1), và lỗi nào mặc định `blocking`. | Lấy từ kết quả spike; lỗi mặc định `tolerated`, chỉ lỗi làm sai ý mới `blocking`. |
| D8 | Người dùng trẻ em: bật chấm máy khi nào? | Chỉ khi có consent phụ huynh (cần hồ sơ người học trước). Trước đó, tài khoản trẻ dùng tự đánh giá. |

**Có thể bắt đầu ngay mà không cần chốt D1–D8:** PR 12a (chấm lại theo luật, bảng `evaluations`). Nó không đụng âm thanh và là nền cho 12b.
