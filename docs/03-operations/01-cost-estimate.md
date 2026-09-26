# Cost Estimate — LingoBites

## 1. Purpose

This document is separated from BA to track app operating costs. Figures are estimates for Phase 0 based on current architecture:

```text
Mobile app → Backend proxy → OCR provider / AI provider → Local saved lesson
```

Principles: Phase 0 local-first, no mandatory login, no cloud sync, no original image storage by default.

Quick reference:

| Key point                 |                                                                  Value |
| ------------------------- | ---------------------------------------------------------------------: |
| Paste text lesson         |                                              ~0.003–0.008 USD / lesson |
| Image → OCR → AI lesson   |                                              ~0.005–0.015 USD / lesson |
| Small closed beta         |                             ~30–100 USD/month after store account fees |
| Most important guardrails | 3,000 characters, max 1 AI retry, no AI call when opening saved lesson |

---

## 2. Fixed costs

| Item                    |                            Required? |        Estimate | Period   | Notes                                                   |
| ----------------------- | -----------------------------------: | --------------: | -------- | ------------------------------------------------------- |
| Apple Developer Program | If publishing iOS/TestFlight broadly |          99 USD | Annual   | Needed for App Store/TestFlight production workflow     |
| Google Play Console     |  If publishing Android on Play Store |          25 USD | One-time | Developer account registration fee                      |
| Domain                  |                          Recommended |       10–20 USD | Annual   | For API/support/privacy URL                             |
| Small backend hosting   |               When using real OCR/AI |        5–25 USD | Monthly  | Railway/Render/Fly/small VPS                            |
| Support email           |              Recommended before beta |        0–10 USD | Monthly  | Gmail/domain email acceptable initially                 |
| Crash reporting         |                          Recommended | 0 USD initially | Monthly  | Firebase Crashlytics usually sufficient for small beta  |
| Product analytics       |                          Recommended | 0 USD initially | Monthly  | PostHog/Firebase free tier sufficient if events are few |
| Monitoring/logging      |                          Recommended |        0–20 USD | Monthly  | Start with hosting logs; increase with traffic          |

### Minimum fixed total

| Level                                 |                               Cost |
| ------------------------------------- | ---------------------------------: |
| Internal/local only, not on store yet |                     5–25 USD/month |
| Closed beta iOS + Android first year  |   124 USD upfront + 5–35 USD/month |
| Minimum public beta                   | 124 USD upfront + 30–100 USD/month |

---

## 3. Variable cost per lesson

Assume 1 lesson includes:

- 1 OCR call if user uses image.
- 1 AI analysis.
- No AI call when opening saved lesson.
- Free users may use BYOK (Bring Your Own Key) to pay AI provider directly.
- Paid users use system managed AI key, no personal token required.

| Component               | When incurred               |                   Estimate / call | Notes                                                                        |
| ----------------------- | --------------------------- | --------------------------------: | ---------------------------------------------------------------------------- |
| OCR text detection      | User captures/uploads image |       ~0.0015 USD after free tier | Google Cloud Vision Text Detection often free for first 1,000 requests/month |
| AI analysis             | Each lesson generation      |                  ~0.003–0.008 USD | Depends on model, input/output length, retry                                 |
| AI retry invalid output | When schema invalid         | +0–100% of that request's AI cost | Spec limits retry to at most 1                                               |
| Backend bandwidth       | Image upload/API response   |              Very small initially | May increase with large images or high traffic                               |
| Logging/analytics event | Each funnel step            |               Near zero initially | Avoid sending raw text/AI output                                             |

### Quick estimates

| Lesson type                 | Variable cost / lesson |
| --------------------------- | ---------------------: |
| Paste text, no OCR          |       ~0.003–0.008 USD |
| Image → OCR → AI            |       ~0.005–0.015 USD |
| Image + multiple AI retries |       ~0.010–0.025 USD |

---

## 4. Impact of BYOK / paid managed mode

BYOK reduces system AI cost because users pay the provider directly. Paid managed AI is better for mainstream UX but the system bears usage cost, so quota/rate limits are required.

For security design and setup details see `docs/01-ba/08-operations/03-ai-key-strategy-byok-paid-managed.md`.

---

## 5. Cost scenarios by traffic

| Scenario          | Lessons/month |      AI + OCR | Backend/monitoring | Total ops/month |
| ----------------- | ------------: | ------------: | -----------------: | --------------: |
| Internal test     |           500 |       0–5 USD |           5–10 USD |        5–15 USD |
| Small closed beta |         5,000 |     25–75 USD |           5–25 USD |      30–100 USD |
| Medium beta       |        50,000 |   250–750 USD |         25–100 USD |     275–850 USD |
| Small scale       |       100,000 | 500–1,500 USD |         50–200 USD |   550–1,700 USD |

> Quick formula: `monthly_cost ≈ fixed_infra + lessons * cost_per_lesson`.
>
> For image lessons, use `cost_per_lesson = 0.005–0.015 USD`.

---

## 6. One-time / irregular costs

| Item                         |       Estimate | When needed                                                            |
| ---------------------------- | -------------: | ---------------------------------------------------------------------- |
| App icon / store screenshots |      0–300 USD | Before public beta or polished store listing                           |
| Privacy policy/legal review  |     0–500+ USD | Before public beta, especially since app sends image/text to providers |
| Real device QA               |   0–1,000+ USD | If no iPhone/Android test devices available                            |
| Provider evaluation          |      0–100 USD | When testing multiple OCR/AI models                                    |
| BYOK setup/security review   | Primarily time | When allowing users to enter their own API key                         |
| Build/release signing setup  | Primarily time | Before TestFlight/Play Store                                           |
| Support/CS time              | Primarily time | When real beta users exist                                             |

---

## 7. Phase 0 cost guardrails

| Guardrail             | Suggested value                             | Reason                         |
| --------------------- | ------------------------------------------- | ------------------------------ |
| Max text length       | 3,000 characters                            | Prevent token cost spikes      |
| Max image size        | 5 MB before backend reject                  | Avoid OCR/bandwidth increase   |
| AI retry              | At most 1 on invalid output                 | Limit retry cost               |
| OCR retry             | User-triggered, no auto loop                | Prevent infinite loops         |
| Daily request cap     | 20–50 lessons/user/day for beta             | Prevent abuse                  |
| Monthly budget alert  | 20 USD, 50 USD, 100 USD during closed beta  | Detect cost spikes             |
| Saved lesson reopen   | Do not call AI again                        | Reduce cost and keep UX stable |
| Log sensitive content | Off by default                              | Reduce privacy risk            |
| Analytics payload     | No raw text, no images, no full AI output   | Keep events small and safe     |
| Paid managed quota    | Limit lessons/day or credits/month per plan | Protect margin                 |

---

## 8. Pricing references

Provider prices change over time; verify before public beta.

| Provider                | Pricing page                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| Apple Developer Program | https://developer.apple.com/programs/                                  |
| Google Play Console     | https://support.google.com/googleplay/android-developer/answer/6112435 |
| Google Cloud Vision API | https://cloud.google.com/vision/pricing                                |
| OpenAI API              | https://openai.com/api/pricing                                         |
| Railway                 | https://docs.railway.com/reference/pricing/plans                       |
| Render                  | https://render.com/pricing                                             |
| Firebase                | https://firebase.google.com/pricing                                    |
| PostHog                 | https://posthog.com/pricing                                            |
