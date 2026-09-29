/**
 * SETE-122 Việc 6.2 — global masking scan, warning mode.
 *
 * This does not fail CI: it renders the reusable, exported components that
 * the Việc 5 audit (see issue comments) identified as accessibility-label
 * masking risks, and logs any `findMaskedContent` candidates via
 * console.warn. It exists so a regression (or a newly-added risky pattern)
 * shows up in test output immediately instead of waiting for the next
 * manual audit.
 *
 * Scope: components exported and reusable across screens. Bespoke inline
 * `Pressable`/`Tappable` JSX embedded directly in a single screen (e.g.
 * LessonResultView's local `Tappable` wrapping card rows,
 * SpeakingRoomScreen's mode cards) is covered by each screen's own test
 * suite, not duplicated here — scanning every screen's every inline
 * Pressable would mean touching dozens of unrelated test files for this
 * issue. See the Việc 5 audit comment for the full per-file findings.
 *
 * Graduation path: once a component's masking candidates are fixed, switch
 * its assertion below from `warnOnMaskedContent` (log-only) to
 * `expect(findMaskedContent(tree.root)).toHaveLength(0)` (hard gate).
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FlipCard} from '../../src/ui/components/FlipCard';
import {ProfileSettingsRow} from '../../src/ui/components/ProfileSettingsRow';
import {RatingControl} from '../../src/ui/components/RatingControl';
import {AppThemeProvider} from '../../src/ui/theme';
import {FeatureFlagProvider} from '../../src/core/release';
import {Text} from 'react-native';
import {findMaskedContent, warnOnMaskedContent} from '../a11yTestUtils';

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('Global a11y masking scan (warning mode — SETE-122 Việc 6.2)', () => {
  it('ProfileSettingsRow: default accessibilityLabel drops `trailing` text/chip when a caller does not override it', async () => {
    // SETE-122 Việc 5: reachable today — ProfileScreen's "Âm thanh chương
    // học" row passes an explicit accessibilityLabel override that still
    // omits the trailing cache-size text, so this warns even with a
    // caller-supplied label.
    const tree = await render(
      <ProfileSettingsRow
        icon="volume_up"
        label="Âm thanh chương học"
        onPress={() => {}}
        trailing={{text: '12.4 MB / 3 chương'}}
      />,
    );
    warnOnMaskedContent(tree.root, 'ProfileSettingsRow');
  });

  it('RatingControl: known paraphrase (not real content loss, see SETE-122 audit)', async () => {
    const tree = await render(
      <RatingControl onRate={() => {}} onSkip={() => {}} />,
    );
    warnOnMaskedContent(tree.root, 'RatingControl');
  });

  it('FlipCard: no masked content (graduated hard gate - SETE-124)', async () => {
    const tree = await render(
      <FlipCard
        back={<Text>back</Text>}
        flipped={false}
        front={<Text>front</Text>}
        onFlip={() => {}}
      />,
    );
    expect(findMaskedContent(tree.root)).toHaveLength(0);
  });
});
