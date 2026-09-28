import React from 'react';
import {Pressable, StyleSheet, TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider} from '@ui/theme/index';
import {AppButton} from '../AppButton';
import {Chip} from '../Chip';
import {HandoffProgressTrack} from '../HandoffProgressTrack';
import {IconButton} from '../IconButton';
import {LessonExploreRow} from '../LessonExploreRow';
import {MaterialIcon} from '../MaterialIcon';
import {ProfileSettingsRow} from '../ProfileSettingsRow';
import {QuizOption} from '../QuizOption';
import {TextField} from '../TextField';

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function flattenPressableStyle(node: ReactTestRenderer.ReactTestInstance) {
  const style = node.props.style;
  return StyleSheet.flatten(
    typeof style === 'function' ? style({pressed: false}) : style,
  );
}

function findButtonByTestID(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  return tree.root.find(
    node =>
      node.props.testID === testID && node.props.accessibilityRole === 'button',
  );
}

describe('component accessibility regressions', () => {
  it('keeps AppButton named and marked busy while loading', async () => {
    const tree = await render(
      <AppButton loading title="Lưu bài" testID="save-lesson" />,
    );
    const button = findButtonByTestID(tree, 'save-lesson');

    expect(button.props.accessibilityLabel).toBe('Lưu bài');
    expect(button.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
    expect(button.props.disabled).toBe(true);
  });

  it('exposes TextField labels and error copy to accessibility', async () => {
    const tree = await render(
      <TextField
        errorMessage="Cần nhập nội dung"
        hasError
        label="Nội dung"
        value=""
      />,
    );
    const input = tree.root.findByType(TextInput);

    expect(input.props.accessibilityLabel).toBe('Nội dung');
    expect(input.props.accessibilityHint).toBe('Cần nhập nội dung');
    expect(input.props.accessibilityValue.text).toBe('Cần nhập nội dung');
  });

  it('does not expose a read-only QuizOption as a button', async () => {
    const tree = await render(<QuizOption label="Đáp án: A" />);

    expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('marks selected interactive chips and keeps their touch target usable', async () => {
    const tree = await render(
      <Chip label="5 phút" selected onPress={() => {}} testID="mode-chip" />,
    );
    const chip = findButtonByTestID(tree, 'mode-chip');

    expect(chip.props.accessibilityState).toEqual({selected: true});
    expect(flattenPressableStyle(chip).minHeight).toBe(44);
  });

  it('enforces a minimum IconButton target even when visual size is smaller', async () => {
    const tree = await render(
      <IconButton
        accessibilityLabel="Lưu từ"
        icon="bookmark"
        onPress={() => {}}
        size={36}
        testID="save-word"
      />,
    );
    const button = findButtonByTestID(tree, 'save-word');
    const style = flattenPressableStyle(button);

    expect(style.height).toBe(44);
    expect(style.width).toBe(44);
    expect(style.minHeight).toBe(44);
    expect(style.minWidth).toBe(44);
  });

  it('keeps disabled LessonExploreRow semantics when an action exists', async () => {
    const tree = await render(
      <LessonExploreRow
        disabled
        icon="menu_book"
        onPress={() => {}}
        subtitle="Chưa có câu"
        title="Học từng câu"
      />,
    );
    const row = tree.root.findByProps({accessibilityLabel: 'Học từng câu'});

    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityState).toEqual({disabled: true});
    expect(row.props.disabled).toBe(true);
  });

  it('does not show a chevron for non-interactive settings rows', async () => {
    const tree = await render(
      <ProfileSettingsRow
        icon="notifications"
        label="Nhắc nhở"
        trailing="chevron"
      />,
    );

    expect(tree.root.findAllByProps({name: 'chevron_right'})).toHaveLength(0);
    expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('exposes handoff progress as a progressbar', async () => {
    const tree = await render(
      <HandoffProgressTrack label="2 / 5" progress={0.42} />,
    );
    const progress = tree.root.findByProps({accessibilityRole: 'progressbar'});

    expect(progress.props.accessibilityLabel).toBe('2 / 5');
    expect(progress.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 42,
    });
  });

  it('hides decorative MaterialIcon glyphs from accessibility grouping', async () => {
    const tree = await render(<MaterialIcon name="info" />);
    const hiddenIcons = tree.root.findAll(
      node =>
        node.props.accessibilityElementsHidden === true &&
        node.props.importantForAccessibility === 'no',
    );

    expect(hiddenIcons.length).toBeGreaterThan(0);
  });
});
