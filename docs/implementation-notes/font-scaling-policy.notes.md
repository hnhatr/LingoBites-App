# Font Scaling Policy (SETE-125)

## Decision

Approved by the project owner (2026-09-08, comment on SETE-125): **Option B — per-variant `maxFontSizeMultiplier` caps**, not Option A (no cap) or Option C (disable `allowFontScaling`).

`allowFontScaling` stays enabled everywhere (RN default) — text still grows with the OS accessibility setting, which Option C would have regressed. What changes is that growth is now bounded per typography variant so fixed/min-height layouts (e.g. `FlipCard`) don't overflow unpredictably at the largest system font size.

## Where it lives

`src/theme/tokens.ts` — `typographyPresets`, one `maxFontSizeMultiplier` value per variant, alongside `fontSize`/`lineHeight`/`fontWeight`. All 7 themes (`src/theme/themes/*.ts`) spread `typographyPresets` wholesale into `presets`, so the caps apply uniformly across themes with no duplication.

`src/components/AppText.tsx` reads `preset.maxFontSizeMultiplier` and passes it to the underlying `Text`'s `maxFontSizeMultiplier` prop by default. A caller can still override it via the `maxFontSizeMultiplier` prop on `AppText` for the rare case that needs a different cap — but the default must come from the token table, not a hardcoded number in a component.

## Groups and values

| Group           | Variants                             | Cap | Rationale                                                                                                          |
| --------------- | ------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------ |
| Headings        | `display`, `h1`, `h2`, `h3`, `title` | 1.5 | Large type already reads well scaled; layouts (headers, cards) have the least vertical slack for these.            |
| Body            | `subtitle`, `bodyLg`, `body`         | 2.0 | Reading text benefits most from scaling; these mostly sit in scrollable containers with room to grow.              |
| Labels/captions | `label`, `caption`                   | 1.3 | Smallest text, often inside tight rows (chips, list rows, badges) where uncontrolled growth breaks layout fastest. |

These are the same three groups from the issue's Option B proposal. `title` was grouped with headings (32px/xxl scale, used for hero-style copy) and `subtitle` was grouped with body (16px/md scale, prose-like usage) — both variants existed in the codebase but weren't explicitly named in the issue, so this note records where they landed.

## Not done in this issue

Visual verification at maximum OS font size (Việc 3) requires an iOS/Android device or simulator, which is not available in this agent's environment — it was **not performed**, and no screenshots exist. This is a gap against the issue's Definition of Done, not a silent skip: it should be picked up as a follow-up (manual QA pass, or a dedicated issue) before this policy is considered fully verified.

Static review (grep for `minHeight`/`height` combined with text content) flags `src/components/FlipCard.tsx` (`minHeight: 220`) and `src/components/AppButton.tsx` (fixed `height: spec.height` around a text label) as the components most likely to show clipping at the largest scale — both use `body`/`label`-range text now capped at 1.3–2.0x rather than uncapped growth, which should reduce but not guarantee no overflow. This list is a static-analysis guess, not a substitute for the required visual pass.

## Guardrail

Do not add a hardcoded `fontSize`, `maxFontSizeMultiplier`, or `allowFontScaling` to an individual component. If a screen needs different scaling behavior, either add/adjust a variant in `typographyPresets` or pass the `maxFontSizeMultiplier` override prop on `AppText` — never a magic number scattered in component styles.
