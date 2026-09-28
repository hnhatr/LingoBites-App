import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import {useAppTheme} from '../theme';
import type {HandoffIconName} from '../icons/iconRegistry';
import {MaterialIcon} from './MaterialIcon';
import {ShelfSurface} from './ShelfSurface';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'primary-accent'
  | 'secondary-coral'
  | 'outline'
  | 'ghost'
  | 'deep';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: AppButtonVariant;
  loading?: boolean;
  iconLeft?: HandoffIconName;
  iconRight?: HandoffIconName;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  title,
  variant = 'primary-accent',
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  style,
  accessibilityLabel,
  accessibilityState,
  testID = 'app-button',
  ...rest
}: Props) {
  const {theme} = useAppTheme();
  const spec =
    theme.components.button[variant] ||
    theme.components.button['primary-accent'] ||
    theme.components.button.primary ||
    Object.values(theme.components.button)[0];
  if (__DEV__ && !theme.components.button[variant]) {
    console.warn(
      `[AppButton] variant "${variant}" is not defined in theme "${theme.id}" — fell back. Add it to components.button instead of relying on fallback.`,
    );
  }
  const isDisabled = disabled || loading;
  const buttonAccessibilityState = loading
    ? {disabled: true, busy: true}
    : {...accessibilityState, disabled: isDisabled};

  const shadowStyle = spec.shadow ? theme.shadow[spec.shadow] : undefined;

  const shelfRoleMap: Record<string, string> = {
    'primary-accent': 'accent',
    'secondary-coral': 'coral',
    deep: 'primary',
    ghost: 'ghost',
  };
  const shelfRole = shelfRoleMap[variant];
  const shelf =
    theme.shelf && shelfRole ? (theme.shelf as any)[shelfRole] : undefined;

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={buttonAccessibilityState}
      disabled={isDisabled}
      style={style}
      {...rest}
    >
      {({pressed}) => (
        <ShelfSurface
          shelfHeight={shelf?.height}
          shelfColor={shelf?.color}
          borderRadius={spec.radius}
          isPressed={pressed}
          isDisabled={disabled ?? false}
          preserveShelfSpace={loading}
          containerStyle={shadowStyle}
          faceTestID={testID + '-face'}
          faceStyle={[
            styles.base,
            {
              backgroundColor: spec.background,
              height: spec.height,
            },
            spec.border && {
              borderColor: spec.border,
              borderWidth: 2,
            },
            !shelf &&
              pressed &&
              !isDisabled && {opacity: theme.states.pressedOpacity},
            !shelf &&
              isDisabled &&
              !loading && {opacity: theme.states.disabledOpacity},
          ]}
        >
          {loading ? (
            <ActivityIndicator
              accessibilityElementsHidden
              color={spec.text}
              importantForAccessibility="no"
            />
          ) : (
            <>
              {iconLeft && (
                <MaterialIcon color={spec.text} name={iconLeft} size={22} />
              )}
              <Text
                numberOfLines={3}
                style={{
                  color: spec.text,
                  fontSize: theme.typography.size.md,
                  fontWeight: theme.typography.weight.bold,
                  fontFamily: theme.typography.fontFamily.primary,
                  flexShrink: 1,
                  textAlign: 'center',
                }}
              >
                {title}
              </Text>
              {iconRight && (
                <MaterialIcon color={spec.text} name={iconRight} size={22} />
              )}
            </>
          )}
        </ShelfSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    flexDirection: 'row',
    gap: 8,
  },
});
