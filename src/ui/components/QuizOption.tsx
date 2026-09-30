import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {useAppTheme} from '../theme';
import {AppText} from './AppText';

export type QuizOptionState = 'default' | 'selected' | 'correct' | 'wrong';

/**
 * Coral 10%-alpha fill for the `wrong` state, matching
 * `design/app.css` (`.quiz-opt.wrong`).
 */
const WRONG_BACKGROUND = 'rgba(254,116,136,0.1)';

type Props = {
  label: string;
  /** Key shown in the leading circle (e.g. "A", "B", "C"). Omit to hide it. */
  optionKey?: string;
  /**
   * Visual feedback state. When omitted, falls back to the legacy
   * `selected` flag (`true` maps to `"selected"`).
   */
  state?: QuizOptionState;
  /** Legacy selection flag; prefer `state`. Ignored when `state` is set. */
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
};

export function QuizOption({
  label,
  optionKey,
  state,
  selected = false,
  disabled = false,
  onPress,
  testID,
  accessibilityLabel,
}: Props) {
  const {theme} = useAppTheme();
  const resolved: QuizOptionState =
    state ?? (selected ? 'selected' : 'default');

  let backgroundColor = theme.colors.surface;
  let borderColor = theme.colors.surfaceHigh;
  let keyBackground = theme.colors.surfaceHigh;
  let keyColor = theme.colors.text.secondary;
  if (resolved === 'selected') {
    borderColor = theme.colors.primary;
  } else if (resolved === 'correct') {
    backgroundColor = theme.colors.accentSoft;
    borderColor = theme.colors.accent;
    keyBackground = theme.colors.accent;
    keyColor = theme.colors.accentInk;
  } else if (resolved === 'wrong') {
    backgroundColor = WRONG_BACKGROUND;
    borderColor = theme.colors.secondaryContainer;
    keyBackground = theme.colors.secondaryContainer;
    keyColor = theme.colors.text.inverse;
  }

  const containerStyle = {
    backgroundColor,
    borderColor,
    borderRadius: 18,
    borderWidth: 2,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 16,
  };

  const content = (
    <>
      {optionKey ? (
        <View style={[styles.key, {backgroundColor: keyBackground}]}>
          <AppText
            variant="label"
            style={{
              color: keyColor,
              fontWeight: theme.typography.weight.bold,
            }}
          >
            {optionKey}
          </AppText>
        </View>
      ) : null}
      <AppText color="primary" style={styles.label}>
        {label}
      </AppText>
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{
          disabled: true,
          selected: resolved === 'selected',
          checked: resolved === 'correct',
        }}
        style={[styles.container, containerStyle]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (resolved === 'correct'
      ? `${label}, đúng`
      : resolved === 'wrong'
      ? `${label}, sai`
      : label);

  return (
    <Pressable
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        disabled,
        selected: resolved === 'selected',
        checked: resolved === 'correct',
      }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.container, containerStyle]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  key: {
    alignItems: 'center',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  label: {
    flex: 1,
  },
});
