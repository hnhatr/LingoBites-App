import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {packKindOf, summaryOfItems, topicLabelOf} from '../logic/packRows';
import {findDownloadedPack, learnedCodes} from '../logic/wordPackRepository';
import type {WordPackRouteParams} from './navigationTypes';
import {kindSummary} from './packText';

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
  const title = pack
    ? (topicLabelOf(pack.topicCode) ??
      t('wordPath.pack_title', {position: pack.position}))
    : t('wordPack.title');

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
          <AppCard testID="word-pack-summary">
            <View style={styles.stack}>
              <View style={styles.tags}>
                {pack ? (
                  <View style={themedStyles.tag}>
                    <AppText variant="caption">
                      {`${pack.cefrLevel} · ${t(
                        `wordPath.level_${pack.cefrLevel}`,
                        {defaultValue: ''},
                      )}`}
                    </AppText>
                  </View>
                ) : null}
                <View
                  style={[
                    themedStyles.tag,
                    kind === 'sentence'
                      ? themedStyles.tagSentence
                      : themedStyles.tagWord,
                  ]}
                  testID="word-pack-kind"
                >
                  <AppText
                    style={
                      kind === 'sentence'
                        ? themedStyles.tagSentenceText
                        : themedStyles.tagWordText
                    }
                    variant="caption"
                  >
                    {kind === 'sentence'
                      ? t('wordPack.kind_sentence')
                      : t('wordPack.kind_word')}
                  </AppText>
                </View>
              </View>
              <AppText variant="h2">{title}</AppText>
              <AppText color="secondary">
                {t('wordPack.about', {parts: kindSummary(t, kindCounts)})}
              </AppText>
              <View style={styles.stats}>
                <View style={themedStyles.stat}>
                  <AppText variant="h3">{total}</AppText>
                  <AppText color="secondary" variant="caption">
                    {t('wordPack.stat_total')}
                  </AppText>
                </View>
                <View style={themedStyles.stat}>
                  <AppText testID="word-pack-learned-count" variant="h3">
                    {learnedTotal}
                  </AppText>
                  <AppText color="secondary" variant="caption">
                    {t('wordPack.stat_learned')}
                  </AppText>
                </View>
                <View style={themedStyles.stat}>
                  <AppText variant="h3">{left}</AppText>
                  <AppText color="secondary" variant="caption">
                    {t('wordPack.stat_left')}
                  </AppText>
                </View>
              </View>
              <AppButton
                onPress={() => appNavigation.openPackLearn(packId)}
                testID="word-pack-learn"
                title={learnTitle}
                variant="secondary"
              />
              {done ? null : (
                <AppButton
                  onPress={() => appNavigation.openQuickKnownCheck(packId)}
                  testID="word-pack-check"
                  title={t('wordPack.check')}
                  variant="outline"
                />
              )}
            </View>
          </AppCard>
        ) : null}
        {total > 0 ? (
          <View style={styles.listHeader}>
            <AppText color="secondary" variant="label">
              {t('wordPack.in_pack')}
            </AppText>
            <AppText color="secondary" variant="label">
              {`${learnedTotal}/${total}`}
            </AppText>
          </View>
        ) : null}
        {total > 0 ? (
          <View style={themedStyles.list}>
            {items.map((item, index) => {
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
                      themedStyles.dot,
                      isLearned ? themedStyles.dotOn : null,
                    ]}
                    testID={
                      isLearned
                        ? `word-pack-learned-${item.code}`
                        : `word-pack-new-${item.code}`
                    }
                  />
                  <View style={styles.itemText}>
                    <AppText variant="title">
                      {item.text}
                      {item.ipa ? (
                        <AppText color="secondary" variant="caption">
                          {`  ${item.ipa}`}
                        </AppText>
                      ) : null}
                    </AppText>
                    <AppText color="secondary" variant="caption">
                      {item.meaning_vi}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityHint={t('wordPack.combo_hint')}
                    accessibilityLabel={t('wordPack.combo')}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => appNavigation.openComboSetup(item.code)}
                    testID={`word-pack-combo-${item.code}`}
                  >
                    <AppText style={themedStyles.link} variant="caption">
                      {t('wordPack.combo')}
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
          </View>
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
    dot: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      height: 10,
      width: 10,
    },
    dotOn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    itemDivider: {
      borderTopColor: theme.colors.outlineVariant,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    link: {
      color: theme.colors.primary,
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.md,
    },
    stat: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      flex: 1,
      paddingVertical: theme.spacing.sm,
    },
    tag: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    tagSentence: {
      backgroundColor: theme.colors.secondarySoft,
    },
    tagSentenceText: {
      color: theme.colors.secondary,
    },
    tagWord: {
      backgroundColor: theme.colors.accentSoft,
    },
    tagWordText: {
      color: theme.colors.primary,
    },
  });
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  itemText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stack: {
    gap: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
