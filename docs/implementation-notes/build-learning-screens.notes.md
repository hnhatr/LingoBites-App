# Implementation Notes: Build 4 missing learning screens

## Task Summary

Add the 4 learning-mode screens from `design_handoff_lingoscan` that were not yet in
`this repo`: **sentence detail, word detail, grammar detail, quick practice (quiz)**.
They drill down from the existing single-scroll lesson view (`LessonResultView`).

## Assumptions

- These screens were a documented **P0 non-goal** (spec `2026-06-05-lingobites-ui-design.md`
  §58–59: "Separate … screens for sentence, word, grammar, or practice details"). The user
  explicitly requested building them now, so this is an additive P1 layer — the existing inline
  rendering in `LessonResultView` is preserved.
- Data is already in memory (validated `AIOutput`), so detail screens receive their item via
  navigation params rather than a repository lookup.
- "Related grammar" is derived as the other `grammar_points` in the same lesson (schema has no
  explicit related-grammar field on a grammar point).

## Decisions

- **Feature gating:** entry points are gated behind the existing `shortPractice` flag
  (module `modules/practice`, depends on `lessonResultView`) instead of adding a new registry key.
  Rationale: AGENTS.md requires post-P0 modules be flag-controlled, and adding a key forces churn
  across `feature-registry`, `feature-dependencies`, and all 4 release configs. `shortPractice` is
  already `true` in `close-beta-1` (the app's default release) so the screens are reachable.
- **Quiz logic** lives in a pure module `modules/practice/quizEngine.ts` (unit-tested without a
  renderer); `useQuiz` is a thin hook wrapper. Matches the handoff quiz JS (3 MC questions,
  correct/wrong highlight, progress, score, restart).
- **Navigation:** the 4 routes are added to a shared `LearningDetailParamList` intersected into
  both `HomeStackParamList` and `LessonsStackParamList`, and registered in both navigators so the
  flow works from a fresh lesson and a reopened saved lesson. Screens use a union props type (like
  `SavedLessonDetailScreen`) and cast `navigation` to one concrete type for `navigate` calls — the
  React Navigation union-prop `navigate` is otherwise not callable.
- **Chip** extended with a token-driven `tone` prop (accent / accentSoft / coralSoft / gold /
  neutral) to render the handoff's colored chips. Two soft surface tokens (`secondarySoft`,
  `tertiarySoft`) were added to `ColorScale` and all three themes.

## Changes from Spec

- **Audio / TTS buttons omitted.** The handoff shows speaker buttons on sentences/chunks/words;
  there is no TTS dependency in the repo and README defers "wire TTS last". Omitted rather than
  shipping dead controls. Layout/content otherwise matches.
- **No Material icons.** The app uses no icon font; screens render text-based per existing app
  style (e.g. a "›" chevron, text "Đóng").
- **Decorative-only blocks dropped** to honor AGENTS.md "do not invent fields": word-detail
  "High utility / Common usage" stat tiles and the grammar "Level B1" badge are not in the schema,
  so they are not rendered. Word level uses the real `cefr_level`.
- Grammar screen omits the design's per-item "Save" CTA (no per-grammar persistence in the data
  model); keeps "Luyện ngay" → Practice.

## Tradeoffs / Risks

- Bundling the 3 detail screens under `shortPractice` (rather than a dedicated flag) is a product
  grouping choice; if detail-view and practice need independent toggles later, add a key then.
- Detail screens pass whole schema objects as nav params (serializable JSON, consistent with the
  existing `lesson: AIOutput` param). Not a concern for in-app navigation; would matter only if
  deep-linking/state-persistence is added.
- Inline styles trigger `react-native/no-inline-styles` warnings — consistent with the existing
  screens (same warning class throughout `src/modules`). No color literals: every color is a theme
  token.

## Files Changed

| File                                                               | Change                                                                   | Reason                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------- |
| `src/app/navigation/types.ts`                                      | Add `LearningDetailParamList`; intersect into Home & Lessons param lists | Route params for the 4 screens         |
| `src/app/navigation/AppNavigator.tsx`                              | Register 4 screens (headerShown:false) in both stacks                    | Reachable from fresh & saved lessons   |
| `src/theme/types.ts`                                               | Add `secondarySoft`, `tertiarySoft` to `ColorScale`                      | Token-driven coral/gold soft surfaces  |
| `src/theme/themes/{default,dark,pastelKids}.ts`                    | Provide the 2 new tokens                                                 | Keep all themes valid                  |
| `src/components/Chip.tsx`                                          | Add `tone` prop (token-driven)                                           | Handoff colored chips                  |
| `src/modules/practice/quizEngine.ts`                               | New pure quiz engine                                                     | Testable quiz logic                    |
| `src/modules/practice/useQuiz.ts`                                  | New hook wrapping the engine                                             | Screen state                           |
| `src/modules/practice/PracticeScreen.tsx`                          | New quiz screen                                                          | Screen 10                              |
| `src/modules/lesson/SentenceDetailScreen.tsx`                      | New                                                                      | Screen 7                               |
| `src/modules/lesson/WordDetailScreen.tsx`                          | New                                                                      | Screen 8                               |
| `src/modules/lesson/GrammarDetailScreen.tsx`                       | New                                                                      | Screen 9                               |
| `src/modules/lesson/LessonResultView.tsx`                          | Optional drill-down callbacks + tappable items + practice CTA            | Entry points                           |
| `src/modules/lesson/LessonResultScreen.tsx`                        | Wire callbacks (gated by `shortPractice`)                                | Fresh-lesson entry                     |
| `src/modules/lesson/SavedLessonDetailScreen.tsx`                   | Wire callbacks (gated by `shortPractice`)                                | Saved-lesson entry                     |
| `src/modules/practice/__tests__/quizEngine.test.ts`                | New (TDD)                                                                | 10 unit tests                          |
| `src/modules/practice/__tests__/PracticeScreen.test.tsx`           | New                                                                      | Render + empty + grade interaction     |
| `src/modules/lesson/__tests__/LearningDetailScreens.test.tsx`      | New                                                                      | Render 3 detail screens                |
| `src/modules/lesson/__tests__/LessonResultView.drilldown.test.tsx` | New                                                                      | Entry-point callbacks fire / gated off |

## Tests / Verification

- Command: `npx tsc --noEmit -p tsconfig.json` → **clean (exit 0)**.
- Command: `npx jest` → **32 suites / 105 tests passed** (was 28/86; +4 suites / +19 tests).
- Command: `npx eslint <changed files>` → **0 errors**, only `no-inline-styles` warnings
  (codebase norm); no color literals in new files.
- Not done: on-device/simulator visual check (no emulator in this environment) and TTS audio.

## Review Notes

- Confirm `shortPractice` is the desired gate for the detail-screen entry points (vs. a dedicated
  flag). It is on in `close-beta-1`, so the screens are live in the default app build.
- The quiz currently launches the full `practice[]` from every CTA. If word/grammar CTAs should
  filter by `PracticeQuestion.skill`, that's a small follow-up.
- Visual QA against `design_handoff_lingoscan` recommended (colors/spacing are token-driven; audio
  buttons intentionally absent).
