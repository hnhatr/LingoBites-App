/**
 * HomeReviewBanner: "N thẻ đến hạn · Ôn tập ngay", shown above the hero only
 * while flashcards are due, so the learner sees what is waiting at once.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getHardShadow} from '@ui/theme/hardShadow';

type Props = {
  count: number;
  onPress: () => void;
};

export function HomeReviewBanner({count, onPress}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityHint={t('home.shortcut_review')}
      accessibilityLabel={`${t('home.review_banner_cta')}. ${t(
        'home.review_banner_due',
        {count},
      )}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.banner, pressed && styles.pressed]}
      testID="home-review-banner"
    >
      <MaterialIcon color={theme.colors.primary} name="refresh" size={20} />
      <AppText variant="label" style={styles.text} numberOfLines={1}>
        {t('home.review_banner_due', {count})}
      </AppText>
      <AppText variant="label" style={styles.cta}>
        {t('home.review_banner_cta')}
      </AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    banner: {
      alignItems: 'center',
      backgroundColor: solidOver(theme.colors.accentSoft, theme.colors.surface),
      borderColor: theme.colors.ink,
      borderRadius: 20,
      borderWidth: 2,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
      ...getHardShadow(3, theme.colors.ink),
    },
    text: {color: theme.colors.text.primary, flex: 1},
    cta: {color: theme.colors.primary},
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
