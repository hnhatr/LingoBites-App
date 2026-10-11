# Theme-driven Architecture — Design Spec

- **Date:** 2026-06-05
- **Scope:** `this repo` (React Native CLI + TypeScript, no Expo)
- **Source idea:** `theme-driven-architecture-guide.md` (Desktop) — this version is adjusted for the app's actual state.
- **Status:** **Implemented & shipped** (theme system lives in `src/theme/` with the `default`/`dark`/`pastel-kids` themes, picker, persistence, and release-flag gating). This doc was reconciled to the shipped code on 2026-06-05; `src/theme/types.ts` is the authoritative contract. Original plan: [`plans/2026-06-05-theme-system.md`](../plans/2026-06-05-theme-system.md) (Phase 0). Roadmap: [`README.md`](../README.md).

---

## 1. Goals

Separate all presentation concerns (colors, fonts, spacing, radius, shadow, component styles) from screen/business logic into a centralized **theme system**. When complete:

- Screens do not hard-code colors/fonts.
- Change the global theme via a single Provider.
- Add/remove themes via checklist without editing screens.
- AI/devs build UI against a unified set of rules (semantic tokens).
- Keep future monetization possible without adding payment, account, or entitlement behavior to Phase 0.

## 2. Scope decisions (confirmed with user)

| Item                                               | Decision                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Icon / asset (PNG mascot, logo, icon)              | **Deferred.** No binary files yet. Do not scaffold `AppIcon`/`AppImage`/`icons.ts`/`assets.ts` in this iteration.                                                                                                                                                                                         |
| Custom font (.ttf: Nunito, Baloo2…)                | **Deferred.** Requires native linking. Keep `typography` token structure but `fontFamily` uses system font (`undefined`/`'System'`).                                                                                                                                                                      |
| Refactor existing screens                          | **Yes.** Migrate `PasteTextScreen` + `LessonResultView` to use theme; remove all hard-coded colors/fonts.                                                                                                                                                                                                 |
| Initial theme count                                | **3:** `default` (light, matches current app), `dark`, `pastel-kids`.                                                                                                                                                                                                                                     |
| Runtime theme switching                            | **Provider + persistence + UI picker.**                                                                                                                                                                                                                                                                   |
| Persistence                                        | **Install `@react-native-async-storage/async-storage`.** Requires `pod install` + rebuild (user runs locally).                                                                                                                                                                                            |
| Per-theme **release** gating (rollout control)     | **In scope.** `themeRegistry.themeReleaseFlag` maps a theme id to a release `FeatureKey`; `ThemePicker` only offers themes whose flag is on, and a saved-but-now-disabled theme falls back to `default`. This is staged rollout, **not** monetization.                                                    |
| Sellable / premium themes (**entitlement** gating) | **Deferred to Post-P0.** Do not build premium locks, purchase stubs, entitlement storage, or payment/account seams in this iteration. Entitlement is distinct from the release flag above: release flags answer "is this theme shipped to this build?", entitlement answers "has this user paid for it?". |
| `'system'` pseudo-id (follow OS)                   | **Deferred.** `App.tsx` already has `useColorScheme`; add later behind the same registry.                                                                                                                                                                                                                 |

### Deferred (later iteration, when real assets exist)

`AppIcon`, `AppImage`, `theme/themes/*/icons.ts`, `theme/themes/*/assets.ts`, `theme/themes/*/fonts.ts`, native font linking, add `icons`/`assets` tokens to `AppTheme`.

## 3. Architecture

```
Design Tokens (base)  ->  Semantic Theme (AppTheme)  ->  Theme Registry
   ->  Theme Provider (context + persistence)  ->  useAppTheme hook
   ->  Reusable UI Components  ->  Screens
```

Screens only read via: `theme.colors`, `theme.typography`, `theme.spacing`, `theme.radius`, `theme.shadow`, `theme.components`.

**Cross-module dependency:** the theme system is self-contained for _rendering_, but theme _visibility_ depends on the release subsystem. `themeRegistry.ts` imports `FeatureKey` from `release/feature-registry` and `ThemePicker` reads release flags to decide which themes to offer, so the dependency direction is **theme → release** (never the reverse). This is why `FeatureFlagProvider` must wrap `AppThemeProvider` (see §7).

## 4. Directory structure (`src/`)

```
theme/
  types.ts            # AppTheme type (id: string)
  tokens.ts           # shared base scale (spacing, radius, weight, size)
  themes/
    default.ts        # id 'default'      (light, keeps current app identity — blue, BR-THEME-007)
    dark.ts           # id 'dark'         (modern dark)
    pastelKids.ts     # id 'pastel-kids'  (pastel, large radius)
  themeRegistry.ts    # SINGLE SOURCE OF TRUTH: themes map (satisfies Record<string, AppTheme>);
                      #   ThemeId = keyof typeof themes; themeIds; themeList; defaultThemeId; isThemeId();
                      #   themeReleaseFlag: Partial<Record<ThemeId, FeatureKey>>  (release gating, see §2)
  themeStorage.ts     # getSavedThemeId()/saveThemeId() via AsyncStorage
  ThemeProvider.tsx   # context, state, load+validate on mount, save on change, memoized value
                      #   (exported as `AppThemeProvider` — the name used in App.tsx)
  useAppTheme.ts      # hook, throws if used outside Provider
  index.ts            # public re-export
components/
  AppText.tsx         # Text + typography/colors tokens
  AppButton.tsx       # primary | secondary, uses components.button
  AppCard.tsx         # container using components.card + shadow
  AppScreen.tsx       # SafeAreaView + theme background
  ThemePicker.tsx     # lists registry themes allowed by release flags; tap -> setThemeId
```

## 5. Token model (`AppTheme`)

> **Authoritative source:** `src/theme/types.ts`. The block below mirrors it; if they ever diverge, `types.ts` wins.

```ts
// ThemeId is derived from the registry (§ single source of truth), not a
// hand-written union. The contract uses a plain string id.
type AppTheme = {
  id: string;
  name: string;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    primary: string;
    primaryPressed: string;
    secondary: string;
    secondaryContainer: string;
    danger: string;
    text: {primary: string; secondary: string; inverse: string; muted: string};
  };
  states: {disabledOpacity: number; pressedOpacity: number}; // no literal opacity in components
  typography: {
    fontFamily: {primary?: string; display?: string}; // system font in this iteration
    size: {xs; sm; md; lg; xl; xxl}; // number
    weight: {regular: '400'; medium: '600'; bold: FontWeight};
    // Named text styles consumed by AppText; each is { fontSize; lineHeight; fontWeight }.
    presets: {
      display;
      h1;
      h2;
      h3;
      bodyLg;
      body;
      label;
      caption;
    };
  };
  gutter: number; // default screen horizontal inset
  spacing: {xs; sm; md; lg; xl; xxl}; // number
  radius: {sm; md; lg; xl; pill}; // number
  shadow: {soft; medium; strong}; // ViewStyle (shadow* + elevation)
  components: {
    button: {
      primary: {background; text; height; radius};
      secondary: {background; text; border; height; radius};
    };
    card: {background; radius; padding; shadow: keyof shadow};
    input: {background; text; placeholder; border; radius};
  };
};
```

Rule: use **semantic** tokens (`colors.text.primary`) and **typography presets** (`typography.presets.h1`), not raw palette names or ad-hoc font sizes in screens.

## 6. Persistence

- `themeStorage.ts`:
  - `const KEY = 'app_theme_id'`
  - `saveThemeId(id: ThemeId): Promise<void>`
  - `getSavedThemeId(): Promise<ThemeId | null>`
  - Uses `@react-native-async-storage/async-storage`.
- `ThemeProvider`:
  - State `themeId`, initialized to `defaultThemeId`.
  - `useEffect` on mount: read `getSavedThemeId()`, validate with `isThemeId(saved)`; if the theme was removed or its flag is off → fall back to `defaultThemeId`. Never throw.
  - `setThemeId(id)`: validate with `isThemeId(id)` and enabled flag, then update state + `saveThemeId(id)`.
  - Context value `{ theme, themeId, setThemeId }` is wrapped in `useMemo([themeId])` so switching does not trigger unrelated re-renders and `theme` keeps a stable identity.

> Native setup: add dependency to `package.json`, run `npm install`, `cd ios && pod install`, then rebuild the app. User runs this locally.

## 7. Screen refactor

- `App.tsx`: provider order `FeatureFlagProvider` → `SafeAreaProvider` → `AppThemeProvider` → screens. This order is **required, not incidental**: `AppThemeProvider`/`ThemePicker` read release flags to decide which themes are available (§3), so `FeatureFlagProvider` must sit above them.
- `PasteTextScreen`:
  - `AppScreen` replaces `SafeAreaView`.
  - `AppText` replaces `Text` (title/subtitle/error).
  - `AppButton` replaces `Pressable` primary/secondary.
  - `TextInput` style from `theme.components.input`.
  - Remove hard-coded `StyleSheet`; dynamic styles from `useAppTheme()`.
- `LessonResultView`:
  - `AppText` for all text, `AppCard` for items.
  - Section/spacing/colors from tokens.
- `ProfileScreen` (Settings): host `ThemePicker` here — this is the product home for theme switching
  (`01-user-flow` §12). Do **not** place the picker inside the PasteText input flow.

## 8. Tests (Jest)

- Parametrized over `themeList`: render every registry theme via Provider without errors (new themes auto-covered).
- `useAppTheme()` outside Provider → throw.
- `setThemeId` updates context value (mock AsyncStorage).
- `AppButton` renders correctly per `components.button` (primary vs secondary).
- Smoke test `PasteTextScreen` renders inside Provider.
- Unknown/removed saved id → fallback to `default`.

## 9. Coding rules (for AI/dev)

1. Do not hard-code colors in screens. ESLint enforces `react-native/no-color-literals` (error) on `src/components/**` + `src/modules/**` (there is no `screens/` dir — screens live under `modules/<feature>/`). Note: `no-inline-styles` is **not** currently enabled; dynamic-from-token styles are allowed.
2. Use `useAppTheme()` for colors/spacing/radius/typography/shadow/states/component tokens.
3. Use `AppText`/`AppButton`/`AppCard`/`AppScreen` instead of raw primitives.
4. Missing token → add to `AppTheme` and update **all** themes (the contract is closed; no value lives outside it).
5. Each new theme must fully implement `AppTheme`. The registry `satisfies Record<string, AppTheme>` makes TypeScript reject an incomplete theme.
6. Use semantic tokens (`colors.text.primary`), not raw palette.
7. The registry is the single source of truth: `ThemeId = keyof typeof themes`. Never hand-write the id union; never hard-code theme buttons in `ThemePicker` — map over `themeList`.
8. On load, validate the persisted id (`isThemeId`) and fall back to `default` if unknown. `default` must never be removed.
9. `ThemePicker` shows a theme only when its feature flag is on (`default` always shown).

## 10. Checklist for adding / removing a theme (later)

**Add — registry-only, no screen/type/picker edits:**

- [ ] Create `themes/<name>.ts` implementing `AppTheme` (colors / states / typography / spacing / radius / shadow / components — TypeScript enforces completeness).
- [ ] Add **one entry** to the `themes` map in `themeRegistry.ts`. `ThemeId`, `themeList`, `ThemePicker` and the parametrized render test all pick it up automatically.
- [ ] (Optional) add a feature flag (`feature-registry.ts` + `feature-dependencies.ts`, depends on `themeSystem`) to gate it.
- [ ] (When assets exist) add icons/assets/fonts.

**Remove:**

- [ ] Turn the flag off (or delete the registry entry). The picker drops it; users who had it selected fall back to `default` on next load. `default` is never removable.

## 11. Post-P0 monetization note

Themes may become sellable later, but that is outside this iteration and outside Phase 0 unless explicitly approved through the Phase N workflow. A future monetization spec must define account identity, payment/receipt validation, entitlement storage, premium lock UI, QA cases, rollback, and traceability rows before implementation.

**Reuse seam:** monetization should build entitlement gating _on top of_ the existing release-flag mechanism, not replace it. Release flags answer "is this theme in this build?"; entitlement answers "has this user paid for it?". A premium theme would be release-enabled **and** entitlement-locked. Do not conflate the two — release flags are already shipped (§2) and are not a purchase signal.

## 12. Out of scope for this iteration

- Premium theme locks, purchase stubs, entitlement storage, real auth/account identity, payment/receipt validation, and backend entitlement API. (Per-theme **release** gating via `themeReleaseFlag` **is** in scope — see §2; it is rollout control, not entitlement.)
- `'system'` (OS-following) pseudo-theme.
- Icon/asset/font binary and resolver.
- New screens (Scan, Result, Profile) per guide.
- Themes beyond the 3 confirmed themes.
