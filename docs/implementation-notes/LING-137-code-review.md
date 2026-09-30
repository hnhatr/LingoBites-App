# LING-137 code review report

Measured review of the LingoBites-App codebase after the LING-137 cleanup
series (TASK-001..006, PRs #109..#114), plus the written conventions they
motivate (`docs/architecture/code-conventions.md`). Every count below was
measured on the final merged state and is reproducible by the command named
next to it. Topic verdicts use exactly one of: **conforms** /
**deviations found** / **not applicable**.

- Base (first LING-137 merge parent): `0f80f92` (merge of PR #108).
- Final measured state: `0eeead06` (merge of PR #114, TASK-006).
- This document: added by TASK-007 (LING-146) on top of `0eeead06`
  without touching any code, so all counts measured on `0eeead06` apply
  unchanged to the TASK-007 head.

## Baseline, final state and budget history

At the LING-137 baseline (`0f80f92`, CI run `36616006792`, green):

- ESLint: 0 errors / **316 warnings** against `WARNING_BUDGET` total 340.
- Tests: **2166 passed** / 1 skipped, **288 suites passed** / 1 skipped.
- Prettier: `format:check` passes ("All matched files use Prettier code
  style!").

On the final merged state (`0eeead06`), re-measured for this report:

- ESLint: 0 errors / **281 warnings** in 57 files, exactly matching
  `WARNING_BUDGET` (`totalWarnings: 281`).
- Tests: **2166 passed** / 1 skipped, **288 suites passed** / 1 skipped
  (no drop from baseline; command `yarn test --ci --watchman=false`,
  see "Validation evidence").
- Prettier: `yarn format:check` passes; `yarn lint:boundaries` passes
  with zero new violations; `yarn lint:budget` passes; `yarn typecheck`
  (`tsc --noEmit`) passes.

`WARNING_BUDGET` (`scripts/check-eslint-warning-budget.js`) history,
verified per merge commit with
`git show <merge>:scripts/check-eslint-warning-budget.js | grep -m1 totalWarnings:`:

| Merge | PR / task | `totalWarnings` |
| --- | --- | --- |
| `0f80f92` | baseline (PR #108) | 340 |
| `1e86bd4` | #109 / TASK-001 import order | 340 |
| `8f4d03a` | #110 / TASK-002 core cleanup | 314 |
| `56bef9b` | #111 / TASK-003 UI styles | 309 |
| `79e0cec` | #112 / TASK-004 app styles | 308 |
| `3ee57da` | #113 / TASK-005 lesson cleanup | 299 |
| `0eeead06` | #114 / TASK-006 features cleanup | **281** |

Per-rule budget on `0eeead06` versus actual warnings measured by
`./node_modules/.bin/eslint . --format json` (summary script counts
`severity === 1` per `ruleId`; 0 `severity === 2` messages):

| Rule | Budget | Actual | Files |
| --- | --- | --- | --- |
| `no-bitwise` | 131 | 131 | 7 |
| `react-native-a11y/has-accessibility-hint` | 84 | 84 | 36 |
| `react-native/no-inline-styles` | 64 | 64 | 32 |
| `no-void` | 1 | 1 | 1 |
| `react/no-unstable-nested-components` | 1 | 1 | 1 |
| `react-native-a11y/has-valid-accessibility-descriptors` | 0 | 0 | 0 |
| `react-native-a11y/has-valid-accessibility-ignores-invert-colors` | 0 | 0 | 0 |
| `eslint-comments/no-unused-disable` | 0 | 0 | 0 |
| `jest/no-disabled-tests` | 0 | 0 | 0 |
| `@typescript-eslint/no-shadow` | 0 | 0 | 0 |
| `no-undef-init` | 0 | 0 | 0 |
| `no-regex-spaces` | 0 | 0 | 0 |
| `no-useless-escape` | 0 | 0 | 0 |
| **Total** | **281** | **281** | **57** |

## 1. Prettier — conforms

- Finding: formatting is fully clean. `yarn format:check`
  (`prettier --check "**/*.{ts,tsx,js,json}"`) prints "All matched files
  use Prettier code style!" on the measured state.
- Finding: formatter pinned and untouched — `package.json` pins
  `"prettier": "2.8.8"` (command `grep '"prettier"' package.json`);
  `git diff 0f80f92..0eeead06 -- .prettierrc.js .prettierignore
  package.json` shows no change to Prettier config or version (BR-006).
- Verdict: **conforms**.

## 2. ESLint — deviations found (all residuals justified)

- Finding: 0 errors and 281 warnings (command
  `./node_modules/.bin/eslint . --format json`, counted per `ruleId`
  at `severity === 1`), exactly equal to `WARNING_BUDGET`
  (`yarn lint:budget` passes; tail output shows e.g.
  `react-native/no-inline-styles: 64/64` and
  `react/no-unstable-nested-components: 1/1`).
- Finding: the per-rule residuals are listed in full under
  "Residual warnings per rule" below (131 `no-bitwise`, 84
  `has-accessibility-hint`, 64 `no-inline-styles`, 1 `no-void`,
  1 `react/no-unstable-nested-components`), each with its
  justification; every rule that reached 0 keeps a 0 (not removed)
  entry in `WARNING_BUDGET`.
- Verdict: **deviations found** — the 281 residual warnings are the
  deviations, and each is justified below. No unjustified warning
  remains.

## 3. Naming — conforms

- Finding: component file names are PascalCase. Of all production
  `.tsx` files, only 1 is not PascalCase:
  `src/features/youtube/screens/useYouTubeLessonScreenController.tsx`
  (a hook module, camelCase `use*` by convention), measured with
  `git ls-files 'src/*.tsx' | grep -v __tests__ | awk -F/ '{print $NF}'`
  `| grep -v -E '^[A-Z][A-Za-z0-9]*\.tsx$'`. The same command also
  lists 3 kebab-case integration test files
  (`src/test/integration/feature-flag.test.tsx`,
  `flashcard-e2e.test.tsx`, `flashcard-edge-cases.test.tsx`), which
  follow the test-file convention, not the component convention.
- Finding: custom hooks follow the `use*` convention — 22 hook modules
  matched by `git ls-files 'src/**/use*.ts' 'src/**/use*.tsx' | grep -v
  __tests__ | wc -l`; no hook file without the `use` prefix was found.
- Finding: no file or exported identifier was renamed by the LING-137
  series (BR-004) — `git diff -M --name-status 0f80f92..0eeead06`
  shows no `R` rename entry (checked during each task's diff audit).
- Verdict: **conforms**. Grandfathered deviations: none — the hook
  and test file names above are the convention, not exceptions.

## 4. File ordering — conforms

- Finding: import order is machine-enforced with zero violations.
  `simple-import-sort/imports: error` scoped to `src/**`
  (`.eslintrc.js` override added by TASK-001) reports 0 messages in
  the ESLint JSON (command: count messages whose `ruleId` starts with
  `simple-import-sort` in `./node_modules/.bin/eslint . --format
  json`). Type-only imports are preserved: 452 `import type` lines
  (`git grep -c "^import type" -- src`, summed).
- Finding: module layout follows
  `docs/architecture/module-boundaries.md` — 37 barrel `index.ts`
  files (`git ls-files 'src/**/index.ts' | wc -l`), one public barrel
  per feature plus the three lesson sub-part barrels
  (`library`/`player`/`packages`); `yarn lint:boundaries` passes with
  zero new violations and an empty exception manifest.
- Finding: the i18n side-effect import stays first — `App.tsx` line 1
  is `import './src/core/i18n';` (EC-001; verified in TASK-001, covered
  by AC-005).
- Verdict: **conforms**.

## 5. Component ordering — conforms

- Finding: hook call order is machine-enforced with zero violations.
  `react-hooks/rules-of-hooks: 2` (error) comes from
  `@react-native/eslint-config/shared.js:266`, and the ESLint JSON on
  the measured state contains 0 errors, hence 0 hook-order violations.
  `useEffect(` appears on 65 lines (`git grep -c "useEffect(" -- src`,
  summed) across screens and hooks, all statically ordered.
- Finding: file-body order (imports, component, `StyleSheet.create`
  last) is review-only and holds in samples: the last lines of
  `src/features/speaking/screens/SpeakingRoomScreen.tsx`,
  `src/ui/components/AppButton.tsx` and `src/app/navigation/TabBar.tsx`
  are all the closing of a bottom-of-file `StyleSheet.create` block
  (command `tail -3 <file>` on each of the three paths).
- Verdict: **conforms**.

## 6. JSX — deviations found (all residuals justified)

- Finding: no hard JSX violation remains. All `react/jsx-*` rules
  come from `extends: ['@react-native']` at error severity and the
  ESLint JSON contains 0 errors. JSX-adjacent residuals are the 84
  `has-accessibility-hint` and 64 `no-inline-styles` warnings, each
  listed per file under "Residual warnings per rule".
- Finding: fragment shorthand `<></>` is used on 18 lines
  (`git grep -c "<>" -- 'src/*.tsx'`, summed); prop spreading
  `{...x}` appears on 58 lines (`git grep -c -E '\{\.\.\.[a-zA-Z]' --
  'src/*.tsx'`, summed), concentrated in navigator/test plumbing such
  as `tabBar={props => <TabBar {...props} />}`
  (`src/app/navigation/AppNavigator.tsx:276`, the single
  `react/no-unstable-nested-components` residual — changing it would
  alter navigation rendering, so it stays per BR-001).
- Finding: accessibility props are widespread — 225
  `accessibilityLabel` lines and 102 `accessibilityHint` lines
  (`git grep -c accessibilityLabel|accessibilityHint -- src`, summed);
  the 84 hint warnings mark the elements whose hint text is still
  missing, deliberately deferred as follow-up work (spec non-goal).
- Verdict: **deviations found** — the hint residuals are the
  deviations, justified as deferred follow-up (a11y text changes are
  out of scope per BR-001).

## 7. StyleSheet — deviations found (all residuals justified)

- Finding: 69 files use `StyleSheet.create`
  (`git grep -l "StyleSheet.create" -- src | wc -l`); 64 dynamic-only
  inline styles remain in 32 files, each listed under "Residual
  warnings per rule" (`react-native/no-inline-styles`). Every remaining
  one reads props, state, theme or insets (hence not static per EC-006)
  or sits in a position where TASK-002..006 could not prove literal
  equivalence — they stay per BR-001.
- Finding: no color literals remain in the enforced scopes:
  `react-native/no-color-literals: error` (override on
  `src/ui/components/**/*.tsx`, `src/ui/icons/**/*.tsx`,
  `src/features/**/*.tsx`) reports 0 messages in the ESLint JSON.
- Verdict: **deviations found** — the 64 dynamic inline styles are the
  deviations, justified per file below.

## 8. TypeScript — conforms

- Finding: `yarn typecheck` (`tsc --noEmit`) passes on the measured
  state. `tsconfig.json` extends `@react-native/typescript-config`,
  which sets `"strict": true` (verified in
  `node_modules/@react-native/typescript-config/tsconfig.json`).
- Finding: zero type-safety warnings remain —
  `@typescript-eslint/no-shadow` and `no-undef-init` each read 0/0 in
  `yarn lint:budget` and 0 messages in the ESLint JSON.
- Finding: `any` is review-only in this codebase (the RN config does
  not extend the TS recommended set, so `no-explicit-any` is off):
  46 `: any` lines in 20 files (`git grep -c ": any" -- src` summed;
  `git grep -l ": any" -- src | wc -l`). Non-null assertions are
  likewise unenforced: 88 matching lines (`git grep -c -E
  '[A-Za-z0-9_)][!][.?[]' -- src`, summed, approximate pattern).
  Neither grew during LING-137; both are now fenced by the conventions
  document instead of new rules (no new requirements per TASK-007
  scope).
- Verdict: **conforms**.

## 9. Hooks — conforms

- Finding: both hook safety rules are errors with zero violations:
  `react-hooks/rules-of-hooks: 2` and `react-hooks/exhaustive-deps: 2`
  (`node_modules/@react-native/eslint-config/shared.js:266-267`),
  and the ESLint JSON contains 0 errors. No `void`-in-effect hazard
  was introduced: the only kept `void`
  (`src/features/lesson/player/screens/UnifiedLessonGenerationScreen.tsx:464`,
  `onRetryPart={(target) => void handleRetryPart(target)}`) sits in an
  event callback, not in an effect body, and stays per EC-005 (removing
  it would return a Promise where `undefined` is expected).
- Finding: 22 custom hook modules (`git ls-files 'src/**/use*.ts'
  'src/**/use*.tsx' | grep -v __tests__ | wc -l`) all use the `use*`
  prefix; effects are statically ordered (see topic 5).
- Verdict: **conforms**.

## 10. Import ordering — conforms

- Finding: the TASK-001 rule holds with zero violations:
  `simple-import-sort/imports: error` on `src/**` with alias groups
  `@app/@features/@ui/@core/@test` (`.eslintrc.js` override), 0
  messages in the ESLint JSON; BR-005 protected paths
  (`adv-ling108-r1-atomic-replacement` adversarial test,
  `validator.test.ts`, vendored `validator.ts`, generated
  `bundledPackageData.ts`) carry `simple-import-sort/imports: off`
  and are byte-untouched.
- Finding: cross-layer relative imports are gone: `git grep -E "(from
  |require\()'(\.\./)+(app|core|ui|test|features)/" -- src` returns no
  output (AC-007). The sole conversion,
  `src/features/home/screens/HomeScreenView.tsx:524`, now reads
  `require('@ui/assets/home-hero-cat.png')` and contains zero
  `../../../` (`git grep -c -E "'(\.\./){3,}" --
  src/features/home/screens/HomeScreenView.tsx` returns nothing).
  Remaining deep relatives (90 files / 105 occurrences) are all
  intra-module and listed under "Remaining `../../../` imports".
- Verdict: **conforms**.

## 11. Comments — conforms

- Finding: Vietnamese comments are preserved untranslated per BR-004:
  207 files under `src` contain Vietnamese diacritics (command
  `git grep -l -P
  '[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]'
  -- src | wc -l`; the spec's planning estimate was 192 files — the
  measured 207 above is the final-state number).
- Finding: only 10 TODO/FIXME/HACK/XXX tag lines remain
  (`git grep -c -i -E "TODO|FIXME|HACK|XXX" -- src`, summed). No
  comment translation occurred in the series: each task's diff audit
  (AC-008) confirmed mechanical-only diffs, and the Vietnamese
  comment files above are intact.
- Verdict: **conforms**.

## 12. Platform — conforms

- Finding: platform branches are explicit and few — 27
  `Platform.OS`/`Platform.select` references in 11 files (`git grep -c
  "Platform\.OS\|Platform\.select" -- src`, summed; `git grep -l ...
  | wc -l`). No platform-specific file extensions exist:
  `git ls-files 'src/*.ios.*' 'src/*.android.*' | wc -l` returns 0,
  so every platform difference goes through the explicit
  `Platform` API, never through file forking.
- Verdict: **conforms**.

## Residual warnings per rule (FR-006 / AC-010)

Counts are `warning count — path`, from the ESLint JSON
(`./node_modules/.bin/eslint . --format json`, per-`ruleId` per-file
tally; 0 errors overall).

### `no-bitwise`: 131 in 7 files — kept, rewriting bit logic is a spec non-goal

- 37 — `src/core/utils/sha256.ts` (BR-002: import-only file; hash bit
  operations are the algorithm)
- 60 — `src/features/lesson/packages/logic/importer/packageChecksum.ts`
  (BR-002: import-only file; checksum bit operations)
- 9 — `src/features/lesson/packages/logic/importer/zipReader.ts`
  (BR-002: import-only file; zip bit parsing)
- 11 — `src/features/audio/logic/bytesToBase64.ts` (BR-002:
  import-only file; base64 bit packing)
- 12 — `src/features/lesson/packages/logic/importer/_fixtures/testZip.ts`
  (test fixture mirroring zip bit layout)
- 1 — `src/features/lesson/packages/logic/importer/__tests__/ContentPackageImporter.test.ts`
  (test asserting checksum bit behavior)
- 1 — `src/features/youtube/logic/sync/useTranscriptSync.ts`
  (flag bitmask documented at the use site)

### `react-native-a11y/has-accessibility-hint`: 84 in 36 files — kept, deferred follow-up (spec non-goal; hint text changes are a11y-text changes under BR-001)

- 1 — `src/app/navigation/TabBar.tsx`
- 12 — `src/features/home/screens/HomeScreenView.tsx`
- 3 — `src/features/input/screens/CreateScreen.tsx`
- 3 — `src/features/input/screens/ImageCaptureScreen.tsx`
- 2 — `src/features/input/screens/PasteTextScreen.tsx`
- 2 — `src/features/lesson/library/components/GrammarRowCard.tsx`
- 1 — `src/features/lesson/library/components/SearchAndFilterBar.tsx`
- 2 — `src/features/lesson/library/components/VocabularyRowCard.tsx`
- 1 — `src/features/lesson/library/screens/LessonsHistoryScreen.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ContextCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ExitCheckCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/RolePlayCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ShadowingCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/StepActions.tsx`
- 2 — `src/features/lesson/packages/screens/ContentLessonListScreen.tsx`
- 2 — `src/features/lesson/packages/screens/ContentLessonRuntimeScreen.tsx`
- 4 — `src/features/lesson/player/screens/UnifiedLessonGenerationScreen.tsx`
- 1 — `src/features/lesson/player/screens/UnifiedLessonsScreen.tsx`
- 2 — `src/features/ocr/screens/OCRReviewScreen.tsx`
- 1 — `src/features/practice/components/PracticeEntryCard.tsx`
- 1 — `src/features/practice/screens/PracticeScreen.tsx`
- 9 — `src/features/profile/screens/ProfileScreenView.tsx`
- 2 — `src/features/profile/screens/ProgressReportScreen.tsx`
- 5 — `src/features/review/screens/DailyReviewScreen.tsx`
- 7 — `src/features/speaking/components/activities/SpeakingShadowingActivity.tsx`
- 1 — `src/features/speaking/screens/SpeakingRoomScreen.tsx`
- 4 — `src/features/youtube/components/YouTubeToolsPopup.tsx`
- 1 — `src/ui/components/AppButton.tsx`
- 1 — `src/ui/components/HandoffProgressTrack.tsx`
- 1 — `src/ui/components/LessonExploreRow.tsx`
- 1 — `src/ui/components/PrimaryActionButton.tsx`
- 2 — `src/ui/components/QuizOption.tsx`
- 2 — `src/ui/components/RatingControl.tsx`
- 1 — `src/ui/components/ScreenHeader.tsx`
- 1 — `src/ui/components/ThemePicker.tsx`
- 1 — `src/ui/components/__tests__/componentAccessibilityRegressions.test.tsx`
  (test asserting the current hint state)

### `react-native/no-inline-styles`: 64 in 32 files — kept, each remaining style is dynamic (EC-006) or not provably literal-equivalent (BR-001)

- 3 — `src/app/navigation/TabBar.tsx`
- 1 — `src/features/home/screens/PlaceholderTabScreen.tsx`
- 7 — `src/features/input/screens/ImageCaptureScreen.tsx`
- 2 — `src/features/input/screens/PasteTextScreen.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ActiveRecallCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ContextCard.tsx`
- 2 — `src/features/lesson/packages/components/runtime/activities/ExitCheckCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/RolePlayCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/ShadowingCard.tsx`
- 1 — `src/features/lesson/packages/components/runtime/activities/StepActions.tsx`
- 2 — `src/features/lesson/packages/screens/ContentLessonDetailScreen.tsx`
- 3 — `src/features/lesson/packages/screens/ContentLessonListScreen.tsx`
- 2 — `src/features/lesson/packages/screens/ContentLessonRuntimeScreen.tsx`
- 3 — `src/features/ocr/screens/OCRReviewScreen.tsx`
- 3 — `src/features/profile/screens/ProgressReportScreen.tsx`
- 1 — `src/features/review/screens/DailyReviewScreen.tsx`
- 6 — `src/features/speaking/components/activities/SpeakingShadowingActivity.tsx`
- 4 — `src/features/speaking/screens/SpeakingRoomScreen.tsx`
- 2 — `src/features/youtube/screens/YouTubeInputScreen.tsx`
- 1 — `src/features/youtube/screens/YouTubeProcessingScreen.tsx`
- 2 — `src/ui/components/AppButton.tsx`
- 1 — `src/ui/components/BottomActionBar.tsx`
- 1 — `src/ui/components/Chip.tsx`
- 2 — `src/ui/components/HandoffProgressTrack.tsx`
- 1 — `src/ui/components/ImagePlaceholder.tsx`
- 2 — `src/ui/components/Medallion.tsx`
- 1 — `src/ui/components/PrimaryActionButton.tsx`
- 1 — `src/ui/components/ProfileSettingsRow.tsx`
- 1 — `src/ui/components/SectionHeader.tsx`
- 2 — `src/ui/components/ShelfSurface.tsx`
- 1 — `src/ui/components/TextField.tsx`
- 2 — `src/ui/components/ThemePicker.tsx`

### `no-void`: 1 — kept per EC-005

- 1 — `src/features/lesson/player/screens/UnifiedLessonGenerationScreen.tsx:464`
  (`onRetryPart={(target: LessonGenerationPartTarget) => void
  handleRetryPart(target)}`): removing `void` would return the async
  handler's Promise from the callback instead of `undefined`. All other
  16 baseline `void` warnings were removed by TASK-002..006 after
  proving return-equivalence (budget `no-void` 17 → 1).

### `react/no-unstable-nested-components`: 1 — kept per BR-001

- 1 — `src/app/navigation/AppNavigator.tsx:276`
  (`tabBar={props => <TabBar {...props} />}`): hoisting the inline
  renderer would change navigation rendering behavior; fixing the
  lint would risk a behavior change, so it stays (spec non-goal).

## Remaining `../../../` imports (FR-006 / AC-007)

`git grep -E "(from |require\()'(\.\./)+(app|core|ui|test|features)/" --
src` returns no output: zero cross-layer relative imports remain.
`git grep -l -E "'(\.\./){3,}" -- src` lists **90 files / 105
occurrences** (`git grep -c` summed; 75 files / 89 occurrences under
`src/features/**`). Every one is intra-module and stays relative per
BR-008. `path: occurrences — reason`:

Production files (7, all lesson `packages` sub-part internals that must
not route through the `@features/lesson/...` barrel, per
`module-boundaries.md:59-61`):

- `src/features/lesson/packages/components/runtime/activities/ActiveRecallCard.tsx: 1`
- `src/features/lesson/packages/components/runtime/activities/ContextCard.tsx: 2`
- `src/features/lesson/packages/components/runtime/activities/ExitCheckCard.tsx: 1`
- `src/features/lesson/packages/components/runtime/activities/FeedbackCard.tsx: 1`
- `src/features/lesson/packages/components/runtime/activities/GuidedPracticeCard.tsx: 1`
- `src/features/lesson/packages/components/runtime/activities/RolePlayCard.tsx: 1`
- `src/features/lesson/packages/components/runtime/activities/ShadowingCard.tsx: 1`

Test files importing intra-module siblings or the repo-root
`test-utils/` helpers (boundary checker inspects production code only;
production never imports `test`). `path: occurrences`:

- `src/app/navigation/__tests__/TabBar.test.tsx: 1`
- `src/core/auth/__tests__/authSession-pointer-lock.test.ts: 1`
- `src/core/auth/__tests__/characterization/inv003-account-isolation.characterization.test.ts: 1`
- `src/core/auth/__tests__/characterization/inv003-production-account-switch.characterization.test.ts: 1`
- `src/core/db/__tests__/characterization/inv001-prior-schema-upgrade.characterization.test.ts: 1`
- `src/core/db/__tests__/installMarker.test.ts: 1`
- `src/core/db/__tests__/syncOutboxCore.test.ts: 1`
- `src/features/account/logic/__tests__/accountBootstrap-recovery.test.ts: 1`
- `src/features/account/logic/__tests__/accountBootstrap-switch.test.ts: 2`
- `src/features/account/logic/__tests__/accountBootstrap.test.ts: 1`
- `src/features/account/logic/__tests__/accountIsolation.integration.test.ts: 1`
- `src/features/account/logic/__tests__/legacyClear.test.ts: 3`
- `src/features/account/logic/__tests__/useAccountStore.test.ts: 1`
- `src/features/account/screens/__tests__/AccountSwitchGateScreen.test.tsx: 1`
- `src/features/account/screens/__tests__/BootGateScreen.test.tsx: 1`
- `src/features/account/screens/__tests__/OnboardingNameScreen.test.tsx: 1`
- `src/features/audio/logic/__tests__/chapterAudioCache.test.ts: 1`
- `src/features/audio/logic/__tests__/characterization/inv001-sqlite-upgrade-read.characterization.test.ts: 1`
- `src/features/audio/logic/__tests__/deviceChapterAudio.test.ts: 1`
- `src/features/audio/logic/data/__tests__/AudioAssetRepository.test.ts: 1`
- `src/features/engagement/logic/__tests__/gamification.test.ts: 1`
- `src/features/engagement/logic/__tests__/nativeReminderScheduler.test.ts: 1`
- `src/features/engagement/logic/__tests__/reminderService.test.ts: 1`
- `src/features/engagement/logic/__tests__/reviewSession.test.ts: 1`
- `src/features/engagement/logic/data/__tests__/GamificationRepository.test.ts: 1`
- `src/features/home/screens/__tests__/HomeScreenMvp.test.tsx: 1`
- `src/features/home/screens/__tests__/HomeScreenOptionA.test.tsx: 2`
- `src/features/home/screens/__tests__/HomeScreenStarter.test.tsx: 2`
- `src/features/home/screens/__tests__/HomeScreenStreakPill.test.tsx: 2`
- `src/features/home/screens/__tests__/HomeScreenUnified.test.tsx: 1`
- `src/features/input/screens/__tests__/ImageCaptureScreen.test.tsx: 2`
- `src/features/lesson/packages/logic/__tests__/contentQaMatrix.test.ts: 2`
- `src/features/lesson/packages/logic/data/__tests__/ContentLessonStateRepository.test.ts: 1`
- `src/features/lesson/packages/logic/data/__tests__/ContentPackageRepository.test.ts: 1`
- `src/features/lesson/packages/logic/data/__tests__/ContentRuntimeRepository.test.ts: 1`
- `src/features/lesson/packages/logic/data/__tests__/inv005-content-progress-upsert.characterization.test.ts: 1`
- `src/features/lesson/packages/logic/importer/__tests__/ContentPackageImporter.test.ts: 1`
- `src/features/lesson/packages/logic/runtime/__tests__/ContentLessonRuntime.test.ts: 1`
- `src/features/lesson/player/logic/__tests__/characterization/inv001-sqlite-upgrade-read.characterization.test.ts: 1`
- `src/features/lesson/player/logic/__tests__/learningTriggers.test.tsx: 2`
- `src/features/practice/logic/__tests__/characterization/inv001-sqlite-upgrade-read.characterization.test.ts: 1`
- `src/features/practice/logic/__tests__/practiceE2E.test.ts: 1`
- `src/features/practice/logic/__tests__/sessionEngine.test.ts: 1`
- `src/features/practice/logic/__tests__/sessionLifecycle.test.ts: 1`
- `src/features/practice/logic/data/__tests__/PracticeRepository.test.ts: 1`
- `src/features/practice/screens/__tests__/PracticeScreen.session.test.tsx: 1`
- `src/features/profile/logic/__tests__/LocalDataDeletionService.test.ts: 2`
- `src/features/profile/screens/__tests__/ProfileScreen.test.tsx: 3`
- `src/features/review/logic/__tests__/FlashcardRepository.test.ts: 1`
- `src/features/review/logic/__tests__/GrammarBookmarkRepository.test.ts: 1`
- `src/features/review/logic/__tests__/offlineReviewQa.test.ts: 1`
- `src/features/review/screens/__tests__/DailyReviewScreen.a11y.test.tsx: 2`
- `src/features/review/screens/__tests__/DailyReviewScreen.test.tsx: 1`
- `src/features/speaking/logic/__tests__/characterization/inv001-sqlite-upgrade-read.characterization.test.ts: 1`
- `src/features/speaking/logic/__tests__/errorNotebookService.test.ts: 1`
- `src/features/speaking/logic/__tests__/speakingModes.test.ts: 1`
- `src/features/speaking/logic/data/__tests__/SpeakingRepository.test.ts: 1`
- `src/features/sync/logic/__tests__/characterization/inv002-practice-outbox-replay.characterization.test.ts: 1`
- `src/features/sync/logic/__tests__/characterization/inv002-real-http-replay.characterization.test.ts: 1`
- `src/features/sync/logic/__tests__/characterization/inv002-review-outbox-replay.characterization.test.ts: 1`
- `src/features/sync/logic/__tests__/findingsVerification.test.ts: 1`
- `src/features/sync/logic/__tests__/offlineSyncResilience.test.ts: 1`
- `src/features/sync/logic/__tests__/outboxDrainFailures.test.ts: 1`
- `src/features/sync/logic/__tests__/outboxSync.test.ts: 1`
- `src/features/sync/logic/__tests__/practiceOutboxSync.test.ts: 1`
- `src/features/sync/logic/__tests__/syncIntegration.test.ts: 1`
- `src/features/sync/logic/__tests__/syncManager.test.ts: 1`
- `src/features/sync/logic/adapters/__tests__/SyncOutboxRepository.test.ts: 1`
- `src/features/today/logic/__tests__/todayAdapter.test.ts: 1`
- `src/features/today/screens/__tests__/TodayScreen.test.tsx: 1`
- `src/features/youtube/logic/data/__tests__/YouTubeLessonRepository.test.ts: 1`
- `src/features/youtube/logic/data/__tests__/YouTubeProgressRepository.test.ts: 1`
- `src/features/youtube/logic/sentence/__tests__/sentencePipeline.integration.test.tsx: 1`
- `src/features/youtube/screens/__tests__/YouTubeLessonScreen.test.tsx: 1`
- `src/features/youtube/screens/__tests__/YouTubeLessonScreenCarouselIntegration.test.tsx: 1`
- `src/test/integration/dogfood/__tests__/selfDogfoodRunner.test.ts: 1`
- `src/test/integration/feature-flag.test.tsx: 1`
- `src/test/integration/flashcard-e2e.test.tsx: 1`
- `src/test/integration/flashcard-edge-cases.test.tsx: 1`
- `src/ui/components/__tests__/FlipCard.a11y.test.tsx: 1`
- `src/ui/components/__tests__/RatingControl.a11y.test.tsx: 1`
- `src/ui/icons/__tests__/materialIconsSubset.test.ts: 2`
- `src/ui/theme/__tests__/contrastCompliance.test.ts: 1`

## Explicit exceptions

- BR-007 fixture exception: the synthetic in-budget sample in
  `scripts/__tests__/check-eslint-warning-budget.test.js:93-113`
  (`it('evaluates correctly using the default WARNING_BUDGET', ...)`)
  feeds 131 `no-bitwise` + 84 `has-accessibility-hint` + 64
  `no-inline-styles` + 1 `no-void` + 1
  `react/no-unstable-nested-components` = 281 synthetic warnings and
  still asserts `expect(result.ok).toBe(true)` with
  `expect(result.summary.totalWarnings).toBe(281)`. This is the single
  permitted fixture edit; no other `expect(` line changed
  (`git diff 0f80f92..0eeead06` shows no changed or deleted `expect(`
  outside that range — AC-003).
- `no-undef-init` ended at 0: budget entry `0`, actual 0 warnings.
  The last `= undefined` initializer
  (`src/features/today/logic/todayAdapter.ts`) was removed by TASK-006
  after proving equivalence; the rule stays in `WARNING_BUDGET` at 0
  as a ratchet.

## Validation evidence (TASK-007 preflight)

All on the docs-only head (base `0eeead06` + 4 docs files; docs cannot
affect code checks — `format:check` covers only
`ts/tsx/js/json`, ESLint covers code, typecheck/tests compile `src`):

- `yarn format:check` — pass ("All matched files use Prettier code
  style!").
- `yarn lint` (ESLint + boundaries + budget) — pass, 0 errors.
- `yarn lint:boundaries` — pass ("zero new violations").
- `yarn lint:budget` — pass (281/281 per rule).
- `yarn typecheck` — pass (`tsc --noEmit`, no output).
- `yarn test --ci --watchman=false` — pass (288 suites passed / 1
  skipped; 2166 tests passed / 1 skipped, matching baseline).
- Not verified: bare `yarn test --ci` crashes in this sandbox
  (Watchman socket error, `Node.js v26.4.0` crash tail) — the known
  environment limit; CI on the exact PR head is the primary evidence.
- Diff audit: `git diff -M --name-status 0eeead06...HEAD` lists exactly
  the four docs files, no `R` entries, zero `src/`/`scripts`/config
  diff (see PR handoff).

## Reproducibility

Recompute every count with, from the repo root on `0eeead06`:

- `./node_modules/.bin/eslint . --format json` → per-rule/file tally
  (warnings = `severity === 1` grouped by `ruleId`; errors =
  `severity === 2`, none).
- `git grep -l -E "'(\.\./){3,}" -- src` (files),
  `git grep -c -E "'(\.\./){3,}" -- src` summed (occurrences).
- `git grep -E "(from |require\()'(\.\./)+(app|core|ui|test|features)/" -- src`
  (must print nothing).
- `git show <merge>:scripts/check-eslint-warning-budget.js | grep -m1
  totalWarnings:` per merge hash in the history table.

