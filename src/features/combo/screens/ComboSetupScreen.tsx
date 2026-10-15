import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {useAppNavigation} from '@core/navigation';

import {comboEdges} from '../components/comboEdges';
import {ComboGenerating} from '../components/ComboGenerating';
import {
  mixTotal,
  type PolarityMix,
  PolarityMixPicker,
} from '../components/PolarityMixPicker';
import {SegmentedChoice} from '../components/SegmentedChoice';
import {
  type Situation,
  SituationPickerSheet,
} from '../components/SituationPickerSheet';
import {openTenseCount, TenseGrid, tenseNameVi} from '../components/TenseGrid';
import {
  type ComboOptions,
  type ComboPolarity,
  fetchComboOptions,
  fetchComboSituations,
  openComboSet,
} from '../logic/comboClient';
import {
  comboEmptyNotice,
  type ComboErrorNotice,
  comboFailureNotice,
} from '../logic/comboErrors';
import {comboWordLabel} from '../logic/comboHistoryGroups';
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

/** Every subject group, in the order they show; the plan opens some of them. */
const SUBJECT_GROUPS: readonly string[] = [
  'i',
  'you',
  'he_she',
  'we',
  'they',
  'noun_phrase',
];

const POLARITIES: readonly string[] = ['affirmative', 'negative', 'question'];

function isPolarity(value: string): value is ComboPolarity {
  return POLARITIES.includes(value);
}

/**
 * Vocab path P5: set up a combo set for one word. The learner picks the
 * situation, the tense (not for a locked pattern), the subject groups, the
 * how many sentences, per polarity when the plan allows more than one;
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
  const [mix, setMix] = useState<PolarityMix>({});
  const [busy, setBusy] = useState(false);
  /** The message shown under the summary when a set could not be opened. */
  const [startError, setStartError] = useState<ComboErrorNotice | null>(null);
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
        const first = opts.value.polarities.find(isPolarity);
        const size = opts.value.batch_sizes[0];
        setMix(first && size ? {[first]: size} : {});
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
  const polarities = options?.polarities.filter(isPolarity) ?? [];
  const batchSizes = options?.batch_sizes ?? [];
  const total = mixTotal(mix);
  // A locked pattern has no tense to pick: the Server uses its own placeholder.
  const ready =
    options !== null &&
    situation !== null &&
    batchSizes.includes(total) &&
    groups.length > 0 &&
    (locked || tense !== null);

  const toggleGroup = (group: string) =>
    setGroups(current =>
      current.includes(group)
        ? current.filter(value => value !== group)
        : [...current, group],
    );

  const openGroups = options?.subject_groups ?? [];
  const allPicked = groups.length === openGroups.length;
  const lockedGroups = SUBJECT_GROUPS.filter(
    group => !openGroups.includes(group),
  ).length;

  const toggleAllGroups = () => setGroups(allPicked ? [] : openGroups);

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
  const pickedTense = options?.tenses.find(entry => entry.code === tense);
  const tenseName = pickedTense ? tenseNameVi(t, pickedTense) : undefined;
  const situationEn = situations.find(
    entry => entry.code === situation,
  )?.title_en;
  const countText =
    polarities.length > 1
      ? t('combo.setup.count_mix', {
          count: total,
          parts: polarities
            .filter(polarity => (mix[polarity] ?? 0) > 0)
            .map(
              polarity =>
                `${mix[polarity]} ${t(
                  `combo.setup.polarity_short.${polarity}`,
                )}`,
            )
            .join(', '),
        })
      : t('combo.setup.count_value', {count: total});
  const summary = !situationTitle
    ? t('combo.setup.need_situation')
    : groups.length === 0
      ? t('combo.setup.need_group')
      : total === 0
        ? t('combo.setup.need_count')
        : [
            situationTitle,
            locked ? t('combo.setup.locked_short') : tenseName,
            countText,
          ]
            .filter(Boolean)
            .join(' · ');

  const start = async () => {
    if (!options || !ready || situation === null) return;
    setBusy(true);
    setStartError(null);
    const grammarCode = locked ? undefined : (tense ?? undefined);
    const result = await openComboSet({
      itemCode,
      grammarCode,
      situationCode: situation,
      polarityCounts: mix,
      subjectGroups: groups,
    });
    if (!result.ok) {
      setBusy(false);
      setStartError(comboFailureNotice(result, 'open'));
      return;
    }
    // The Server deletes a set it could not fill and refunds it; nothing to open.
    if (result.value.sentences.length === 0) {
      setBusy(false);
      setStartError(
        comboEmptyNotice(result.value.reason, result.value.request_id),
      );
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
    appNavigation.openComboSet(
      result.value.set_id,
      result.value.sentences.length,
    );
    setBusy(false);
  };

  const step = (
    number: number,
    title: string,
    aside: string | null,
    body: React.ReactNode,
  ) => (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={themedStyles.stepNumber}>
          <AppText style={themedStyles.onTeal} variant="caption">
            {number}
          </AppText>
        </View>
        <AppText style={styles.grow} variant="h3">
          {title}
        </AppText>
        {aside ? (
          <AppText color="muted" variant="caption">
            {aside}
          </AppText>
        ) : null}
      </View>
      {body}
    </View>
  );

  const limit = (icon: HandoffIconName, label: string) => (
    <View style={themedStyles.limit}>
      <MaterialIcon
        color={theme.colors.onTertiaryContainer}
        name={icon}
        size={13}
      />
      <AppText style={themedStyles.sunInk} variant="caption">
        {label}
      </AppText>
    </View>
  );

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
          <View style={themedStyles.word}>
            <View style={styles.wordTop}>
              <View style={themedStyles.tile}>
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="style"
                  size={24}
                />
              </View>
              <View style={styles.grow}>
                <AppText numberOfLines={1} variant="h2">
                  {comboWordLabel(itemCode)}
                </AppText>
                <AppText color="muted" variant="caption">
                  {t('combo.setup.word_hint')}
                </AppText>
              </View>
            </View>
            <View style={styles.chips} testID="combo-setup-limits">
              {limit(
                'bolt',
                t('combo.setup.ai_left', {count: options.ai_left_today}),
              )}
              {limit(
                'style',
                t('combo.setup.sets_left', {count: options.sets_left_today}),
              )}
            </View>
          </View>
        ) : null}
        {options
          ? step(
              1,
              t('combo.setup.situation'),
              null,
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
                <View style={themedStyles.fieldIcon}>
                  <MaterialIcon
                    color={theme.colors.primary}
                    name="event_note"
                    size={20}
                  />
                </View>
                <View style={styles.grow}>
                  <AppText
                    color={situationTitle ? 'primary' : 'muted'}
                    numberOfLines={1}
                    variant="label"
                  >
                    {situationTitle ?? t('combo.setup.situation_placeholder')}
                  </AppText>
                  {situationEn ? (
                    <AppText color="muted" numberOfLines={1} variant="caption">
                      {situationEn}
                    </AppText>
                  ) : null}
                </View>
                <MaterialIcon
                  color={theme.colors.text.muted}
                  name="chevron_right"
                  size={22}
                />
              </Pressable>,
            )
          : null}
        {options
          ? step(
              2,
              t('combo.setup.tense'),
              locked
                ? null
                : t('combo.setup.tenses_open', {
                    count: openTenseCount(options.tenses),
                  }),
              locked ? (
                <View style={themedStyles.note} testID="combo-setup-locked">
                  <AppText color="secondary">{t('combo.setup.locked')}</AppText>
                </View>
              ) : (
                <TenseGrid
                  onSelect={setTense}
                  selected={tense}
                  tenses={options.tenses}
                />
              ),
            )
          : null}
        {options
          ? step(
              3,
              t('combo.setup.groups'),
              t('combo.setup.groups_picked', {
                count: groups.length,
                open: openGroups.length,
              }),
              <View style={styles.groups}>
                <View style={styles.chips}>
                  {SUBJECT_GROUPS.map(group => {
                    const name = t(`combo.setup.group.${group}`, {
                      defaultValue: group,
                    });
                    if (!openGroups.includes(group)) {
                      return (
                        <View
                          accessibilityHint={t('combo.setup.group_locked_hint')}
                          accessibilityLabel={t('combo.setup.group_locked', {
                            name,
                          })}
                          accessibilityState={{disabled: true}}
                          accessible
                          key={group}
                          style={themedStyles.subjectLocked}
                          testID={`combo-setup-group-locked-${group}`}
                        >
                          <MaterialIcon
                            color={theme.colors.text.muted}
                            name="lock"
                            size={14}
                          />
                          <AppText color="muted" variant="label">
                            {name}
                          </AppText>
                        </View>
                      );
                    }
                    const on = groups.includes(group);
                    return (
                      <Pressable
                        accessibilityHint={t('combo.setup.group_hint')}
                        accessibilityLabel={name}
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: on}}
                        key={group}
                        onPress={() => toggleGroup(group)}
                        style={[
                          themedStyles.subject,
                          on ? themedStyles.subjectOn : null,
                        ]}
                        testID={`combo-setup-group-${group}`}
                      >
                        {on ? (
                          <MaterialIcon
                            color={theme.colors.primary}
                            name="check_circle"
                            size={15}
                          />
                        ) : (
                          <View style={themedStyles.ring} />
                        )}
                        <AppText
                          style={on ? themedStyles.teal : themedStyles.plain}
                          variant="label"
                        >
                          {name}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.subtools}>
                  <AppText
                    color={groups.length === 0 ? 'danger' : 'muted'}
                    testID="combo-setup-groups-note"
                    variant="caption"
                  >
                    {groups.length === 0
                      ? t('combo.setup.need_group')
                      : t('combo.setup.groups_tap')}
                  </AppText>
                  {openGroups.length > 1 ? (
                    <Pressable
                      accessibilityHint={t('combo.setup.groups_all_hint')}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={toggleAllGroups}
                      testID="combo-setup-groups-all"
                    >
                      <AppText style={themedStyles.teal} variant="label">
                        {allPicked
                          ? t('combo.setup.groups_none')
                          : t('combo.setup.groups_all')}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
                {lockedGroups > 0 ? (
                  <View style={styles.lockHint}>
                    <MaterialIcon
                      color={theme.colors.text.muted}
                      name="lock"
                      size={14}
                    />
                    <AppText
                      color="muted"
                      style={styles.grow}
                      testID="combo-setup-groups-locked"
                      variant="caption"
                    >
                      {t('combo.setup.groups_locked', {count: lockedGroups})}
                    </AppText>
                  </View>
                ) : null}
              </View>,
            )
          : null}
        {options
          ? step(
              4,
              polarities.length > 1
                ? t('combo.setup.count_by_polarity')
                : t('combo.setup.count'),
              batchSizes.length > 0
                ? t('combo.setup.count_max', {count: Math.max(...batchSizes)})
                : null,
              polarities.length > 1 ? (
                <PolarityMixPicker
                  max={Math.max(...batchSizes)}
                  mix={mix}
                  onChange={setMix}
                  polarities={polarities}
                  step={Math.min(...batchSizes)}
                />
              ) : (
                <SegmentedChoice
                  accessibilityHint={t('combo.setup.choice_hint')}
                  onSelect={key =>
                    setMix(polarities[0] ? {[polarities[0]]: Number(key)} : {})
                  }
                  options={batchSizes.map(size => ({
                    key: String(size),
                    label: t('combo.setup.count_value', {count: size}),
                    testID: `combo-setup-count-${size}`,
                  }))}
                  selected={String(total)}
                />
              ),
            )
          : null}
      </ScrollView>
      {options ? (
        <StickerFooter>
          <AppText
            color={ready ? 'secondary' : 'muted'}
            numberOfLines={2}
            style={styles.summary}
            testID="combo-setup-summary"
            variant="caption"
          >
            {summary}
          </AppText>
          {startError ? (
            <AppText
              color="danger"
              style={styles.summary}
              testID="combo-setup-start-error"
              variant="label"
            >
              {t(startError.key)}
            </AppText>
          ) : null}
          {startError?.requestId ? (
            <AppText
              color="muted"
              selectable
              style={styles.summary}
              testID="combo-setup-start-error-id"
              variant="caption"
            >
              {t('combo.errors.request_id', {id: startError.requestId})}
            </AppText>
          ) : null}
          <StickerButton
            disabled={!ready || busy}
            icon="auto_awesome"
            label={t('combo.setup.start')}
            onPress={start}
            testID="combo-setup-start"
          />
        </StickerFooter>
      ) : null}
      {busy && options ? (
        <ComboGenerating
          count={total}
          subline={summary}
          word={comboWordLabel(itemCode)}
        />
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
  fill: {
    flex: 1,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  groups: {
    gap: 8,
  },
  lockHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 4,
  },
  step: {
    gap: 8,
  },
  stepHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  subtools: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  summary: {
    textAlign: 'center',
  },
  wordTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

function makeStyles(theme: AppTheme) {
  const edge = theme.colors.surfaceHigh;
  return StyleSheet.create({
    container: {
      gap: 18,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    word: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      gap: 10,
      padding: 14,
      ...getStickerEdge(4, edge),
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      height: 48,
      justifyContent: 'center',
      width: 48,
      ...getStickerEdge(3, comboEdges(theme).sun),
    },
    limit: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    sunInk: {
      color: theme.colors.onTertiaryContainer,
    },
    stepNumber: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      height: 22,
      justifyContent: 'center',
      width: 22,
    },
    onTeal: {
      color: theme.colors.text.inverse,
    },
    field: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getStickerEdge(3, edge),
    },
    fieldIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 12,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    subject: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      ...getStickerEdge(3, edge),
    },
    subjectOn: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, comboEdges(theme).mint),
    },
    subjectLocked: {
      alignItems: 'center',
      borderColor: theme.colors.outlineVariant,
      borderRadius: 14,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    ring: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: 8,
      borderWidth: 2,
      height: 15,
      width: 15,
    },
    teal: {
      color: theme.colors.primary,
    },
    plain: {
      color: theme.colors.text.secondary,
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
