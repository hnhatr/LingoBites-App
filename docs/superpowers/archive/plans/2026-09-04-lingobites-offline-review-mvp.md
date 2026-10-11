# LingoBites Offline Review MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest local-first LingoBites review loop: learners review saved vocabulary cards offline with a two-rating fixed-interval scheduler.

**Architecture:** Keep the existing bare React Native app and preserve the current `src/modules`, `src/shared/db`, `src/release`, `src/components`, and `src/theme` boundaries. Add only the approved MVP dependencies, select the `lingobites-mvp` release config for the MVP build via build-time env (leaving the compile-time `DEFAULT_RELEASE_NAME` unchanged so other builds/QA are not silently affected), gate legacy OCR/AI ingestion behind release config, and verify the already-existing flashcard/review path before polishing UI and QA.

**Tech Stack:** React Native 0.85.3, React 19.2.3, TypeScript 5.8.3, React Navigation 7, `react-native-quick-sqlite`, Jest/RN Testing Library, Fastlane, plus approved additions `react-native-reanimated`, `react-native-gesture-handler`, `i18next`, and `react-i18next`.

**Spec:** Multica SETE-81 description revision 7; architecture source: Multica SETE-82 description revision 15 (changelog v3).

## Global Constraints

- MVP rating model is exactly `remembered | forgot`; do not add `hard`, `good`, or `easy`.
- MVP scheduler is the fixed interval sequence `[1, 3, 7, 14, 30, 60, 120]`; do not implement SM-2 or FSRS.
- Review flow must work offline after lesson and flashcard data already exist locally.
- User-facing strings added or touched during MVP implementation must use `i18next` keys with Vietnamese default copy.
- MVP build must boot with the `lingobites-mvp` release config, activated via a build-specific mechanism (env-driven release selection), not by replacing the compile-time global `DEFAULT_RELEASE_NAME`. Other release configs such as `close-beta-1` keep their default behavior unless the build explicitly selects `lingobites-mvp`.
- Keep `package.json.name`, iOS bundle id, Android application id, and signing metadata unchanged for MVP.
- Do not add Sentry, notifications, audio playback, auth, sync, backend APIs, gamification, marketplace, or new content ingestion UI.
- Do not drop or rewrite existing SQLite tables; schema changes require explicit approval and migration tests.
- Archive legacy docs by moving them under `docs/legacy/`; do not delete historical docs.
- Do not log raw vocabulary, learner text, full lesson text, or AI output from review actions.

---

## File Structure

```text
mobile-app/
  package.json                                      # Modified, approved deps only
  babel.config.js                                   # Modified, reanimated plugin
  tsconfig.json                                     # Verified/adjusted, strict + noUncheckedIndexedAccess + @/* alias
  App.tsx                                           # Modified, i18n provider + env-selected release name
  ios/Podfile.lock                                  # Modified by pod install
  yarn.lock | package-lock.json                     # Modified by package manager
  .env.development                                  # Modified, RELEASE_NAME=lingobites-mvp for MVP build
  docs/
    legacy/                                         # New, archived legacy BA/tech docs
    superpowers/plans/2026-09-04-lingobites-offline-review-mvp.md
  src/
    i18n/
      index.ts                                      # New, i18next bootstrap
      vi.json                                       # New, Vietnamese default copy
      en.json                                       # New, empty/fallback English keys where needed
    release/
      feature-registry.ts                           # Modified, legacy required flags become optional (lessonResultView stays required)
      feature-dependencies.ts                       # Modified, decouple lesson/review flags from OCR/AI ingestion chain
      types.ts                                      # Modified only if FeatureReleaseGroup lacks 'lingobites'
      release-manifest.ts                           # Modified, registers lingobites-mvp; DEFAULT_RELEASE_NAME unchanged
      configs/lingobites-mvp.json                   # New, MVP release flag matrix
      __tests__/validate-release-config.test.ts     # Modified, validates MVP config
    app/navigation/
      AppNavigator.tsx                              # Modified, hides legacy input routes for MVP mode
      types.ts                                      # Modified only if route typing needs a new flag-safe route
    modules/input/
      HomeScreen.tsx                                # Modified, i18n copy and hidden legacy input CTAs
      __tests__/HomeScreenDailyReview.test.tsx      # Modified, flag and due-widget tests
    modules/review/
      DailyReviewScreen.tsx                         # Modified, i18n copy, active recall gating, error behavior
      __tests__/DailyReviewScreen.test.tsx          # Modified, flow tests
      __tests__/DailyReviewScreen.a11y.test.tsx     # Modified, a11y labels from i18n copy
    modules/lesson/
      LessonResultScreen.tsx                        # Modified only if save entry point is incomplete
      SavedLessonDetailScreen.tsx                   # Modified only if saved lesson save state is incomplete
      WordDetailScreen.tsx                          # Modified only if save state is incomplete
      __tests__/LessonResultScreen.flashcards.test.tsx
      __tests__/SavedLessonDetailScreen.test.tsx
      __tests__/WordDetailScreen.test.tsx           # New, save-from-word-detail coverage
    shared/db/
      reviewScheduler.ts                            # Modified only for verified scheduler bug
      FlashcardRepository.ts                        # Modified only for verified persistence bug
      __tests__/reviewScheduler.test.ts             # Modified, full interval contract coverage
      __tests__/FlashcardRepository.test.ts         # Modified, save/rating/history coverage
    shared/errors/
      index.ts                                      # Modified only if privacy-safe debug logging needs a wrapper
```

## Task 1: Install Approved Runtime Dependencies

**Files:**

- Modify: `mobile-app/package.json`
- Modify: `mobile-app/babel.config.js`
- Modify: `mobile-app/ios/Podfile.lock`
- Modify: lockfile used by the repo package manager
- Verify/adjust: `mobile-app/tsconfig.json`

**Interfaces:**

- Consumes: existing RN 0.85.3 app.
- Produces: installed packages importable by later tasks:

  - `react-native-reanimated`
  - `react-native-gesture-handler`
  - `i18next`
  - `react-i18next`

- [ ] **Step 1: Verify TypeScript strictness and path alias**

SETE-82 Stage 0 requires the compiler to run in strict mode. From `mobile-app`, confirm `tsconfig.json` enables `strict` and `noUncheckedIndexedAccess` (inherited from the RN base config counts). If `noUncheckedIndexedAccess` is not enabled, add it explicitly. If no path alias exists yet, add `@/* → ./src/*` to `compilerOptions.paths`; keep it aligned with the Metro/`babel.config.js` resolver so runtime and type resolution agree. Record the final state in the commit message.

- [ ] **Step 2: Add dependency install test**

Run from `mobile-app`:

```bash
node -e "const pkg=require('./package.json'); for (const name of ['react-native-reanimated','react-native-gesture-handler','i18next','react-i18next']) { if (!pkg.dependencies[name]) throw new Error(`${name} missing`); }"
```

Expected before install: FAIL with the first missing package name.

- [ ] **Step 3: Install approved dependencies**

Use the repo's current package manager. If both lockfiles exist, inspect recent commit/worktree convention before choosing.

```bash
npm install react-native-reanimated react-native-gesture-handler i18next react-i18next
```

- [ ] **Step 4: Configure Reanimated Babel plugin**

Update `babel.config.js` to:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

- [ ] **Step 5: Install iOS pods**

Run:

```bash
npm run pod
```

- [ ] **Step 6: Verify dependency imports and package metadata**

Run:

```bash
node -e "for (const name of ['react-native-reanimated','react-native-gesture-handler','i18next','react-i18next']) require.resolve(name); console.log('ok')"
npx tsc --noEmit
npm test -- --runInBand src/release/__tests__/validate-release-config.test.ts
```

Expected: dependency resolution passes, TypeScript type-checks under strict mode, and existing tests may still fail only where old required-flag assumptions are changed in Task 3.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json yarn.lock babel.config.js ios/Podfile.lock tsconfig.json
git commit -m "chore: add LingoBites MVP runtime dependencies"
```

## Task 2: Add i18n Bootstrap and Vietnamese Copy

**Files:**

- Create: `mobile-app/src/i18n/index.ts`
- Create: `mobile-app/src/i18n/vi.json`
- Create: `mobile-app/src/i18n/en.json`
- Modify: `mobile-app/App.tsx`

**Interfaces:**

- Consumes: `i18next`, `react-i18next`.
- Produces: `i18n` initialized before app screens render; `useTranslation()` available in screens and components.

- [ ] **Step 1: Write i18n initialization test**

Create `src/i18n/__tests__/i18n.test.ts`:

```ts
import i18n from '../index';

describe('i18n', () => {
  it('uses Vietnamese as the default language', () => {
    expect(i18n.language).toBe('vi');
    expect(i18n.t('app.name')).toBe('LingoBites');
  });
});
```

Run:

```bash
npm test -- src/i18n/__tests__/i18n.test.ts --runInBand
```

Expected before implementation: FAIL because `src/i18n/index.ts` does not exist.

- [ ] **Step 2: Create translation resources**

Create `src/i18n/vi.json`:

```json
{
  "app": {
    "name": "LingoBites"
  },
  "home": {
    "settingsA11y": "Cài đặt",
    "title": "Hôm nay bạn ôn gì?",
    "subtitle": "Ôn lại những từ bạn đã lưu từ bài học có sẵn.",
    "legacyTitle": "Hôm nay bạn muốn học từ đâu?",
    "legacySubtitle": "Chọn cách để lấy từ vựng từ bất cứ đoạn text nào bạn đọc.",
    "reviewWidgetA11y": "Mở ôn tập hôm nay",
    "reviewTitle": "Ôn tập hôm nay",
    "dueCount": "{{count}} thẻ đến hạn hôm nay",
    "recentLessons": "Bài học gần đây",
    "viewAllLessons": "Xem tất cả bài học",
    "emptyLessons": "Chưa có bài học đã lưu.",
    "mvpEmptyTitle": "Chưa có bài học để ôn",
    "mvpEmptyCopy": "Bản MVP dùng bài học đã lưu sẵn. Hãy thêm dữ liệu fixture trong dev/QA hoặc dùng bài học đã có trên thiết bị."
  },
  "review": {
    "disabled": "Tính năng ôn tập hiện chưa được bật.",
    "closeA11y": "Đóng phiên ôn tập",
    "todayTitle": "Ôn tập hôm nay",
    "noCardsTitle": "Chưa có flashcard",
    "noCardsCopy": "Lưu flashcard đầu tiên để bắt đầu ôn mỗi ngày.",
    "completeTitle": "Hoàn thành hôm nay",
    "completeCopy": "Bạn đã ôn xong tất cả thẻ đến hạn hôm nay.",
    "summaryTitle": "Tổng kết ôn tập",
    "carryOver": "còn {{count}} thẻ để dành lần ôn sau",
    "reviewed": "Đã ôn",
    "remembered": "Đã nhớ",
    "forgot": "Chưa nhớ",
    "backHome": "Quay về Home",
    "backHomeA11y": "Quay về Home"
  },
  "rating": {
    "forgot": "Quên",
    "remembered": "Nhớ",
    "skip": "Bỏ qua",
    "forgotA11y": "Không nhớ - ôn lại sau 1 ngày",
    "rememberedA11y": "Đã nhớ - lên lịch ôn sau",
    "skipA11y": "Bỏ qua thẻ này"
  }
}
```

Create `src/i18n/en.json` with matching top-level keys and English values where available. Keep it valid JSON even if English is not surfaced in MVP.

- [ ] **Step 3: Initialize i18next**

Create `src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './en.json';
import vi from './vi.json';

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'vi',
  interpolation: {escapeValue: false},
  lng: 'vi',
  resources: {
    en: {translation: en},
    vi: {translation: vi},
  },
});

export default i18n;
```

- [ ] **Step 4: Ensure i18n loads before rendering**

Modify `App.tsx`:

```ts
import './src/i18n';
```

Place the import before screen imports so translations initialize once at app startup.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/i18n/__tests__/i18n.test.ts --runInBand
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/i18n
git commit -m "feat: initialize Vietnamese i18n"
```

## Task 3: Create and Activate LingoBites MVP Release Config

**Files:**

- Modify: `mobile-app/src/release/feature-registry.ts`
- Modify: `mobile-app/src/release/feature-dependencies.ts` (only if a dependency edge blocks `lingobites-mvp` validation; see Step 2 note)
- Modify: `mobile-app/src/release/release-manifest.ts`
- Modify: `mobile-app/src/release/types.ts` (add `'lingobites'` to `FeatureReleaseGroup` if not present)
- Create: `mobile-app/src/release/configs/lingobites-mvp.json`
- Modify: `mobile-app/src/release/__tests__/validate-release-config.test.ts`
- Modify: `mobile-app/App.tsx` (pass env-selected release name to `FeatureFlagProvider`)
- Modify: `mobile-app/.env.development` (and any other env file used by the MVP build) with `RELEASE_NAME=lingobites-mvp`

**Interfaces:**

- Consumes: existing `FeatureFlagProvider`, `useFeatureEnabled()`, and release config validation.
- Produces: release config named `lingobites-mvp` with review enabled and legacy ingestion disabled, activated for the MVP build through build-time env selection. The compile-time `DEFAULT_RELEASE_NAME` is left unchanged; only the MVP build's env opts in to `lingobites-mvp`.

- [ ] **Step 1: Write failing release validation test**

Add to `validate-release-config.test.ts`:

```ts
it('accepts lingobites-mvp preset with review enabled and legacy ingestion disabled', () => {
  const config = getReleaseConfig('lingobites-mvp');
  const result = validateReleaseConfig(
    config,
    featureRegistry,
    featureDependencies,
  );

  expect(result.valid).toBe(true);
  expect(config.features.reviewSystem).toBe(true);
  expect(config.features.lingobitesMvpReviewFlow).toBe(true);
  expect(config.features.lessonResultView).toBe(true);
  expect(config.features.pasteTextInput).toBe(false);
  expect(config.features.imageInput).toBe(false);
  expect(config.features.ocrScanner).toBe(false);
  expect(config.features.aiLessonAnalysis).toBe(false);
});
```

Run:

```bash
npm test -- src/release/__tests__/validate-release-config.test.ts --runInBand
```

Expected before implementation: FAIL because `lingobites-mvp` is unknown and legacy flags are required.

Also add:

```ts
it('keeps the compile-time default release unchanged and activates lingobites-mvp only via env selection', () => {
  expect(DEFAULT_RELEASE_NAME).not.toBe('lingobites-mvp');
  expect(getReleaseConfig().releaseName).toBe(DEFAULT_RELEASE_NAME);
  const envSelected = getReleaseConfig('lingobites-mvp');
  expect(envSelected.releaseName).toBe('lingobites-mvp');
});
```

Import `DEFAULT_RELEASE_NAME` from `release-manifest.ts`. Expected before implementation: FAIL because `lingobites-mvp` is not yet registered in the manifest.

- [ ] **Step 2: Make release-controlled foundation flags optional**

In `feature-registry.ts`, set these entries to `required: false` (the seven flags listed in SETE-82; do not include `lessonResultView`):

```ts
pasteTextInput;
imageInput;
ocrScanner;
ocrReviewEdit;
aiLessonAnalysis;
lessonSave;
lessonHistory;
```

`lessonResultView` stays `required: true` per SETE-82; the MVP config keeps `lessonResultView: true` because saved lesson detail and vocabulary save are part of the MVP path. Do not relax its `required` flag without separate requester approval.

Add one new feature key, with `releaseGroup: 'lingobites'` matching SETE-82 (not `'practice'`):

```ts
{
  key: 'lingobitesMvpReviewFlow',
  module: 'release/lingobites-mvp',
  required: false,
  releaseGroup: 'lingobites',
  description: 'Local-first LingoBites MVP review flow.',
}
```

If `FeatureReleaseGroup` in `types.ts` does not yet include `'lingobites'`, add it to the union so the registry entry type-checks.

> **Dependency decoupling note:** `feature-dependencies.ts` currently chains `pasteTextInput → aiLessonAnalysis → lessonResultView → lessonSave → lessonHistory` and `reviewSystem → lessonSave`. The MVP config disables `pasteTextInput`/`aiLessonAnalysis`/`imageInput`/`ocrScanner` while enabling `lessonResultView`/`lessonSave`/`lessonHistory`/`reviewSystem`, so the config will FAIL `validateReleaseConfig` unless these dependency edges are redefined for the saved-lesson path. Adjust `feature-dependencies.ts` so the lesson/review flags do not require the OCR/AI/paste ingestion flags (e.g., `lessonResultView` and downstream flags no longer depend on `aiLessonAnalysis`). Verify with the Step 1 validation test before moving on.

- [ ] **Step 3: Create release config**

Create `src/release/configs/lingobites-mvp.json` with every registry key present:

```json
{
  "releaseName": "lingobites-mvp",
  "description": "Local-first review MVP using existing saved lessons and flashcards.",
  "features": {
    "pasteTextInput": false,
    "imageInput": false,
    "ocrScanner": false,
    "ocrReviewEdit": false,
    "aiLessonAnalysis": false,
    "lessonResultView": true,
    "lessonSave": true,
    "lessonHistory": true,
    "shortPractice": false,
    "pronunciationSupport": false,
    "themeSystem": true,
    "themeSwitcher": false,
    "darkTheme": true,
    "pastelKidsTheme": false,
    "coreTheme": true,
    "neoTheme": false,
    "comicTheme": false,
    "cartoonTheme": false,
    "reviewSystem": true,
    "miniGame": false,
    "wordMatchGame": false,
    "fillBlankGame": false,
    "tenseQuizGame": false,
    "sentenceOrderGame": false,
    "flashcardChallenge": false,
    "situationLearning": false,
    "dialogueGenerator": false,
    "phraseExtractor": false,
    "situationPractice": false,
    "lingobitesMvpReviewFlow": true
  }
}
```

- [ ] **Step 4: Register config in manifest and activate via env selection**

Modify `release-manifest.ts` using the existing JSON import pattern so `getReleaseConfig('lingobites-mvp')` returns the new config. Do NOT change the value of `DEFAULT_RELEASE_NAME`:

```ts
import lingobitesMvp from './configs/lingobites-mvp.json';

// DEFAULT_RELEASE_NAME stays unchanged (e.g. 'close-beta-1').

export type ReleaseConfigName =
  | 'close-beta-1'
  | 'theme-release'
  | 'mini-game-release'
  | 'situation-learning-release'
  | 'lingobites-mvp';

const releaseConfigs: Record<ReleaseConfigName, ReleaseConfig> = {
  'close-beta-1': closeBeta1 as ReleaseConfig,
  'theme-release': themeRelease as ReleaseConfig,
  'mini-game-release': miniGameRelease as ReleaseConfig,
  'situation-learning-release': situationLearningRelease as ReleaseConfig,
  'lingobites-mvp': lingobitesMvp as ReleaseConfig,
};
```

Activate `lingobites-mvp` only for the MVP build through build-time env selection:

- Add `RELEASE_NAME=lingobites-mvp` to the env file used by the MVP build (`.env.development` by default), not to env files used by other builds/QA.
- In `App.tsx`, read the env value and pass it to `FeatureFlagProvider`:

```tsx
import Config from 'react-native-config';
import {
  DEFAULT_RELEASE_NAME,
  type ReleaseConfigName,
} from './src/release/release-manifest';

const envReleaseName = Config.RELEASE_NAME as ReleaseConfigName | undefined;
const releaseName = envReleaseName ?? DEFAULT_RELEASE_NAME;

<FeatureFlagProvider releaseName={releaseName}>
```

This scopes the activation to the MVP build and keeps `close-beta-1` (and every other config) as the default for any build that does not set `RELEASE_NAME`. Do not hardcode a new global default in this task; that would change behavior for unrelated builds/QA beyond the approved SETE-82 scope.

- [ ] **Step 5: Update old required-feature test**

The existing "rejects when a required feature is disabled" test currently disables `lessonSave`, which this task makes optional. Retarget it to `lessonResultView` (which stays `required: true`) so the test keeps proving that a required feature cannot be disabled. If a different feature remains required after this pivot, use that one instead.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/release/__tests__/validate-release-config.test.ts --runInBand
npm test -- src/__tests__/feature-flag.test.tsx --runInBand
npm run lint
```

Confirm the MVP build (env `RELEASE_NAME=lingobites-mvp`) boots with the `lingobites-mvp` config and that a build without that env var still uses `DEFAULT_RELEASE_NAME`.

- [ ] **Step 7: Commit**

```bash
git add src/release App.tsx .env.development
git commit -m "feat: add LingoBites MVP release config"
```

## Task 4: Hide Legacy Ingestion Routes and CTAs in MVP Mode

**Files:**

- Modify: `mobile-app/src/app/navigation/AppNavigator.tsx`
- Modify: `mobile-app/src/app/navigation/types.ts`
- Modify: `mobile-app/src/modules/input/HomeScreen.tsx`
- Modify: `mobile-app/src/modules/input/__tests__/HomeScreenDailyReview.test.tsx`

**Interfaces:**

- Consumes: `useFeatureEnabled('lingobitesMvpReviewFlow')`, `useFeatureEnabled('pasteTextInput')`, `useFeatureEnabled('imageInput')`, `useFeatureEnabled('ocrScanner')`.
- Produces: MVP UI that shows review and saved lessons, while not offering OCR/image/paste content ingestion.

- [ ] **Step 1: Write failing Home CTA test**

In `HomeScreenDailyReview.test.tsx`, add a case using the project’s existing feature-flag test wrapper:

```tsx
it('hides legacy input CTAs when lingobites MVP mode is enabled', () => {
  renderHomeScreen({
    features: {
      lingobitesMvpReviewFlow: true,
      pasteTextInput: false,
      imageInput: false,
      ocrScanner: false,
      reviewSystem: true,
    },
  });

  expect(screen.queryByText('Chụp ảnh học ngay')).toBeNull();
  expect(screen.queryByText('Upload ảnh')).toBeNull();
  expect(screen.queryByText('Dán text')).toBeNull();
});
```

Run:

```bash
npm test -- src/modules/input/__tests__/HomeScreenDailyReview.test.tsx --runInBand
```

Expected before implementation: FAIL because legacy CTAs are always rendered.

- [ ] **Step 2: Gate legacy input screens in navigation**

In `AppNavigator.tsx`, read MVP and legacy flags inside `HomeStackNavigator()`:

```tsx
const lingobitesMvp = useFeatureEnabled('lingobitesMvpReviewFlow');
const pasteEnabled = useFeatureEnabled('pasteTextInput') && !lingobitesMvp;
const imageEnabled = useFeatureEnabled('imageInput') && !lingobitesMvp;
const ocrEnabled = useFeatureEnabled('ocrScanner') && !lingobitesMvp;
```

Render `PasteText`, `ImageCapture`, `OCRReview`, and `Analyzing` screens only when their corresponding flag is enabled. Keep `LessonResult`, `SavedLessonDetail`, `FlashcardList`, `DailyReview`, and detail screens mounted.

- [ ] **Step 3: Audit route callers before hiding screens**

Search for navigation calls to hidden legacy routes:

```bash
rg -n "navigate\\(('PasteText'|'ImageCapture'|'OCRReview'|'Analyzing')" src
```

Expected for MVP after edits: only guarded calls remain. If another path can still navigate to a hidden route, gate that caller behind the same feature flags or leave the screen mounted but unreachable only after proving there is no `route not found` path.

- [ ] **Step 4: Gate Home CTAs**

In `HomeScreen.tsx`, read the same flags:

```tsx
const lingobitesMvp = useFeatureEnabled('lingobitesMvpReviewFlow');
const showImageInput = useFeatureEnabled('imageInput') && !lingobitesMvp;
const showPasteInput = useFeatureEnabled('pasteTextInput') && !lingobitesMvp;
```

Only render camera/gallery CTAs when `showImageInput` is true. Only render paste CTA when `showPasteInput` is true. When both are false, keep the Home page focused on Daily Review and recent lessons.

- [ ] **Step 5: Replace MVP Home copy and empty state**

When `lingobitesMvp` is true, replace the ingestion-oriented title/subtitle with review-oriented copy:

```tsx
const {t} = useTranslation();
const title = lingobitesMvp ? t('home.title') : t('home.legacyTitle');
const subtitle = lingobitesMvp ? t('home.subtitle') : t('home.legacySubtitle');
```

When there are no recent lessons and no due review cards in MVP mode, render explicit copy explaining that the MVP uses existing local lessons:

```tsx
{
  lingobitesMvp && emptyRecent && dueReviewCount === 0 ? (
    <View testID="lingobites-mvp-empty-state">
      <AppText variant="h3">{t('home.mvpEmptyTitle')}</AppText>
      <AppText color="secondary">{t('home.mvpEmptyCopy')}</AppText>
    </View>
  ) : null;
}
```

Also replace touched Home strings with i18n keys:

```tsx
t('home.reviewTitle');
t('home.dueCount', {count: dueReviewCount});
t('home.mvpEmptyTitle');
t('home.mvpEmptyCopy');
```

- [ ] **Step 6: Add Home copy tests**

Add assertions:

```tsx
expect(screen.getByText('Hôm nay bạn ôn gì?')).toBeTruthy();
expect(screen.getByTestId('lingobites-mvp-empty-state')).toBeTruthy();
expect(
  screen.getByText(
    'Bản MVP dùng bài học đã lưu sẵn. Hãy thêm dữ liệu fixture trong dev/QA hoặc dùng bài học đã có trên thiết bị.',
  ),
).toBeTruthy();
```

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- src/modules/input/__tests__/HomeScreenDailyReview.test.tsx --runInBand
npm test -- src/__tests__/feature-flag.test.tsx --runInBand
rg -n "navigate\\(('PasteText'|'ImageCapture'|'OCRReview'|'Analyzing')" src
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/app/navigation src/modules/input src/i18n
git commit -m "feat: gate legacy input in LingoBites MVP"
```

## Task 5: Lock Scheduler and Persistence Contracts

**Files:**

- Modify: `mobile-app/src/shared/db/__tests__/reviewScheduler.test.ts`
- Modify: `mobile-app/src/shared/db/__tests__/FlashcardRepository.test.ts`
- Modify: `mobile-app/src/shared/db/reviewScheduler.ts` only if a test exposes a scheduler bug
- Modify: `mobile-app/src/shared/db/FlashcardRepository.ts` only if a test exposes a persistence bug

**Interfaces:**

- Consumes: `calculateNextReviewState()`, `saveFlashcard()`, `getDueFlashcards()`, `recordFlashcardRating()`.
- Produces: verified MVP contracts for SETE-81 FR-001 through FR-003 and FR-007 through FR-011.

- [ ] **Step 1: Add full interval progression test**

Add to `reviewScheduler.test.ts`:

```ts
it.each([
  [1, 3],
  [3, 7],
  [7, 14],
  [14, 30],
  [30, 60],
  [60, 120],
  [120, 120],
])('advances remembered interval from %s to %s days', (current, expected) => {
  const result = calculateNextReviewState({
    rating: 'remembered',
    currentIntervalDays: current,
    reviewedAt: '2026-08-17T12:00:00.000Z',
  });

  expect(result.intervalDays).toBe(expected);
});
```

- [ ] **Step 2: Add duplicate save test**

Add to `FlashcardRepository.test.ts`:

```ts
it('does not duplicate or reset schedule when saving the same vocabulary twice', () => {
  const lessonId = saveFixtureLesson();
  const first = saveFlashcard({
    lessonId,
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-08-17T00:00:00.000Z',
  });
  const second = saveFlashcard({
    lessonId,
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-08-18T00:00:00.000Z',
  });

  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (!first.ok || !second.ok) return;
  expect(second.duplicate).toBe(true);
  expect(second.flashcardId).toBe(first.flashcardId);
  expect(listFlashcards({lessonId})).toHaveLength(1);
});
```

- [ ] **Step 3: Add forgot rating persistence test**

Add:

```ts
it('records forgot rating and keeps the card due tomorrow', () => {
  const lessonId = saveFixtureLesson();
  const saved = saveFlashcard({
    lessonId,
    vocabulary: validFullOutput.vocabulary[0],
    now: '2026-08-17T00:00:00.000Z',
  });
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;

  const result = recordFlashcardRating({
    flashcardId: saved.flashcardId,
    rating: 'forgot',
    reviewedAt: '2026-08-17T12:00:00.000Z',
  });

  expect(result).toMatchObject({
    ok: true,
    intervalDays: 1,
    nextReviewAt: '2026-08-18T12:00:00.000Z',
  });
  expect(getDueFlashcards({today: '2026-08-17T23:59:00.000Z'})).toHaveLength(0);
  expect(getDueFlashcards({today: '2026-08-18T00:00:00.000Z'})).toHaveLength(1);
});
```

- [ ] **Step 4: Add missing-card error test**

Add:

```ts
it('returns FLASHCARD_NOT_FOUND when rating a card without a schedule', () => {
  const result = recordFlashcardRating({
    flashcardId: 'missing-card',
    rating: 'remembered',
    reviewedAt: '2026-08-17T12:00:00.000Z',
  });

  expect(result).toMatchObject({
    ok: false,
    errorCode: 'FLASHCARD_NOT_FOUND',
  });
});
```

- [ ] **Step 5: Fix only verified bugs**

If tests fail, make the smallest repository/scheduler change that preserves the existing schema and two-rating model. Do not change migrations unless explicitly approved.

- [ ] **Step 6: Verify**

Run:

```bash
npm test -- src/shared/db/__tests__/reviewScheduler.test.ts --runInBand
npm test -- src/shared/db/__tests__/FlashcardRepository.test.ts --runInBand
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/db
git commit -m "test: lock offline review persistence contracts"
```

## Task 6: Polish Daily Review Flow

**Files:**

- Modify: `mobile-app/src/modules/review/DailyReviewScreen.tsx`
- Modify: `mobile-app/src/modules/review/__tests__/DailyReviewScreen.test.tsx`
- Modify: `mobile-app/src/modules/review/__tests__/DailyReviewScreen.a11y.test.tsx`
- Modify: `mobile-app/src/components/RatingControl.tsx` only if rating labels/a11y are missing

**Interfaces:**

- Consumes: `getDueFlashcards({limit})`, `recordFlashcardRating()`, `ReviewRating`.
- Produces: active-recall review session with Vietnamese i18n copy, two ratings, summary, carry-over, empty states, and privacy-safe error display.

- [ ] **Step 1: Write active recall gating test**

In `DailyReviewScreen.test.tsx`, assert rating controls are disabled or hidden before reveal:

```tsx
it('requires reveal before rating a due card', () => {
  seedDueFlashcards(1);
  renderDailyReviewScreen();

  expect(screen.getByTestId('daily-review-flip-card')).toBeTruthy();
  expect(screen.getByLabelText('Không nhớ - ôn lại sau 1 ngày')).toBeDisabled();
  expect(screen.getByLabelText('Đã nhớ - lên lịch ôn sau')).toBeDisabled();

  fireEvent.press(screen.getByTestId('daily-review-flip-card'));

  expect(screen.getByLabelText('Không nhớ - ôn lại sau 1 ngày')).toBeEnabled();
  expect(screen.getByLabelText('Đã nhớ - lên lịch ôn sau')).toBeEnabled();
});
```

- [ ] **Step 2: Write summary and carry-over tests**

Add tests for:

```tsx
expect(screen.getByTestId('summary-reviewed-count')).toHaveTextContent('2');
expect(screen.getByTestId('summary-remembered-count')).toHaveTextContent('1');
expect(screen.getByTestId('summary-forgot-count')).toHaveTextContent('1');
expect(screen.getByText('còn 1 thẻ để dành lần ôn sau')).toBeTruthy();
```

- [ ] **Step 3: Write empty-state distinction tests**

Add tests for:

```tsx
expect(screen.getByText('Chưa có flashcard')).toBeTruthy();
expect(screen.getByText('Hoàn thành hôm nay')).toBeTruthy();
```

Use separate test data setup: zero saved cards for the first assertion; saved card with future `next_review_at` for the second.

- [ ] **Step 4: Migrate Daily Review copy to i18n**

Use:

```tsx
const {t} = useTranslation();
t('review.todayTitle');
t('review.noCardsTitle');
t('review.completeTitle');
t('review.summaryTitle');
t('review.carryOver', {count: carryOverCount});
t('rating.forgotA11y');
t('rating.rememberedA11y');
```

- [ ] **Step 5: Gate rating after reveal**

Pass disabled state into `RatingControl`:

```tsx
<RatingControl disabled={!flipped} onRate={handleRate} onSkip={handleSkip} />
```

If `RatingControl` does not support `disabled`, add `disabled?: boolean` and apply it to the rating buttons while leaving skip behavior unchanged.

- [ ] **Step 6: Fix error advance behavior**

If `recordFlashcardRating()` returns `{ok: false}`, show `result.message` and keep the active card in place. Do not call `finishNext(nextSummary)` on failed persistence.

Implementation shape:

```ts
if (!result.ok) {
  setRatingError(result.message);
  return;
}
finishNext(nextSummary);
```

- [ ] **Step 7: Verify**

Run:

```bash
npm test -- src/modules/review/__tests__/DailyReviewScreen.test.tsx --runInBand
npm test -- src/modules/review/__tests__/DailyReviewScreen.a11y.test.tsx --runInBand
npm test -- src/components/__tests__/RatingControl.a11y.test.tsx --runInBand
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/modules/review src/components src/i18n
git commit -m "feat: polish offline daily review flow"
```

## Task 7: Verify Save-From-Lesson Entry Point

**Files:**

- Modify: `mobile-app/src/modules/lesson/LessonResultScreen.tsx` only if save entry is incomplete
- Modify: `mobile-app/src/modules/lesson/SavedLessonDetailScreen.tsx` only if save state is incomplete
- Modify: `mobile-app/src/modules/lesson/WordDetailScreen.tsx` only if save state is incomplete
- Modify: `mobile-app/src/modules/lesson/__tests__/LessonResultScreen.flashcards.test.tsx`
- Modify: `mobile-app/src/modules/lesson/__tests__/SavedLessonDetailScreen.test.tsx`
- Add/modify: `mobile-app/src/modules/lesson/__tests__/WordDetailScreen.test.tsx`

**Interfaces:**

- Consumes: `saveFlashcard({lessonId, vocabulary})`.
- Produces: idempotent vocabulary save path from existing local lessons across all three save entry points (lesson result, saved lesson detail, and word detail).

- [ ] **Step 1: Add save idempotency UI test**

Add a test that opens a lesson with one vocabulary item, presses save twice, and verifies saved state remains stable:

```tsx
fireEvent.press(screen.getByLabelText('Lưu flashcard'));
fireEvent.press(screen.getByLabelText('Đã lưu flashcard'));

expect(screen.getByText('Đã lưu')).toBeTruthy();
expect(listFlashcards({lessonId})).toHaveLength(1);
```

- [ ] **Step 2: Add existing lesson requirement test**

Verify the flow starts from saved/local lesson data and does not depend on network mocks:

```tsx
expect(mockFetch).not.toHaveBeenCalled();
expect(screen.getByText(validFullOutput.vocabulary[0].word)).toBeTruthy();
```

- [ ] **Step 3: Extend save verification to WordDetailScreen**

`WordDetailScreen.tsx` is a first-class save entry point in SETE-82 (same group as `LessonResultScreen`/`SavedLessonDetailScreen`). Add a `WordDetailScreen.test.tsx` case that renders a vocabulary word from a saved lesson, presses the save control (`Lưu từ` label / the flashcard save affordance in `WordDetailScreen`), presses it again, and asserts:

- a single flashcard row exists for `(lessonId, vocabularyId)` (no duplicate);
- saved state is reflected in the UI after the second press;
- `mockFetch` was not called.

```tsx
fireEvent.press(screen.getByLabelText('Lưu từ'));
fireEvent.press(screen.getByLabelText('Đã lưu'));

expect(listFlashcards({lessonId})).toHaveLength(1);
expect(mockFetch).not.toHaveBeenCalled();
```

Match the exact accessibility label used in `WordDetailScreen.tsx`; if the label differs, update the assertion to the actual label.

- [ ] **Step 4: Fix save state only if needed**

If the test exposes a bug, ensure the UI calls:

```ts
saveFlashcard({lessonId, vocabulary});
```

Then render saved state from `listFlashcards({lessonId})` or an equivalent existing selector.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- src/modules/lesson/__tests__/LessonResultScreen.flashcards.test.tsx --runInBand
npm test -- src/modules/lesson/__tests__/SavedLessonDetailScreen.test.tsx --runInBand
npm test -- src/modules/lesson/__tests__/WordDetailScreen.test.tsx --runInBand
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/lesson src/shared/db
git commit -m "test: verify lesson vocabulary save flow"
```

## Task 8: Archive Legacy Docs Without Deleting History

**Files:**

- Create: `mobile-app/docs/legacy/`
- Move: legacy ScanLearnEnglish BA/technical docs currently under `mobile-app/docs/01-ba/`
- Modify: `mobile-app/docs/README.md`
- Mark deprecated (comment header only): `.cursorrules`, `.opencode.json`, `GEMINI.md`, `QODER.md`

**Interfaces:**

- Consumes: existing docs tree.
- Produces: clear separation between legacy ScanLearnEnglish docs and current LingoBites MVP plan, and one canonical agent-config convention.

- [ ] **Step 1: Identify docs to archive**

Run:

```bash
find docs/01-ba -maxdepth 2 -type f | sort
```

Archive the old ScanLearnEnglish Phase 0-M5 docs unless a file is directly referenced by the new LingoBites MVP plan.

- [ ] **Step 2: Move docs**

Run from `mobile-app`:

```bash
mkdir -p docs/legacy
git mv docs/01-ba docs/legacy/01-ba
```

- [ ] **Step 3: Mark deprecated multi-agent config files**

SETE-82 chooses `CLAUDE.md` + `AGENTS.md` as the canonical agent instruction files. Mark the others deprecated without deleting content:

- `GEMINI.md`, `QODER.md`, `.cursorrules`: add an HTML comment header `<!-- DEPRECATED: superseded by CLAUDE.md and AGENTS.md. Kept for reference only. -->` at the top.
- `.opencode.json`: add a top-level metadata key instead of a comment (JSON has no comments), e.g. `"_deprecated": "Superseded by CLAUDE.md and AGENTS.md. Kept for reference only."`, and confirm the file still parses as valid JSON for the tooling that reads it.

- [ ] **Step 4: Update docs index**

Update `docs/README.md` with:

```md
## Current Planning

- `docs/superpowers/plans/2026-09-04-lingobites-offline-review-mvp.md` is the current implementation plan for the LingoBites offline review MVP.

## Legacy

- `docs/legacy/01-ba/` contains historical ScanLearnEnglish planning material retained for reference. It is not the source of scope for the LingoBites MVP.
```

- [ ] **Step 5: Verify links and git move**

Run:

```bash
git status --short docs
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add docs .cursorrules .opencode.json GEMINI.md QODER.md
git commit -m "docs: archive legacy ScanLearnEnglish planning"
```

## Task 9: Offline Manual QA and Release Acceptance

**Files:**

- Modify: `mobile-app/docs/01-ba/05-qa/02-p0-manual-qa-runbook.md` if not archived yet
- Or create: `mobile-app/docs/qa/lingobites-offline-review-mvp.md`

**Interfaces:**

- Consumes: emulator/simulator with local lesson data.
- Produces: documented QA evidence for SETE-81 NFR-001, NFR-002, NFR-003, and NFR-005.

- [ ] **Step 1: Create QA checklist**

Create `docs/qa/lingobites-offline-review-mvp.md`:

```md
# LingoBites Offline Review MVP QA

## Setup

- Build: development (boots `lingobites-mvp` via `RELEASE_NAME=lingobites-mvp`)
- Release config: lingobites-mvp
- Device: iOS simulator and Android emulator
- Local data: at least one saved lesson with two saved flashcards

## Checks

- Home shows Daily Review count when cards are due.
- Legacy OCR/image/paste CTAs are hidden in MVP mode.
- Airplane mode is enabled after local data exists.
- Daily Review opens without network.
- Card front appears before answer.
- Rating is available only after reveal.
- `Quên` schedules next review for the next day.
- `Nhớ` advances to the next fixed interval.
- Summary shows reviewed, remembered, and forgot counts.
- Restarting the app preserves flashcards and review schedule.
- No raw vocabulary or lesson text appears in app logs from review actions.
- NFR-003: with ~1,000 saved/due cards seeded, the Home due-count query/UI renders without visible UI blocking (manual timing check; record observed behavior).
```

- [ ] **Step 2: Run automated verification**

Run from `mobile-app`:

```bash
npm test -- src/shared/db/__tests__/reviewScheduler.test.ts --runInBand
npm test -- src/shared/db/__tests__/FlashcardRepository.test.ts --runInBand
npm test -- src/modules/input/__tests__/HomeScreenDailyReview.test.tsx --runInBand
npm test -- src/modules/review/__tests__/DailyReviewScreen.test.tsx --runInBand
npm test -- src/modules/review/__tests__/DailyReviewScreen.a11y.test.tsx --runInBand
npm test -- src/release/__tests__/validate-release-config.test.ts --runInBand
npm run lint
```

- [ ] **Step 3: Run native smoke builds**

Run:

```bash
npm run android:dev
npm run ios:dev
```

If local simulator/device setup blocks native runs, record the exact blocker in the issue comment and keep automated results separate from manual QA status.

- [ ] **Step 4: Complete manual offline QA**

Follow the checklist created in Step 1 on both platforms where available. Capture result as:

```md
## Result

- iOS: pass/fail/not run, device, date, blocker if any
- Android: pass/fail/not run, device, date, blocker if any
- Automated tests: pass/fail, command summary
- Residual risks: list any unverified native paths
```

- [ ] **Step 5: Commit**

```bash
git add docs/qa
git commit -m "docs: add offline review MVP QA checklist"
```

## Rollout and Definition of Done

The implementation is done when:

- The MVP build boots with the `lingobites-mvp` release config via build-time env selection (`RELEASE_NAME=lingobites-mvp`); the compile-time `DEFAULT_RELEASE_NAME` is unchanged for other builds/QA.
- `lingobites-mvp` release config validates.
- Legacy OCR/image/paste entry points are hidden in MVP mode without deleting code.
- Hidden legacy routes have no unguarded navigation callers that can trigger a `route not found` crash.
- MVP Home empty state explains that this build relies on existing local lessons/fixtures.
- Home shows due review count only when `reviewSystem` is enabled and due cards exist.
- Daily Review supports front-first active recall, reveal, two ratings, skip, summary, carry-over, no-card, and no-due states.
- Rating write failure does not silently advance the session.
- Save-from-lesson is idempotent and does not reset existing schedules, and is verified on all three entry points (`LessonResultScreen`, `SavedLessonDetailScreen`, `WordDetailScreen`).
- Scheduler and persistence tests cover the fixed interval sequence and error paths.
- i18n is initialized and touched user-facing MVP copy uses Vietnamese keys.
- `tsconfig.json` runs under `strict` + `noUncheckedIndexedAccess`, with `@/*` path alias aligned to the runtime resolver (REV-04).
- Deprecated multi-agent config files (`.cursorrules`, `.opencode.json`, `GEMINI.md`, `QODER.md`) carry a deprecation header (REV-05).
- Legacy docs are archived, not deleted.
- NFR-003 due-count responsiveness at ~1,000 cards is checked in manual QA (Task 9 checklist).
- Local automated checks pass.
- Manual offline QA result is recorded, including any native environment blockers.

## Human Approval Gates

- Any SQLite schema migration beyond tests/fixes that preserve current tables.
- Any new dependency beyond `react-native-reanimated`, `react-native-gesture-handler`, `i18next`, and `react-i18next`.
- Any rating model expansion beyond `remembered | forgot`.
- Any backend, sync, auth, notification, Sentry, audio, gamification, or content-ingestion work.
- Any app identity rebrand touching package name, bundle id, application id, icons, signing, or store metadata.

## Open Questions

1. Which package manager should be the source of truth if both `package-lock.json` and `yarn.lock` remain present in `mobile-app/`?
2. Should QA seed local lessons through an existing dev fixture path, or should a small dev-only seed command be created in a separate approved issue?
3. **Daily Review soft cap (SETE-81 Open Question #3):** the spec has not fixed the session cap at 10 cards/session. Task 6 should not be considered done until this value is confirmed at spec level; until then keep the existing soft cap and record the assumption in the Task 6 test.
4. **SETE-82 dependency count inconsistency (reference only):** SETE-82 says "chỉ cần thêm 3 dep" but lists 4 packages (`react-native-reanimated`, `react-native-gesture-handler`, `i18next`, `react-i18next`). This plan treats all 4 as the approved set; no change needed unless the requester clarifies 3 vs 4.

## Risks

- `react-native-reanimated` and `react-native-gesture-handler` require native rebuilds; partial install without pods/Gradle verification can leave the app broken.
- The MVP Home empty state must be implemented with the route-gating work; otherwise users with no existing lessons will not understand why ingestion is unavailable.
- Local-only MVP has no backup. Reinstall or device loss removes review progress.
- Existing tests may encode required legacy flags; update tests to reflect the approved MVP pivot rather than preserving old assumptions.
