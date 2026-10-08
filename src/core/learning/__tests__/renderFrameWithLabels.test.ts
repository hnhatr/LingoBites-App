import {renderFrameWithLabels} from '../patternFrame';

describe('renderFrameWithLabels', () => {
  const frame = 'Can I have a {size} {drink}, please?';

  it('shows each slot as its label, or an ellipsis without one', () => {
    expect(renderFrameWithLabels(frame, {size: 'cỡ', drink: 'đồ uống'})).toBe(
      'Can I have a cỡ đồ uống, please?',
    );
    expect(renderFrameWithLabels(frame)).toBe('Can I have a … …, please?');
  });

  it('returns a malformed frame unchanged', () => {
    expect(renderFrameWithLabels('Can I {have?')).toBe('Can I {have?');
  });
});
