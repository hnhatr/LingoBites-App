import {pastelKidsTheme} from '../themes/pastelKids';

describe('pastelKids semantic colors (SETE-240)', () => {
  it('keeps selection accent separate from decorative primaryContainer', () => {
    expect(pastelKidsTheme.colors.accent).toBe('#2dd4bf');
    expect(pastelKidsTheme.colors.primaryContainer).not.toBe(
      pastelKidsTheme.colors.accent,
    );
  });

  it('uses stronger outline tokens for interactive control boundaries', () => {
    expect(pastelKidsTheme.colors.outline).toBe('#566862');
    expect(pastelKidsTheme.components.input.border).toBe('#566862');
  });
});
