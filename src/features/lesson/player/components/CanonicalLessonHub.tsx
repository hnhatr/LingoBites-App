import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {LessonExploreRow} from '@ui/components/LessonExploreRow';
import {SectionHeader} from '@ui/components/SectionHeader';
import {SvgIcon} from '@ui/components/SvgIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {buildPracticeSource, getPracticeEligibility} from '@core/learning';
import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {
  collectLessonOutcome,
  type LessonHubSection,
  type LessonHubSectionRow,
  lessonHubSections,
  sortedSentences,
} from '../logic/lessonHubContent';
import {LessonOutcomeCard} from './LessonOutcomeCard';
import {LessonStatusBanners} from './LessonStatusBanners';
import {SourcePhotoCard} from './SourcePhotoCard';

export type {LessonHubSection};

type ExploreRowCopy = {
  icon: HandoffIconName;
  tone: 'teal' | 'coral' | 'gold';
  titleKey: string;
  subtitleKey: string;
  /** Shown instead of the subtitle when the section is empty. */
  emptyKey?: string;
};

const EXPLORE_ROWS: Record<LessonHubSection, ExploreRowCopy> = {
  sentences: {
    icon: 'menu_book',
    tone: 'teal',
    titleKey: 'lessonPlayer.explore_sentences_title',
    subtitleKey: 'lessonPlayer.explore_sentences_subtitle',
  },
  vocabulary: {
    icon: 'style',
    tone: 'coral',
    titleKey: 'lessonPlayer.explore_vocabulary_title',
    subtitleKey: 'lessonPlayer.explore_vocabulary_subtitle',
    emptyKey: 'lessonPlayer.explore_vocabulary_empty',
  },
  grammar: {
    icon: 'rule',
    tone: 'gold',
    titleKey: 'lessonPlayer.explore_grammar_title',
    subtitleKey: 'lessonPlayer.explore_grammar_subtitle',
    emptyKey: 'lessonPlayer.explore_grammar_empty',
  },
  patterns: {
    icon: 'rule',
    tone: 'gold',
    titleKey: 'lessonPlayer.explore_patterns_title',
    subtitleKey: 'lessonPlayer.explore_patterns_subtitle',
  },
  pronunciation: {
    icon: 'record_voice_over',
    tone: 'teal',
    titleKey: 'lessonPlayer.explore_pronunciation_title',
    subtitleKey: 'lessonPlayer.explore_pronunciation_subtitle',
  },
  listening: {
    icon: 'hearing',
    tone: 'coral',
    titleKey: 'lessonPlayer.explore_listening_title',
    subtitleKey: 'lessonPlayer.explore_listening_subtitle',
  },
};

/** Catalog lessons call their vocabulary "Từ & cụm". */
const CATALOG_VOCABULARY_ROW: ExploreRowCopy = {
  ...EXPLORE_ROWS.vocabulary,
  titleKey: 'lessonPlayer.explore_items_vocabulary_title',
  subtitleKey: 'lessonPlayer.explore_items_vocabulary_subtitle',
};

/** Section title for the player header (same wording as the hub row). */
export function lessonSectionTitleKey(
  section: LessonHubSection,
  catalogLesson: boolean,
): string {
  return section === 'vocabulary' && catalogLesson
    ? CATALOG_VOCABULARY_ROW.titleKey
    : EXPLORE_ROWS[section].titleKey;
}

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
  /** Opens another lesson (a prerequisite on the outcome card). */
  onOpenLesson?: (lessonId: string) => void;
  /**
   * Opens the quick-practice quiz. Omit to hide the row (practice flag off);
   * the row also stays hidden while the lesson is too small for a quiz.
   */
  onOpenPractice?: () => void;
  /** S4.3: opens "Học theo 6 bước" sentence picking. Omit to hide the row. */
  onOpenCompose?: () => void;
  /** E5: the learner's own lesson can be deleted (server and this device). */
  onDeleteLesson?: () => void;
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
  onOpenLesson,
  onOpenPractice,
  onOpenCompose,
  onDeleteLesson,
}: CanonicalLessonHubProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const sentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const outcome = useMemo(() => collectLessonOutcome(snapshot), [snapshot]);
  const sectionRows = useMemo(
    () => lessonHubSections(snapshot, analyses),
    [snapshot, analyses],
  );
  const catalogLesson = (snapshot.lesson_items ?? []).length > 0;
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
      <SourcePhotoCard lessonId={snapshot.id} offline={offline ?? false} />

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
          {snapshot.generated ? (
            <Chip
              label={t('compose.chip_generated')}
              testID="canonical-hub-generated"
              tone="gold"
            />
          ) : null}
          {snapshot.situation_source === 'inferred' ? (
            <Chip
              label={t('compose.chip_inferred')}
              testID="canonical-hub-inferred"
              tone="coralSoft"
            />
          ) : null}
          {outcome && outcome.audience !== 'all' ? (
            <Chip
              label={t(`lessonPlayer.audience_${outcome.audience}`)}
              testID="canonical-hub-audience"
              tone="coralSoft"
            />
          ) : null}
        </View>
        {snapshot.generated &&
        snapshot.derived_from_lesson_id &&
        onOpenLesson ? (
          <Pressable
            accessibilityHint={t('compose.source_link_hint')}
            accessibilityRole="link"
            onPress={() => onOpenLesson(snapshot.derived_from_lesson_id!)}
            testID="canonical-hub-source-lesson"
          >
            <AppText style={themedStyles.expandLabel} variant="label">
              {`${t('compose.source_link')} →`}
            </AppText>
          </Pressable>
        ) : null}
        {snapshot.description.trim().length > 0 ? (
          <AppText color="secondary" variant="body">
            {snapshot.description}
          </AppText>
        ) : null}
      </View>

      {outcome ? (
        <LessonOutcomeCard onOpenLesson={onOpenLesson} outcome={outcome} />
      ) : null}

      <AppCard style={themedStyles.contentCard}>
        <View style={styles.cardBody}>
          <View style={styles.sectionTitleRow}>
            <SvgIcon
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
        {sectionRows.map(row => (
          <ExploreRow
            key={row.section}
            catalogLesson={catalogLesson}
            onOpenSection={onOpenSection}
            row={row}
          />
        ))}
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
        {onOpenCompose ? (
          <LessonExploreRow
            icon="auto_awesome"
            medallionTone="gold"
            onPress={onOpenCompose}
            subtitle={t('compose.entry_subtitle')}
            testID="canonical-hub-compose"
            title={t('compose.entry_title')}
          />
        ) : null}
        {onDeleteLesson ? (
          <Pressable
            accessibilityLabel={t('moment.delete_lesson')}
            accessibilityRole="button"
            disabled={offline}
            onPress={onDeleteLesson}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
            testID="canonical-hub-delete"
          >
            <AppText
              style={{color: theme.colors.text.muted, fontWeight: '600'}}
            >
              {t('moment.delete_lesson')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ExploreRow({
  row,
  catalogLesson,
  onOpenSection,
}: {
  row: LessonHubSectionRow;
  catalogLesson: boolean;
  onOpenSection: (section: LessonHubSection) => void;
}) {
  const {t} = useTranslation();
  const copy =
    row.section === 'vocabulary' && catalogLesson
      ? CATALOG_VOCABULARY_ROW
      : EXPLORE_ROWS[row.section];
  return (
    <LessonExploreRow
      disabled={row.section === 'sentences' && row.count === 0}
      icon={copy.icon}
      medallionTone={copy.tone}
      onPress={() => onOpenSection(row.section)}
      subtitle={
        row.count === 0 && copy.emptyKey
          ? t(copy.emptyKey)
          : t(copy.subtitleKey, {count: row.count})
      }
      testID={`canonical-hub-explore-${row.section}`}
      title={t(copy.titleKey)}
    />
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
