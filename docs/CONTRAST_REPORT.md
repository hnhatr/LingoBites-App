# WCAG AA Contrast Compliance Report - Flashcard UI

**Date:** 2026-08-17  
**Tested Components:** RatingControl, Banner, FlipCard, Summary Screen  
**Standard:** WCAG 2.0 Level AA (4.5:1 for text, 3:1 for UI components)

## Summary

| Theme       | Status    | Passing | Failing |
| ----------- | --------- | ------- | ------- |
| neo         | ✅ PASS   | 17/17   | 0/17    |
| comic       | ✅ PASS   | 17/17   | 0/17    |
| default     | ⚠️ ISSUES | 12/17   | 5/17    |
| dark        | ⚠️ ISSUES | 13/17   | 4/17    |
| pastel-kids | ⚠️ ISSUES | 12/17   | 5/17    |
| core        | ⚠️ ISSUES | 12/17   | 5/17    |
| cartoon     | ⚠️ ISSUES | 12/17   | 5/17    |

**Total:** 95/119 checks passed (79.8%)

## Fully Compliant Themes

✅ **neo** - All 17 contrast checks pass WCAG AA  
✅ **comic** - All 17 contrast checks pass WCAG AA

These themes are production-ready for the flashcard feature with no accessibility concerns.

## Themes with Contrast Issues

### Common Failures Across Themes

The following color combinations fail WCAG AA in 5 out of 7 themes:

1. **RatingControl "Remembered" button**

   - Issue: `primary` color on `accentSoft` background
   - Components: Icon + text label
   - Impact: Users may have difficulty seeing the green "remembered" button

2. **Banner Info variant**

   - Issue: `text.secondary` and `primary` on `accentSoft` background
   - Impact: Informational banners (soft cap message) may be hard to read

3. **Border colors**

   - Issue: `border` color insufficient contrast on `surface` / `card.background`
   - Impact: Card outlines and button borders may be faint

4. **Muted text** (some themes)
   - Issue: `text.muted` on `card.background`
   - Components: FlipCard hint text ("🔄 Nhấn để xem mặt sau")
   - Impact: Hint text may be too light

### Detailed Breakdown

#### default theme

- ❌ Remembered button (primary on accentSoft)
- ❌ Remembered button border
- ❌ Forgot/Skip button border
- ❌ Banner info text
- ❌ Banner info icon
- ✅ All other checks pass

#### dark theme

- ❌ Remembered button (primary on accentSoft)
- ❌ FlipCard secondary text (primary on card.background)
- ❌ Borders
- ❌ Banner info variant
- ✅ Muted text passes (good for dark theme)

#### pastel-kids theme

- ❌ Remembered button (primary on accentSoft)
- ❌ Borders
- ❌ Banner info variant
- ❌ Muted text
- ✅ Main content text passes

#### core theme

- ❌ Remembered button (primary on accentSoft)
- ❌ Borders
- ❌ Banner info variant
- ❌ Muted text
- ✅ Main content text passes

#### cartoon theme

- ❌ Remembered button (primary on accentSoft)
- ❌ Borders
- ❌ Banner info variant
- ❌ Muted text
- ✅ Main content text passes

## Recommendations

### Immediate Actions

1. **Use neo or comic themes** for demos and screenshots - they are fully compliant
2. **Document known issues** for default, dark, pastel-kids, core, and cartoon themes

### Design System Improvements (Future Work)

To fix the failing themes, consider:

1. **accentSoft backgrounds**: Increase opacity or darken the background to improve contrast with `primary` color
2. **Border colors**: Use darker border colors or increase border width for better visibility
3. **Muted text**: Ensure `text.muted` meets 4.5:1 ratio on all card backgrounds
4. **Alternative**: Use solid backgrounds instead of soft/translucent ones for critical UI elements

### User Impact

- **High priority**: RatingControl buttons (core interaction)
- **Medium priority**: Banner messages (informational, not blocking)
- **Low priority**: Border visibility (visual polish)
- **Low priority**: Hint text (supplementary guidance)

## Test Coverage

All components tested:

- ✅ RatingControl (3 buttons × icon + text + borders)
- ✅ Banner (2 variants × text + icon)
- ✅ FlipCard (text hierarchy + borders)
- ✅ Summary screen (stats + labels)

## Testing Methodology

- **Tool**: Custom WCAG contrast checker implementing W3C relative luminance algorithm
- **Automation**: Jest test suite with 119 test cases (17 per theme × 7 themes)
- **Location**: `src/theme/__tests__/contrastCompliance.test.ts`
- **Utilities**: `test-utils/a11yTestUtils.ts`

## Conclusion

**2 out of 7 themes (neo, comic) are fully WCAG AA compliant for the flashcard feature.**

The remaining themes have minor contrast issues primarily affecting:

- Soft/translucent backgrounds (accentSoft)
- Border visibility
- Secondary text tones

These issues do not block feature functionality but should be addressed in a future design system update for full accessibility compliance.
