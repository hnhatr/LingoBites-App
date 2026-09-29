import {
  abWrap,
  checkDictation,
  formatLoopLabel,
  nextLoopOption,
  normalizeForDictation,
  shouldShowDots,
  toolsBadgeActive,
} from '../toolsLogic';

describe('toolsLogic (SETE-332, TASK-5)', () => {
  describe('shouldShowDots', () => {
    it('shows dots only when sentence count <= 10', () => {
      expect(shouldShowDots(0)).toBe(false);
      expect(shouldShowDots(1)).toBe(true);
      expect(shouldShowDots(7)).toBe(true);
      expect(shouldShowDots(10)).toBe(true);
      expect(shouldShowDots(11)).toBe(false);
      expect(shouldShowDots(50)).toBe(false);
    });
  });

  describe('formatLoopLabel & nextLoopOption', () => {
    it('formats loop labels correctly', () => {
      expect(formatLoopLabel(1)).toBe('1');
      expect(formatLoopLabel(3)).toBe('3');
      expect(formatLoopLabel(5)).toBe('5');
      expect(formatLoopLabel(Infinity)).toBe('∞');
    });

    it('cycles through loop options in order', () => {
      expect(nextLoopOption(1)).toBe(3);
      expect(nextLoopOption(3)).toBe(5);
      expect(nextLoopOption(5)).toBe(Infinity);
      expect(nextLoopOption(Infinity)).toBe(1);
    });
  });

  describe('toolsBadgeActive', () => {
    it('returns true when loop is not 1', () => {
      expect(toolsBadgeActive(3, 1, false)).toBe(true);
      expect(toolsBadgeActive(Infinity, 1, false)).toBe(true);
    });

    it('returns true when speed is not 1.0x', () => {
      expect(toolsBadgeActive(1, 0.75, false)).toBe(true);
      expect(toolsBadgeActive(1, 1.25, false)).toBe(true);
    });

    it('returns true when A-B loop is active', () => {
      expect(toolsBadgeActive(1, 1, true)).toBe(true);
    });

    it('returns false when default state (loop=1, speed=1, ab=false)', () => {
      expect(toolsBadgeActive(1, 1, false)).toBe(false);
    });
  });

  describe('abWrap', () => {
    it('returns null when boundaries are null or within range', () => {
      expect(abWrap(5000, null, 10000)).toBeNull();
      expect(abWrap(5000, 2000, null)).toBeNull();
      expect(abWrap(8000, 2000, 10000)).toBeNull();
      // Within overshoot allowance (endMs + 80ms)
      expect(abWrap(10050, 2000, 10000, 80)).toBeNull();
    });

    it('returns startMs when current time exceeds endMs + overshoot', () => {
      expect(abWrap(10081, 2000, 10000, 80)).toBe(2000);
      expect(abWrap(12000, 2000, 10000, 80)).toBe(2000);
    });
  });

  describe('normalizeForDictation & checkDictation', () => {
    it('normalizes punctuation, case, and spacing', () => {
      expect(normalizeForDictation('Hello, World! How are you?')).toBe(
        'hello world how are you',
      );
      expect(normalizeForDictation("It's a beautiful day.")).toBe(
        "it's a beautiful day",
      );
    });

    it('validates correct dictation entry', () => {
      const target = 'How is the weather today?';
      const result = checkDictation('how is the weather today', target);
      expect(result.correct).toBe(true);
      expect(result.message).toBe('✓ Chính xác!');
    });

    it('identifies incorrect dictation entry', () => {
      const target = 'How is the weather today?';
      const result = checkDictation('how is weather', target);
      expect(result.correct).toBe(false);
      expect(result.message).toBe('Chưa đúng, nghe lại và thử tiếp.');
    });

    it('handles empty input gracefully', () => {
      const target = 'Sample sentence';
      const result = checkDictation('   ', target);
      expect(result.correct).toBe(false);
      expect(result.message).toContain('Vui lòng gõ');
    });
  });
});
