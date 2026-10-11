# Phản hồi phát âm: so sánh hướng D (OpenAI logprobs) và C (Azure Pronunciation Assessment)

> Trạng thái: **THIẾT KẾ, LÀM SAU**. Chưa code. Cần chốt hướng (§6) và được duyệt dịch vụ, chi phí, dependency trước khi viết plan chi tiết.
> Ngày lập: 2026-10-11. Repo: `LingoBites-App` + `LingoBites-Server`.
> Đi trước: gói A + B + A2 (bật chấm nói cho nhóm chạy thử, bớt gửi câu mẫu làm gợi ý cho STT, hiện "Máy chưa nghe rõ: …"). Tài liệu này chỉ bàn bước tiếp theo: phản hồi phát âm thật.

## 1. Hiện trạng (để hiểu hai hướng gắn vào đâu)

- App ghi âm AAC `.m4a` (`src/features/speaking/logic/recordingService.ts`), câu trả lời bước 5 dài tối đa 45 s (`STEP5_MAX_RECORDING_MS`, `IndependentTaskView.tsx`).
- Server: upload → `evaluation_jobs` → `EvaluationWorker` (`src/modules/evaluation/service/evaluationWorker.ts`) → cổng `SpeechToText` (`src/common/stt/speechToText.ts`), adapter duy nhất là `OpenAISpeechToText` (`gpt-4o-mini-transcribe`, `response_format=json`, `language=en`) → `evaluateUtterance` so từng từ với câu mẫu.
- Cổng `SpeechToText` hiện chỉ trả `{ text }`. Cả hai hướng đều phải mở rộng kết quả này (thêm thông tin theo từng từ).
- `pronunciationSupport` trong `src/core/release/feature-registry.ts` đang `not_implemented`. Đây là cờ để bật tính năng này.
- Nguyên tắc riêng tư đang giữ: không lưu hay ghi log những gì máy nghe được (`speechToText.ts`, `evaluationWorker.ts`). Hướng nào cũng phải giữ nguyên tắc này.

## 2. Hướng D: OpenAI logprobs (độ tự tin theo từng từ)

**Cách làm:** gửi thêm `include[]=logprobs` trong request transcription đang có. API trả mảng `logprobs` theo token (token, bytes, logprob). Server gộp token thành từ, từ nào có xác suất thấp (dưới một ngưỡng) thì đánh dấu "máy nghe chưa chắc".

**Đã kiểm chứng:** tài liệu OpenAI ghi `logprobs` hỗ trợ cho `gpt-4o-transcribe` và `gpt-4o-mini-transcribe`, chỉ với `response_format=json` (đúng định dạng đang dùng).

**Đo được gì:**
- Từ nào máy *không chắc* đã nghe đúng. Đây là chỉ báo gián tiếp của phát âm chưa rõ, không phải điểm phát âm.
- Không có điểm theo âm (phoneme), không có độ trôi chảy, ngữ điệu.
- Máy vẫn "sửa hộ" lỗi phát âm phổ biến: nói sai mà model vẫn tự tin thì không bị đánh dấu.
- Prompt có câu mẫu làm model tự tin hơn với đúng các từ đó, nên B (bớt gợi ý) là điều kiện để D có ý nghĩa.

**Chi phí:** không phát sinh nhà cung cấp mới. Giá transcription giữ như hiện tại (`STT_COST_PER_MINUTE_USD=0.003`). Chưa thấy phí riêng cho `logprobs`; cần xác nhận trên trang giá OpenAI trước khi làm.

**Dependency:** không thêm thư viện. Dùng `fetch` + `FormData` như `openaiSpeechToText.ts`.

**Việc phải làm (ước lượng nhỏ, khoảng 1 PR mỗi repo):**
- Server: `OpenAISpeechToText` gửi `include[]=logprobs`, gộp token thành từ. `SpeechToText` trả thêm `words?: { text; confidence }[]`. Worker tính danh sách từ chưa chắc, ghép với câu mẫu, lưu vào kết quả chấm (chỉ lưu từ của câu mẫu, không lưu bản chữ người học).
- Schema kết quả chấm (`evaluations` server + `core/schemas/evaluation.ts` app): thêm trường, ví dụ `unclear_words: string[]`. Đây là thay đổi API công khai, cần giữ tương thích ngược (trường tùy chọn).
- App: `EvaluationFeedback.tsx` hiện danh sách từ, cho nghe lại câu mẫu bằng TTS.
- Hiệu chỉnh ngưỡng tự tin bằng bộ bản ghi thử (xem §5).

## 3. Hướng C: Azure Speech Pronunciation Assessment

**Cách làm:** gửi audio cùng câu mẫu (`ReferenceText`) tới Azure Speech. Kết quả có điểm cho cả câu và từng từ, kể cả từng âm.

**Đo được gì (theo tài liệu Azure, cần đối chiếu lại khi làm):**
- Điểm cả câu: Accuracy (độ chuẩn phát âm), Fluency (độ trôi chảy), Completeness (đủ từ so với câu mẫu), và Prosody (ngữ điệu, chỉ có ở một số ngôn ngữ như en-US).
- Từng từ: AccuracyScore và ErrorType (Mispronunciation, Omission, Insertion…). Có thể xuống mức âm (phoneme).
- Đây là chấm phát âm thật, đúng nghĩa `pronunciationSupport`.

**Giới hạn kỹ thuật:**
- REST "short audio": chấm phát âm tối đa **30 s** mỗi lần gọi, trong khi app cho ghi tối đa 45 s. Phải hạ giới hạn ghi, cắt audio, hoặc dùng SDK chế độ liên tục.
- Định dạng nhận: WAV PCM 16 kHz mono hoặc OGG Opus. **Không nhận AAC `.m4a`** mà app đang ghi. Phải chọn một trong hai:
  - đổi định dạng ghi trên app (WAV thì file to hơn nhiều; Opus thì cần kiểm tra thư viện ghi âm hiện tại có hỗ trợ không), hoặc
  - chuyển định dạng trên server (cần `ffmpeg` trong image, là dependency hệ thống mới).
- Chế độ có câu mẫu: hợp với bước nhắc lại, luyện mẫu câu. Với bước 5 (người học tự nói, không có câu cố định) phải dùng chế độ không câu mẫu, hoặc lấy câu mẫu gần nhất mà scorer đã chọn (`reference_en`). Cần thử để biết điểm có ổn không.

**Chi phí (nguồn không chính thức, cuối 2025; phải kiểm lại trên trang giá Azure):**
- STT real-time khoảng $1/giờ, cộng chấm phát âm khoảng $0.30/giờ, tổng khoảng **$1.32/giờ ≈ $0.022/phút**. Một câu trả lời trên Microsoft Q&A cũng ra con số tương tự.
- So với OpenAI hiện tại ($0.003/phút) thì đắt hơn khoảng **7 lần**.
- Ví dụ trần: 30 câu/người/ngày × 15 s = 7,5 phút, tức khoảng $0.17/người/ngày với Azure, so với khoảng $0.02 với OpenAI.
- Bậc miễn phí: 5 giờ audio/tháng, đủ cho thử nghiệm nội bộ.
- Có thể **thay** OpenAI bằng Azure cho bài nói (Azure cũng trả bản chữ), thay vì gọi cả hai. Như vậy không cộng dồn chi phí, nhưng phải so lại chất lượng nhận dạng với scorer hiện tại.

**Dependency:**
- Tối thiểu: không thêm thư viện npm nếu gọi REST bằng `fetch`. Thêm nhà cung cấp, khóa `AZURE_SPEECH_KEY` và vùng `AZURE_SPEECH_REGION` (secret, không ghi vào `.env.example` giá trị thật).
- Nếu cần audio dài hơn 30 s hoặc tính năng chỉ có trong SDK: `microsoft-cognitiveservices-speech-sdk` (npm).
- Nếu chuyển định dạng trên server: `ffmpeg` trong image.
- Dữ liệu giọng nói của người học đi tới thêm một nhà cung cấp: cần cập nhật thông báo riêng tư và màn đồng ý chấm bài nói.

**Việc phải làm (ước lượng vừa, khoảng 3–4 PR):**
- Server: adapter `AzurePronunciation` (cổng mới hoặc mở rộng `SpeechToText`), cấu hình env, xử lý định dạng audio, lưu điểm theo từ vào kết quả chấm, trang admin cộng chi phí Azure.
- App: định dạng ghi âm hoặc giới hạn 30 s, màn phản hồi phát âm (tô màu từ sai, điểm câu, nghe lại câu mẫu), bật `pronunciationSupport`.
- Có thể mở rộng sang bước nhắc lại, luyện mẫu câu, đóng vai, shadowing (đang tự chấm). Đây là quyết định sản phẩm riêng.

## 4. Bảng so sánh

| Tiêu chí | D: OpenAI logprobs | C: Azure Pronunciation Assessment |
|---|---|---|
| Đo được | Từ máy *không chắc* nghe đúng | Điểm phát âm từng từ, từng âm; trôi chảy; đủ từ; ngữ điệu (en-US) |
| Có phải chấm phát âm thật | Không, chỉ báo gián tiếp | Có |
| Độ chính xác cho người học | Thấp đến vừa; bỏ sót lỗi phổ biến mà model tự sửa | Cao hơn, thiết kế cho mục đích này |
| Chi phí thêm | Gần như 0 (cần xác nhận) | ~$0.022/phút, ~7× hiện tại; 5 giờ/tháng miễn phí |
| Nhà cung cấp mới | Không | Có (Microsoft Azure) |
| Thư viện / dependency | Không | Không nếu dùng REST; có thể cần SDK npm hoặc `ffmpeg` |
| Định dạng audio | Dùng nguyên `.m4a` | Phải đổi sang WAV/Opus |
| Độ dài audio | Như hiện tại (45 s) | ≤ 30 s mỗi lần (REST) |
| Khối lượng | ~1 PR mỗi repo | ~3–4 PR |
| Rủi ro | Ngưỡng tự tin khó chỉnh, dễ báo sai | Chi phí, riêng tư, đổi pipeline audio |

## 5. Cách đánh giá trước khi chốt

1. Gom bộ bản ghi thử khoảng 50–100 câu từ nhóm chạy thử (có đồng ý), gồm người phát âm tốt và người phát âm còn yếu. Có người nghe gắn nhãn các từ phát âm sai.
2. Chạy cả D và C (dùng bậc miễn phí của Azure) trên cùng bộ.
3. So: tỉ lệ bắt đúng từ sai, tỉ lệ báo nhầm từ đúng, độ trễ, chi phí thật mỗi phút.
4. Chốt: nếu D bắt được phần lớn lỗi với tỉ lệ báo nhầm chấp nhận được thì làm D trước, C để sau. Nếu không thì đi C.

## 6. Câu hỏi cần chốt

1. Mục tiêu sản phẩm: chỉ cần "từ máy nghe không rõ" (D đủ), hay cần điểm phát âm thật (C)?
2. Có chấp nhận thêm nhà cung cấp Azure và gửi giọng người học tới đó không?
3. Ngân sách tối đa cho chấm nói mỗi người mỗi ngày?
4. Đổi định dạng ghi âm trên app, hay thêm `ffmpeg` trên server?
5. Có mở chấm phát âm sang bước nhắc lại, luyện mẫu câu, đóng vai, shadowing không?

## 7. Nguồn

- OpenAI, Audio transcriptions API (`include` logprobs): https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/index.html
- OpenAI Python SDK ví dụ `include=["logprobs"]`: https://www.mintlify.com/openai/openai-python/api/audio/transcriptions
- Microsoft Q&A, giá Pronunciation Assessment: https://learn.microsoft.com/en-us/answers/questions/5608069/pricing-and-usage-of-pronunciation-assessment-feat
- Bài tổng hợp giá Azure STT (không chính thức): https://brasstranscripts.com/blog/azure-speech-services-pricing-2025-microsoft-ecosystem-costs
- Bản sao skill REST Azure STT (định dạng, giới hạn 30 s; không chính thức): https://mcpservers.org/agent-skills/microsoft/skills/azure-speech-to-text-rest-py
