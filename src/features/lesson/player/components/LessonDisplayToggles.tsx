import React, {useContext, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, StyleSheet, Switch, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {AppText} from '@ui/components/AppText';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

export type LessonDisplayTogglesProps = {
  showTranslation: boolean;
  showIpa: boolean;
  onToggleTranslation: () => void;
  onToggleIpa: () => void;
  /** "Loop current sentence"; omitted = no loop row. */
  loopSentence?: boolean;
  onToggleLoop?: () => void;
};

/** Header height: the menu opens just under the header buttons. */
const MENU_OFFSET_TOP = 56;

type ToggleRowProps = {
  icon: HandoffIconName;
  label: string;
  value: boolean;
  onToggle: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
};

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  testID,
  styles,
}: ToggleRowProps) {
  const {theme} = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, value ? styles.rowIconOn : null]}>
        <MaterialIcon color={theme.colors.primary} name={icon} size={20} />
      </View>
      <AppText style={styles.rowLabel} variant="body">
        {label}
      </AppText>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{selected: value}}
        onValueChange={onToggle}
        testID={testID}
        value={value}
      />
    </View>
  );
}

/**
 * One header "Hiển thị" button that opens a small menu of switches:
 * Vietnamese translation, IPA and (when offered) sentence loop.
 */
export function LessonDisplayToggles({
  showTranslation,
  showIpa,
  onToggleTranslation,
  onToggleIpa,
  loopSentence,
  onToggleLoop,
}: LessonDisplayTogglesProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  // Context (not the hook) so the menu also renders without a provider.
  const insets = useContext(SafeAreaInsetsContext);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeaderIconButton
        accessibilityHint={t('youtube.study.display_menu_hint')}
        accessibilityLabel={t('youtube.study.display_menu_a11y')}
        icon="visibility"
        onPress={() => setOpen(true)}
        selected={open}
        testID="youtube-display-menu"
      />
      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable
          accessibilityLabel={t('youtube.study.sheet_close_a11y')}
          onPress={() => setOpen(false)}
          style={styles.backdrop}
          testID="youtube-display-menu-backdrop"
        />
        <View
          accessibilityLabel={t('youtube.study.display_menu_a11y')}
          style={[styles.menu, {top: (insets?.top ?? 0) + MENU_OFFSET_TOP}]}
          testID="youtube-display-menu-panel"
        >
          <ToggleRow
            icon="translate"
            label={t('youtube.study.display_translation')}
            onToggle={onToggleTranslation}
            styles={styles}
            testID="youtube-toggle-translation"
            value={showTranslation}
          />
          <ToggleRow
            icon="record_voice_over"
            label={t('youtube.study.display_ipa')}
            onToggle={onToggleIpa}
            styles={styles}
            testID="youtube-toggle-ipa"
            value={showIpa}
          />
          {onToggleLoop ? (
            <ToggleRow
              icon="repeat"
              label={t('youtube.study.display_loop')}
              onToggle={onToggleLoop}
              styles={styles}
              testID="youtube-toggle-loop"
              value={loopSentence === true}
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    menu: {
      ...theme.shadow.medium,
      backgroundColor: theme.colors.background,
      borderRadius: 22,
      gap: theme.spacing.sm,
      minWidth: 260,
      padding: theme.spacing.sm,
      position: 'absolute',
      right: theme.gutter,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 56,
      paddingHorizontal: theme.spacing.md,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    rowIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 12,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    rowIconOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    rowLabel: {
      flex: 1,
    },
  });
}
