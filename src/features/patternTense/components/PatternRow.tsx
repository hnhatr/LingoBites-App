import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {levelTone} from '@ui/theme/levelColors';

import type {CatalogItem} from '@core/schemas/lesson';

import {frameParts} from '../logic/frameText';

type Props = {
  item: CatalogItem;
  level: string | null;
  /** Function labels (Hẹn gặp, Nhà hàng…), shown after the level. */
  labels: string[];
  /** The pattern is on the review schedule. */
  inReview: boolean;
  onPress: () => void;
};

/**
 * One pattern of the library: its frame with the slots on soft yellow, its
 * meaning, then the level chip, the slot count and "Đang ôn" once scheduled.
 */
export function PatternRow({item, level, labels, inReview, onPress}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const parts = frameParts(item);
  const slotCount = parts.filter(part => part.type === 'slot').length;
  const testID = `pattern-row-${item.code}`;

  return (
    <Pressable
      accessibilityHint={t('patternTense.open_pattern_hint')}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.body}>
        <AppText style={styles.frame}>
          {parts.map((part, index) =>
            part.type === 'text' ? (
              part.value
            ) : (
              <AppText key={index} style={styles.slot}>
                {` ${part.labelVi} `}
              </AppText>
            ),
          )}
        </AppText>
        <AppText color="secondary">{item.meaning_vi}</AppText>
        <View style={styles.meta}>
          {level ? (
            <View
              style={[
                styles.level,
                {backgroundColor: levelTone(theme, level).soft},
              ]}
            >
              <AppText style={styles.levelText}>{level}</AppText>
            </View>
          ) : null}
          {slotCount > 0 ? (
            <AppText color="muted" variant="caption">
              {t('patternTense.slot_count', {count: slotCount})}
            </AppText>
          ) : null}
          {labels.length > 0 ? (
            <AppText color="muted" variant="caption">
              {labels.join(' · ')}
            </AppText>
          ) : null}
          {inReview ? (
            <View style={styles.review} testID={`${testID}-in-review`}>
              <MaterialIcon
                color={theme.colors.primary}
                name="repeat"
                size={14}
              />
              <AppText style={styles.reviewText}>
                {t('patternTense.in_review_short')}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <MaterialIcon
        color={theme.colors.text.muted}
        name="chevron_right"
        size={22}
      />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: 6,
    },
    frame: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 24,
    },
    level: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    levelText: {
      color: theme.colors.text.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    meta: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    review: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 3,
      paddingLeft: 6,
      paddingRight: 9,
      paddingVertical: 2,
    },
    reviewText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      flexDirection: 'row',
      gap: 10,
      paddingLeft: theme.spacing.md,
      paddingRight: 12,
      paddingVertical: 14,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    slot: {
      backgroundColor: theme.colors.tertiarySoft,
      color: theme.colors.onTertiaryContainer,
      fontWeight: '800',
    },
  });
}
