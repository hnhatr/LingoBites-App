# LingoBites Mobile UI — Implementation Design

**Date:** 2026-06-05
**Source of truth (design):** `~/Desktop/LingoScan Handoff.html` (Vibrant Pastel design system, v1)
**Source of truth (rules/schema):** `AGENTS.md`, `docs/01-ba/01-schema/01-ai-output-v1.ts`, `docs/01-ba/06-design/03-theme-system.md`
**Target:** `this repo` — React Native **CLI** + TypeScript (NOT Expo)
**Status:** Phase 0 visual reference, reconciled with D-002/D-003. If this file conflicts with
`AGENTS.md`, `docs/01-ba/DECISIONS.md`, or BA canonical docs, the BA docs win.

**Theme boundary:** Theme implementation details are delegated to
`docs/superpowers/specs/2026-06-05-theme-driven-architecture-design.md`; this file defines only how
the LingoBites UI consumes theme tokens and reusable `App*` components.

## 0. Prerequisites & execution order

**Do not start UI implementation until Phase 0 theme is complete.**

| Step                       | Document                                                                                          | Exit                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1 — Theme foundation       | [`plans/2026-06-05-theme-system.md`](../plans/2026-06-05-theme-system.md) (implements theme spec) | Done criteria checked; TC-024..030       |
| 2 — UI handoff (this spec) | [`plans/2026-06-05-lingobites-ui.md`](../plans/2026-06-05-lingobites-ui.md)                       | This spec §12 + Done criteria in UI plan |

Roadmap index: [`docs/superpowers/README.md`](../README.md).

**Already delivered by theme plan (do not rebuild in UI phase):** `theme/`, `AppThemeProvider`,
`AppText`/`AppButton`/`AppCard`/`AppScreen`/`ThemePicker`, token migration of `PasteTextScreen`,
`LessonResultView`, `ProfileScreen` (+ `ThemePicker` on Profile only).

**UI phase owns:** extended tokens (if needed), handoff component library, Zustand stores, navigation
shell, remaining screen layout/states, mock data.

## 1. Goal & scope

Implement the LingoBites app UI from the Claude design handoff as reusable, token-driven React
Native components wired into the Phase 0 app shape, using **mock data only** until the relevant
milestone introduces real services. The visual language is preserved, but navigation and feature
scope follow the locked Phase 0 BA docs.

The handoff assumes Expo + custom fonts + live camera. This project mandates RN CLI, deferred
font/icon binaries, and "no real API yet." This design **adapts** the handoff to those constraints
rather than copying it literally — the visual language (palette, type scale, spacing, radii, shadows,
component shapes) is preserved exactly; the Expo-specific plumbing is replaced with CLI equivalents.

### In scope (full fidelity)

- 3-tab shell only: **Home · Lessons · Profile**. Scan/upload actions live on Home, not in a tab.
- Core loop screens: **Home, PasteText, Confirm Text, Lesson Result (single scroll), Library,
  Profile.**
- Reusable component library beyond base `App*` (handoff §4); theme layer is **Phase 0** per §0.
- Mock data + Zustand stores; loading / empty / error / disabled states per handoff §9.

### Stubs (visually-correct placeholder + TODO)

- Profile body detail and later-milestone service entry points.

### Explicitly NOT in scope

- Real camera capture, OCR, AI analysis, audio/TTS, network, on-device persistence.
- Custom font binaries, icon font binaries, image/icon resolvers, and `AppIcon`/`AppImage`
  scaffolding (deferred per `AGENTS.md` and D-003).
- Separate Scan tab, Vocabulary tab, lesson hub navigation, or separate P0 screens for sentence,
  word, grammar, or practice details.

## 2. Decisions (confirmed with user)

| Topic        | Decision                                                                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Screen scope | Core loop full within locked P0 shell; Profile as stub                                                                                                                                                                                                                                                                   |
| State        | **Zustand** for domain state: `useScanStore`, `useLibraryStore` (in-memory + mock seed). `useProgressStore` (streak/stats) is **out-of-P0** — see §11. **Theme state is owned by `ThemeProvider` (React Context) + AsyncStorage per the theme spec — NOT a Zustand `useThemeStore`.** Lesson persistence → SQLite at M4. |
| Theme API    | Align to the theme spec — `useAppTheme()`, `AppText`/`AppButton`/`AppCard`/`AppScreen`. The **handoff's** teal/coral/gold values define the **`pastel-kids`** theme, not `default`; `default` keeps the current app identity (BR-THEME-007). Type presets per §8.                                                        |
| Fonts        | System font now; typography presets carry size/weight/line-height so `fontFamily` (Lexend/Quicksand) can be dropped in later (TODO)                                                                                                                                                                                      |
| Icons        | Deferred. Use text labels or existing platform primitives until the asset/icon batch is approved.                                                                                                                                                                                                                        |

## 3. Adaptation map (Handoff → this build)

| Handoff (Expo)                                         | This build (RN CLI)                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme/tokens.ts`, `theme/typography.ts`, `useTheme()` | folded into `theme/` with `useAppTheme()` exposing `{ colors, typography, spacing, radius, shadow, components }`                                                                                     |
| `expo-font` Lexend/Quicksand                           | system font + presets (TODO fontFamily)                                                                                                                                                              |
| `@expo/vector-icons`                                   | Deferred until the asset/icon batch                                                                                                                                                                  |
| `expo-blur` BlurView (camera)                          | semi-opaque overlay `View` (TODO blur)                                                                                                                                                               |
| `expo-speech` TTS                                      | no-op audio handler that toggles "playing" state on the tapped icon (TODO services/tts)                                                                                                              |
| Live camera                                            | Deferred to M3; use `react-native-image-picker` native UI, not a custom in-app camera                                                                                                                |
| `zustand/middleware persist` + AsyncStorage/MMKV       | Domain stores stay in-memory (lesson persistence → SQLite at M4). **Theme selection persists now via AsyncStorage inside `ThemeProvider`** (theme spec) — the one sanctioned AsyncStorage use in P0. |
| OCR/AI `services/*`                                    | `services/ocr.ts`, `services/ai.ts` return mock `AIOutput` after a delay (TODO real API)                                                                                                             |

## 4. Architecture & folder structure

Built under `src/`, following the handoff's recommended layout while keeping the existing
canonical schema and refactoring the two existing screens into it.

```
src/
  app/
    navigation/             // AppNavigator (native-stack) + bottom tabs: Home, Lessons, Profile only
  theme/                    // OWNED BY THE THEME SPEC (registry + Provider + AsyncStorage)
    types.ts                // AppTheme type (id: string)
    tokens.ts               // shared base scale
    themes/                 // default.ts, dark.ts, pastelKids.ts (pastel-kids = handoff §8 values)
    themeRegistry.ts        // single source of truth: themes map, ThemeId, themeList, isThemeId
    themeStorage.ts         // get/saveThemeId via AsyncStorage
    ThemeProvider.tsx       // context: load + validate + persist (exported as AppThemeProvider)
    useAppTheme.ts          // hook, throws outside provider
    index.ts
  components/               // reusable, token-driven (handoff §4)
    AppText, AppButton, AppCard, AppScreen, ThemePicker,
    IconButton, Chip, Medallion, ListRow, TextField,
    SectionHeader, ImagePlaceholder, AppHeader, BottomActionBar,
    WordCard, ChunkRow, QuizOption, ScanFrame, LessonCard
    // ProgressTrack / StatTile are out-of-P0 (streak/review) — add with their milestone.
  modules/                  // existing app code, organised by FEATURE (not a flat screens/)
    input/                  // HomeScreen, PasteTextScreen, ImageCaptureScreen
    ocr/                    // OCRReviewScreen   (= handoff "Confirm / Review text")
    lesson/                 // LessonResultScreen + LessonResultView, LessonsHistoryScreen (= "Library"), SavedLessonDetailScreen
    settings/               // ProfileScreen, PrivacyNoteScreen
    ai-analysis/, analytics/ // services + event logging
  store/
    useScanStore.ts useLibraryStore.ts   // NO useThemeStore — theme lives in ThemeProvider
  services/
    ai.ts                   // mock implementation + TODO real AI in M2
  data/
    mockLessons.ts mockLibrary.ts
  shared/                   // existing: schemas/ai-output-v1.ts, fixtures/, errors/, copy/
  types/
    async.ts                // Async<T> union (handoff §9)
    lesson.ts               // UI Lesson list types (cards)

Screen-name map (spec name → repo file): Home→HomeScreen, PasteText→PasteTextScreen,
ConfirmText→OCRReviewScreen, LessonResult→LessonResultScreen, Library→LessonsHistoryScreen,
Profile→ProfileScreen.
```

The existing `modules/input/PasteTextScreen.tsx` and `modules/lesson/LessonResultView.tsx` are
**migrated** without changing the P0 flow: PasteText remains the input entry, and lesson rendering
stays a single scroll in the canonical section order. Both are rebuilt on `useAppTheme` + `App*`
components. `modules/ai-analysis/MockAIAnalysisService` is reused/wrapped by `services/ai.ts`.

## 5. Data model

- **Lesson content** uses the **canonical `AIOutput`** schema (`shared/schemas/ai-output-v1.ts`) —
  `sentences[]` (with `breakdown` chunks + `patterns`), `vocabulary[]`, `grammar_points[]`,
  `practice[]`, `pronunciation`. We do NOT invent fields (AGENTS.md rule). Mock lessons are valid
  `AIOutput` objects (extend the existing `validLessonOutput` fixture) and pass `validateAIOutput()`
  before render.
- **Library card** = lightweight derived view: `{ id, title, category, blurb, wordCount, minutes,
createdAt }`, mapped from a stored `AIOutput`.
- Handoff field names map onto canonical ones: handoff `words[]`→`vocabulary[]`,
  handoff sentence `chunks`→`breakdown`, handoff `grammar[]`→`grammar_points[]`.

## 6. State (Zustand, in-memory + mock)

- `useScanStore` — `job: Async<AIOutput>`, `capture`, `scanFromText()`, `scanFromImage()` (mock OCR),
  `reset()`. Drives PasteText/Camera → ScanResult.
- `useLibraryStore` — `lessons: AIOutput[]` (seeded), `save(lesson)`, `remove(id)`, `search/filter`.
- `useProgressStore` — `streak`, `stats`, `recordQuiz()`. **Out-of-P0** (streak/review is not in the
  locked Phase 0 scope — see §11); do not wire into Home/Profile until its milestone.
- **No `useThemeStore`.** Theme state lives in `ThemeProvider` (Context) per the theme spec; screens
  read it through `useAppTheme()` and switch via `ThemePicker`.

`Async<T>` union (`idle|loading|success|empty|error`) from handoff §9 keeps every data screen honest.
Domain `persist` (SQLite) is a TODO for M4; in P0 only the theme selection persists (AsyncStorage).

## 7. Navigation (React Navigation v6)

`RootStack` (native-stack)

- `MainTabs` (bottom-tabs, custom `TabBar`):
  - `HomeStack` → Home → PasteText → ConfirmText → LessonResult
  - `LessonsStack` → Library → LessonResult
  - `ProfileStack` → Profile
- M3 may add native image-picker actions behind Home CTAs. It must not add a Scan tab.

After successful analysis, route to the single-scroll Lesson Result. "Save lesson" is a disabled
placeholder before M4; M4 persists to local history and reopens saved lessons without calling AI.

**Native deps:** `react-native-screens` + `react-native-gesture-handler` are required and must be
linked (`cd ios && pod install`, rebuild). `react-native-safe-area-context` already present. Pinned
footers (TabBar, BottomActionBar) live **outside** the ScrollView per handoff §10:
`View(flex:1) → AppHeader → ScrollView(flex:1) → BottomActionBar`.

## 8. Theme tokens (from handoff §5–§8, exact values)

- **Colors:** bg `#fcfae6`, surface `#ffffff`, surfaceLow/Cont/High/Highest tiers, onSurface `#1c1c10`,
  onVariant `#3c4a46`, outline/outlineVariant, primary `#006b5f`, primaryContainer(accent) `#2dd4bf`,
  onPrimaryContainer `#00574d`, secondary `#a93349`, secondaryContainer(coral) `#fe7488`,
  tertiaryFixed(yellow) `#ffe24c`, error `#ba1a1a`. Semantic tokens only in screens (AGENTS.md).
- **Spacing:** xs4 s8 sm12 m16 md24 lg32 xl48, gutter16.
- **Radius:** sm8, card24, row18, medallion14, lg32, pill999. Round shape language.
- **Shadow:** colored ambient (teal `card`, accent teal, coral) — never black; iOS `shadow*` + Android
  `elevation`.
- **Typography presets:** display 32/38/700, h1 28/34/700, h2 22/28/600, h3 18/24/600, bodyLg 18/28/500,
  body 16/24/500, label 14/18/600, caption 12/16/600. Min body 16; clamp scaling `maxFontSizeMultiplier≈1.3`.

## 9. UI states (handoff §9) — applied everywhere data is read

- **Loading:** AI analyzing → branded progress + skeleton word cards; lists → 3–4 skeleton cards.
- **Empty:** "No lessons yet" medallion + `Scan now`; "No words extracted"; search no-results.
- **Error:** coral inline card with retry (retry the AI job, not the capture); never block whole app.
- **Disabled:** Extract disabled until text non-empty / image chosen; 38% opacity, no shadow/press anim,
  `accessibilityState={{disabled:true}}`.

## 10. Accessibility

`accessibilityLabel` on every icon-only button; quiz options expose selected/correct to screen readers;
honor `AccessibilityInfo.isReduceMotionEnabled` (disable scan-line/entrance animations); `allowFontScaling`
with clamped multiplier on display sizes.

## 11. TODO markers (required by the task)

Explicit `// TODO(...)` comments placed at integration seams:

- **OCR:** Home image-picker CTAs and M3 service boundary.
- **AI analysis:** `services/ai.ts`, ScanResult/LessonDetail generation.
- **Saved lessons:** `useLibraryStore` persist → **SQLite at M4** (AsyncStorage is reserved for the
  theme selection only — do not use it for lesson storage, per `04-html-handoff` dependency gate).
- **Review system / progress:** **out-of-P0.** Streak, `useProgressStore`, and a Home "Review" CTA are
  not in the locked Phase 0 scope; do not build this UI before its milestone (`04-html-handoff` STOP-case).
- Plus: fonts (Lexend/Quicksand), icon font (vector-icons), TTS audio, blur, native image picker.

## 12. Testing

- Component smoke tests (render with provider) for AppText/AppButton/AppCard + WordCard/QuizOption.
- `useScanStore` reducer-style tests (text → success / empty / error transitions).
- Mock lessons validate against `validateAIOutput()` (reuse existing validation test pattern).
- Keep `__tests__/App.test.tsx` green (App renders under providers).

## 13. Out-of-scope / follow-ups

Real services, persistence, fonts/icons/audio binaries, tablet 2-col variants, i18next UI
localization, Scan tab, Vocabulary tab, and separate lesson detail screens. Each approved future
integration has a TODO at its seam.
