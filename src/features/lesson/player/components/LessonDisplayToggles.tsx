import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type LessonDisplayTogglesProps = {
  showTranslation: boolean;
  showIpa: boolean;
  onToggleTranslation: () => void;
  onToggleIpa: () => void;
};

/** Compact translate / IPA toggles, sized to sit in the screen header. */
export function LessonDisplayToggles({
  showTranslation,
  showIpa,
  onToggleTranslation,
  onToggleIpa,
}: LessonDisplayTogglesProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <IconButton
        accessibilityHint={t('youtube.translation_toggle_hint')}
        accessibilityLabel={
          showTranslation
            ? t('youtube.translation_hide_a11y')
            : t('youtube.translation_show_a11y')
        }
        icon="translate"
        iconSize={20}
        onPress={onToggleTranslation}
        size={36}
        testID="youtube-toggle-translation"
        tone={showTranslation ? 'accent' : 'bare'}
      />
      <Pressable
        accessibilityLabel={
          showIpa ? t('youtube.ipa_hide_a11y') : t('youtube.ipa_show_a11y')
        }
        accessibilityRole="button"
        accessibilityState={{selected: showIpa}}
        onPress={onToggleIpa}
        style={({pressed}) => [
          styles.ipa,
          showIpa ? styles.ipaOn : null,
          pressed ? styles.pressed : null,
        ]}
        testID="youtube-toggle-ipa"
      >
        <AppText
          style={showIpa ? styles.ipaTextOn : styles.ipaTextOff}
          variant="label"
        >
          IPA
        </AppText>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    ipa: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
    },
    ipaOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    ipaTextOff: {
      color: theme.colors.primary,
    },
    ipaTextOn: {
      color: theme.colors.primary,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
    },
  });
}
