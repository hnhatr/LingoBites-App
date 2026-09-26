# Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized, theme-driven UI layer for `this repo` so screens render only through semantic tokens, the global theme can be switched at runtime and persisted, and themes can be added/removed by editing one registry entry — with the theme registry as the single source of truth.

**Architecture:** Design tokens → semantic `AppTheme` objects → a `themeRegistry` (single source of truth: `themes` map, derived `ThemeId`, `themeList`, `defaultThemeId`, `isThemeId`, release-flag map) → `ThemeProvider` (context + AsyncStorage persistence + load-time validation/fallback + memoized value) → `useAppTheme` hook → reusable `App*` components → screens. The `ThemePicker` lists registry themes filtered by their release feature flag. Monetization/entitlement is explicitly **out of scope** (deferred to Post-P0 per the spec).

**Tech Stack:** React Native 0.85 (CLI, no Expo), TypeScript 5.8, Jest + `react-test-renderer`, `@react-native-async-storage/async-storage`, existing `FeatureFlag` system in `src/release/`.

**Roadmap:** [`docs/superpowers/README.md`](../README.md) — Phase 0 (this plan) → Phase 1 UI plan.

**Source specs:**

- `docs/superpowers/specs/2026-06-05-theme-driven-architecture-design.md` (authoritative scope — monetization deferred)
- `docs/01-ba/06-design/03-theme-system.md` (BA doc; note: its monetization sections are superseded by the spec's Post-P0 deferral)
- `docs/superpowers/specs/2026-06-05-lingobites-ui-design.md` §8 + `docs/01-ba/06-design/04-html-handoff-to-code-spec.md` §7.1 (visual values for `pastel-kids` only — not `default`)

**Scope note:** Do **not** build premium locks, purchase stubs, entitlement storage, `themeMeta`/`tier`/`sku`, `EntitlementSource`, or the `'system'` pseudo-theme. Those are Post-P0.

**Current status (2026-06-05):** Theme foundation is implemented in `src/theme/` and this plan has been reconciled to the shipped `AppTheme` contract. If code and this plan diverge later, treat `src/theme/types.ts` as authoritative and update this plan before executing further theme work.

**Plan reconciliation (2026-06-05):** Aligns with theme spec + handoff after review:

- `ThemePicker` lives on **`ProfileScreen`** (Settings), not `PasteTextScreen` (theme spec §7, BA `03-theme-system.md` §9).
- `pastel-kids` palette uses handoff teal/coral/gold (`#fcfae6`, `#006b5f`, `#fe7488`, …), not the interim pink/purple draft.
- `pastel-kids` uses `disabledOpacity: 0.38` per handoff §9; colored ambient shadows (teal), not black.
- `AppText` `body` variant maps to `typography.size.md` (16px min per handoff).
- `App.tsx` wraps the existing `AppNavigator` tree (not a bare `PasteTextScreen` stub).
- Full handoff typography presets (`display`/`h1`/line-height) and extended color tiers (`surfaceLow`, `primaryContainer`, …) remain **UI spec phase** — extend `AppTheme` then, not in this iteration.

---

## File Structure

**Create (theme core):**

- `src/theme/types.ts` — `AppTheme` type + supporting types. One responsibility: the token contract.
- `src/theme/tokens.ts` — shared base numeric scales (spacing, radius, font size/weight) reused by themes.
- `src/theme/themes/default.ts` — `defaultTheme` (light, current blue identity).
- `src/theme/themes/dark.ts` — `darkTheme`.
- `src/theme/themes/pastelKids.ts` — `pastelKidsTheme` (handoff Vibrant Pastel palette + large radius).
- `src/theme/themeRegistry.ts` — single source of truth.
- `src/theme/themeStorage.ts` — AsyncStorage get/save of theme id.
- `src/theme/ThemeProvider.tsx` — context, state, load/validate/fallback, persist, memo.
- `src/theme/useAppTheme.ts` — hook that throws outside provider.
- `src/theme/index.ts` — public re-exports.

**Create (components):**

- `src/components/AppText.tsx`
- `src/components/AppButton.tsx`
- `src/components/AppCard.tsx`
- `src/components/AppScreen.tsx`
- `src/components/ThemePicker.tsx`

**Create (tests):**

- `src/theme/__tests__/themeRegistry.test.ts`
- `src/theme/__tests__/themeStorage.test.ts`
- `src/theme/__tests__/ThemeProvider.test.tsx`
- `src/theme/__tests__/themes.render.test.tsx` (parametrized over `themeList`)
- `src/components/__tests__/AppButton.test.tsx`
- `src/components/__tests__/ThemePicker.test.tsx`

**Modify:**

- `package.json` — add `@react-native-async-storage/async-storage` dependency.
- `jest.config.js` — register AsyncStorage mock.
- `.eslintrc.js` — ban color literals / inline styles under `src/components` + `src/modules`.
- `App.tsx` — wrap tree in `AppThemeProvider`.
- `src/modules/input/PasteTextScreen.tsx` — migrate to `App*` + tokens (no `ThemePicker` here).
- `src/modules/lesson/LessonResultView.tsx` — migrate to `App*` + tokens.
- `src/modules/settings/ProfileScreen.tsx` — migrate to `App*` + tokens; host `ThemePicker` (product home for theme switching).
- `src/modules/settings/__tests__/ProfileScreen.test.tsx` — wrap renders in `AppThemeProvider`.

---

## Conventions for every task

- All commands run from ``unless stated. Run`cd .` first in a fresh shell.
- Run a single test file with: `npx jest <path> -v`.
- TypeScript check: `npx tsc --noEmit`.
- Commit messages end with the project's trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
  (Omitted from each step below for brevity — append it to every commit.)

---

## Task 0: Install AsyncStorage + wire Jest mock

**Files:**

- Modify: `package.json`
- Modify: `jest.config.js`

- [ ] **Step 1: Add the dependency**

Run (from `this repo`):

```bash
npm install @react-native-async-storage/async-storage@^2.1.0
```

Expected: `package.json` `dependencies` now lists `@react-native-async-storage/async-storage`.

- [ ] **Step 2: Register the official Jest mock**

Replace `jest.config.js` with:

```js
module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: [
    './node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  ],
};
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `npx jest -v`
Expected: PASS (existing `App.test.tsx` and `validate-release-config.test.ts` green).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json jest.config.js
git commit -m "chore(mobile): add async-storage dep + jest mock for theme persistence"
```

> Native note for the user: after this lands, run `cd ios && pod install` and rebuild the app. Not required for Jest.

---

## Task 1: Token contract (`AppTheme` type) + base tokens

**Files:**

- Create: `src/theme/types.ts`
- Create: `src/theme/tokens.ts`

- [ ] **Step 1: Write the type contract**

Create `src/theme/types.ts`:

```ts
import type {ViewStyle} from 'react-native';

export type FontWeight = '400' | '500' | '600' | '700' | '800';

export type TypographyPreset = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
};

export type ColorScale = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  secondary: string;
  secondaryContainer: string;
  danger: string;
  text: {
    primary: string;
    secondary: string;
    inverse: string;
    muted: string;
  };
};

export type SixStep = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type RadiusScale = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type ShadowScale = {
  soft: ViewStyle;
  medium: ViewStyle;
  strong: ViewStyle;
};

export type AppTheme = {
  id: string;
  name: string;
  colors: ColorScale;
  // Interaction states so components never hard-code opacity values.
  states: {disabledOpacity: number; pressedOpacity: number};
  typography: {
    fontFamily: {primary?: string; display?: string};
    size: SixStep;
    weight: {regular: '400'; medium: '600'; bold: FontWeight};
    presets: {
      display: TypographyPreset;
      h1: TypographyPreset;
      h2: TypographyPreset;
      h3: TypographyPreset;
      bodyLg: TypographyPreset;
      body: TypographyPreset;
      label: TypographyPreset;
      caption: TypographyPreset;
    };
  };
  gutter: number;
  spacing: SixStep;
  radius: RadiusScale;
  shadow: ShadowScale;
  components: {
    button: {
      primary: {
        background: string;
        text: string;
        height: number;
        radius: number;
      };
      secondary: {
        background: string;
        text: string;
        border: string;
        height: number;
        radius: number;
      };
    };
    card: {
      background: string;
      radius: number;
      padding: number;
      shadow: keyof ShadowScale;
    };
    input: {
      background: string;
      text: string;
      placeholder: string;
      border: string;
      radius: number;
    };
  };
};
```

- [ ] **Step 2: Write the shared base tokens**

Create `src/theme/tokens.ts`:

```ts
import type {RadiusScale, SixStep} from './types';

// Base scales shared by themes. A theme may spread these and override (e.g.
// pastel-kids uses a larger radius). Keeping them here keeps spacing/size
// consistent across themes by default.
export const spacing: SixStep = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32};

export const radius: RadiusScale = {sm: 6, md: 8, lg: 12, xl: 20, pill: 999};

export const fontSize: SixStep = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
};

export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '800',
} as const;

export const typographyPresets = {
  display: {fontSize: 32, lineHeight: 38, fontWeight: '700' as const},
  h1: {fontSize: 28, lineHeight: 34, fontWeight: '700' as const},
  h2: {fontSize: 22, lineHeight: 28, fontWeight: '600' as const},
  h3: {fontSize: 18, lineHeight: 24, fontWeight: '600' as const},
  bodyLg: {fontSize: 18, lineHeight: 28, fontWeight: '500' as const},
  body: {fontSize: 16, lineHeight: 24, fontWeight: '500' as const},
  label: {fontSize: 14, lineHeight: 18, fontWeight: '600' as const},
  caption: {fontSize: 12, lineHeight: 16, fontWeight: '600' as const},
};

export const gutter = 16;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/theme/types.ts src/theme/tokens.ts
git commit -m "feat(theme): add AppTheme token contract + base token scales"
```

---

## Task 2: Three theme objects (default, dark, pastel-kids)

**Files:**

- Create: `src/theme/themes/default.ts`
- Create: `src/theme/themes/dark.ts`
- Create: `src/theme/themes/pastelKids.ts`

> Each theme is typed `: AppTheme`, so TypeScript rejects any missing token. The shared shadow definitions are repeated per theme (DRY is fine here since dark needs different shadow opacity; repetition is intentional and small).

- [ ] **Step 1: Write `default.ts` (light, current blue identity)**

Create `src/theme/themes/default.ts`:

```ts
import {fontSize, gutter, radius, spacing, typographyPresets} from '../tokens';
import type {AppTheme} from '../types';

export const defaultTheme: AppTheme = {
  id: 'default',
  name: 'Mặc định',
  colors: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    border: '#e5e7eb',
    primary: '#2563eb',
    primaryPressed: '#1d4ed8',
    secondary: '#64748b',
    secondaryContainer: '#fee2e2',
    danger: '#b91c1c',
    text: {
      primary: '#111827',
      secondary: '#4b5563',
      inverse: '#ffffff',
      muted: '#6b7280',
    },
  },
  states: {disabledOpacity: 0.7, pressedOpacity: 0.85},
  typography: {
    fontFamily: {},
    size: {...fontSize},
    weight: {regular: '400', medium: '600', bold: '800'},
    presets: {...typographyPresets},
  },
  gutter,
  spacing: {...spacing},
  radius: {...radius},
  shadow: {
    soft: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    strong: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  components: {
    button: {
      primary: {background: '#2563eb', text: '#ffffff', height: 48, radius: 8},
      secondary: {
        background: 'transparent',
        text: '#1f2937',
        border: '#cbd5e1',
        height: 44,
        radius: 8,
      },
    },
    card: {background: '#ffffff', radius: 8, padding: 12, shadow: 'soft'},
    input: {
      background: '#ffffff',
      text: '#111827',
      placeholder: '#9ca3af',
      border: '#cbd5e1',
      radius: 8,
    },
  },
};
```

- [ ] **Step 2: Write `dark.ts`**

Create `src/theme/themes/dark.ts`:

```ts
import {fontSize, gutter, radius, spacing, typographyPresets} from '../tokens';
import type {AppTheme} from '../types';

export const darkTheme: AppTheme = {
  id: 'dark',
  name: 'Tối',
  colors: {
    background: '#0b1120',
    surface: '#1e293b',
    surfaceMuted: '#111827',
    border: '#334155',
    primary: '#3b82f6',
    primaryPressed: '#2563eb',
    secondary: '#94a3b8',
    secondaryContainer: '#3f1d2a',
    danger: '#f87171',
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      inverse: '#0b1120',
      muted: '#94a3b8',
    },
  },
  states: {disabledOpacity: 0.5, pressedOpacity: 0.8},
  typography: {
    fontFamily: {},
    size: {...fontSize},
    weight: {regular: '400', medium: '600', bold: '800'},
    presets: {...typographyPresets},
  },
  gutter,
  spacing: {...spacing},
  radius: {...radius},
  shadow: {
    soft: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    },
    strong: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  components: {
    button: {
      primary: {background: '#3b82f6', text: '#0b1120', height: 48, radius: 8},
      secondary: {
        background: 'transparent',
        text: '#f8fafc',
        border: '#334155',
        height: 44,
        radius: 8,
      },
    },
    card: {background: '#1e293b', radius: 8, padding: 12, shadow: 'medium'},
    input: {
      background: '#1e293b',
      text: '#f8fafc',
      placeholder: '#64748b',
      border: '#334155',
      radius: 8,
    },
  },
};
```

- [ ] **Step 3: Write `pastelKids.ts` (handoff Vibrant Pastel — teal/coral/gold)**

> Palette from `04-html-handoff-to-code-spec.md` §7.1 / UI spec §8. Maps handoff roles into the
> closed `AppTheme` contract (`default` keeps blue identity per BR-THEME-007).

Create `src/theme/themes/pastelKids.ts`:

```ts
import {fontSize, typographyPresets} from '../tokens';
import type {AppTheme} from '../types';

// Handoff spacing: xs4 s8 sm12 m16 md24 lg32 xl48
const handoffSpacing = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 48};

export const pastelKidsTheme: AppTheme = {
  id: 'pastel-kids',
  name: 'Pastel Kids',
  colors: {
    background: '#fcfae6',
    surface: '#ffffff',
    surfaceMuted: '#fff4b8',
    border: '#6b7a76',
    primary: '#006b5f',
    primaryPressed: '#00574d',
    secondary: '#fe7488',
    secondaryContainer: '#ffdf6e',
    danger: '#ba1a1a',
    text: {
      primary: '#1c1c10',
      secondary: '#3c4a46',
      inverse: '#ffffff',
      muted: '#6b7a76',
    },
  },
  states: {disabledOpacity: 0.38, pressedOpacity: 0.85},
  typography: {
    fontFamily: {},
    size: {...fontSize},
    weight: {regular: '400', medium: '600', bold: '700'},
    presets: {...typographyPresets},
  },
  gutter: 16,
  spacing: {...handoffSpacing},
  // Handoff radii: sm8 card24 row18 lg32 pill999
  radius: {sm: 8, md: 18, lg: 24, xl: 32, pill: 999},
  shadow: {
    soft: {
      shadowColor: '#006b5f',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    medium: {
      shadowColor: '#2dd4bf',
      shadowOffset: {width: 0, height: 3},
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    strong: {
      shadowColor: '#fe7488',
      shadowOffset: {width: 0, height: 5},
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 6,
    },
  },
  components: {
    button: {
      primary: {background: '#006b5f', text: '#ffffff', height: 52, radius: 24},
      secondary: {
        background: 'transparent',
        text: '#730425',
        border: '#fe7488',
        height: 48,
        radius: 24,
      },
    },
    card: {background: '#ffffff', radius: 24, padding: 16, shadow: 'soft'},
    input: {
      background: '#ffffff',
      text: '#1c1c10',
      placeholder: '#6b7a76',
      border: '#6b7a76',
      radius: 18,
    },
  },
};
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (A missing token in any theme would fail here.)

- [ ] **Step 5: Commit**

```bash
git add src/theme/themes/
git commit -m "feat(theme): add default, dark, and pastel-kids themes"
```

---

## Task 3: Theme registry (single source of truth)

**Files:**

- Create: `src/theme/themeRegistry.ts`
- Test: `src/theme/__tests__/themeRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/themeRegistry.test.ts`:

```ts
import {
  defaultThemeId,
  isThemeId,
  themeIds,
  themeList,
  themeReleaseFlag,
  themes,
} from '../themeRegistry';

describe('themeRegistry', () => {
  it('exposes the three confirmed themes', () => {
    expect(Object.keys(themes).sort()).toEqual([
      'dark',
      'default',
      'pastel-kids',
    ]);
  });

  it('themeIds and themeList are derived from the themes map', () => {
    expect(themeIds).toEqual(Object.keys(themes));
    expect(themeList.map(t => t.id)).toEqual(themeIds);
  });

  it('defaultThemeId points to an existing theme', () => {
    expect(themes[defaultThemeId]).toBeDefined();
    expect(defaultThemeId).toBe('default');
  });

  it('isThemeId accepts known ids and rejects everything else', () => {
    expect(isThemeId('dark')).toBe(true);
    expect(isThemeId('pastel-kids')).toBe(true);
    expect(isThemeId('nope')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });

  it('maps gated themes to their release feature flag; default is ungated', () => {
    expect(themeReleaseFlag.dark).toBe('darkTheme');
    expect(themeReleaseFlag['pastel-kids']).toBe('pastelKidsTheme');
    expect(themeReleaseFlag.default).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/themeRegistry.test.ts -v`
Expected: FAIL with "Cannot find module '../themeRegistry'".

- [ ] **Step 3: Write the registry**

Create `src/theme/themeRegistry.ts`:

```ts
import type {FeatureKey} from '../release/feature-registry';
import {darkTheme} from './themes/dark';
import {defaultTheme} from './themes/default';
import {pastelKidsTheme} from './themes/pastelKids';
import type {AppTheme} from './types';

// SINGLE SOURCE OF TRUTH. Add a theme = add one entry here. `ThemeId`,
// `themeIds`, `themeList`, and the parametrized render test all derive from it.
export const themes = {
  default: defaultTheme,
  dark: darkTheme,
  'pastel-kids': pastelKidsTheme,
} satisfies Record<string, AppTheme>;

export type ThemeId = keyof typeof themes;

export const themeIds = Object.keys(themes) as ThemeId[];

export const themeList: AppTheme[] = themeIds.map(id => themes[id]);

export const defaultThemeId: ThemeId = 'default';

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && value in themes;

// Release-flag gating (NOT entitlement): the feature flag that must be enabled
// for a theme to appear in the ThemePicker. Themes absent from this map are
// always shown. `default` is intentionally absent.
export const themeReleaseFlag: Partial<Record<ThemeId, FeatureKey>> = {
  dark: 'darkTheme',
  'pastel-kids': 'pastelKidsTheme',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/themeRegistry.test.ts -v`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/themeRegistry.ts src/theme/__tests__/themeRegistry.test.ts
git commit -m "feat(theme): add theme registry as single source of truth"
```

---

## Task 4: Theme storage (AsyncStorage persistence)

**Files:**

- Create: `src/theme/themeStorage.ts`
- Test: `src/theme/__tests__/themeStorage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/themeStorage.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSavedThemeId, saveThemeId, THEME_STORAGE_KEY} from '../themeStorage';

describe('themeStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when nothing was saved', async () => {
    expect(await getSavedThemeId()).toBeNull();
  });

  it('persists and reads back the saved theme id', async () => {
    await saveThemeId('dark');
    expect(await getSavedThemeId()).toBe('dark');
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('returns null if AsyncStorage throws (corrupt/unavailable)', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));
    expect(await getSavedThemeId()).toBeNull();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/themeStorage.test.ts -v`
Expected: FAIL with "Cannot find module '../themeStorage'".

- [ ] **Step 3: Write the storage module**

Create `src/theme/themeStorage.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ThemeId} from './themeRegistry';

export const THEME_STORAGE_KEY = 'app_theme_id';

export async function saveThemeId(id: ThemeId): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Persistence is best-effort; failing to save must not crash the app.
  }
}

export async function getSavedThemeId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}
```

> Note: `getSavedThemeId` returns `string | null` (raw). Validation to a real `ThemeId` happens in the Provider via `isThemeId`, so removed/garbage ids are handled in one place.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/themeStorage.test.ts -v`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/themeStorage.ts src/theme/__tests__/themeStorage.test.ts
git commit -m "feat(theme): add AsyncStorage-backed theme id persistence"
```

---

## Task 5: ThemeProvider + useAppTheme

**Files:**

- Create: `src/theme/useAppTheme.ts`
- Create: `src/theme/ThemeProvider.tsx`
- Create: `src/theme/index.ts`
- Test: `src/theme/__tests__/ThemeProvider.test.tsx`

> The Provider reads the persisted id on mount, validates it (`isThemeId` + the theme's release flag, via the existing `useFeatureEnabled`), and falls back to `default` if invalid/removed/flag-off. `setThemeId` guards the same way. The Provider must sit **inside** `FeatureFlagProvider`.

- [ ] **Step 1: Write the hook (needed by the test and provider)**

Create `src/theme/useAppTheme.ts`:

```ts
import {createContext, useContext} from 'react';
import type {ThemeId} from './themeRegistry';
import type {AppTheme} from './types';

export type ThemeContextValue = {
  theme: AppTheme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/theme/__tests__/ThemeProvider.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '../../release';
import {AppThemeProvider} from '../ThemeProvider';
import {THEME_STORAGE_KEY} from '../themeStorage';
import {useAppTheme} from '../useAppTheme';

function ThemeProbe() {
  const {themeId, setThemeId} = useAppTheme();
  return (
    <Text onPress={() => setThemeId('dark')} testID="probe">
      {themeId}
    </Text>
  );
}

// Use "theme-release" so dark/pastel-kids release flags are ON — otherwise the
// provider correctly refuses to restore/apply a flag-off theme (the default
// "close-beta-1" config has all theme flags off).
function renderWithProviders() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  return act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseName="theme-release">
        <AppThemeProvider>
          <ThemeProbe />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  }).then(() => tree);
}

describe('AppThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('useAppTheme throws outside the provider', () => {
    expect(() =>
      ReactTestRenderer.create(
        <FeatureFlagProvider>
          <ThemeProbe />
        </FeatureFlagProvider>,
      ),
    ).toThrow('useAppTheme must be used within an AppThemeProvider');
  });

  it('defaults to "default" when nothing is persisted', async () => {
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'default',
    );
  });

  it('restores a valid persisted theme on mount', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'dark',
    );
  });

  it('falls back to "default" for an unknown/removed persisted id', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'ocean-removed');
    const tree = await renderWithProviders();
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'default',
    );
  });

  it('setThemeId updates context and persists', async () => {
    const tree = await renderWithProviders();
    await act(async () => {
      tree.root.findByProps({testID: 'probe'}).props.onPress();
    });
    expect(tree.root.findByProps({testID: 'probe'}).props.children).toBe(
      'dark',
    );
    expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/ThemeProvider.test.tsx -v`
Expected: FAIL with "Cannot find module '../ThemeProvider'".

- [ ] **Step 4: Write the Provider**

Create `src/theme/ThemeProvider.tsx`:

```tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useFeatureFlags} from '../release';
import {
  defaultThemeId,
  isThemeId,
  themeReleaseFlag,
  themes,
  type ThemeId,
} from './themeRegistry';
import {getSavedThemeId, saveThemeId} from './themeStorage';
import {ThemeContext} from './useAppTheme';

type Props = {children: React.ReactNode};

export function AppThemeProvider({children}: Props) {
  const {isFeatureEnabled} = useFeatureFlags();
  const [themeId, setThemeIdState] = useState<ThemeId>(defaultThemeId);

  // A theme is allowed if its release flag (if any) is enabled.
  const isThemeAllowed = useCallback(
    (id: ThemeId) => {
      const flag = themeReleaseFlag[id];
      return flag === undefined || isFeatureEnabled(flag);
    },
    [isFeatureEnabled],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getSavedThemeId();
      if (!active) {
        return;
      }
      if (saved !== null && isThemeId(saved) && isThemeAllowed(saved)) {
        setThemeIdState(saved);
      } else {
        setThemeIdState(defaultThemeId);
      }
    })();
    return () => {
      active = false;
    };
  }, [isThemeAllowed]);

  const setThemeId = useCallback(
    (id: ThemeId) => {
      if (!isThemeId(id) || !isThemeAllowed(id)) {
        return; // defense in depth: never apply a removed/disabled theme
      }
      setThemeIdState(id);
      void saveThemeId(id);
    },
    [isThemeAllowed],
  );

  const value = useMemo(
    () => ({theme: themes[themeId], themeId, setThemeId}),
    [themeId, setThemeId],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
```

- [ ] **Step 5: Write the public barrel**

Create `src/theme/index.ts`:

```ts
export {AppThemeProvider} from './ThemeProvider';
export {useAppTheme} from './useAppTheme';
export type {ThemeContextValue} from './useAppTheme';
export {
  defaultThemeId,
  isThemeId,
  themeIds,
  themeList,
  themeReleaseFlag,
  themes,
  type ThemeId,
} from './themeRegistry';
export type {AppTheme} from './types';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/ThemeProvider.test.tsx -v`
Expected: PASS (all 5 tests).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/theme/useAppTheme.ts src/theme/ThemeProvider.tsx src/theme/index.ts src/theme/__tests__/ThemeProvider.test.tsx
git commit -m "feat(theme): add ThemeProvider with persistence, validation, and fallback"
```

---

## Task 6: AppText component

**Files:**

- Create: `src/components/AppText.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/AppText.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, type TextProps} from 'react-native';
import {useAppTheme} from '../theme';

type Variant =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'caption'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLg'
  | 'label';
type ColorToken = 'primary' | 'secondary' | 'muted' | 'inverse' | 'danger';

type Props = TextProps & {
  variant?: Variant;
  color?: ColorToken;
};

export function AppText({
  variant = 'body',
  color = 'primary',
  style,
  ...rest
}: Props) {
  const {theme} = useAppTheme();

  const presetVariants = new Set([
    'display',
    'h1',
    'h2',
    'h3',
    'bodyLg',
    'body',
    'label',
    'caption',
  ]);

  const variantStyle = presetVariants.has(variant)
    ? {
        fontSize:
          theme.typography.presets[
            variant as keyof typeof theme.typography.presets
          ].fontSize,
        lineHeight:
          theme.typography.presets[
            variant as keyof typeof theme.typography.presets
          ].lineHeight,
        fontWeight:
          theme.typography.presets[
            variant as keyof typeof theme.typography.presets
          ].fontWeight,
      }
    : {
        title: {
          fontSize: theme.typography.size.xxl,
          fontWeight: theme.typography.weight.bold,
        },
        subtitle: {
          fontSize: theme.typography.size.md,
          fontWeight: theme.typography.weight.regular,
        },
      }[variant as 'title' | 'subtitle'];

  const colorValue =
    color === 'danger' ? theme.colors.danger : theme.colors.text[color];

  return (
    <Text
      style={StyleSheet.flatten([
        {color: colorValue, fontFamily: theme.typography.fontFamily.primary},
        variantStyle,
        style,
      ])}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppText.tsx
git commit -m "feat(components): add themed AppText"
```

---

## Task 7: AppButton component

**Files:**

- Create: `src/components/AppButton.tsx`
- Test: `src/components/__tests__/AppButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/AppButton.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '../../release';
import {AppThemeProvider} from '../../theme';
import {defaultTheme} from '../../theme/themes/default';
import {AppButton} from '../AppButton';

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  return act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  }).then(() => tree);
}

describe('AppButton', () => {
  it('primary variant uses components.button.primary background', async () => {
    const tree = await render(<AppButton title="Go" onPress={() => {}} />);
    const pressable = tree.root.findByProps({testID: 'app-button'});
    const flattened = Object.assign(
      {},
      ...[].concat(pressable.props.style({pressed: false})),
    );
    expect(flattened.backgroundColor).toBe(
      defaultTheme.components.button.primary.background,
    );
  });

  it('secondary variant uses a border', async () => {
    const tree = await render(
      <AppButton title="Back" variant="secondary" onPress={() => {}} />,
    );
    const pressable = tree.root.findByProps({testID: 'app-button'});
    const flattened = Object.assign(
      {},
      ...[].concat(pressable.props.style({pressed: false})),
    );
    expect(flattened.borderColor).toBe(
      defaultTheme.components.button.secondary.border,
    );
    expect(flattened.borderWidth).toBe(1);
  });

  it('fires onPress', async () => {
    const onPress = jest.fn();
    const tree = await render(<AppButton title="Go" onPress={onPress} />);
    await act(async () => {
      tree.root.findByProps({testID: 'app-button'}).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/AppButton.test.tsx -v`
Expected: FAIL with "Cannot find module '../AppButton'".

- [ ] **Step 3: Write the component**

Create `src/components/AppButton.tsx`:

```tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
} from 'react-native';
import {useAppTheme} from '../theme';

type Variant = 'primary' | 'secondary';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export function AppButton({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  const spec = theme.components.button[variant];

  return (
    <Pressable
      testID="app-button"
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: spec.background,
          height: spec.height,
          borderRadius: spec.radius,
        },
        variant === 'secondary' && {
          borderColor: theme.components.button.secondary.border,
          borderWidth: 1,
        },
        pressed && {opacity: theme.states.pressedOpacity},
        (disabled || loading) && {opacity: theme.states.disabledOpacity},
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={spec.text} />
      ) : (
        <Text
          style={{
            color: spec.text,
            fontSize: theme.typography.size.md,
            fontWeight: theme.typography.weight.bold,
            fontFamily: theme.typography.fontFamily.primary,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/AppButton.test.tsx -v`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AppButton.tsx src/components/__tests__/AppButton.test.tsx
git commit -m "feat(components): add themed AppButton (primary/secondary)"
```

---

## Task 8: AppCard component

**Files:**

- Create: `src/components/AppCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/AppCard.tsx`:

```tsx
import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {useAppTheme} from '../theme';

export function AppCard({style, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;

  return (
    <View
      style={StyleSheet.flatten([
        {
          backgroundColor: spec.background,
          borderRadius: spec.radius,
          padding: spec.padding,
        },
        theme.shadow[spec.shadow],
        style,
      ])}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppCard.tsx
git commit -m "feat(components): add themed AppCard"
```

---

## Task 9: AppScreen component

**Files:**

- Create: `src/components/AppScreen.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/AppScreen.tsx`:

```tsx
import React from 'react';
import {StyleSheet, View, type ViewProps} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '../theme';

export function AppScreen({style, children, ...rest}: ViewProps) {
  const {theme} = useAppTheme();
  return (
    <SafeAreaView
      style={StyleSheet.flatten([
        styles.fill,
        {backgroundColor: theme.colors.background},
        style,
      ])}
      {...rest}
    >
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppScreen.tsx
git commit -m "feat(components): add themed AppScreen"
```

---

## Task 10: ThemePicker component

**Files:**

- Create: `src/components/ThemePicker.tsx`
- Test: `src/components/__tests__/ThemePicker.test.tsx`

> The picker maps over `themeIds`, hides a theme whose release flag is off, and calls `setThemeId` on tap. It reads flags via `useFeatureEnabled`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ThemePicker.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '../../release';
import {AppThemeProvider} from '../../theme';
import {themes} from '../../theme/themeRegistry';
import {ThemePicker} from '../ThemePicker';

// theme-release: themeSystem/themeSwitcher/darkTheme/pastelKidsTheme all ON.
// close-beta-1 (default): all theme flags OFF.
function render(releaseName: 'theme-release' | 'close-beta-1') {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  return act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseName={releaseName}>
        <AppThemeProvider>
          <ThemePicker />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  }).then(() => tree);
}

function labelsOf(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByProps({testID: 'theme-option'})
    .map(n => n.props.accessibilityLabel);
}

describe('ThemePicker', () => {
  it('shows all themes when all theme flags are on (theme-release)', async () => {
    const labels = labelsOf(await render('theme-release'));
    expect(labels).toContain(themes.default.name);
    expect(labels).toContain(themes.dark.name);
    expect(labels).toContain(themes['pastel-kids'].name);
  });

  it('hides flag-gated themes when their flags are off (close-beta-1)', async () => {
    const labels = labelsOf(await render('close-beta-1'));
    expect(labels).toContain(themes.default.name); // ungated, always shown
    expect(labels).not.toContain(themes.dark.name);
    expect(labels).not.toContain(themes['pastel-kids'].name);
  });

  it('applies a theme on tap', async () => {
    const tree = await render('theme-release');
    const darkOption = tree.root
      .findAllByProps({testID: 'theme-option'})
      .find(n => n.props.accessibilityLabel === themes.dark.name)!;
    await act(async () => {
      darkOption.props.onPress();
    });
    expect(darkOption.props.accessibilityState.selected).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/ThemePicker.test.tsx -v`
Expected: FAIL with "Cannot find module '../ThemePicker'".

- [ ] **Step 3: Write the component**

Create `src/components/ThemePicker.tsx`:

```tsx
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useFeatureFlags} from '../release';
import {useAppTheme} from '../theme';
import {themeIds, themeReleaseFlag, themes} from '../theme/themeRegistry';

export function ThemePicker() {
  const {theme, themeId, setThemeId} = useAppTheme();
  const {isFeatureEnabled} = useFeatureFlags();

  const visibleIds = themeIds.filter(id => {
    const flag = themeReleaseFlag[id];
    return flag === undefined || isFeatureEnabled(flag);
  });

  return (
    <View style={styles.row}>
      {visibleIds.map(id => {
        const selected = id === themeId;
        return (
          <Pressable
            key={id}
            testID="theme-option"
            accessibilityRole="button"
            accessibilityLabel={themes[id].name}
            accessibilityState={{selected}}
            onPress={() => setThemeId(id)}
            style={[
              styles.chip,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
              selected && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Text
              style={{
                color: selected
                  ? theme.colors.text.inverse
                  : theme.colors.text.secondary,
                fontSize: theme.typography.size.sm,
                fontWeight: theme.typography.weight.medium,
              }}
            >
              {themes[id].name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/ThemePicker.test.tsx -v`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemePicker.tsx src/components/__tests__/ThemePicker.test.tsx
git commit -m "feat(components): add ThemePicker filtered by release flags"
```

---

## Task 11: Refactor PasteTextScreen to tokens + App\* components

**Files:**

- Modify: `src/modules/input/PasteTextScreen.tsx` (full rewrite of the render + remove `StyleSheet`)

- [ ] **Step 1: Rewrite the screen using theme tokens**

Replace the entire contents of `src/modules/input/PasteTextScreen.tsx` with:

```tsx
import React, {useState} from 'react';
import {ScrollView, TextInput, View} from 'react-native';
import {analyzeTextWithMock} from '../ai-analysis/MockAIAnalysisService';
import {LessonResultView} from '../lesson/LessonResultView';
import type {AIOutput} from '../../shared/schemas/ai-output-v1';
import {validateConfirmedText} from './textValidation';
import {AppButton} from '../../components/AppButton';
import {AppScreen} from '../../components/AppScreen';
import {AppText} from '../../components/AppText';
import {useAppTheme} from '../../theme';

type ScreenState =
  | {type: 'input'}
  | {type: 'loading'}
  | {type: 'result'; lesson: AIOutput}
  | {type: 'error'; message: string};

export function PasteTextScreen() {
  const {theme} = useAppTheme();
  const [text, setText] = useState(
    'We are offering a special discount for new customers.',
  );
  const [screenState, setScreenState] = useState<ScreenState>({type: 'input'});

  async function handleAnalyze() {
    const validation = validateConfirmedText(text);
    if (!validation.valid) {
      setScreenState({type: 'error', message: validation.message});
      return;
    }

    setScreenState({type: 'loading'});
    const result = await analyzeTextWithMock(validation.value);

    if (result.ok) {
      setScreenState({type: 'result', lesson: result.lesson});
    } else {
      setScreenState({type: 'error', message: result.message});
    }
  }

  if (screenState.type === 'result') {
    return (
      <AppScreen>
        <View
          style={{
            borderBottomColor: theme.colors.border,
            borderBottomWidth: 1,
            padding: theme.spacing.lg,
          }}
        >
          <AppButton
            title="Nhập đoạn khác"
            variant="secondary"
            onPress={() => setScreenState({type: 'input'})}
          />
        </View>
        <LessonResultView lesson={screenState.lesson} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          padding: theme.spacing.xl,
        }}
      >
        <View style={{gap: theme.spacing.sm}}>
          <AppText variant="title">LingoBites</AppText>
          <AppText variant="subtitle" color="secondary">
            Dán đoạn tiếng Anh để tạo bài học mẫu trước khi nối OCR và AI thật.
          </AppText>
        </View>

        <TextInput
          multiline
          onChangeText={value => {
            setText(value);
            if (screenState.type === 'error') {
              setScreenState({type: 'input'});
            }
          }}
          placeholder="Dán hoặc nhập đoạn tiếng Anh..."
          placeholderTextColor={theme.components.input.placeholder}
          style={{
            backgroundColor: theme.components.input.background,
            borderColor: theme.components.input.border,
            borderRadius: theme.components.input.radius,
            borderWidth: 1,
            color: theme.components.input.text,
            fontSize: theme.typography.size.md,
            minHeight: 180,
            padding: theme.spacing.md,
          }}
          textAlignVertical="top"
          value={text}
        />

        {screenState.type === 'error' ? (
          <AppText color="danger">{screenState.message}</AppText>
        ) : null}

        <AppButton
          title="Tạo bài học mẫu"
          loading={screenState.type === 'loading'}
          onPress={handleAnalyze}
        />
      </ScrollView>
    </AppScreen>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Confirm no hard-coded colors remain**

Run: `grep -nE "#[0-9a-fA-F]{3,8}" src/modules/input/PasteTextScreen.tsx || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/input/PasteTextScreen.tsx
git commit -m "refactor(input): migrate PasteTextScreen to theme tokens + App* components"
```

---

## Task 12: Refactor LessonResultView to tokens + App\* components

**Files:**

- Modify: `src/modules/lesson/LessonResultView.tsx` (full rewrite)

- [ ] **Step 1: Rewrite using AppText/AppCard + tokens**

Replace the entire contents of `src/modules/lesson/LessonResultView.tsx` with:

```tsx
import React from 'react';
import {ScrollView, View} from 'react-native';
import type {AIOutput} from '../../shared/schemas/ai-output-v1';
import {AppCard} from '../../components/AppCard';
import {AppText} from '../../components/AppText';
import {useAppTheme} from '../../theme';

type Props = {
  lesson: AIOutput;
};

export function LessonResultView({lesson}: Props) {
  const {theme} = useAppTheme();
  return (
    <ScrollView
      contentContainerStyle={{padding: theme.spacing.xl, gap: theme.spacing.lg}}
    >
      <AppText variant="title">{lesson.title}</AppText>
      <AppText color="muted">
        {lesson.detected_language} · {lesson.level}
      </AppText>

      <Section title="Bản gốc">
        <AppText>{lesson.original_text}</AppText>
      </Section>

      <Section title="Dịch tiếng Việt">
        <AppText>{lesson.vietnamese_translation}</AppText>
      </Section>

      <Section title="Tóm tắt">
        <AppText>{lesson.summary || 'Chưa có tóm tắt cho đoạn này.'}</AppText>
      </Section>

      <Section title="Tách câu">
        {lesson.sentences.length === 0 ? (
          <EmptyText />
        ) : (
          lesson.sentences.map(sentence => (
            <AppCard key={sentence.id} style={{gap: theme.spacing.xs}}>
              <AppText
                variant="body"
                color="primary"
                style={{fontWeight: theme.typography.weight.bold}}
              >
                {sentence.original}
              </AppText>
              <AppText>{sentence.translation}</AppText>
              {sentence.simple_meaning ? (
                <AppText color="muted">{sentence.simple_meaning}</AppText>
              ) : null}
            </AppCard>
          ))
        )}
      </Section>

      <Section title="Từ vựng">
        {lesson.vocabulary.length === 0 ? (
          <EmptyText />
        ) : (
          lesson.vocabulary.map(item => (
            <AppCard key={item.id} style={{gap: theme.spacing.xs}}>
              <AppText style={{fontWeight: theme.typography.weight.bold}}>
                {item.word}
              </AppText>
              <AppText>{item.meaning_vi}</AppText>
              {item.example ? (
                <AppText color="muted">{item.example}</AppText>
              ) : null}
            </AppCard>
          ))
        )}
      </Section>

      <Section title="Ngữ pháp">
        {lesson.grammar_points.length === 0 ? (
          <EmptyText />
        ) : (
          lesson.grammar_points.map(item => (
            <AppCard key={item.id} style={{gap: theme.spacing.xs}}>
              <AppText style={{fontWeight: theme.typography.weight.bold}}>
                {item.vietnamese_name || item.name}
              </AppText>
              <AppText>{item.explanation_vi}</AppText>
            </AppCard>
          ))
        )}
      </Section>

      <Section title="Luyện tập">
        {lesson.practice.length === 0 ? (
          <EmptyText />
        ) : (
          lesson.practice.map(item => (
            <AppCard key={item.id} style={{gap: theme.spacing.xs}}>
              <AppText style={{fontWeight: theme.typography.weight.bold}}>
                {item.question}
              </AppText>
              <AppText>Đáp án: {item.answer}</AppText>
            </AppCard>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({title, children}: React.PropsWithChildren<{title: string}>) {
  const {theme} = useAppTheme();
  return (
    <View style={{gap: theme.spacing.sm}}>
      <AppText
        variant="subtitle"
        style={{fontWeight: theme.typography.weight.bold}}
      >
        {title}
      </AppText>
      {children}
    </View>
  );
}

function EmptyText() {
  return <AppText color="muted">Chưa có nội dung cho phần này.</AppText>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Confirm no hard-coded colors remain**

Run: `grep -nE "#[0-9a-fA-F]{3,8}" src/modules/lesson/LessonResultView.tsx || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/lesson/LessonResultView.tsx
git commit -m "refactor(lesson): migrate LessonResultView to theme tokens + App* components"
```

---

## Task 13: Migrate ProfileScreen and host ThemePicker

**Files:**

- Modify: `src/modules/settings/ProfileScreen.tsx` (migrate to `App*` + tokens; add `ThemePicker`)
- Modify: `src/modules/settings/__tests__/ProfileScreen.test.tsx` (wrap in providers)

> Per theme spec §7 and BA `03-theme-system.md` §9: **Profile** is the product home for theme
> switching (`01-user-flow` §12). Do not place `ThemePicker` on input screens.

- [ ] **Step 1: Rewrite ProfileScreen using theme tokens**

Replace the entire contents of `src/modules/settings/ProfileScreen.tsx` with:

```tsx
import React, {useState} from 'react';
import {Alert, Linking, Pressable, ScrollView, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from '../../app/navigation/types';
import {AppCard} from '../../components/AppCard';
import {AppScreen} from '../../components/AppScreen';
import {AppText} from '../../components/AppText';
import {ThemePicker} from '../../components/ThemePicker';
import {
  CLEAR_DATA_CONFIRM_MESSAGE,
  CLEAR_DATA_DONE_MESSAGE,
} from '../../shared/copy/userMessages';
import {getSupportEmail} from '../../shared/api/appConfig';
import {clearAllLocalData} from '../../shared/db/LessonRepository';
import {useAppTheme} from '../../theme';
import {PRIVACY_NOTE_BODY, SUPPORT_PROMPT} from './privacyCopy';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const supportEmail = getSupportEmail();

  function handleClearData() {
    Alert.alert('Xóa dữ liệu local', CLEAR_DATA_CONFIRM_MESSAGE, [
      {text: 'Hủy', style: 'cancel'},
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          clearAllLocalData();
          setStatusMessage(CLEAR_DATA_DONE_MESSAGE);
        },
      },
    ]);
  }

  function handleSupport() {
    const subject = encodeURIComponent('LingoBites — Góp ý / báo lỗi');
    void Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          padding: theme.spacing.xl,
        }}
      >
        <AppText variant="title" accessibilityRole="header">
          Hồ sơ
        </AppText>
        <AppText variant="subtitle" color="secondary">
          Cài đặt học tập và quyền riêng tư trên thiết bị.
        </AppText>

        <AppCard style={{gap: theme.spacing.sm}}>
          <AppText style={{fontWeight: theme.typography.weight.bold}}>
            Trình độ học
          </AppText>
          <AppText color="secondary">Beginner (mặc định Phase 0)</AppText>
        </AppCard>

        <AppCard style={{gap: theme.spacing.sm}}>
          <AppText style={{fontWeight: theme.typography.weight.bold}}>
            Giao diện
          </AppText>
          <AppText color="secondary">
            Chọn giao diện ưa thích — áp dụng ngay cho toàn app.
          </AppText>
          <ThemePicker />
        </AppCard>

        <AppCard style={{gap: theme.spacing.sm}}>
          <AppText style={{fontWeight: theme.typography.weight.bold}}>
            Quyền riêng tư
          </AppText>
          <AppText color="secondary">{PRIVACY_NOTE_BODY}</AppText>
          <Pressable
            accessibilityLabel="Xem chi tiết quyền riêng tư"
            accessibilityRole="button"
            onPress={() => navigation.navigate('PrivacyNote')}
            style={{minHeight: 44, justifyContent: 'center'}}
          >
            <AppText
              style={{
                color: theme.colors.primary,
                fontWeight: theme.typography.weight.bold,
              }}
            >
              Xem chi tiết
            </AppText>
          </Pressable>
        </AppCard>

        <AppCard style={{gap: theme.spacing.sm}}>
          <AppText style={{fontWeight: theme.typography.weight.bold}}>
            Hỗ trợ & góp ý
          </AppText>
          <AppText color="secondary">{SUPPORT_PROMPT}</AppText>
          <Pressable
            accessibilityLabel="Gửi email hỗ trợ"
            accessibilityRole="button"
            onPress={handleSupport}
            style={{minHeight: 44, justifyContent: 'center'}}
          >
            <AppText
              style={{
                color: theme.colors.primary,
                fontWeight: theme.typography.weight.bold,
              }}
            >
              {supportEmail}
            </AppText>
          </Pressable>
        </AppCard>

        <Pressable
          accessibilityLabel="Xóa dữ liệu học trên máy"
          accessibilityRole="button"
          onPress={handleClearData}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.danger,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            justifyContent: 'center',
            marginTop: theme.spacing.sm,
            minHeight: 48,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <AppText
            color="danger"
            style={{fontWeight: theme.typography.weight.bold}}
          >
            Xóa dữ liệu học trên máy
          </AppText>
        </Pressable>

        {statusMessage ? (
          <AppText color="secondary">{statusMessage}</AppText>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
```

- [ ] **Step 2: Update ProfileScreen tests to include providers**

At the top of `src/modules/settings/__tests__/ProfileScreen.test.tsx`, add:

```tsx
import {FeatureFlagProvider} from '../../../release';
import {AppThemeProvider} from '../../../theme';

function renderProfileScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <ProfileScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}
```

Replace each `ReactTestRenderer.create(<ProfileScreen navigation={navigation} route={route} />)` with `renderProfileScreen()`.

- [ ] **Step 3: Confirm no hard-coded colors remain**

Run: `grep -nE "#[0-9a-fA-F]{3,8}" src/modules/settings/ProfileScreen.tsx || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Run ProfileScreen tests**

Run: `npx jest src/modules/settings/__tests__/ProfileScreen.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/settings/ProfileScreen.tsx src/modules/settings/__tests__/ProfileScreen.test.tsx
git commit -m "refactor(settings): migrate ProfileScreen to theme tokens and host ThemePicker"
```

---

## Task 14: Wire AppThemeProvider into App.tsx

**Files:**

- Modify: `App.tsx`

- [ ] **Step 1: Update the provider tree**

Insert `AppThemeProvider` around the navigator. Keep analytics and global error handler. Provider order per theme spec §7: `FeatureFlagProvider` → `SafeAreaProvider` → `AppThemeProvider` → screens.

Replace the return block in `App.tsx` with:

```tsx
import {AppThemeProvider} from './src/theme';

// ...existing imports and useEffect...

return (
  <FeatureFlagProvider>
    <SafeAreaProvider>
      <AppThemeProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  </FeatureFlagProvider>
);
```

- [ ] **Step 2: Run the existing App smoke test**

Run: `npx jest __tests__/App.test.tsx -v`
Expected: PASS (App renders inside the new provider tree).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(app): wrap AppNavigator in AppThemeProvider"
```

---

## Task 15: Parametrized "render all themes" test

**Files:**

- Test: `src/theme/__tests__/themes.render.test.tsx`

> This test loops `themeList`, so any future theme is automatically covered without editing the test.

- [ ] **Step 1: Write the test**

Create `src/theme/__tests__/themes.render.test.tsx`:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '../../release';
import {AppButton} from '../../components/AppButton';
import {AppCard} from '../../components/AppCard';
import {AppText} from '../../components/AppText';
import {AppThemeProvider} from '../ThemeProvider';
import {themeList} from '../themeRegistry';
import {THEME_STORAGE_KEY} from '../themeStorage';

describe('every registered theme renders App* components', () => {
  themeList.forEach(theme => {
    it(`renders under "${theme.id}"`, async () => {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme.id);
      await act(async () => {
        ReactTestRenderer.create(
          <FeatureFlagProvider releaseName="theme-release">
            <AppThemeProvider>
              <>
                <AppText variant="title">{theme.name}</AppText>
                <AppCard>
                  <AppText>body</AppText>
                </AppCard>
                <AppButton title="Primary" onPress={() => {}} />
                <AppButton
                  title="Secondary"
                  variant="secondary"
                  onPress={() => {}}
                />
              </>
            </AppThemeProvider>
          </FeatureFlagProvider>,
        );
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/themes.render.test.tsx -v`
Expected: PASS (one test per theme: default, dark, pastel-kids).

- [ ] **Step 3: Commit**

```bash
git add src/theme/__tests__/themes.render.test.tsx
git commit -m "test(theme): parametrized render of every registered theme"
```

---

## Task 16: ESLint guard against color literals + full green run

**Files:**

- Modify: `.eslintrc.js`

> The `@react-native` config bundles `eslint-plugin-react-native`, which provides `no-color-literals` and `no-inline-styles`. We enable them only for `src/components` + `src/modules` (the App\* components legitimately read token values into inline `style={{...}}` objects, which is allowed — these rules flag literal colors and untokenized values, not theme-derived ones). `no-inline-styles` would be too noisy given our token-driven inline styles, so we enable only `no-color-literals`, which is what actually enforces "no hard-coded colors."

- [ ] **Step 1: Add the override**

Replace `.eslintrc.js` with:

```js
module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['src/components/**/*.tsx', 'src/modules/**/*.tsx'],
      rules: {
        'react-native/no-color-literals': 'error',
      },
    },
  ],
};
```

- [ ] **Step 2: Run lint on the guarded paths**

Run: `npx eslint src/components src/modules`
Expected: PASS (no color-literal errors — Tasks 11–13 already removed them). If any error appears, replace the offending literal with the matching `theme.*` token and re-run.

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: PASS (all suites green).

- [ ] **Step 4: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.js
git commit -m "chore(mobile): enforce no-color-literals in components and screens"
```

---

## Done criteria (maps to spec §8 + BR/FR)

- [ ] `npx jest` and `npx tsc --noEmit` both pass.
- [ ] Registry is the single source of truth: `ThemeId = keyof typeof themes`; no hand-written union (FR-THEME-012, BR-THEME-010).
- [ ] 3 themes fully implement `AppTheme` with no TS errors (FR-THEME-008).
- [ ] Runtime switch + persistence + restore work; unknown/removed id falls back to `default` (FR-THEME-005/006/013, BR-THEME-011).
- [ ] `useAppTheme()` outside the provider throws (FR-THEME-007).
- [ ] `ThemePicker` filters by release flag (FR-THEME-014).
- [ ] `ThemePicker` is hosted on `ProfileScreen`, not input screens (theme spec §7, TC-024).
- [ ] `pastel-kids` uses handoff teal/coral/gold palette; `default` keeps blue identity (BR-THEME-007).
- [ ] `PasteTextScreen` + `LessonResultView` + `ProfileScreen` contain no hard-coded colors; ESLint `no-color-literals` active on `src/modules` + `src/components` (FR-THEME-002/009/015, TC-028).
- [ ] Parametrized render test covers every registered theme (TC-027).
- [ ] No entitlement/monetization/`'system'` code was added (spec §12 out of scope).
- [ ] `docs/01-ba/03-requirements/05-traceability-matrix.md` §3 — Status updated for FR-THEME-001..015 (and related TC-024..030 notes if applicable).
- [ ] Phase 1 UI handoff unblocked — follow [`plans/2026-06-05-lingobites-ui.md`](2026-06-05-lingobites-ui.md) Task 0 gate; roadmap: [`docs/superpowers/README.md`](../README.md).
