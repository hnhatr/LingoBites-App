import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {AddToReviewButton} from '../components/AddToReviewButton';
import {memoryLevel, tenseInfo} from '../logic/libraryModel';
import {memoryOf} from '../logic/libraryRepository';
import type {TenseDetailRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: TenseDetailRouteParams};
  /** Tests pass the tense and the tenses it is confused with; read from the device otherwise. */
  item?: CatalogItem | null;
  related?: CatalogItem[];
};

function readItems(codes: string[]): Map<string, CatalogItem> {
  try {
    return readCatalogItems(codes);
  } catch {
    return new Map();
  }
}

/**
 * Vocab path P6 (F3): one tense of the map: its forms (affirmative, negative,
 * question), signal words, uses, the tenses it is confused with, examples and
 * "Thêm vào ôn". Read from the device, so it opens offline.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function TenseDetailScreen({navigation, route, item, related}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const code = route?.params.itemCode ?? '';
  const tense =
    item === undefined ? (readItems([code]).get(code) ?? null) : item;
  const info = tense ? tenseInfo(tense.payload) : null;
  const confused =
    related ??
    (info ? [...readItems(info.contrastWith).values()] : ([] as CatalogItem[]));

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('patternTense.tense_title')}
      />
      {tense && info ? (
        <ScrollView
          contentContainerStyle={styles.content}
          testID="tense-detail"
        >
          <View style={styles.block}>
            <AppText variant="h2">{tense.text}</AppText>
            <AppText color="secondary" variant="bodyLg">
              {tense.meaning_vi}
            </AppText>
            <AppText color="muted" variant="caption">
              {t(`patternTense.level_${memoryLevel(memoryOf(tense.code))}`)}
            </AppText>
          </View>

          {info.forms ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.forms')}</AppText>
              <AppText>
                {t('patternTense.form_affirmative')}: {info.forms.affirmative}
              </AppText>
              <AppText>
                {t('patternTense.form_negative')}: {info.forms.negative}
              </AppText>
              <AppText>
                {t('patternTense.form_question')}: {info.forms.question}
              </AppText>
            </AppCard>
          ) : null}

          {info.signals.length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.signals')}</AppText>
              <AppText>{info.signals.join(', ')}</AppText>
            </AppCard>
          ) : null}

          {info.usesVi.length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.uses')}</AppText>
              {info.usesVi.map((use, index) => (
                <AppText key={index}>• {use}</AppText>
              ))}
            </AppCard>
          ) : null}

          {confused.length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">
                {t('patternTense.confused_with')}
              </AppText>
              {confused.map(other => (
                <Pressable
                  accessibilityRole="button"
                  key={other.code}
                  onPress={() => appNavigation.openTenseDetail(other.code)}
                  testID={`tense-related-${other.code}`}
                >
                  <AppText style={styles.link}>{other.text}</AppText>
                </Pressable>
              ))}
            </AppCard>
          ) : null}

          {tense.examples.length > 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="label">{t('patternTense.examples')}</AppText>
              {tense.examples.map((example, index) => (
                <View key={index} style={styles.example}>
                  <AppText>{example.text_en}</AppText>
                  <AppText color="secondary">{example.text_vi}</AppText>
                </View>
              ))}
            </AppCard>
          ) : null}

          <AddToReviewButton itemCode={tense.code} />
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
    link: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    missing: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      textAlign: 'center',
    },
  });
}
