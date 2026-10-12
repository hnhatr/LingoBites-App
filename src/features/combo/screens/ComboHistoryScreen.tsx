import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  listLocalComboSets,
  type LocalComboSetSummary,
} from '../logic/comboSetRepository';

type Props = {
  navigation?: {goBack?: () => void};
  /** Tests pass the sets; the screen reads the device otherwise. */
  sets?: LocalComboSetSummary[];
};

/**
 * Vocab path P5, library "Bộ câu đã học": the sets kept on this device, newest
 * first. The list alone, so the Library can show it inside its own screen.
 */
export function ComboHistoryList({
  sets: all,
  query = '',
}: {
  sets: LocalComboSetSummary[];
  query?: string;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const needle = query.trim().toLowerCase();
  const sets = needle
    ? all.filter(set => set.itemCode.toLowerCase().includes(needle))
    : all;
  return (
    <ScrollView contentContainerStyle={themedStyles.container}>
      {sets.length === 0 ? (
        <AppCard testID="combo-history-empty">
          <AppText color="secondary">{t('combo.history.empty')}</AppText>
        </AppCard>
      ) : null}
      {sets.map(set => (
        <AppCard key={set.id} testID={`combo-history-${set.id}`}>
          <AppText variant="h3">{set.itemCode}</AppText>
          <AppText color="secondary" variant="label">
            {t('combo.history.count', {count: set.sentenceCount})}
          </AppText>
          <AppButton
            onPress={() => appNavigation.openComboSet(set.id)}
            testID={`combo-history-open-${set.id}`}
            title={t('combo.history.open')}
            variant="secondary"
          />
        </AppCard>
      ))}
    </ScrollView>
  );
}

/**
 * The history as its own screen; the word path links here.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ComboHistoryScreen({navigation, sets: given}: Props) {
  const {t} = useTranslation();
  const sets = useMemo(() => given ?? listLocalComboSets(), [given]);
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('combo.history.title')}
      />
      <ComboHistoryList sets={sets} />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
  });
}
