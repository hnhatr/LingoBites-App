import type {AppButtonVariant} from '../../components/AppButton';
import {themes} from '../themeRegistry';
import {spacing as sharedSpacing} from '../tokens';

// Regression coverage for SETE-280: every theme must define every button
// variant the app can render (no silent fallback to primary), and spacing
// must come from the shared token (no hand-copied duplicates).
const everyVariant: AppButtonVariant[] = [
  'primary',
  'secondary',
  'primary-accent',
  'secondary-coral',
  'outline',
  'ghost',
  'deep',
];

describe('theme consistency (SETE-280)', () => {
  it.each(Object.keys(themes))(
    'theme %s defines every AppButton variant',
    id => {
      const buttons = themes[id as keyof typeof themes].components.button;
      for (const variant of everyVariant) {
        expect(buttons[variant]).toBeDefined();
      }
    },
  );

  it.each(Object.keys(themes))(
    'theme %s spacing matches the shared token',
    id => {
      expect(themes[id as keyof typeof themes].spacing).toEqual(sharedSpacing);
    },
  );
});
