import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';

type Props = {
  /** A muted line above the buttons, e.g. why the main one is disabled. */
  note?: string | null;
  /** Space under the buttons (the floating tab bar's clearance, if any). */
  bottomInset?: number;
  children: React.ReactNode;
};

/** The pinned bottom bar of the create screens: an optional note, then buttons. */
export function StickerFooter({note, bottomInset, children}: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={[styles.bar, {paddingBottom: bottomInset ?? theme.spacing.lg}]}
      testID="sticker-footer"
    >
      {note ? (
        <AppText color="muted" style={styles.note} variant="caption">
          {note}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    bar: {
      backgroundColor: theme.colors.background,
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    note: {
      textAlign: 'center',
    },
  });
}
