import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {AddToReviewButton} from '../components/AddToReviewButton';
import {frameSlots, frameText} from '../logic/frameText';
import {functionLabels} from '../logic/libraryModel';
import {readPatternLibrary} from '../logic/libraryRepository';
import type {PatternDetailRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: PatternDetailRouteParams};
  /** Tests pass the item; the screen reads the device otherwise. */
  item?: CatalogItem | null;
  /** Tests pass the labels (level, functions); read from the kept library otherwise. */
  labels?: string[];
};

function readItem(code: string): CatalogItem | null {
  try {
    return readCatalogItems([code]).get(code) ?? null;
  } catch {
    return null;
  }
}

function readLabels(code: string): string[] {
  try {
    const library = readPatternLibrary();
    const pattern = library?.patterns.find(entry => entry.item.code === code);
    if (!library || !pattern) return [];
    return [
      pattern.cefrLevel,
      ...functionLabels(pattern, library.functions),
    ].filter((label): label is string => Boolean(label));
  } catch {
    return [];
  }
}

/**
 * Vocab path P6 (F2): one pattern of the library: its frame and meaning, what
 * each slot takes, examples, "Luyện câu tổ hợp" (a combo set for it) and
 * "Thêm vào ôn". Read from the device, so it opens offline.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PatternDetailScreen({navigation, route, item, labels}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const code = route?.params.itemCode ?? '';
  const pattern = item === undefined ? readItem(code) : item;
  const tags = labels ?? readLabels(code);

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('patternTense.pattern_title')}
      />
      {pattern ? (
        <ScrollView
          contentContainerStyle={styles.content}
          testID="pattern-detail"
        >
          <View style={styles.block}>
            <AppText variant="h2">{frameText(pattern)}</AppText>
            <AppText color="secondary" variant="bodyLg">
              {pattern.meaning_vi}
            </AppText>
            {tags.length > 0 ? (
              <AppText color="muted" variant="caption">
                {tags.join(' · ')}
              </AppText>
            ) : null}
            {pattern.note_vi ? <AppText>{pattern.note_vi}</AppText> : null}
          </View>

          {frameSlots(pattern).length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.slots')}</AppText>
              {frameSlots(pattern).map(slot => (
                <AppText key={slot.name}>
                  {slot.labelVi}
                  {slot.values.length > 0 ? `: ${slot.values.join(', ')}` : ''}
                </AppText>
              ))}
            </AppCard>
          ) : null}

          {pattern.examples.length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.examples')}</AppText>
              {pattern.examples.map((example, index) => (
                <View key={index} style={styles.example}>
                  <AppText>{example.text_en}</AppText>
                  <AppText color="secondary">{example.text_vi}</AppText>
                </View>
              ))}
            </AppCard>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              iconLeft="play_arrow"
              onPress={() => appNavigation.openComboSetup(pattern.code)}
              testID="pattern-practise"
              title={t('patternTense.practise_combo')}
            />
            <AddToReviewButton itemCode={pattern.code} />
          </View>
        </ScrollView>
      ) : (
        <AppText color="secondary" style={styles.missing}>
          {t('patternTense.not_on_device')}
        </AppText>
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      gap: theme.spacing.sm,
    },
    block: {
      gap: theme.spacing.xs,
    },
    card: {
      gap: theme.spacing.xs,
    },
    content: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },
    example: {
      gap: 2,
      marginTop: theme.spacing.xs,
    },
    missing: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      textAlign: 'center',
    },
  });
}
