import {
  formatElapsed,
  formatRemaining,
  formatSentenceLabel,
  MINI_PLAYER_SCROLL_RATIO,
  SENTENCE_SNAP_TOLERANCE_S,
  shouldShowMiniPlayer,
  snapSeekToSentence,
} from '../sentenceSeek';

const SENTENCES = [{start_ms: 1200}, {start_ms: 5000}, {start_ms: 9600}];

describe('snapSeekToSentence', () => {
  it('exposes the ±0.4s tolerance', () => {
    expect(SENTENCE_SNAP_TOLERANCE_S).toBe(0.4);
  });

  it('snaps to the sentence start within tolerance', () => {
    expect(snapSeekToSentence(5.2, SENTENCES)).toBe(5.0);
    expect(snapSeekToSentence(4.7, SENTENCES)).toBe(5.0);
  });

  it('snaps on the exact tolerance edge despite float noise', () => {
    // 5 - 4.6 > 0.4 in binary floating point; the edge must still snap.
    expect(5 - 4.6 > 0.4).toBe(true);
    expect(snapSeekToSentence(4.6, SENTENCES)).toBe(5.0);
    expect(snapSeekToSentence(5.4, SENTENCES)).toBe(5.0);
  });

  it('keeps the raw position outside tolerance', () => {
    expect(snapSeekToSentence(7.0, SENTENCES)).toBe(7.0);
    expect(snapSeekToSentence(4.0, SENTENCES)).toBe(4.0);
    expect(snapSeekToSentence(5.45, SENTENCES)).toBe(5.45);
  });

  it('prefers the nearest boundary and clamps at zero', () => {
    expect(snapSeekToSentence(7.3, [{start_ms: 7000}, {start_ms: 7500}])).toBe(
      7.5,
    );
    expect(snapSeekToSentence(3.3, [])).toBe(3.3);
    expect(snapSeekToSentence(-1, [])).toBe(0);
  });
});

describe('shouldShowMiniPlayer', () => {
  it('toggles strictly past 50% of the player height', () => {
    expect(MINI_PLAYER_SCROLL_RATIO).toBe(0.5);
    const base = {playerHeightPx: 400, windowHeightPt: 800};
    expect(shouldShowMiniPlayer({scrolledPastPx: 200, ...base})).toBe(false);
    expect(shouldShowMiniPlayer({scrolledPastPx: 201, ...base})).toBe(true);
    expect(shouldShowMiniPlayer({scrolledPastPx: 0, ...base})).toBe(false);
  });

  it('collapses immediately on compact screens', () => {
    const base = {playerHeightPx: 400, windowHeightPt: 699};
    expect(shouldShowMiniPlayer({scrolledPastPx: 0, ...base})).toBe(false);
    expect(shouldShowMiniPlayer({scrolledPastPx: 1, ...base})).toBe(true);
  });

  it('never shows without a measured player height', () => {
    expect(
      shouldShowMiniPlayer({
        scrolledPastPx: 500,
        playerHeightPx: 0,
        windowHeightPt: 800,
      }),
    ).toBe(false);
  });
});

describe('labels', () => {
  it('formats remaining, elapsed and sentence labels', () => {
    expect(formatRemaining(200, 59)).toBe('-02:21');
    expect(formatRemaining(50, 80)).toBe('-00:00');
    expect(formatElapsed(84)).toBe('01:24');
    expect(formatSentenceLabel(3, 7)).toBe('Câu 4/7');
  });
});
