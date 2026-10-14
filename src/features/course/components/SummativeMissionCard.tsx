import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {SummativeState, UnitProgress} from '../logic/unitProgress';

type Props = {
  state: SummativeState;
  progress: UnitProgress;
  onPress: () => void;
  /** Width of the lesson rail, so the flag sits on the line. */
  railWidth: number;
};

/**
 * The unit's summative task (decision B4) as the reward at the end of its
 * lessons: locked with a pip per lesson until every lesson's practice is
 * done, then open.
 */
export function SummativeMissionCard({
  state,
  progress,
  onPress,
  railWidth,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const locked = state === 'locked';

  return (
    <View style={styles.row}>
      <View style={[styles.rail, {width: railWidth}]}>
        <View style={[themedStyles.flag, !locked && themedStyles.flagOpen]}>
          <MaterialIcon
            color={locked ? theme.colors.text.muted : theme.colors.accentInk}
            name="flag"
            size={18}
          />
        </View>
      </View>
      <Pressable
        accessibilityHint={t(`course.summative_${state}_hint`)}
        accessibilityLabel={t(`course.summative_${state}`)}
        accessibilityRole="button"
        accessibilityState={{disabled: locked}}
        disabled={locked}
        onPress={onPress}
        style={[themedStyles.card, !locked && themedStyles.cardOpen]}
        testID="unit-lessons-summative"
      >
        <View style={[themedStyles.icon, !locked && themedStyles.iconOpen]}>
          <MaterialIcon
            color={locked ? theme.colors.text.muted : theme.colors.accentInk}
            name={locked ? 'lock' : 'emoji_events'}
            size={24}
          />
        </View>
        <View style={styles.copy}>
          <AppText style={themedStyles.eyebrow}>
            {t('course.summative_locked')}
          </AppText>
          <AppText variant="label">
            {locked
              ? t('course.summative_mission_title')
              : t(`course.summative_${state}`)}
          </AppText>
          {locked ? (
            <AppText
              color="muted"
              testID="unit-lessons-summative-locked"
              variant="caption"
            >
              {t('course.summative_locked_note')}
            </AppText>
          ) : null}
          {locked && progress.total > 0 ? (
            <View style={styles.pips}>
              {Array.from({length: progress.total}, (_, index) => (
                <View
                  key={index}
                  style={[
                    themedStyles.pip,
                    index < progress.completed && themedStyles.pipDone,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pips: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  rail: {
    alignItems: 'center',
    paddingTop: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.components.card.radius,
      borderStyle: 'dashed',
      borderWidth: 2,
      flex: 1,
      flexDirection: 'row',
      gap: 14,
      minWidth: 0,
      padding: 16,
    },
    cardOpen: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accent,
      borderStyle: 'solid',
    },
    eyebrow: {
      color: theme.colors.secondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      lineHeight: 15,
      textTransform: 'uppercase',
    },
    flag: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: 18,
      borderWidth: 2,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    flagOpen: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    icon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 16,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    iconOpen: {
      backgroundColor: theme.colors.accent,
    },
    pip: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 3,
      height: 6,
      width: 22,
    },
    pipDone: {
      backgroundColor: theme.colors.primary,
    },
  });
}
