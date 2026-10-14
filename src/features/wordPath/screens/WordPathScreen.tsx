import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {LibraryCover, topicGlyph} from '@ui/components/LibraryCover';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  continuePackOf,
  matchesQuery,
  type PackKind,
  type PackRow,
  type PackStatus,
} from '../logic/packRows';
import {useWordPathRows} from '../logic/useWordPathRows';
import {saveWordPack} from '../logic/wordPackRepository';
import {fetchWordPack} from '../logic/wordPathClient';
import {kindSummary, packTitle} from './packText';

type Props = {navigation?: {goBack?: () => void}};

type Translate = ReturnType<typeof useTranslation>['t'];

function actionLabel(t: Translate, status: PackStatus): string {
  switch (status) {
    case 'not_downloaded':
      return t('wordPath.download');
    case 'ready':
      return t('wordPath.action_start');
    case 'learning':
      return t('wordPath.action_continue');
    case 'done':
      return t('wordPath.action_review');
  }
}

type PackCardProps = {
  row: PackRow;
  busy: boolean;
  disabled: boolean;
  onPress: (row: PackRow) => void;
};

function PackCard({row, busy, disabled, onPress}: PackCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const title = packTitle(t, row);
  const kinds = kindSummary(t, row.kindCounts);
  const subtitle = row.topic
    ? `${t('wordPath.pack_title', {position: row.position})} · ${kinds}`
    : kinds;
  const shown = row.kind === 'sentence' ? 2 : 4;
  const preview = row.preview.slice(0, shown);
  const more = row.total - preview.length;
  const status = t(`wordPath.status_${row.status}`);
  const ratio = row.total > 0 ? Math.min(row.learned / row.total, 1) : 0;
  const filled = row.status === 'learning' || row.status === 'ready';

  return (
    <Pressable
      accessibilityHint={
        row.downloaded ? t('wordPath.open_hint') : t('wordPath.download_hint')
      }
      accessibilityLabel={`${title}. ${subtitle}. ${status}`}
      accessibilityRole="button"
      accessibilityState={{busy, disabled}}
      disabled={disabled}
      onPress={() => onPress(row)}
      style={({pressed}) => [
        row.status === 'done' ? themedStyles.doneCard : null,
        pressed ? {opacity: theme.states.pressedOpacity} : null,
      ]}
      testID={`word-path-pack-${row.packId}`}
    >
      <AppCard>
        <View style={styles.stack}>
          <View style={styles.topRow}>
            <View style={themedStyles.thumb}>
              <LibraryCover
                badge={row.downloaded ? 'check' : null}
                compact
                glyph={topicGlyph(row.topicCode)}
                imageUrl={row.coverUrl}
                level={row.level}
                shape="pack"
                testID={`word-path-cover-${row.packId}`}
              />
            </View>
            <View style={styles.meta}>
              <AppText numberOfLines={1} variant="title">
                {title}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {subtitle}
              </AppText>
            </View>
            <View
              style={[themedStyles.pill, themedStyles[`pill_${row.status}`]]}
              testID={`word-path-status-${row.packId}`}
            >
              <AppText style={themedStyles.pillText} variant="caption">
                {status}
              </AppText>
            </View>
          </View>

          {preview.length > 0 ? (
            <View
              style={
                row.kind === 'sentence'
                  ? styles.previewColumn
                  : styles.previewRow
              }
              testID={`word-path-preview-${row.packId}`}
            >
              {preview.map((item, index) => (
                <View key={`${item.text}-${index}`} style={themedStyles.chip}>
                  <AppText numberOfLines={1} variant="caption">
                    {row.kind === 'sentence'
                      ? `${item.text} · ${item.meaning_vi}`
                      : item.text}
                  </AppText>
                </View>
              ))}
              {more > 0 ? (
                <View style={themedStyles.moreChip}>
                  <AppText color="secondary" variant="caption">
                    {t('wordPath.more', {count: more})}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.footRow}>
            <View style={themedStyles.track}>
              <View
                style={[
                  themedStyles.fill,
                  row.status === 'done' ? themedStyles.fillDone : null,
                  {width: `${ratio * 100}%`},
                ]}
              />
            </View>
            <AppText color="secondary" variant="caption">
              {t('wordPath.learned_of', {
                learned: row.learned,
                total: row.total,
              })}
            </AppText>
            <View
              style={[
                themedStyles.action,
                filled ? themedStyles.actionFilled : null,
              ]}
              testID={
                row.downloaded
                  ? `word-path-open-${row.packId}`
                  : `word-path-download-${row.packId}`
              }
            >
              <AppText
                style={
                  filled
                    ? themedStyles.actionFilledText
                    : themedStyles.actionText
                }
                variant="label"
              >
                {busy ? t('wordPath.downloading') : actionLabel(t, row.status)}
              </AppText>
            </View>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

type ContinueCardProps = {
  row: PackRow;
  busy: boolean;
  disabled: boolean;
  onPress: (row: PackRow) => void;
};

/** The pack to pick up first, set apart at the top of the list. */
function ContinueCard({row, busy, disabled, onPress}: ContinueCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const eyebrow =
    row.status === 'learning' ? t('wordPath.continue') : t('wordPath.next');
  const title = packTitle(t, row);
  const ratio = row.total > 0 ? Math.min(row.learned / row.total, 1) : 0;

  return (
    <Pressable
      accessibilityHint={
        row.downloaded ? t('wordPath.open_hint') : t('wordPath.download_hint')
      }
      accessibilityLabel={`${eyebrow}: ${title}`}
      accessibilityRole="button"
      accessibilityState={{busy, disabled}}
      disabled={disabled}
      onPress={() => onPress(row)}
      style={({pressed}) => [
        themedStyles.hero,
        pressed ? {opacity: theme.states.pressedOpacity} : null,
      ]}
      testID="word-path-next"
    >
      <AppText style={themedStyles.heroText} variant="label">
        {`${eyebrow} · ${row.level} · ${t('wordPath.pack_title', {
          position: row.position,
        })}`}
      </AppText>
      <AppText style={themedStyles.heroText} variant="h3">
        {title}
      </AppText>
      <View style={themedStyles.heroTrack}>
        <View style={[themedStyles.heroFill, {width: `${ratio * 100}%`}]} />
      </View>
      <View style={styles.heroRow}>
        <AppText style={themedStyles.heroText} variant="caption">
          {t('wordPath.remaining', {count: row.total - row.learned})}
        </AppText>
        <View style={themedStyles.heroAction}>
          <AppText style={themedStyles.heroActionText} variant="label">
            {busy ? t('wordPath.downloading') : actionLabel(t, row.status)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

type KindTabsProps = {
  kind: PackKind;
  counts: Record<PackKind, number>;
  onChange: (kind: PackKind) => void;
};

function KindTabs({kind, counts, onChange}: KindTabsProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const tabs: Array<{id: PackKind; title: string; sub: string}> = [
    {
      id: 'word',
      title: t('wordPath.tab_words'),
      sub: t('wordPath.tab_words_sub'),
    },
    {
      id: 'sentence',
      title: t('wordPath.tab_sentences'),
      sub: t('wordPath.tab_sentences_sub'),
    },
  ];
  return (
    <View accessibilityRole="tablist" style={themedStyles.tabs}>
      {tabs.map(tab => {
        const selected = tab.id === kind;
        return (
          <Pressable
            accessibilityHint={t('wordPath.tab_hint')}
            accessibilityLabel={`${tab.title} (${counts[tab.id]})`}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[themedStyles.tab, selected ? themedStyles.tabOn : null]}
            testID={`word-path-tab-${tab.id}`}
          >
            <AppText color={selected ? 'primary' : 'secondary'} variant="label">
              {`${tab.title} (${counts[tab.id]})`}
            </AppText>
            <AppText color="secondary" variant="caption">
              {tab.sub}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Vocab path P5: the packs to download and learn, as a list split into word
 * packs and sentence packs. The Library shows it inside its own screen;
 * `query` filters the packs by title, topic and first items.
 */
export function WordPathList({query = ''}: {query?: string}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {rows, offline, reload: load} = useWordPathRows();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<PackKind>('word');

  /** Opens a pack on the device; downloads it first when it is not. */
  const openPack = async (row: PackRow) => {
    if (row.downloaded) {
      appNavigation.openWordPack(row.packId);
      return;
    }
    setBusy(row.packId);
    setFailed(false);
    const result = await fetchWordPack(row.packId);
    if (result.ok) {
      saveWordPack(result.value, new Date());
      await load();
      appNavigation.openWordPack(row.packId);
    } else {
      setFailed(true);
    }
    setBusy(null);
  };

  if (rows === null) return null;

  const needle = query.trim().toLowerCase();
  const counts: Record<PackKind, number> = {
    word: rows.filter(row => row.kind === 'word').length,
    sentence: rows.filter(row => row.kind === 'sentence').length,
  };
  const ofKind = rows.filter(row => row.kind === kind);
  const shown = ofKind.filter(row => matchesQuery(row, needle));
  const continuePack = needle ? null : continuePackOf(ofKind);
  const levels = [...new Set(shown.map(row => row.level))];

  return (
    <ScrollView contentContainerStyle={themedStyles.container}>
      {offline ? (
        <AppText color="secondary" testID="word-path-offline">
          {t('wordPath.offline')}
        </AppText>
      ) : null}
      {rows.length === 0 ? (
        <AppCard testID="word-path-empty">
          <AppText color="secondary">{t('wordPath.empty')}</AppText>
        </AppCard>
      ) : (
        <>
          <KindTabs counts={counts} kind={kind} onChange={setKind} />
          {continuePack ? (
            <ContinueCard
              busy={busy === continuePack.packId}
              disabled={busy !== null}
              onPress={openPack}
              row={continuePack}
            />
          ) : null}
          {ofKind.length === 0 ? (
            <AppCard testID={`word-path-empty-${kind}`}>
              <AppText color="secondary">
                {kind === 'word'
                  ? t('wordPath.empty_words')
                  : t('wordPath.empty_sentences')}
              </AppText>
            </AppCard>
          ) : null}
          {ofKind.length > 0 && shown.length === 0 ? (
            <AppText color="secondary" testID="word-path-no-match">
              {t('wordPath.no_match')}
            </AppText>
          ) : null}
          {levels.map(level => {
            const inLevel = shown.filter(row => row.level === level);
            const done = inLevel.filter(row => row.status === 'done').length;
            return (
              <View
                key={level}
                style={styles.levelGroup}
                testID={`word-path-level-${level}`}
              >
                <View style={styles.levelHeader}>
                  <AppText variant="h3">
                    {`${level} · ${t(`wordPath.level_${level}`, {
                      defaultValue: '',
                    })}`}
                  </AppText>
                  <AppText color="secondary" variant="caption">
                    {t('wordPath.level_done', {done, total: inLevel.length})}
                  </AppText>
                </View>
                {inLevel.map(row => (
                  <PackCard
                    busy={busy === row.packId}
                    disabled={busy !== null}
                    key={row.packId}
                    onPress={openPack}
                    row={row}
                  />
                ))}
              </View>
            );
          })}
        </>
      )}
      <AppButton
        onPress={() => appNavigation.openComboHistory()}
        testID="word-path-combo-history"
        title={t('wordPath.combo_history')}
        variant="outline"
      />
      {failed ? (
        <AppText color="danger">{t('wordPath.download_failed')}</AppText>
      ) : null}
    </ScrollView>
  );
}

/**
 * Vocab path P5: the word path as its own screen (its list is also shown in the
 * Library).
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function WordPathScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('wordPath.title')}
      />
      <WordPathList />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    action: {
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    actionFilled: {
      backgroundColor: theme.colors.primary,
    },
    actionFilledText: {
      color: theme.colors.text.inverse,
    },
    actionText: {
      color: theme.colors.primary,
    },
    thumb: {
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      width: 56,
    },
    chip: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      maxWidth: '100%',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    doneCard: {
      opacity: 0.75,
    },
    fill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      height: '100%',
    },
    fillDone: {
      backgroundColor: theme.colors.tertiary,
    },
    hero: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    heroAction: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    heroActionText: {
      color: theme.colors.primary,
    },
    heroFill: {
      backgroundColor: theme.colors.text.inverse,
      borderRadius: theme.radius.pill,
      height: '100%',
    },
    heroText: {
      color: theme.colors.text.inverse,
    },
    heroTrack: {
      backgroundColor: theme.colors.overlayLight,
      borderRadius: theme.radius.pill,
      height: 6,
      overflow: 'hidden',
    },
    moreChip: {
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.sm,
      borderStyle: 'dashed',
      borderWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    pill: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    pillText: {
      color: theme.colors.text.primary,
    },
    pill_done: {
      backgroundColor: theme.colors.accentSoft,
    },
    pill_learning: {
      backgroundColor: theme.colors.tertiarySoft,
    },
    pill_not_downloaded: {
      backgroundColor: theme.colors.surfaceContainer,
    },
    pill_ready: {
      backgroundColor: theme.colors.accentSoft,
    },
    tab: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      flex: 1,
      paddingVertical: theme.spacing.sm,
    },
    tabOn: {
      backgroundColor: theme.colors.surface,
    },
    tabs: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      padding: theme.spacing.xs,
    },
    track: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      flex: 1,
      height: 6,
      overflow: 'hidden',
    },
  });
}

const styles = StyleSheet.create({
  footRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  levelGroup: {
    gap: 12,
  },
  levelHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  meta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  previewColumn: {
    gap: 6,
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stack: {
    gap: 12,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
});
