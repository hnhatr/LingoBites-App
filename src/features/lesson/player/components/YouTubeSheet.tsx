import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type YouTubeSheetProps = {
  visible: boolean;
  title: string;
  accessibilityLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
  /** When false, children manage their own scroll (e.g. FlatList). */
  scrollable?: boolean;
};

export function YouTubeSheet({
  visible,
  title,
  accessibilityLabel,
  onClose,
  children,
  testID = 'youtube-sheet',
  scrollable = true,
}: YouTubeSheetProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const {height: windowHeight} = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const bottomInset = insets?.bottom ?? 0;
  const reducedMotion = useReducedMotion();
  const styles = useMemo(
    () => makeStyles(theme, windowHeight, bottomInset),
    [bottomInset, theme, windowHeight],
  );

  return (
    <Modal
      accessibilityLabel={accessibilityLabel}
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      testID={testID}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('youtube.study.sheet_close_a11y')}
        onPress={onClose}
        style={styles.backdrop}
        testID="youtube-sheet-backdrop"
      />
      <View style={styles.panel}>
        <View style={styles.header}>
          <AppText numberOfLines={1} style={styles.title} variant="h3">
            {title}
          </AppText>
          <IconButton
            accessibilityLabel={t('youtube.study.sheet_close_a11y')}
            icon="close"
            onPress={onClose}
            testID="youtube-sheet-close"
            tone="ghost"
          />
        </View>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={styles.body}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.body, styles.scrollContent]}>{children}</View>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(
  theme: AppTheme,
  windowHeight: number,
  bottomInset: number,
) {
  const panelHeight = Math.round(windowHeight * 0.6);
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.overlay,
    },
    body: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.sm,
    },
    panel: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      bottom: 0,
      height: panelHeight,
      left: 0,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      position: 'absolute',
      right: 0,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Math.max(bottomInset, theme.spacing.md),
    },
    title: {
      flex: 1,
      minWidth: 0,
    },
  });
}
