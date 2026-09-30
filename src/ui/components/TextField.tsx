import React, {useId, useState} from 'react';
import {
  type BlurEvent,
  type FocusEvent,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import {useAppTheme} from '../theme';
import {AppText} from './AppText';

type Props = TextInputProps & {
  hasError?: boolean;
  label?: string;
  errorMessage?: string;
};

const FOCUS_RING_WIDTH = 4;

/**
 * Applies an alpha channel to an `#rgb` / `#rrggbb` theme color.
 * Falls back to the solid color when the value cannot be parsed, so
 * non-hex theme tokens keep rendering instead of breaking.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(part => part + part)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return color;
  }
  const red = parseInt(full.slice(0, 2), 16);
  const green = parseInt(full.slice(2, 4), 16);
  const blue = parseInt(full.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function TextField({
  hasError = false,
  label,
  errorMessage,
  style,
  multiline,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityLabelledBy,
  accessibilityState,
  accessibilityHint,
  accessibilityValue,
  placeholder,
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  const [focused, setFocused] = useState(false);
  const rawId = useId();
  const labelNativeId = `textfield-label-${rawId.replace(
    /[^a-zA-Z0-9-_]/g,
    '',
  )}`;

  const hasErrorText = errorMessage !== undefined && errorMessage !== '';
  const invalid = hasError || hasErrorText;
  const radius = theme.components.input.radius;
  const borderColor = invalid
    ? theme.colors.danger
    : focused
    ? theme.colors.primary
    : theme.components.input.border;

  const ringColor =
    focused && !invalid
      ? withAlpha(theme.colors.accent, 0.34)
      : withAlpha(theme.colors.accent, 0);

  const handleFocus = (event: FocusEvent) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: BlurEvent) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <AppText nativeID={labelNativeId} variant="label">
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.focusRing,
          {
            borderColor: ringColor,
            borderRadius: radius + FOCUS_RING_WIDTH,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={
            accessibilityLabel ??
            label ??
            (typeof placeholder === 'string' ? placeholder : undefined)
          }
          accessibilityLabelledBy={
            label
              ? accessibilityLabelledBy ?? labelNativeId
              : accessibilityLabelledBy
          }
          accessibilityHint={accessibilityHint ?? errorMessage}
          accessibilityState={accessibilityState}
          accessibilityValue={
            errorMessage
              ? {...accessibilityValue, text: errorMessage}
              : accessibilityValue
          }
          placeholder={placeholder}
          placeholderTextColor={theme.components.input.placeholder}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            {
              backgroundColor: theme.components.input.background,
              borderColor,
              borderRadius: radius,
              borderWidth: focused ? 2.5 : 2,
              color: theme.components.input.text,
              fontSize: theme.typography.presets.body.fontSize,
              minHeight: 48,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {hasErrorText ? (
        <View style={styles.errorRow}>
          <AppText color="danger" style={styles.errorIcon}>
            ⚠
          </AppText>
          <AppText
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            color="danger"
            variant="caption"
          >
            {errorMessage}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  focusRing: {
    borderWidth: FOCUS_RING_WIDTH,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorIcon: {
    fontSize: 14,
  },
});
