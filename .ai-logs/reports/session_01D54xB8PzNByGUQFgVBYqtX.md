# Video card layout: centred play button

## Work
- Play disc now sits centred over the thumbnail on both video cards (hero ~60px, row ~36px), in the card's ink colour with a light ring and medium theme shadow.
- Removed the "Xem" pill on the hero card and the play disc on the right of row cards.
- Removed the "Video" meta label on the Explore video shelf; only "N bài học" remains when the video has lessons, otherwise the line is hidden.

## Files
- `src/features/lesson/library/components/ExploreCards.tsx`: new `PlayDisc`, layout changes, `meta` now optional.
- `src/features/lesson/library/components/tabs/ExploreTab.tsx`: meta = lesson count only.

## Dependencies
None.

## Checks
eslint, tsc, jest `src/features/lesson/library` (24 suites, 205 tests) pass. Not verified on a device/simulator.

## Review
- Visual check on iOS/Android (ring colour uses `theme.colors.onOverlay`, shadow `theme.shadow.medium`).
- `videoContextLabel` in the full video list (PublicLessonsList) still shows "Video"; unchanged.
