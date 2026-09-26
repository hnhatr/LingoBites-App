# Business Model & Unit Economics

## 1. Business model hypothesis

LingoBites can start with a hybrid model:

```text
Free/BYOK for cost control
Paid managed AI for convenience
Future premium learning features for retention
```

This matches the product reality: AI/OCR creates direct usage cost, so pricing must control cost per generated lesson.

---

## 2. Pricing tiers

| Tier           | Target user                 | AI setup                    | Revenue logic               |
| -------------- | --------------------------- | --------------------------- | --------------------------- |
| Free demo      | Curious user                | Mock/sample or small quota  | Acquisition                 |
| Free BYOK      | Power user / technical user | User provides own API key   | Near-zero AI cost to system |
| Paid managed   | Main paid segment           | System AI key               | User pays for convenience   |
| Future premium | Retained learners           | System AI + review features | Subscription / bundles      |

Recommended early positioning:

```text
Free users can bring their own AI key. Paid users do not need to configure anything.
```

---

## 3. Cost per lesson

| Lesson type      | Estimated variable cost |
| ---------------- | ----------------------: |
| Paste text only  |        ~0.003-0.008 USD |
| Image → OCR → AI |        ~0.005-0.015 USD |
| Image + AI retry |        ~0.010-0.025 USD |

Key cost drivers:

- AI output tokens
- OCR request count
- retry rate
- long input text
- user abuse/spam

---

## 4. BYOK effect

| Scenario        | BYOK ratio | System pays AI for | AI cost impact          |
| --------------- | ---------: | -----------------: | ----------------------- |
| Free-only BYOK  |       100% | 0% of free lessons | AI cost near zero       |
| Power-user beta |        70% |     30% of lessons | Large cost reduction    |
| Mixed beta      |        40% |     60% of lessons | Moderate cost reduction |
| Paid-first      |      0-10% |       Most lessons | Higher cost, better UX  |

BYOK is not the best mass-market UX, but it is useful for:

- early adopters
- beta testing
- cost control
- transparent free tier

Paid managed AI remains important for mainstream users.

---

## 5. Cost guardrails

| Guardrail           | Default                                |
| ------------------- | -------------------------------------- |
| Max text length     | 3.000 characters                       |
| Max image size      | 5 MB                                   |
| AI retry            | Max 1 retry                            |
| Saved lesson reopen | No AI call                             |
| Trial quota         | 5-10 lessons/user                      |
| Paid daily cap      | 50-200 lessons/user/day depending plan |
| Budget alerts       | 20, 50, 100 USD during closed beta     |

---

## 6. Early revenue hypotheses

These are hypotheses to validate, not confirmed pricing:

| Model                | Pros                                 | Cons                                  |
| -------------------- | ------------------------------------ | ------------------------------------- |
| Monthly subscription | Simple, predictable                  | Needs retention features              |
| Credit bundle        | Maps to AI cost                      | More complex UX                       |
| Freemium + BYOK      | Low system cost                      | Technical setup can confuse beginners |
| Paid convenience     | Strong user logic: no API key needed | Requires cost cap and quota           |

Recommended validation:

1. Start with free/trial + BYOK during beta.
2. Measure generated lessons, save rate, return rate.
3. Test willingness to pay for managed AI.
4. Add subscription only after retention loop improves.

---

## 7. What investors should watch

| Metric                        | Why it matters                |
| ----------------------------- | ----------------------------- |
| Cost per generated lesson     | Determines gross margin       |
| Save rate                     | Indicates lesson value        |
| Review/open saved lesson rate | Indicates retention potential |
| D1/D7 retention               | Indicates habit formation     |
| AI schema valid rate          | Determines reliability        |
| OCR success rate              | Determines scan UX quality    |
| Paid conversion / paid intent | Determines monetization path  |
