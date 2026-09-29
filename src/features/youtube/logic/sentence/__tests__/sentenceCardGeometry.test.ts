import {
  AXIS_LOCK_THRESHOLD_PT,
  CARD_BORDER_RADIUS_PT,
  CARD_HEADER_HEIGHT_PT,
  CARD_SPACING_PT,
  CARD_WIDTH_OFFSET_PT,
  CAROUSEL_HORIZONTAL_PADDING_PT,
  PINNED_AUDIO_BUTTON_SIZE_PT,
  SNAP_DISTANCE_RATIO,
  SNAP_VELOCITY_THRESHOLD_PT_PER_MS,
  calculateNearestCardIndex,
  calculateSnapIndex,
  formatCardHeaderTitle,
  formatGrammarBottomHint,
  formatNextSentencePrompt,
  getCardPeekWidth,
  getCardSnapInterval,
  getCardWidth,
  resolveAxisLock,
  shouldShowPinnedSentence,
} from '../sentenceCardGeometry';

describe('sentenceCardGeometry (SETE-330 & SETE-336 logic tests)', () => {
  describe('Constants and dimensions', () => {
    it('defines spec-compliant dimensions', () => {
      expect(CAROUSEL_HORIZONTAL_PADDING_PT).toBe(12);
      expect(CARD_WIDTH_OFFSET_PT).toBe(24);
      expect(CARD_SPACING_PT).toBe(10);
      expect(CARD_BORDER_RADIUS_PT).toBe(26);
      expect(CARD_HEADER_HEIGHT_PT).toBe(48);
      expect(PINNED_AUDIO_BUTTON_SIZE_PT).toBe(32);
      expect(AXIS_LOCK_THRESHOLD_PT).toBe(10);
      expect(SNAP_DISTANCE_RATIO).toBe(0.35);
      expect(SNAP_VELOCITY_THRESHOLD_PT_PER_MS).toBe(0.5);
    });

    it('computes card width as screen width - 24', () => {
      expect(getCardWidth(390)).toBe(366);
      expect(getCardWidth(375)).toBe(351);
      expect(getCardWidth(428)).toBe(404);
      expect(getCardWidth(20)).toBe(0); // clamped at 0
    });

    it('computes snap interval as cardWidth + 10 (screenWidth - 14)', () => {
      expect(getCardSnapInterval(390)).toBe(376);
      expect(getCardSnapInterval(375)).toBe(361);
    });

    it('computes peek width on trailing edge in 12–16pt range', () => {
      const peek = getCardPeekWidth(390);
      expect(peek).toBeGreaterThanOrEqual(12);
      expect(peek).toBeLessThanOrEqual(16);
      expect(peek).toBe(14);
    });
  });

  describe('Carousel snapping logic', () => {
    const cardWidth = 363; // 390 - 27
    const totalCards = 5;

    it('stays on current card when displacement and velocity are below threshold', () => {
      // 35% of 363 is 127.05
      const target = calculateSnapIndex({
        currentIndex: 2,
        offsetDeltaX: 100,
        velocityX: 0.2,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(2);
    });

    it('snaps to next card when displacement exceeds 35% of width', () => {
      const target = calculateSnapIndex({
        currentIndex: 2,
        offsetDeltaX: 130, // > 127.05
        velocityX: 0,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(3);
    });

    it('snaps to next card when velocity exceeds 0.5 pt/ms', () => {
      const target = calculateSnapIndex({
        currentIndex: 2,
        offsetDeltaX: 20,
        velocityX: 0.6, // > 0.5
        cardWidth,
        totalCards,
      });
      expect(target).toBe(3);
    });

    it('clamps next card index at totalCards - 1', () => {
      const target = calculateSnapIndex({
        currentIndex: 4,
        offsetDeltaX: 200,
        velocityX: 1.0,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(4);
    });

    it('snaps to previous card when backward displacement exceeds 35%', () => {
      const target = calculateSnapIndex({
        currentIndex: 2,
        offsetDeltaX: -130,
        velocityX: 0,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(1);
    });

    it('snaps to previous card when backward velocity exceeds 0.5 pt/ms', () => {
      const target = calculateSnapIndex({
        currentIndex: 2,
        offsetDeltaX: -10,
        velocityX: -0.7,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(1);
    });

    it('clamps previous card index at 0', () => {
      const target = calculateSnapIndex({
        currentIndex: 0,
        offsetDeltaX: -200,
        velocityX: -1.0,
        cardWidth,
        totalCards,
      });
      expect(target).toBe(0);
    });

    it('calculates nearest card index from continuous scroll offset', () => {
      const screenWidth = 390; // interval = 376
      expect(calculateNearestCardIndex(0, screenWidth, 5)).toBe(0);
      expect(calculateNearestCardIndex(100, screenWidth, 5)).toBe(0);
      expect(calculateNearestCardIndex(200, screenWidth, 5)).toBe(1);
      expect(calculateNearestCardIndex(376, screenWidth, 5)).toBe(1);
      expect(calculateNearestCardIndex(752, screenWidth, 5)).toBe(2);
      expect(calculateNearestCardIndex(2000, screenWidth, 5)).toBe(4); // clamped
    });
  });

  describe('Axis locking logic', () => {
    it('returns null when movement in both axes is under 10pt threshold', () => {
      expect(resolveAxisLock(5, 5)).toBe(null);
      expect(resolveAxisLock(-9, 8)).toBe(null);
      expect(resolveAxisLock(0, 0)).toBe(null);
    });

    it('locks to horizontal when dx reaches 10pt and is >= dy', () => {
      expect(resolveAxisLock(10, 5)).toBe('horizontal');
      expect(resolveAxisLock(-12, 6)).toBe('horizontal');
      expect(resolveAxisLock(10, 10)).toBe('horizontal');
    });

    it('locks to vertical when dy reaches 10pt and is > dx', () => {
      expect(resolveAxisLock(5, 10)).toBe('vertical');
      expect(resolveAxisLock(3, -15)).toBe('vertical');
      expect(resolveAxisLock(-8, 12)).toBe('vertical');
    });

    it('preserves an existing lock during the gesture', () => {
      expect(resolveAxisLock(2, 50, 'horizontal')).toBe('horizontal');
      expect(resolveAxisLock(50, 2, 'vertical')).toBe('vertical');
    });
  });

  describe('Sticky pinned sentence logic', () => {
    it('shows pinned sentence when scrollY reaches or exceeds sentence block height', () => {
      expect(shouldShowPinnedSentence(50, 80)).toBe(false);
      expect(shouldShowPinnedSentence(80, 80)).toBe(true);
      expect(shouldShowPinnedSentence(120, 80)).toBe(true);
    });

    it('does not show pinned sentence when height is 0 or negative', () => {
      expect(shouldShowPinnedSentence(50, 0)).toBe(false);
    });
  });

  describe('Formatting helpers', () => {
    it('formats card header title with total', () => {
      expect(formatCardHeaderTitle(1, 10)).toBe('Câu 1/10');
      expect(formatCardHeaderTitle(4, 7)).toBe('Câu 4/7');
    });

    it('formats card header title without total', () => {
      expect(formatCardHeaderTitle(3)).toBe('Câu 3');
    });

    it('formats remaining grammar bottom hint', () => {
      expect(formatGrammarBottomHint(2)).toBe(
        'cuộn xuống · còn 2 điểm ngữ pháp',
      );
      expect(formatGrammarBottomHint(1)).toBe(
        'cuộn xuống · còn 1 điểm ngữ pháp',
      );
    });

    it('formats next sentence prompt', () => {
      expect(formatNextSentencePrompt(2)).toBe('Vuốt ngang để sang câu 2 →');
      expect(formatNextSentencePrompt(5)).toBe('Vuốt ngang để sang câu 5 →');
    });
  });
});
