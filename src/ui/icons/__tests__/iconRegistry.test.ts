import {
  HANDOFF_ICONS,
  isValidMaterialIconGlyph,
  resolveHandoffIconName,
} from '../iconRegistry';

describe('iconRegistry', () => {
  it('resolves every registered handoff icon to a MaterialIcons glyph', () => {
    for (const icon of HANDOFF_ICONS) {
      const glyph = resolveHandoffIconName(icon);
      expect(isValidMaterialIconGlyph(glyph)).toBe(true);
    }
  });

  it('maps function to the functions glyph', () => {
    expect(resolveHandoffIconName('function')).toBe('functions');
  });
});
