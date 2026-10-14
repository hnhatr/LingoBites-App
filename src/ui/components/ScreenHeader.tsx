import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';
import {HeaderIconButton} from './HeaderIconButton';

/** One tappable step of a header breadcrumb (an ancestor screen). */
export type HeaderCrumb = {
  label: string;
  onPress: () => void;
  testID?: string;
};

type Props = {
  title: string;
  /** Optional muted second line under the title (one line). */
  subtitle?: string;
  /**
   * Optional second line of ancestor screens (`Course › A1`); each one jumps
   * straight back to that screen. Shown instead of `subtitle`.
   */
  breadcrumb?: HeaderCrumb[];
  onBack?: () => void;
  backLabel?: string;
  /** Screen-reader hint of every breadcrumb link. */
  crumbHint?: string;
  /**
   * Buttons on the right, laid out in a row with a fixed gap. Use
   * `HeaderIconButton` (or a 40px-tall CTA) so every header matches.
   */
  rightAction?: React.ReactNode;
};

/**
 * Standard header for every screen except Home: 18px primary title on one
 * line, optional back button on the left, actions on the right.
 * Long titles (e.g. lesson names) belong in the page body, not here.
 */
export function ScreenHeader({
  title,
  subtitle,
  breadcrumb,
  onBack,
  backLabel = 'Quay lại',
  crumbHint = 'Quay thẳng về màn này',
  rightAction,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const hasCrumbs = breadcrumb !== undefined && breadcrumb.length > 0;

  return (
    <View style={themedStyles.header} testID="screen-header">
      {onBack ? (
        <HeaderIconButton
          accessibilityLabel={backLabel}
          icon="arrow_back"
          onPress={onBack}
          testID="screen-header-back"
        />
      ) : null}
      {hasCrumbs ? (
        <View style={styles.title}>
          <AppText
            color="primary"
            numberOfLines={1}
            testID="screen-header-title"
            variant="h3"
          >
            {title}
          </AppText>
          <View
            accessibilityRole="toolbar"
            style={themedStyles.crumbs}
            testID="screen-header-breadcrumb"
          >
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={`${index}-${crumb.label}`}>
                {index > 0 ? (
                  <AppText color="muted" variant="caption">
                    ›
                  </AppText>
                ) : null}
                <Pressable
                  accessibilityHint={crumbHint}
                  accessibilityLabel={crumb.label}
                  accessibilityRole="link"
                  hitSlop={CRUMB_HIT_SLOP}
                  onPress={crumb.onPress}
                  style={styles.crumb}
                  testID={crumb.testID}
                >
                  <AppText
                    numberOfLines={1}
                    style={themedStyles.crumbText}
                    variant="caption"
                  >
                    {crumb.label}
                  </AppText>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>
      ) : subtitle ? (
        <View style={styles.title}>
          <AppText
            color="primary"
            numberOfLines={1}
            testID="screen-header-title"
            variant="h3"
          >
            {title}
          </AppText>
          <AppText
            color="muted"
            numberOfLines={1}
            testID="screen-header-subtitle"
            variant="caption"
          >
            {subtitle}
          </AppText>
        </View>
      ) : (
        <AppText
          color="primary"
          numberOfLines={1}
          style={styles.title}
          testID="screen-header-title"
          variant="h3"
        >
          {title}
        </AppText>
      )}
      {rightAction ? (
        <View style={themedStyles.actions}>{rightAction}</View>
      ) : null}
    </View>
  );
}

/** Lifts a one-line caption link to the 44px minimum touch target. */
const CRUMB_HIT_SLOP = {top: 14, bottom: 14, left: 4, right: 4};

const styles = StyleSheet.create({
  crumb: {
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    crumbText: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    crumbs: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 56,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
  });
}
