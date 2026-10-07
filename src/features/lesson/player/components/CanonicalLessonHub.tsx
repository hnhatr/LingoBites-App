import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {LessonExploreRow} from '@ui/components/LessonExploreRow';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SectionHeader} from '@ui/components/SectionHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {buildPracticeSource, getPracticeEligibility} from '@core/learning';
import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {
  collectLessonGrammar,
  collectLessonVocabulary,
  sortedSentences,
} from '../logic/lessonHubContent';
import {LessonStatusBanners} from './LessonStatusBanners';

export type LessonHubSection = 'sentences' | 'vocabulary' | 'grammar';

const PREVIEW_COUNT = 2;

type ContentMode = 'original' | 'translation' | 'both';

const CONTENT_MODES: {mode: ContentMode; labelKey: string}[] = [
  {mode: 'original', labelKey: 'lessonPlayer.original_title'},
  {mode: 'translation', labelKey: 'lessonPlayer.translation_title'},
  {mode: 'both', labelKey: 'lessonPlayer.bilingual_title'},
];

export type CanonicalLessonHubProps = {
  snapshot: LessonSnapshot;
  /** Stored plus late analyses (display-only merge). */
  analyses: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  onOpenSection: (section: LessonHubSection) => void;
  /**
   * Opens the quick-practice quiz. Omit to hide the row (practice flag off);
   * the row also stays hidden while the lesson is too small for a quiz.
   */
  onOpenPractice?: () => void;
};

/**
 * Lesson overview: title header, one expandable original/translation card,
 * and "Khám phá bài học" rows into the study sections.
 * Everything shown is derived from the canonical snapshot; no lesson data is
 * fetched or stored here.
 */
export function CanonicalLessonHub({
  snapshot,
  analyses,
  offline,
  hasUpdate,
  onOpenSection,
  onOpenPractice,
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
  const canPractice = useMemo(
    () =>
      onOpenPractice !== undefined &&
      getPracticeEligibility(buildPracticeSource(snapshot, analyses)).eligible,
    [onOpenPractice, snapshot, analyses],
  );
  const [contentMode, setContentMode] = useState<ContentMode>('original');
  const [expanded, setExpanded] = useState(false);
  const hasMore = sentences.length > PREVIEW_COUNT;
  const visible = expanded ? sentences : sentences.slice(0, PREVIEW_COUNT);

  return (
    <View testID="canonical-lesson-hub" style={styles.container}>
      <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />

      <View style={styles.header}>
        <AppText testID="canonical-hub-title" variant="h2" numberOfLines={3}>
          {snapshot.title}
        </AppText>
        <View style={styles.chips}>
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
        {snapshot.description.trim().length > 0 ? (
          <AppText color="secondary" variant="body">
            {snapshot.description}
          </AppText>
        ) : null}
      </View>

      <AppCard style={themedStyles.contentCard}>
        <View style={styles.cardBody}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcon
              color={theme.colors.primary}
              name="description"
              size={22}
            />
            <View style={styles.modes}>
              {CONTENT_MODES.map(({mode, labelKey}) => (
                <Chip
                  key={mode}
                  accessibilityHint={t('lessonPlayer.content_toggle_hint')}
                  label={t(labelKey)}
                  onPress={() => setContentMode(mode)}
                  selected={contentMode === mode}
                  testID={`canonical-hub-mode-${mode}`}
                />
              ))}
            </View>
          </View>
          {visible.map(sentence => (
            <View key={sentence.id} style={styles.sentence}>
              {contentMode !== 'translation' ? (
                <AppText color="secondary" variant="bodyLg">
                  {sentence.text_en}
                </AppText>
              ) : null}
              {contentMode !== 'original' ? (
                <AppText
                  color={contentMode === 'both' ? 'muted' : 'secondary'}
                  variant={contentMode === 'both' ? 'body' : 'bodyLg'}
                >
                  {sentence.text_vi}
                </AppText>
              ) : null}
            </View>
          ))}
          {hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('lessonPlayer.content_toggle_hint')}
              testID="canonical-hub-expand"
              onPress={() => setExpanded(value => !value)}
              style={styles.expand}
            >
              <AppText style={themedStyles.expandLabel} variant="label">
                {expanded
                  ? `${t('lessonPlayer.content_show_less')} ↑`
                  : `${t('lessonPlayer.content_show_more')} ↓`}
              </AppText>
            </Pressable>
          ) : null}
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
        {canPractice ? (
          <LessonExploreRow
            icon="bolt"
            medallionTone="teal"
            onPress={onOpenPractice!}
            subtitle={t('practice.entry_hint')}
            testID="canonical-hub-practice"
            title={t('practice.entry_button')}
          />
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    contentCard: {
      borderBottomColor: theme.colors.accentSoft,
      borderBottomWidth: 4,
    },
    expandLabel: {
      color: theme.colors.primary,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expand: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  header: {
    gap: 8,
  },
  modes: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sentence: {
    gap: 2,
  },
});
