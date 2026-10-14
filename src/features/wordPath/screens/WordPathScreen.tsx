import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {topicGlyph} from '@ui/components/LibraryCover';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type CardAction, cardToneAt, ToneCard} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
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

const ACTION_GLYPH: Record<PackStatus, CardAction['glyph']> = {
  not_downloaded: 'download',
  ready: 'play',
  learning: 'play',
  done: 'check',
};

/** "Chưa tải", "Đã tải", "4/12 đã nhớ" or "Hoàn thành" under a pack. */
function statusLabel(t: Translate, row: PackRow): string {
  return row.status === 'learning'
    ? t('wordPath.learned_of', {learned: row.learned, total: row.total})
    : t(`wordPath.status_${row.status}`);
}

type PackCardProps = {
  row: PackRow;
  index: number;
  busy: boolean;
  disabled: boolean;
  onPress: (row: PackRow) => void;
};

/** A pack drawn like the Library's pack cards. */
function PackCard({row, index, busy, disabled, onPress}: PackCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  return (
    <ToneCard
      accessibilityHint={
        row.downloaded ? t('wordPath.open_hint') : t('wordPath.download_hint')
      }
      action={{
        label: busy ? t('wordPath.downloading') : actionLabel(t, row.status),
        glyph: ACTION_GLYPH[row.status],
        solid: row.downloaded,
      }}
      cover={{imageUrl: row.coverUrl, glyph: topicGlyph(row.topicCode)}}
      description={[
        kindSummary(t, row.kindCounts),
        row.level,
        statusLabel(t, row),
      ]
        .filter(Boolean)
        .join(' · ')}
      disabled={disabled}
      eyebrow={
        row.topic ? t('wordPath.pack_title', {position: row.position}) : null
      }
      gutter={theme.spacing.md}
      onPress={() => onPress(row)}
      testID={`word-path-pack-${row.packId}`}
      title={packTitle(t, row)}
      tone={cardToneAt(index)}
    />
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
                {inLevel.map((row, index) => (
                  <PackCard
                    busy={busy === row.packId}
                    disabled={busy !== null}
                    index={index}
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
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
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
  });
}

const styles = StyleSheet.create({
  levelGroup: {
    gap: 12,
  },
  levelHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
});
