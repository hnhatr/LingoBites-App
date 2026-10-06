import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, SectionList, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {SectionHeader} from '@ui/components/SectionHeader';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import {useAppNavigation} from '@core/navigation';
import type {LessonCatalogItem, LessonSourceType} from '@core/schemas/lesson';

import {
  LIBRARY_SOURCE_FILTER_OPTIONS,
  type LibraryLessonCardView,
} from '../logic/lesson';
import {LibraryEmptyState} from './LibraryEmptyState';

export interface LessonsTabContentProps {
  packagedLessons: LibraryLessonCardView[];
  /** First page of the canonical catalog, shown as a capped preview. */
  catalogLessons?: LessonCatalogItem[];
  onViewAllCatalog?: () => void;
  /** A search/source filter is active, so an empty list means no matches. */
  isFiltered?: boolean;
  /**
   * Starts quick practice for a downloaded lesson. Omit to hide the action
   * (practice flag off); it only shows on lessons big enough for a quiz.
   */
  onPracticeLesson?: (lessonId: string) => void;
}

/** How many catalog lessons the "Tất cả bài học" section previews. */
export const CATALOG_PREVIEW_LIMIT = 5;

type LessonType = 'packaged' | 'catalog';

interface LessonItem {
  id: string;
  title: string;
  summary: string | null;
  /** "12 câu · ~6 phút · Tải 2026-10-06": what the lesson contains. */
  meta: string;
  sourceType: LessonSourceType;
  type: LessonType;
  practiceReady: boolean;
}

interface LessonSection {
  title: string;
  data: LessonItem[];
  type: LessonType;
}

const LESSON_HINTS: Record<LessonType, string> = {
  packaged: 'Bài học đã tải về. Chạm để học.',
  catalog: 'Bài học trong danh mục. Chạm để mở bài.',
};

const SOURCE_LABELS = Object.fromEntries(
  LIBRARY_SOURCE_FILTER_OPTIONS.map(option => [option.key, option.label]),
) as Record<string, string>;

function buildMeta(parts: (string | null)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    pressable: {
      flex: 1,
    },
    cardContent: {
      gap: theme.spacing.xs,
    },
    badgeRow: {
      alignItems: 'flex-start',
    },
    lessonTitle: {
      marginBottom: theme.spacing.xs,
    },
    viewAll: {
      paddingVertical: theme.spacing.xs,
    },
    practice: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.xs,
    },
    sectionHeader: {
      paddingHorizontal: 0,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      zIndex: 1,
    },
  });
}

export function LessonsTabContent({
  packagedLessons,
  catalogLessons,
  onViewAllCatalog,
  isFiltered = false,
  onPracticeLesson,
}: LessonsTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sections = useMemo((): LessonSection[] => {
    const result: LessonSection[] = [];

    if (packagedLessons && packagedLessons.length > 0) {
      const packagedItems: LessonItem[] = packagedLessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.blurb || null,
        meta: buildMeta([
          lesson.vocabularyCount > 0 ? `${lesson.vocabularyCount} câu` : null,
          lesson.durationMin > 0 ? `~${lesson.durationMin} phút` : null,
          lesson.dateLabel ? `Tải ${lesson.dateLabel}` : null,
        ]),
        sourceType: lesson.sourceType,
        type: 'packaged' as const,
        practiceReady: lesson.practiceReady === true,
      }));

      result.push({
        title: 'Đã tải về',
        data: packagedItems,
        type: 'packaged',
      });
    }

    if (catalogLessons && catalogLessons.length > 0) {
      result.push({
        title: 'Tất cả bài học',
        data: catalogLessons.slice(0, CATALOG_PREVIEW_LIMIT).map(lesson => ({
          id: lesson.id,
          title: lesson.title,
          summary: lesson.description || null,
          meta: buildMeta([`${lesson.sentence_count} câu`]),
          sourceType: lesson.source_type,
          type: 'catalog' as const,
          practiceReady: false,
        })),
        type: 'catalog',
      });
    }

    return result;
  }, [packagedLessons, catalogLessons]);

  const handleLessonPress = (item: LessonItem) => {
    navigation.openLesson(item.id);
  };

  const renderLessonItem = ({item}: {item: LessonItem}) => (
    <View style={styles.pressable}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityHint={LESSON_HINTS[item.type]}
        onPress={() => handleLessonPress(item)}
        testID={`lesson-item-${item.id}`}
        style={styles.pressable}
      >
        <AppCard>
          <View style={styles.cardContent}>
            <View style={styles.badgeRow}>
              <Chip
                label={SOURCE_LABELS[item.sourceType] ?? item.sourceType}
                tone="accentSoft"
              />
            </View>
            <AppText
              variant="h3"
              style={styles.lessonTitle}
              testID={`lesson-title-${item.id}`}
            >
              {item.title}
            </AppText>
            {item.summary && (
              <AppText
                variant="label"
                color="secondary"
                numberOfLines={2}
                ellipsizeMode="tail"
                testID={`lesson-summary-${item.id}`}
              >
                {item.summary}
              </AppText>
            )}
            {item.meta ? (
              <AppText
                variant="caption"
                color="muted"
                testID={`lesson-meta-${item.id}`}
              >
                {item.meta}
              </AppText>
            ) : null}
          </View>
        </AppCard>
      </Pressable>
      {/* A sibling of the card button (not nested) so it stays reachable. */}
      {onPracticeLesson && item.practiceReady ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('library.practice_a11y', {title: item.title})}
          accessibilityHint={t('practice.entry_hint')}
          onPress={() => onPracticeLesson(item.id)}
          style={styles.practice}
          testID={`lesson-practice-${item.id}`}
        >
          <AppText variant="label" color="primary">
            {t('practice.entry_button')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  const renderSectionHeader = ({section}: {section: LessonSection}) => (
    <View style={styles.sectionHeader}>
      <SectionHeader
        title={section.title}
        action={
          section.type === 'catalog' && onViewAllCatalog ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem tất cả bài học"
              accessibilityHint="Mở danh mục đầy đủ"
              onPress={onViewAllCatalog}
              style={styles.viewAll}
              testID="library-catalog-view-all"
            >
              <AppText variant="label" color="primary">
                Xem tất cả
              </AppText>
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );

  if (sections.length === 0) {
    return <LibraryEmptyState type={isFiltered ? 'no-results' : 'lessons'} />;
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderLessonItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: feedClearance},
        ]}
        testID="lessons-section-list"
      />
    </View>
  );
}
