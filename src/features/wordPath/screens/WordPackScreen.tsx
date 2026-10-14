import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {PackHeroCard} from '../components/PackHeroCard';
import {packKindOf, summaryOfItems, topicLabelOf} from '../logic/packRows';
import {findDownloadedPack, learnedCodes} from '../logic/wordPackRepository';
import type {WordPackRouteParams} from './navigationTypes';
import {kindSummary} from './packText';

const FILTERS = ['all', 'new', 'learned'] as const;
type Filter = (typeof FILTERS)[number];

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: WordPackRouteParams};
  /** Tests pass the items; the screen reads the device otherwise. */
  items?: CatalogItem[];
  /** Tests pass the learned codes; the screen reads the device otherwise. */
  learned?: string[];
};

/**
 * Vocab path P5: one pack. What it teaches and how far the learner is come
 * first, with the two ways in (learn it, or check which words the learner
 * already knows); its items follow.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function WordPackScreen({
  navigation,
  route,
  items: given,
  learned: givenLearned,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {speak: say} = useSpeak();
  const [filter, setFilter] = useState<Filter>('all');
  const packId = route?.params.packId ?? '';
  const pack = findDownloadedPack(packId);
  const items = useMemo(() => {
    if (given) return given;
    if (!pack) return [];
    const byCode = readCatalogItems(pack.itemCodes);
    return pack.itemCodes.flatMap(code => byCode.get(code) ?? []);
  }, [given, pack]);
  const learned = useMemo(
    () =>
      givenLearned
        ? new Set(givenLearned)
        : learnedCodes(items.map(item => item.code)),
    [givenLearned, items],
  );

  const {kindCounts} = summaryOfItems(items);
  const kind = packKindOf(kindCounts);
  const total = items.length;
  const learnedTotal = items.filter(item => learned.has(item.code)).length;
  const left = total - learnedTotal;
  const done = total > 0 && left === 0;
  const learnTitle = done
    ? t('wordPack.review')
    : learnedTotal > 0
      ? t('wordPack.continue', {count: left})
      : t('wordPack.learn');
  const title = capitalized(
    pack
      ? (topicLabelOf(pack.topicCode) ??
          t('wordPath.pack_title', {position: pack.position}))
      : t('wordPack.title'),
  );

  const shown = items.filter(item =>
    filter === 'all'
      ? true
      : filter === 'learned'
        ? learned.has(item.code)
        : !learned.has(item.code),
  );

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={
          kind === 'sentence'
            ? t('wordPack.kind_sentence')
            : t('wordPack.kind_word')
        }
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {!pack && !given ? (
          <AppCard testID="word-pack-missing">
            <AppText color="secondary">{t('wordPack.not_downloaded')}</AppText>
          </AppCard>
        ) : null}
        {total > 0 ? (
          <PackHeroCard
            kindLabel={
              kind === 'sentence'
                ? t('wordPack.kind_sentence')
                : t('wordPack.kind_word')
            }
            learnTitle={learnTitle}
            learned={learnedTotal}
            levelLabel={
              pack
                ? [
                    pack.cefrLevel,
                    t(`wordPath.level_${pack.cefrLevel}`, {defaultValue: ''}),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null
            }
            onCheck={
              done ? undefined : () => appNavigation.openQuickKnownCheck(packId)
            }
            onLearn={() => appNavigation.openPackLearn(packId)}
            subtitle={kindSummary(t, kindCounts)}
            title={title}
            total={total}
          />
        ) : null}
        {total > 0 ? (
          <View style={styles.listHeader}>
            <AppText variant="h3">{t('wordPack.in_pack')}</AppText>
            <View accessibilityRole="tablist" style={themedStyles.filters}>
              {FILTERS.map(option => {
                const on = option === filter;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="tab"
                    accessibilityState={{selected: on}}
                    hitSlop={4}
                    onPress={() => setFilter(option)}
                    style={[themedStyles.filter, on && themedStyles.filterOn]}
                    testID={`word-pack-filter-${option}`}
                  >
                    <AppText
                      style={[
                        themedStyles.filterText,
                        on && themedStyles.filterTextOn,
                      ]}
                    >
                      {t(`wordPack.filter_${option}`)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {total > 0 ? (
          <View style={themedStyles.list}>
            {shown.length === 0 ? (
              <AppText color="muted" style={styles.emptyFilter}>
                {t('wordPack.filter_empty')}
              </AppText>
            ) : null}
            {shown.map((item, index) => {
              const isLearned = learned.has(item.code);
              return (
                <View
                  key={item.code}
                  style={[
                    styles.item,
                    index > 0 ? themedStyles.itemDivider : null,
                  ]}
                  testID={`word-pack-item-${item.code}`}
                >
                  <View
                    style={[
                      themedStyles.status,
                      isLearned ? themedStyles.statusOn : null,
                    ]}
                    testID={
                      isLearned
                        ? `word-pack-learned-${item.code}`
                        : `word-pack-new-${item.code}`
                    }
                  >
                    {isLearned ? (
                      <AppText style={themedStyles.statusMark}>✓</AppText>
                    ) : null}
                  </View>
                  <View style={styles.itemText}>
                    <View style={styles.wordLine}>
                      <AppText style={themedStyles.word}>{item.text}</AppText>
                      {item.ipa ? (
                        <AppText color="muted" variant="caption">
                          {formatIpa(item.ipa)}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText color="secondary" variant="caption">
                      {item.meaning_vi}
                    </AppText>
                  </View>
                  <IconButton
                    accessibilityHint={t('packQuiz.speak_hint')}
                    accessibilityLabel={t('wordPack.speak', {text: item.text})}
                    icon="volume_up"
                    iconSize={18}
                    onPress={() => say(item.text)}
                    size={36}
                    style={themedStyles.speak}
                    testID={`word-pack-speak-${item.code}`}
                  />
                  <IconButton
                    accessibilityHint={t('wordPack.combo_hint')}
                    accessibilityLabel={t('wordPack.combo')}
                    icon="auto_awesome"
                    iconSize={18}
                    onPress={() => appNavigation.openComboSetup(item.code)}
                    size={36}
                    style={themedStyles.combo}
                    testID={`word-pack-combo-${item.code}`}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

/** "daily life" → "Daily life": topic labels come lower-case. */
function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    filters: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      padding: 3,
    },
    filter: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    filterOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    filterText: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    filterTextOn: {
      color: theme.colors.primary,
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.shelf?.surface.color ?? theme.colors.border,
      borderBottomWidth: 4,
      borderRadius: 22,
      overflow: 'hidden',
    },
    itemDivider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    status: {
      alignItems: 'center',
      borderColor: theme.colors.outlineVariant,
      borderRadius: 13,
      borderWidth: 2,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    statusOn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    statusMark: {
      color: theme.colors.text.inverse,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
    },
    word: {
      color: theme.colors.text.primary,
      fontSize: 16.5,
      fontWeight: '700',
    },
    speak: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 12,
    },
    combo: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 12,
    },
  });
}

const styles = StyleSheet.create({
  emptyFilter: {
    padding: 16,
    textAlign: 'center',
  },
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 11,
  },
  itemText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  wordLine: {
    alignItems: 'baseline',
    columnGap: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
