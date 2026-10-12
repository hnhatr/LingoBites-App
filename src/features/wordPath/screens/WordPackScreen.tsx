import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {findDownloadedPack} from '../logic/wordPackRepository';
import type {WordPackRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: WordPackRouteParams};
  /** Tests pass the items; the screen reads the device otherwise. */
  items?: CatalogItem[];
};

/**
 * Vocab path P5: one pack, its words, and the two ways in: learn it, or check
 * which words the learner already knows.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function WordPackScreen({navigation, route, items: given}: Props) {
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

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={pack?.titleVi ?? t('wordPack.title')}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {!pack && !given ? (
          <AppCard testID="word-pack-missing">
            <AppText color="secondary">{t('wordPack.not_downloaded')}</AppText>
          </AppCard>
        ) : null}
        {items.map(item => (
          <AppCard key={item.code} testID={`word-pack-item-${item.code}`}>
            <AppText variant="h3">{item.text}</AppText>
            <AppText color="secondary">{item.meaning_vi}</AppText>
          </AppCard>
        ))}
        {items.length > 0 ? (
          <>
            <AppButton
              onPress={() => appNavigation.openPackLearn(packId)}
              testID="word-pack-learn"
              title={t('wordPack.learn')}
              variant="secondary"
            />
            <AppButton
              onPress={() => appNavigation.openQuickKnownCheck(packId)}
              testID="word-pack-check"
              title={t('wordPack.check')}
              variant="outline"
            />
          </>
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
