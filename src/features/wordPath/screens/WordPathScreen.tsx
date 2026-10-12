import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
  type DownloadedPack,
  learnedCount,
  listDownloadedPacks,
  saveWordPack,
} from '../logic/wordPackRepository';
import {
  fetchWordPack,
  fetchWordPath,
  type WordPath,
} from '../logic/wordPathClient';

type Props = {navigation?: {goBack?: () => void}};

type PackRow = {
  packId: string;
  title: string;
  level: string;
  total: number;
  learned: number;
  downloaded: boolean;
};

/** The server's path when it can be reached; otherwise what is on the device, by level. */
function rowsFrom(
  path: WordPath | null,
  downloaded: DownloadedPack[],
): PackRow[] {
  const onDevice = new Map(downloaded.map(pack => [pack.packId, pack]));
  if (path) {
    return path.levels.flatMap(level =>
      level.topics.flatMap(topic =>
        topic.packs.map(pack => {
          const local = onDevice.get(pack.id);
          return {
            packId: pack.id,
            title: pack.title_vi,
            level: level.cefr_level,
            total: pack.item_count,
            learned: local ? learnedCount(local.itemCodes) : 0,
            downloaded: Boolean(local),
          };
        }),
      ),
    );
  }
  return downloaded.map(pack => ({
    packId: pack.packId,
    title: pack.titleVi,
    level: pack.cefrLevel,
    total: pack.itemCodes.length,
    learned: learnedCount(pack.itemCodes),
    downloaded: true,
  }));
}

/**
 * Vocab path P5: the word path. Levels, topics and packs; a pack is downloaded
 * once and then learned offline. The first pack not yet learned is suggested.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function WordPathScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [offline, setOffline] = useState(false);
  const [rows, setRows] = useState<PackRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const downloaded = listDownloadedPacks();
    const result = await fetchWordPath();
    if (result.ok) {
      setOffline(false);
      setRows(rowsFrom(result.value, downloaded));
    } else {
      setOffline(true);
      setRows(rowsFrom(null, downloaded));
    }
  }, []);

  useEffect(() => {
    load().catch(() => setOffline(true));
  }, [load]);

  const download = async (packId: string) => {
    setBusy(packId);
    setFailed(false);
    const result = await fetchWordPack(packId);
    if (result.ok) {
      saveWordPack(result.value, new Date());
      await load();
    } else {
      setFailed(true);
    }
    setBusy(null);
  };

  if (rows === null) {
    return (
      <AppScreen>
        <ScreenHeader
          onBack={() => navigation?.goBack?.()}
          title={t('wordPath.title')}
        />
      </AppScreen>
    );
  }

  const nextPack = rows.find(row => row.learned < row.total);

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('wordPath.title')}
      />
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
        ) : null}
        {rows.map(row => (
          <AppCard key={row.packId} testID={`word-path-pack-${row.packId}`}>
            <AppText variant="h3">{row.title}</AppText>
            <AppText color="secondary" variant="label">
              {t('wordPath.progress', {
                level: row.level,
                learned: row.learned,
                total: row.total,
              })}
            </AppText>
            {nextPack?.packId === row.packId ? (
              <AppText color="secondary" testID="word-path-next">
                {t('wordPath.next')}
              </AppText>
            ) : null}
            {row.downloaded ? (
              <AppButton
                onPress={() => appNavigation.openWordPack(row.packId)}
                testID={`word-path-open-${row.packId}`}
                title={t('wordPath.open')}
                variant="secondary"
              />
            ) : (
              <AppButton
                disabled={busy !== null}
                onPress={() => download(row.packId)}
                testID={`word-path-download-${row.packId}`}
                title={t('wordPath.download')}
                variant="outline"
              />
            )}
          </AppCard>
        ))}
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
