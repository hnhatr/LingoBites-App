# One-page Brief — LingoBites

## 1. Elevator pitch

**LingoBites** helps Vietnamese beginners turn photos or real-world English text into easy-to-understand lessons in Vietnamese.

Instead of just translating, the app explains each sentence, highlights important vocabulary, points out key grammar, suggests pronunciation, and saves content so users can review later.

---

## 2. Problem

Vietnamese beginners encounter English in daily life: signs, menus, emails, messages, flyers, product instructions. They can use translation apps to understand meaning, but still do not know:

- How that sentence is structured.
- Which words are actually worth learning.
- What grammar is at play.
- How to read it or reuse the sentence pattern.
- How to save that content for review.

Result: translation tools solve instant comprehension, but do not turn real situations into a learning process.

---

## 3. Solution

Core loop:

```text
Scan/Input → Confirm Text → Generate Lesson → Learn → Save → Review
```

The app uses OCR and AI structured output to create mini lessons in Vietnamese:

| Component        | Value for user                              |
| ---------------- | ------------------------------------------- |
| Full translation | Quick meaning                               |
| Sentence split   | Know what each sentence says                |
| Breakdown        | Understand sentence structure               |
| Grammar          | Learn tenses/patterns from real text        |
| Vocabulary       | Highlight important words/phrases           |
| Pronunciation    | Basic reading guidance                      |
| Save/review      | Turn real-world content into study material |

---

## 4. Target user

Primary segment:

```text
Vietnamese beginners or learners with weak foundations who need Vietnamese explanations and simple examples.
```

Secondary segments:

- Students who need to understand English passages.
- Office workers who encounter English emails/notices.
- Travelers who need to understand menus, signs, flyers.
- Self-learners who want quick sentence analysis.

---

## 5. Why now

- AI can produce structured learning output, not just translation.
- OCR/mobile cameras are mainstream enough to scan real-world content.
- Learners expect personalized, instant experiences from real context.
- AI cost can be controlled via text limits, quotas, local saved lessons, and BYOK.

---

## 6. Differentiation

| Alternative           | Does well              | Gap                                                           |
| --------------------- | ---------------------- | ------------------------------------------------------------- |
| Google Translate/Lens | Fast translate/scan    | Does not create structured lessons                            |
| Duolingo              | Learning path          | Does not teach from real-world text users encounter           |
| ELSA                  | Pronunciation practice | Does not explain sentences/vocabulary from image/text         |
| ChatGPT               | Flexible               | No dedicated mobile UX with clear OCR/review/save lesson flow |

Positioning:

```text
Learning-first scan app for Vietnamese beginners, not a generic translator.
```

---

## 7. Business model

| Tier   | Model                                                                       |
| ------ | --------------------------------------------------------------------------- |
| Free   | BYOK: users can enter their own API key or use a small demo/trial quota     |
| Paid   | Managed AI: users pay for the app, no separate token needed                 |
| Future | Flashcard/review, advanced practice, speaking, content import, subscription |

Cost strategy:

- Reopening a saved lesson does not call AI.
- Default text limit of 3,000 characters.
- AI retry capped at 1.
- Paid users have quota/rate limits.
- Free/power users can use BYOK to reduce system cost.

---

## 8. Phase 0 goal

Phase 0 must prove:

1. Users need to scan/paste real-world English.
2. Vietnamese lessons are more valuable than plain translation.
3. Users want to save and return to review lessons.

Exit criteria:

- Core flow runs reliably on iOS/Android.
- AI output validates against schema consistently.
- At least 20 sample images pass the OCR flow.
- Users can save/open lessons.
- Privacy/cost guardrails ready for closed beta.

---

## 9. Funding use

Priority resource allocation:

| Area                | Goal                                           |
| ------------------- | ---------------------------------------------- |
| Product engineering | Ship closed beta M1–M5                         |
| AI/OCR quality      | Stabilize schema, prompt, retry, sample eval   |
| UX testing          | Verify beginners understand lessons            |
| Growth testing      | Find first user channels and measure retention |
| Operations          | Cost guard, privacy, release readiness         |
