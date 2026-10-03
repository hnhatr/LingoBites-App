import {
  indeterminateProgressTranslateX,
  indeterminateProgressTravelRange,
  SEGMENT_RATIO,
} from '../IndeterminateProgressBar';

describe('IndeterminateProgressBar travel range', () => {
  it('maps progress 0 and 1 to -0.4W and W (AC-001)', () => {
    const w = 200;
    const {start, end} = indeterminateProgressTravelRange(w);
    expect(start).toBe(-SEGMENT_RATIO * w);
    expect(end).toBe(w);
    expect(indeterminateProgressTranslateX(0, w)).toBe(start);
    expect(indeterminateProgressTranslateX(1, w)).toBe(end);
  });

  it('recomputes range when W changes (AC-002)', () => {
    expect(indeterminateProgressTravelRange(100).end).toBe(100);
    expect(indeterminateProgressTravelRange(320).start).toBe(-0.4 * 320);
  });

  it('returns translateX 0 while W is not measured (AC-003)', () => {
    expect(indeterminateProgressTranslateX(0.5, 0)).toBe(0);
    expect(indeterminateProgressTranslateX(1, -1)).toBe(0);
  });
});
