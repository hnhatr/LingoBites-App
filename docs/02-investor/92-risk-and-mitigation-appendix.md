# Risk & Mitigation

## 1. Product risks

| Risk                                    | Impact                     | Mitigation                                          |
| --------------------------------------- | -------------------------- | --------------------------------------------------- |
| Users only want translation, not lesson | Weak learning retention    | Test save/review rate and qualitative feedback      |
| Lesson output is too long               | Beginners feel overwhelmed | Limit vocabulary/grammar count, beginner-first copy |
| OCR mistakes damage lesson              | Bad trust                  | OCR review/edit before AI                           |
| AI explanations are inconsistent        | Poor reliability           | Canonical schema, validation, retry, sample eval    |

---

## 2. Cost risks

| Risk                     | Impact                    | Mitigation                                              |
| ------------------------ | ------------------------- | ------------------------------------------------------- |
| AI cost grows with usage | Bad margins               | Text limit, quota, BYOK, no AI recall for saved lessons |
| Users spam generate      | Cost spike                | Rate limit, request cap, anomaly alerts                 |
| Retry rate high          | Cost and latency increase | Better prompt/schema, provider eval                     |
| OCR provider cost grows  | Higher image lesson cost  | Free tier, compression, provider benchmarking           |

---

## 3. Privacy and trust risks

| Risk                              | Impact                 | Mitigation                                        |
| --------------------------------- | ---------------------- | ------------------------------------------------- |
| User uploads sensitive text/image | Privacy concern        | Clear privacy note, avoid storing original images |
| API key leakage in BYOK           | Severe trust issue     | Secure storage, no logs, masked display           |
| Provider data handling unclear    | Legal/store risk       | Privacy policy disclosure and provider review     |
| Logging raw content               | Compliance/trust issue | Log metadata only                                 |

---

## 4. Market risks

| Risk                               | Impact             | Mitigation                                                    |
| ---------------------------------- | ------------------ | ------------------------------------------------------------- |
| Existing tools add similar feature | Competition        | Focus on Vietnamese beginner UX and retention loop            |
| Low willingness to pay             | Weak monetization  | Validate paid managed convenience and premium review features |
| BYOK too hard for users            | Free tier friction | Keep BYOK optional; paid user needs no token                  |
| Acquisition channels weak          | Slow growth        | Test Facebook/TikTok/community/teacher channels early         |

---

## 5. Technical risks

| Risk                     | Impact          | Mitigation                                              |
| ------------------------ | --------------- | ------------------------------------------------------- |
| Mobile native complexity | Slow delivery   | React Native CLI, add camera/gallery in M3              |
| Backend key management   | Security burden | Backend proxy, env/secret manager, no mobile system key |
| Saved lesson data drift  | Bad review UX   | Store full validated `ai_output_json`                   |
| Schema changes break UI  | Regression      | Version schema and fixtures                             |
