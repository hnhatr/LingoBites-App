import {StyleSheet} from 'react-native';
import type {AppTheme} from '@ui/theme/index';

/**
 * Shared base styles for curriculum lesson block renderers.
 *
 * Every color comes from the active theme so block UI follows the app theme
 * and never trips `react-native/no-color-literals`. Renderers with special
 * layout needs extend these with their own `StyleSheet.create` styles.
 */
export function blockBaseStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.bold,
    },
    body: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      lineHeight: theme.typography.size.md * 1.5,
    },
    secondary: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
      lineHeight: theme.typography.size.sm * 1.5,
    },
    caption: {
      color: theme.colors.text.muted,
      fontSize: theme.typography.size.sm,
    },
    fallbackBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    fallbackText: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.sm,
    },
    button: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    buttonDisabled: {
      opacity: theme.states.disabledOpacity,
    },
    buttonText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.medium,
    },
    secondaryButton: {
      alignItems: 'center',
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    secondaryButtonText: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.medium,
    },
  });
}
