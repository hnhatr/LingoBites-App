import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';
import {comboSituationsAvailable} from '@features/combo';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppTabs} from '@ui/components/AppTabs';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {formatIpa} from '@ui/components/WordCard';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

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

/** The combo button's check of an item: under way, or why it stayed here. */
type ComboCheck = {code: string; state: 'checking' | 'none' | 'error'};

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
  const [comboCheck, setComboCheck] = useState<ComboCheck | null>(null);
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

  // The setup opens only when some situation fits the item; otherwise the row says so.
  const openCombo = async (code: string) => {
    if (comboCheck?.state === 'checking') return;
    setComboCheck({code, state: 'checking'});
    const found = await comboSituationsAvailable(code);
    if (found === 'ok') {
      setComboCheck(null);
      appNavigation.openComboSetup(code);
      return;
    }
    setComboCheck({code, state: found});
  };

  const shown = items.filter(item =>
    filter === 'all'
      ? true
      : filter === 'learned'
        ? learned.has(item.code)
        : !learned.has(item.code),
  );
  const filterCounts: Record<Filter, number> = {
    all: total,
    new: left,
    learned: learnedTotal,
  };

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
            <AppTabs
              onChange={setFilter}
              tabs={FILTERS.map(option => ({
                id: option,
                label: t(`wordPack.filter_${option}`),
                count: filterCounts[option],
              }))}
              testID="word-pack-filter"
              value={filter}
            />
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
              const check =
                comboCheck?.code === item.code ? comboCheck.state : null;
              return (
                <View
                  key={item.code}
                  style={index > 0 ? themedStyles.itemDivider : null}
                  testID={`word-pack-item-${item.code}`}
                >
                  <View style={styles.item}>
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
                    <RowButton
                      accessibilityHint={t('packQuiz.speak_hint')}
                      accessibilityLabel={t('wordPack.speak', {
                        text: item.text,
                      })}
                      icon="volume_up"
                      onPress={() => say(item.text)}
                      testID={`word-pack-speak-${item.code}`}
                      tone="plain"
                    />
                    <RowButton
                      accessibilityHint={t('wordPack.combo_hint')}
                      accessibilityLabel={t('wordPack.combo')}
                      disabled={check === 'checking'}
                      icon="auto_awesome"
                      onPress={() => openCombo(item.code)}
                      testID={`word-pack-combo-${item.code}`}
                      tone="mint"
                    />
                  </View>
                  {check === 'none' || check === 'error' ? (
                    <AppText
                      accessibilityLiveRegion="polite"
                      color="secondary"
                      style={styles.comboNotice}
                      testID={`word-pack-combo-notice-${item.code}`}
                      variant="caption"
                    >
                      {t(
                        check === 'none'
                          ? 'wordPack.combo_no_situation'
                          : 'wordPack.combo_check_failed',
                      )}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

type RowButtonProps = {
  icon: HandoffIconName;
  tone: 'plain' | 'mint';
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint: string;
  testID: string;
};

/**
 * A row's small square button on a soft edge, like "Dán": `plain` to listen,
 * `mint` for the combo. Pressing sinks it into its edge.
 */
function RowButton({
  icon,
  tone,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: RowButtonProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const mint = tone === 'mint';
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({pressed}) => [
        styles.rowButton,
        mint ? themedStyles.mint : themedStyles.plain,
        pressed && !disabled
          ? mint
            ? themedStyles.mintPressed
            : themedStyles.plainPressed
          : null,
        disabled ? themedStyles.disabled : null,
      ]}
      testID={testID}
    >
      <MaterialIcon color={theme.colors.primary} name={icon} size={18} />
    </Pressable>
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
    list: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
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
    plain: {
      backgroundColor: theme.colors.surfaceMuted,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    plainPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, theme.colors.surfaceHigh),
    },
    mint: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, withAlpha(theme.colors.primary, 0.22)),
    },
    mintPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, withAlpha(theme.colors.primary, 0.22)),
    },
    disabled: {
      opacity: theme.states.disabledOpacity,
    },
  });
}

const styles = StyleSheet.create({
  comboNotice: {
    paddingBottom: 11,
    paddingHorizontal: 14,
    textAlign: 'right',
  },
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
    gap: 10,
    marginTop: 6,
  },
  rowButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wordLine: {
    alignItems: 'baseline',
    columnGap: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
