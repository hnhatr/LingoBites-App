import React, {useEffect, useMemo, useState} from 'react';
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
  type ComboOptions,
  fetchComboOptions,
  fetchComboSituations,
  openComboSet,
} from '../logic/comboClient';
import {saveComboSet} from '../logic/comboSetRepository';
import type {ComboSetupRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: ComboSetupRouteParams};
};

type Situation = {code: string; title_vi: string};

/**
 * Vocab path P5: set up a combo set for one word. The learner picks the
 * situation, the tense (not for a locked pattern), the subject groups, the
 * polarity and how many sentences; the Server's limits show on the sheet.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ComboSetupScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const itemCode = route?.params.itemCode ?? '';
  const [options, setOptions] = useState<ComboOptions | null>(null);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [situation, setSituation] = useState<string | null>(null);
  const [tense, setTense] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [polarity, setPolarity] = useState<string>('affirmative');
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchComboOptions(itemCode), fetchComboSituations(itemCode)])
      .then(([opts, sits]) => {
        if (!active) return;
        if (!opts.ok || !sits.ok) {
          setLoadFailed(true);
          return;
        }
        setOptions(opts.value);
        setSituations(sits.value.situations);
        setGroups(opts.value.subject_groups);
        setPolarity(opts.value.polarities[0] ?? 'affirmative');
        setCount(opts.value.batch_sizes[0] ?? null);
        setTense(opts.value.tenses[0]?.code ?? null);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [itemCode]);

  const locked = options?.tense_mode === 'locked';
  // A locked pattern has no tense to pick: the Server uses its own placeholder.
  const ready =
    options !== null &&
    situation !== null &&
    count !== null &&
    groups.length > 0 &&
    (locked || tense !== null);

  const toggleGroup = (group: string) =>
    setGroups(current =>
      current.includes(group)
        ? current.filter(value => value !== group)
        : [...current, group],
    );

  const start = async () => {
    if (!options || !ready || situation === null || count === null) return;
    setBusy(true);
    setStartFailed(false);
    const grammarCode = locked ? undefined : tense ?? undefined;
    const result = await openComboSet({
      itemCode,
      grammarCode,
      situationCode: situation,
      count,
      polarity: polarity as 'affirmative' | 'negative' | 'question',
      subjectGroups: groups,
    });
    setBusy(false);
    if (!result.ok) {
      setStartFailed(true);
      return;
    }
    saveComboSet(
      {
        id: result.value.set_id,
        itemCode,
        grammarCode: grammarCode ?? '',
        situationCode: situation,
        sentences: result.value.sentences,
      },
      new Date(),
    );
    appNavigation.openComboSet(result.value.set_id);
  };

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('combo.setup.title')}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {loadFailed ? (
          <AppCard testID="combo-setup-failed">
            <AppText color="secondary">{t('combo.setup.load_failed')}</AppText>
          </AppCard>
        ) : null}
        {options ? (
          <AppCard testID="combo-setup-limits">
            <AppText color="secondary" variant="label">
              {t('combo.setup.left', {
                ai: options.ai_left_today,
                sets: options.sets_left_today,
              })}
            </AppText>
          </AppCard>
        ) : null}
        {locked ? (
          <AppCard testID="combo-setup-locked">
            <AppText color="secondary">{t('combo.setup.locked')}</AppText>
          </AppCard>
        ) : null}
        {options ? (
          <AppCard>
            <AppText variant="h3">{t('combo.setup.situation')}</AppText>
            {situations.map(entry => (
              <AppButton
                key={entry.code}
                onPress={() => setSituation(entry.code)}
                testID={`combo-setup-situation-${entry.code}`}
                title={entry.title_vi}
                variant={situation === entry.code ? 'secondary' : 'outline'}
              />
            ))}
          </AppCard>
        ) : null}
        {options && !locked ? (
          <AppCard>
            <AppText variant="h3">{t('combo.setup.tense')}</AppText>
            {options.tenses.map(entry => (
              <AppButton
                key={entry.code}
                onPress={() => setTense(entry.code)}
                testID={`combo-setup-tense-${entry.code}`}
                title={entry.name_en}
                variant={tense === entry.code ? 'secondary' : 'outline'}
              />
            ))}
          </AppCard>
        ) : null}
        {options ? (
          <AppCard>
            <AppText variant="h3">{t('combo.setup.groups')}</AppText>
            {options.subject_groups.map(group => (
              <AppButton
                key={group}
                onPress={() => toggleGroup(group)}
                testID={`combo-setup-group-${group}`}
                title={group}
                variant={groups.includes(group) ? 'secondary' : 'outline'}
              />
            ))}
          </AppCard>
        ) : null}
        {options ? (
          <AppCard>
            <AppText variant="h3">{t('combo.setup.count')}</AppText>
            {options.batch_sizes.map(size => (
              <AppButton
                key={size}
                onPress={() => setCount(size)}
                testID={`combo-setup-count-${size}`}
                title={String(size)}
                variant={count === size ? 'secondary' : 'outline'}
              />
            ))}
          </AppCard>
        ) : null}
        {options ? (
          <AppButton
            disabled={!ready || busy}
            onPress={start}
            testID="combo-setup-start"
            title={t('combo.setup.start')}
            variant="secondary"
          />
        ) : null}
        {startFailed ? (
          <AppText color="danger">{t('combo.setup.start_failed')}</AppText>
        ) : null}
      </ScrollView>
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
