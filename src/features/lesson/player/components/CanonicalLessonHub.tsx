import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {ImagePlaceholder} from '@ui/components/ImagePlaceholder';
import {LessonExploreRow} from '@ui/components/LessonExploreRow';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SectionHeader} from '@ui/components/SectionHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {
  collectLessonGrammar,
  collectLessonVocabulary,
  sortedSentences,
} from '../logic/lessonHubContent';
import {LessonStatusBanners} from './LessonStatusBanners';

export type LessonHubSection = 'sentences' | 'vocabulary' | 'grammar';

const PREVIEW_COUNT = 3;

export type CanonicalLessonHubProps = {
  snapshot: LessonSnapshot;
  /** Stored plus late analyses (display-only merge). */
  analyses: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  onOpenSection: (section: LessonHubSection) => void;
};

/**
 * Lesson overview in the pre-cutover Lesson Hub layout: hero, original and
 * translation cards, and "Khám phá bài học" rows into the study sections.
 * Everything shown is derived from the canonical snapshot; no lesson data is
 * fetched or stored here.
 */
export function CanonicalLessonHub({
  snapshot,
  analyses,
  offline,
  hasUpdate,
  onOpenSection,
}: CanonicalLessonHubProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const sentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const vocabularyCount = useMemo(
    () => collectLessonVocabulary(snapshot, analyses).length,
    [snapshot, analyses],
  );
  const grammarCount = useMemo(
    () => collectLessonGrammar(snapshot, analyses).length,
    [snapshot, analyses],
  );
  const preview = sentences.slice(0, PREVIEW_COUNT);
  const hasMore = sentences.length > PREVIEW_COUNT;

  return (
    <View testID="canonical-lesson-hub" style={styles.container}>
      <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />

      <View style={themedStyles.heroImage}>
        <ImagePlaceholder height={170} label={snapshot.title} />
        <View style={themedStyles.heroOverlay}>
          <AppText
            testID="canonical-hub-title"
            style={themedStyles.heroTitle}
            numberOfLines={2}
          >
            {snapshot.title}
          </AppText>
          <View style={styles.heroChips}>
            {snapshot.unit ? (
              <Chip label={snapshot.unit.level_title} tone="gold" />
            ) : null}
            <Chip
              label={t('lessonPlayer.hero_sentences', {
                count: sentences.length,
              })}
              tone="accent"
            />
            {snapshot.origin === 'learner' ? (
              <Chip label={t('lessonPlayer.hero_mine')} tone="accentSoft" />
            ) : null}
          </View>
        </View>
      </View>

      {snapshot.description.trim().length > 0 ? (
        <AppText color="secondary" variant="body">
          {snapshot.description}
        </AppText>
      ) : null}

      <AppCard style={themedStyles.originalCard}>
        <View style={styles.cardBody}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcon
              color={theme.colors.primary}
              name="description"
              size={22}
            />
            <AppText style={themedStyles.originalTitle} variant="h3">
              {t('lessonPlayer.original_title')}
            </AppText>
          </View>
          {preview.map(sentence => (
            <AppText key={sentence.id} color="secondary" variant="bodyLg">
              {sentence.text_en}
            </AppText>
          ))}
          {hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('lessonPlayer.see_all_sentences_hint')}
              testID="canonical-hub-see-all"
              onPress={() => onOpenSection('sentences')}
            >
              <AppText style={themedStyles.seeAll} variant="label">
                {t('lessonPlayer.see_all_sentences', {
                  count: sentences.length,
                })}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </AppCard>

      <AppCard style={themedStyles.translationCard}>
        <View style={styles.cardBody}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcon
              color={theme.colors.secondary}
              name="translate"
              size={22}
            />
            <AppText style={themedStyles.translationTitle} variant="h3">
              {t('lessonPlayer.translation_title')}
            </AppText>
          </View>
          {preview.map(sentence => (
            <AppText key={sentence.id} color="secondary" variant="bodyLg">
              {sentence.text_vi}
            </AppText>
          ))}
        </View>
      </AppCard>

      <View style={styles.exploreSection}>
        <SectionHeader title={t('lessonPlayer.explore_title')} />
        <LessonExploreRow
          disabled={sentences.length === 0}
          icon="menu_book"
          medallionTone="teal"
          onPress={() => onOpenSection('sentences')}
          subtitle={t('lessonPlayer.explore_sentences_subtitle', {
            count: sentences.length,
          })}
          title={t('lessonPlayer.explore_sentences_title')}
        />
        <LessonExploreRow
          icon="style"
          medallionTone="coral"
          onPress={() => onOpenSection('vocabulary')}
          subtitle={
            vocabularyCount > 0
              ? t('lessonPlayer.explore_vocabulary_subtitle', {
                  count: vocabularyCount,
                })
              : t('lessonPlayer.explore_vocabulary_empty')
          }
          title={t('lessonPlayer.explore_vocabulary_title')}
        />
        <LessonExploreRow
          icon="rule"
          medallionTone="gold"
          onPress={() => onOpenSection('grammar')}
          subtitle={
            grammarCount > 0
              ? t('lessonPlayer.explore_grammar_subtitle', {
                  count: grammarCount,
                })
              : t('lessonPlayer.explore_grammar_empty')
          }
          title={t('lessonPlayer.explore_grammar_title')}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    heroImage: {
      borderRadius: theme.radius.lg,
      height: 170,
      overflow: 'hidden',
      position: 'relative',
    },
    heroOverlay: {
      backgroundColor: theme.colors.overlay,
      bottom: 0,
      left: 0,
      padding: theme.spacing.lg,
      position: 'absolute',
      right: 0,
    },
    heroTitle: {
      color: theme.colors.onOverlay,
      fontSize: theme.typography.presets.h2.fontSize,
      fontWeight: theme.typography.weight.medium,
    },
    originalCard: {
      borderBottomColor: theme.colors.accentSoft,
      borderBottomWidth: 4,
    },
    originalTitle: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.medium,
    },
    seeAll: {
      color: theme.colors.primary,
    },
    translationCard: {
      borderBottomColor: theme.colors.secondarySoft,
      borderBottomWidth: 4,
    },
    translationTitle: {
      color: theme.colors.secondary,
      fontWeight: theme.typography.weight.medium,
    },
  });
}

const styles = StyleSheet.create({
  cardBody: {
    gap: 8,
  },
  container: {
    gap: 16,
  },
  exploreSection: {
    gap: 10,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
