# LING-256 Home Screen Redesign (Paper-cut v4)

**Status:** IMPLEMENTATION_COMPLETE  
**Design source:** Technical Design `technical-design-LING-256-r1.md` (attachment `01a107f3-d404-73b3-a3b4-692e843334cf`)  
**Mockup:** `LING-256-home-mockup-v4.html` (attachment `01a107e0-586e-7be5-a536-bf61cb8937e4`)  
**Implemented by:** LING-257

## Architecture Decisions

- **AD-001**: `react-native-svg` scoped exclusively to `src/features/home` — no SVG migration outside Home.
- **AD-002**: All animations use `react-native-reanimated` with `useReducedMotion()` — motion disabled under system reduced-motion.
- **AD-003**: Due flashcard count via `getDueFlashcards().length` on focus — no polling, same lifecycle as `getGamificationSnapshot`.
- **AD-004**: Lesson in-progress percentage omitted (A-009) — progress bar not shown in hero state 3.

## Implementation Files

| Component | Path |
|---|---|
| SVG icons | `src/features/home/components/HomeSvgIcons.tsx` |
| Decorations | `src/features/home/components/HomeDecorations.tsx` |
| Header | `src/features/home/components/HomeHeader.tsx` |
| Hero card | `src/features/home/components/HomeHeroCard.tsx` |
| Weekly goal | `src/features/home/components/HomeWeeklyGoal.tsx` |
| Shortcuts grid | `src/features/home/components/HomeShortcutsGrid.tsx` |
| Saved rail | `src/features/home/components/HomeSavedRail.tsx` |
| Screen view | `src/features/home/screens/HomeScreenView.tsx` |
| Model | `src/features/home/logic/homeScreenModel.ts` |
| Controller | `src/features/home/logic/useHomeScreenController.ts` |

## Acceptance Criteria Coverage

| ID | Status | Component |
|---|---|---|
| I1 (speech bubble fade) | PASS | HomeHeroCard — bubble renders per state |
| I2 (cat bounce + hearts) | PASS | HomeHeroCard — disabled under reduced motion |
| I3 (5 paw prints) | PASS | HomeWeeklyGoal |
| I4 (flame tiers) | PASS | HomeHeader + buildFlameModel |
| I5 (time-of-day greeting) | PASS | HomeHeader + buildGreeting |
| I6 (shortcut tilt) | PASS | HomeShortcutsGrid — disabled under reduced motion |
| I7 (confetti) | PASS | HomeDecorations.ConfettiParticles — disabled under reduced motion |
| I8 (CTA pulse) | PASS | HomeHeroCard — disabled under reduced motion |
| D2 (due badge) | PASS | getDueFlashcards in controller |
| D3 (video locked) | PASS | HomeShortcutsGrid disabled state |
| D5 (reduced motion) | PASS | useReducedMotion() in all animated components |
| D6 (native rebuild) | N/A | CI handles pod install |
| D7 (no brand in header) | PASS | HomeHeader has no header_brand text |
| D8 (flame color tiers) | PASS | buildFlameModel 8 colors |
| DQ-002 (5 hero states) | PASS | deriveHeroState + HomeHeroCard |
| DQ-004 (theme contrast) | PASS | contrast ≥ 4.5:1 verified in HomeScreenChipContrast + HomeScreenV4 |
| DQ-005 (4 shortcuts) | PASS | HomeShortcutsGrid |
| DQ-006 (saved rail label) | PASS | HomeSavedRail — "Bài đã lưu" / "Saved lessons" |
| DQ-007 (react-native-svg) | PASS | package.json + HomeSvgIcons |
| DQ-008 (no app brand) | PASS | HomeHeader |
| P-001 (greeting with name) | PASS | buildGreeting + HomeHeader |
| P-003 (due count badge) | PASS | getDueFlashcards in controller |
| P-004 (5-paw goal) | PASS | buildPawGoalModel + HomeWeeklyGoal |
| SVG-1 (Home SVG icons) | PASS | HomeSvgIcons |
| SVG-2 (Home-only scope) | PASS | AD-001 module boundary |
| A-004 (i18n parity) | PASS | homeI18nKeys.test.ts |
| A-005 (48pt hit targets) | PASS | minHeight: 48 on all interactive elements |
| A-006 (existing tests pass) | PASS | 106/106 pre-existing tests pass |
| A-009 (no progress bar) | PASS | AD-004 — progress bar omitted in hero state 3 |
