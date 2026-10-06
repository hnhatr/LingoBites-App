import {solidOver} from '../colorUtils';

describe('solidOver', () => {
  it('flattens translucent rgba onto an opaque hex base', () => {
    expect(solidOver('rgba(0,0,0,0.5)', '#ffffff')).toBe('#808080');
  });

  it('keeps an opaque overlay unchanged', () => {
    expect(solidOver('#336699', '#ffffff')).toBe('#336699');
  });

  it('returns the overlay when a color cannot be parsed', () => {
    expect(solidOver('rgba(0,0,0,0.5)', 'red')).toBe('rgba(0,0,0,0.5)');
  });
});
