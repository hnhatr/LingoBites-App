/**
 * SETE-330 (TASK-3, Stage 2): Pure geometry, layout, snap, and axis-locking
 * calculations for the horizontal sentence carousel and cards.
 *
 * Spec requirements (SETE-321 mục 4, 5, 6):
 * - Card width: screen width − 27pt, border radius 26, spacing 10, peek 12–16pt.
 * - Header: 48pt fixed (Câu N/M · level · Ẩn dịch · Lưu thẻ).
 * - Axis locking: lock axis after first 10pt of movement.
 * - Carousel snap: snap threshold 35% card width or 0.5 pt/ms velocity.
 * - Sticky pinned sentence: threshold when scrolled past the sentence block.
 * - Pinned audio button: 32pt.
 */

export const CAROUSEL_HORIZONTAL_PADDING_PT = 12;
export const CARD_WIDTH_OFFSET_PT = 24;
export const CARD_SPACING_PT = 10;
export const CARD_BORDER_RADIUS_PT = 26;
export const CARD_HEADER_HEIGHT_PT = 48;
export const PINNED_AUDIO_BUTTON_SIZE_PT = 32;

export const AXIS_LOCK_THRESHOLD_PT = 10;
export const SNAP_DISTANCE_RATIO = 0.35;
export const SNAP_VELOCITY_THRESHOLD_PT_PER_MS = 0.5;

export type AxisLock = 'horizontal' | 'vertical' | null;

/**
 * Calculates the width of a sentence card based on screen width.
 * Formula: screenWidth - 24pt.
 */
export function getCardWidth(screenWidth: number): number {
  return Math.max(0, screenWidth - CARD_WIDTH_OFFSET_PT);
}

/**
 * Interval between snapping points in the horizontal carousel.
 * Formula: cardWidth + cardSpacing = screenWidth - 14pt.
 */
export function getCardSnapInterval(screenWidth: number): number {
  return getCardWidth(screenWidth) + CARD_SPACING_PT;
}

/**
 * Approximate peek width visible on the trailing edge of the viewport.
 * Formula: screenWidth - snapInterval = 12–16pt (14pt for default 10pt spacing).
 */
export function getCardPeekWidth(screenWidth: number): number {
  const cardWidth = getCardWidth(screenWidth);
  // When card 0 is at x=0, next card starts at snapInterval (cardWidth + CARD_SPACING_PT).
  // Visible slice of next card is screenWidth - snapInterval.
  return Math.max(0, screenWidth - (cardWidth + CARD_SPACING_PT));
}

export type SnapIndexParams = {
  currentIndex: number;
  offsetDeltaX: number;
  velocityX: number;
  cardWidth: number;
  totalCards: number;
};

/**
 * Determines the target card index to snap to after a horizontal drag/swipe.
 * Snaps to next/prev if drag distance exceeds 35% of card width OR velocity exceeds 0.5 pt/ms.
 *
 * `offsetDeltaX` > 0 indicates moving forward (swiping left / content shifted left).
 * `offsetDeltaX` < 0 indicates moving backward (swiping right).
 * `velocityX` > 0 indicates forward swipe velocity; < 0 indicates backward.
 */
export function calculateSnapIndex({
  currentIndex,
  offsetDeltaX,
  velocityX,
  cardWidth,
  totalCards,
}: SnapIndexParams): number {
  if (totalCards <= 1) {
    return 0;
  }

  const distanceThreshold = cardWidth * SNAP_DISTANCE_RATIO;
  const isForward =
    velocityX > SNAP_VELOCITY_THRESHOLD_PT_PER_MS ||
    offsetDeltaX > distanceThreshold;
  const isBackward =
    velocityX < -SNAP_VELOCITY_THRESHOLD_PT_PER_MS ||
    offsetDeltaX < -distanceThreshold;

  if (isForward) {
    return Math.min(totalCards - 1, currentIndex + 1);
  }
  if (isBackward) {
    return Math.max(0, currentIndex - 1);
  }
  return currentIndex;
}

/**
 * Calculates the nearest card index from a continuous horizontal scroll offset.
 */
export function calculateNearestCardIndex(
  scrollX: number,
  screenWidth: number,
  totalCards: number,
): number {
  if (totalCards <= 1) {
    return 0;
  }
  const snapInterval = getCardSnapInterval(screenWidth);
  if (snapInterval <= 0) {
    return 0;
  }
  const rawIndex = Math.round(scrollX / snapInterval);
  return Math.max(0, Math.min(totalCards - 1, rawIndex));
}

/**
 * Resolves axis locking based on 2D displacement (dx, dy).
 * Locks to 'horizontal' or 'vertical' once displacement reaches 10pt.
 * Once locked, the current lock persists until reset (new gesture).
 */
export function resolveAxisLock(
  dx: number,
  dy: number,
  currentLock: AxisLock = null,
): AxisLock {
  if (currentLock !== null) {
    return currentLock;
  }
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < AXIS_LOCK_THRESHOLD_PT && absDy < AXIS_LOCK_THRESHOLD_PT) {
    return null;
  }

  if (absDx >= absDy) {
    return 'horizontal';
  }
  return 'vertical';
}

/**
 * Determines whether the sticky pinned sentence header should be displayed.
 * Shows when vertical scroll position reaches or exceeds the sentence block bottom.
 */
export function shouldShowPinnedSentence(
  scrollY: number,
  sentenceBlockHeight: number,
): boolean {
  if (sentenceBlockHeight <= 0) {
    return false;
  }
  return scrollY >= sentenceBlockHeight;
}

/**
 * Formats the bottom hint showing remaining grammar points.
 */
export function formatGrammarBottomHint(remainingCount: number): string {
  return `cuộn xuống · còn ${remainingCount} điểm ngữ pháp`;
}

/**
 * Formats the prompt at the bottom of the card to swipe to next sentence.
 * nextIndex1Based is 1-based index (e.g. 2 for sentence 2).
 */
export function formatNextSentencePrompt(nextIndex1Based: number): string {
  return `Vuốt ngang để sang câu ${nextIndex1Based} →`;
}

/**
 * Formats the fixed card header title: `Câu N/M` or `Câu N`.
 */
export function formatCardHeaderTitle(
  index1Based: number,
  total?: number,
): string {
  if (total != null && total > 0) {
    return `Câu ${index1Based}/${total}`;
  }
  return `Câu ${index1Based}`;
}
