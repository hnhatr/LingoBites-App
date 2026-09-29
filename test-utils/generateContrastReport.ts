/**
 * Generate WCAG Contrast Report for All Themes
 * Run with: npx ts-node test-utils/generateContrastReport.ts
 */

import {themes} from '../src/ui/theme/themeRegistry';
import {checkContrast} from './a11yTestUtils';

type ContrastCheck = {
  name: string;
  foreground: string;
  background: string;
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
  passes: boolean;
};

console.log('\n=== WCAG AA Contrast Report for Flashcard UI ===\n');

const themeIds = Object.keys(themes) as Array<keyof typeof themes>;

themeIds.forEach(themeId => {
  const theme = themes[themeId];
  console.log(`\n## Theme: ${theme.name} (${themeId})`);
  console.log('---');

  const checks: ContrastCheck[] = [
    // RatingControl
    {
      name: 'RatingControl: Remembered button (primary on accentSoft)',
      ...checkContrast(theme.colors.primary, theme.colors.accentSoft),
    },
    {
      name: 'RatingControl: Forgot button (text.secondary on surface)',
      ...checkContrast(theme.colors.text.secondary, theme.colors.surface),
    },
    {
      name: 'RatingControl: Border on surface',
      ...checkContrast(theme.colors.border, theme.colors.surface),
    },
    // Banner
    {
      name: 'Banner Info: text.secondary on accentSoft',
      ...checkContrast(theme.colors.text.secondary, theme.colors.accentSoft),
    },
    {
      name: 'Banner Info: primary icon on accentSoft',
      ...checkContrast(theme.colors.primary, theme.colors.accentSoft),
    },
    {
      name: 'Banner Neutral: text.secondary on surfaceMuted',
      ...checkContrast(theme.colors.text.secondary, theme.colors.surfaceMuted),
    },
    // FlipCard
    {
      name: 'FlipCard: text.primary on card.background',
      ...checkContrast(
        theme.colors.text.primary,
        theme.components.card.background,
      ),
    },
    {
      name: 'FlipCard: primary on card.background',
      ...checkContrast(theme.colors.primary, theme.components.card.background),
    },
    {
      name: 'FlipCard: text.muted on card.background',
      ...checkContrast(
        theme.colors.text.muted,
        theme.components.card.background,
      ),
    },
    {
      name: 'FlipCard: border on card.background',
      ...checkContrast(theme.colors.border, theme.components.card.background),
    },
  ];

  const failures = checks.filter(c => !c.passes);
  const passes = checks.filter(c => c.passes);

  console.log(`✓ Passed: ${passes.length}/${checks.length}`);
  console.log(`✗ Failed: ${failures.length}/${checks.length}\n`);

  if (failures.length > 0) {
    console.log('### Failures:');
    failures.forEach(check => {
      console.log(`  ✗ ${check.name}`);
      console.log(
        `    Ratio: ${check.ratio.toFixed(
          2,
        )} (need ≥4.5 for text, ≥3 for UI components)`,
      );
      console.log(`    FG: ${check.foreground}`);
      console.log(`    BG: ${check.background}\n`);
    });
  }

  if (passes.length === checks.length) {
    console.log('  ✓ All checks passed!');
  }
});

console.log('\n=== Summary ===\n');
const allPassing = themeIds.filter(id => {
  const theme = themes[id];
  const checks = [
    checkContrast(theme.colors.primary, theme.colors.accentSoft),
    checkContrast(theme.colors.text.secondary, theme.colors.surface),
    checkContrast(theme.colors.border, theme.colors.surface),
    checkContrast(theme.colors.text.secondary, theme.colors.accentSoft),
    checkContrast(theme.colors.text.muted, theme.components.card.background),
    checkContrast(theme.colors.border, theme.components.card.background),
  ];
  return checks.every(c => c.passes);
});

console.log(`Themes passing all checks: ${allPassing.join(', ') || 'none'}`);
console.log(
  `Themes needing fixes: ${themeIds
    .filter(id => !allPassing.includes(id))
    .join(', ')}\n`,
);
