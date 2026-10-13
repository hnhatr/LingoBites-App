import React, {useContext, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, StyleSheet, Switch, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {AppText} from '@ui/components/AppText';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

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
  label: string;
  value: boolean;
  onToggle: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
};

function ToggleRow({label, value, onToggle, testID, styles}: ToggleRowProps) {
  return (
    <View style={styles.row}>
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
            label={t('youtube.study.display_translation')}
            onToggle={onToggleTranslation}
            styles={styles}
            testID="youtube-toggle-translation"
            value={showTranslation}
          />
          <ToggleRow
            label={t('youtube.study.display_ipa')}
            onToggle={onToggleIpa}
            styles={styles}
            testID="youtube-toggle-ipa"
            value={showIpa}
          />
          {onToggleLoop ? (
            <ToggleRow
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
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      minWidth: 240,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      position: 'absolute',
      right: theme.gutter,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 48,
    },
    rowLabel: {
      flex: 1,
    },
  });
}
