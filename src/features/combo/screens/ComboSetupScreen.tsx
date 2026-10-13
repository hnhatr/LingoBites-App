import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {SegmentedChoice} from '../components/SegmentedChoice';
import {
  type Situation,
  SituationPickerSheet,
} from '../components/SituationPickerSheet';
import {TenseGrid} from '../components/TenseGrid';
import {
  type ComboOptions,
  fetchComboOptions,
  fetchComboSituations,
  openComboSet,
} from '../logic/comboClient';
import {
  listRecentSituationCodes,
  saveComboSet,
} from '../logic/comboSetRepository';
import {
  loadSituationBookmarks,
  saveSituationBookmarks,
} from '../logic/situationBookmarks';
import type {ComboSetupRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: ComboSetupRouteParams};
};

const RECENT_SITUATIONS = 3;

/**
 * Vocab path P5: set up a combo set for one word. The learner picks the
 * situation, the tense (not for a locked pattern), the subject groups, the
 * polarity (only when the plan allows more than one) and how many sentences;
 * the Server's limits show under the title. The situation comes from a
 * searchable sheet with the learner's bookmarks and recent picks on top.
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    loadSituationBookmarks().then(codes => {
      if (active) setBookmarks(codes);
    });
    try {
      setRecent(listRecentSituationCodes(RECENT_SITUATIONS));
    } catch {
      // The recent list is a shortcut; without it the sheet lists them all.
    }
    return () => {
      active = false;
    };
  }, []);

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

  const toggleBookmark = (code: string) => {
    const next = bookmarks.includes(code)
      ? bookmarks.filter(value => value !== code)
      : [...bookmarks, code];
    setBookmarks(next);
    saveSituationBookmarks(next);
  };

  const pickSituation = (code: string) => {
    setSituation(code);
    setPickerOpen(false);
  };

  const situationTitle = situations.find(
    entry => entry.code === situation,
  )?.title_vi;
  const tenseName = options?.tenses.find(
    entry => entry.code === tense,
  )?.name_en;
  const summary = !situationTitle
    ? t('combo.setup.need_situation')
    : groups.length === 0
    ? t('combo.setup.need_group')
    : [
        situationTitle,
        locked ? t('combo.setup.locked_short') : tenseName,
        count !== null ? t('combo.setup.count_value', {count}) : null,
      ]
        .filter(Boolean)
        .join(' · ');

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
      <ScrollView
        contentContainerStyle={themedStyles.container}
        style={styles.fill}
      >
        {loadFailed ? (
          <AppCard testID="combo-setup-failed">
            <AppText color="secondary">{t('combo.setup.load_failed')}</AppText>
          </AppCard>
        ) : null}
        {options ? (
          <View style={styles.pills} testID="combo-setup-limits">
            <Chip
              label={t('combo.setup.ai_left', {count: options.ai_left_today})}
              tone="gold"
            />
            <Chip
              label={t('combo.setup.sets_left', {
                count: options.sets_left_today,
              })}
              tone="gold"
            />
          </View>
        ) : null}
        {options ? (
          <View style={styles.section}>
            <AppText color="secondary" style={styles.heading} variant="label">
              {t('combo.setup.situation')}
            </AppText>
            <Pressable
              accessibilityHint={t('combo.setup.situation_field_hint')}
              accessibilityLabel={
                situationTitle ?? t('combo.setup.situation_placeholder')
              }
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              style={themedStyles.field}
              testID="combo-setup-situation-field"
            >
              <AppText
                color={situationTitle ? 'primary' : 'muted'}
                style={styles.fieldText}
              >
                {situationTitle ?? t('combo.setup.situation_placeholder')}
              </AppText>
              <MaterialIcon
                color={theme.colors.primary}
                name="chevron_right"
                size={22}
              />
            </Pressable>
          </View>
        ) : null}
        {options ? (
          <View style={styles.section}>
            <AppText color="secondary" style={styles.heading} variant="label">
              {t('combo.setup.tense')}
            </AppText>
            {locked ? (
              <View style={themedStyles.note} testID="combo-setup-locked">
                <AppText color="secondary">{t('combo.setup.locked')}</AppText>
              </View>
            ) : (
              <TenseGrid
                onSelect={setTense}
                selected={tense}
                tenses={options.tenses}
              />
            )}
          </View>
        ) : null}
        {options ? (
          <View style={styles.section}>
            <View style={styles.headingRow}>
              <AppText color="secondary" style={styles.heading} variant="label">
                {t('combo.setup.groups')}
              </AppText>
              <AppText color="muted" variant="caption">
                {t('combo.setup.groups_many')}
              </AppText>
            </View>
            <View style={styles.chips}>
              {options.subject_groups.map(group => (
                <Chip
                  key={group}
                  label={t(`combo.setup.group.${group}`, {defaultValue: group})}
                  onPress={() => toggleGroup(group)}
                  selected={groups.includes(group)}
                  testID={`combo-setup-group-${group}`}
                />
              ))}
            </View>
          </View>
        ) : null}
        {options && options.polarities.length > 1 ? (
          <View style={styles.section}>
            <AppText color="secondary" style={styles.heading} variant="label">
              {t('combo.setup.polarity')}
            </AppText>
            <SegmentedChoice
              accessibilityHint={t('combo.setup.choice_hint')}
              onSelect={setPolarity}
              options={options.polarities.map(value => ({
                key: value,
                label: t(`combo.setup.polarity_value.${value}`, {
                  defaultValue: value,
                }),
                testID: `combo-setup-polarity-${value}`,
              }))}
              selected={polarity}
            />
          </View>
        ) : null}
        {options ? (
          <View style={styles.section}>
            <AppText color="secondary" style={styles.heading} variant="label">
              {t('combo.setup.count')}
            </AppText>
            <SegmentedChoice
              accessibilityHint={t('combo.setup.choice_hint')}
              onSelect={key => setCount(Number(key))}
              options={options.batch_sizes.map(size => ({
                key: String(size),
                label: t('combo.setup.count_value', {count: size}),
                testID: `combo-setup-count-${size}`,
              }))}
              selected={count === null ? null : String(count)}
            />
          </View>
        ) : null}
      </ScrollView>
      {options ? (
        <BottomActionBar>
          <AppText
            color={ready ? 'primary' : 'muted'}
            numberOfLines={1}
            style={styles.summary}
            testID="combo-setup-summary"
            variant="label"
          >
            {summary}
          </AppText>
          {startFailed ? (
            <AppText color="danger" style={styles.summary} variant="label">
              {t('combo.setup.start_failed')}
            </AppText>
          ) : null}
          <AppButton
            disabled={!ready || busy}
            onPress={start}
            testID="combo-setup-start"
            title={t('combo.setup.start')}
            variant="secondary"
          />
        </BottomActionBar>
      ) : null}
      {pickerOpen ? (
        <SituationPickerSheet
          bookmarks={bookmarks}
          onDismiss={() => setPickerOpen(false)}
          onSelect={pickSituation}
          onToggleBookmark={toggleBookmark}
          recent={recent}
          selected={situation}
          situations={situations}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldText: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  heading: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headingRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 8,
  },
  summary: {
    textAlign: 'center',
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.lg,
      padding: theme.spacing.md,
    },
    field: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
    },
    note: {
      backgroundColor: theme.colors.surfaceLow,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: theme.spacing.md,
    },
  });
}
