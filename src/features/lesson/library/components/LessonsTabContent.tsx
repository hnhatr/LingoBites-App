import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, SectionList, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  lessonCardDurationLabel,
  type LessonCardKind,
  lessonCardKind,
  type LessonCardProgress,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {type CoverGlyph} from '@ui/components/LibraryCover';
import {SectionHeader} from '@ui/components/SectionHeader';
import {cardToneAt, ToneCard} from '@ui/components/ToneCard';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import {useAppNavigation} from '@core/navigation';
import type {LessonCatalogItem, LessonSourceType} from '@core/schemas/lesson';

import {catalogCoverUrl, downloadedVideoCoverUrl} from '../logic/catalogCover';
import type {LibraryLessonCardView} from '../logic/lesson';
import {
  EMPTY_LESSON_CARD_STATE,
  lessonContextLabel,
  readLessonCardLocalState,
  useLessonBookmarks,
} from '../logic/lessonCardData';
import {LibraryEmptyState} from './LibraryEmptyState';
import {
  createdAction,
  createdProgressLabel,
  createdSourceLabel,
} from './tabs/CreatedTab';

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
  /** Title of the downloaded-lessons section; null hides the header. */
  packagedTitle?: string | null;
}

/** How many catalog lessons the "Tất cả bài học" section previews. */
export const CATALOG_PREVIEW_LIMIT = 5;

type LessonType = 'packaged' | 'catalog';

interface LessonItem {
  id: string;
  /** Raw title; the card splits "English · Tiếng Việt". */
  title: string;
  sourceType: LessonSourceType;
  type: LessonType;
  practiceReady: boolean;
  sentenceCount: number;
  estimatedMinutes: number | null;
  durationLabel: string | null;
  contextLabel: string | null;
  exerciseCount: number;
  /** A video's thumbnail; null for other lessons and unknown videos. */
  videoCoverUrl: string | null;
}

interface LessonSection {
  title: string;
  data: LessonItem[];
  type: LessonType;
}

const COVER_GLYPHS: Record<LessonCardKind, CoverGlyph> = {
  video: 'subtitles',
  image: 'chat',
  text: 'book',
};

const LESSON_HINTS: Record<LessonType, string> = {
  packaged: 'Bài học đã tải về. Chạm để học.',
  catalog: 'Bài học trong danh mục. Chạm để mở bài.',
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      gap: theme.spacing.md,
      padding: theme.gutter,
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
  packagedTitle = 'Đã tải về',
}: LessonsTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  const localState = useMemo(
    () =>
      (packagedLessons?.length ?? 0) + (catalogLessons?.length ?? 0) > 0
        ? readLessonCardLocalState()
        : EMPTY_LESSON_CARD_STATE,
    [packagedLessons, catalogLessons],
  );

  const sections = useMemo((): LessonSection[] => {
    const result: LessonSection[] = [];

    if (packagedLessons && packagedLessons.length > 0) {
      const packagedItems: LessonItem[] = packagedLessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        sourceType: lesson.sourceType,
        type: 'packaged' as const,
        practiceReady: lesson.practiceReady === true,
        sentenceCount: lesson.vocabularyCount,
        estimatedMinutes: null,
        durationLabel: lessonCardDurationLabel({
          youtubeDurationMs: lesson.youtubeDurationMs,
          estimatedMinutes: lesson.durationMin,
        }),
        contextLabel: lesson.contextLabel ?? null,
        exerciseCount: lesson.activityCount ?? 0,
        videoCoverUrl: downloadedVideoCoverUrl(localState, lesson.id),
      }));

      result.push({
        title: packagedTitle ?? '',
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
          sourceType: lesson.source_type,
          type: 'catalog' as const,
          practiceReady: false,
          sentenceCount: lesson.sentence_count,
          estimatedMinutes: lesson.estimated_minutes ?? null,
          durationLabel: lessonCardDurationLabel({
            estimatedMinutes: lesson.estimated_minutes,
            youtubeDurationMs: lesson.youtube_duration_ms,
            sentenceCount: lesson.sentence_count,
          }),
          contextLabel: lessonContextLabel(lesson.unit),
          exerciseCount: lesson.activity_count ?? 0,
          videoCoverUrl:
            lesson.source_type === 'youtube' ? catalogCoverUrl(lesson) : null,
        })),
        type: 'catalog',
      });
    }

    return result;
  }, [packagedLessons, catalogLessons, packagedTitle, localState]);

  const renderLessonItem = ({
    item,
    index,
  }: {
    item: LessonItem;
    index: number;
  }) => {
    const downloaded =
      item.type === 'packaged' || localState.downloadedIds.has(item.id);
    const progress: LessonCardProgress | undefined = localState.progress.get(
      item.id,
    );
    return (
      <ToneCard
        accessibilityHint={LESSON_HINTS[item.type]}
        action={createdAction(progress)}
        bookmark={{
          saved: isBookmarked(item.id),
          onToggle: () =>
            toggleBookmark({
              lessonId: item.id,
              title: item.title,
              sourceType: item.sourceType,
              sentenceCount: item.sentenceCount,
              estimatedMinutes: item.estimatedMinutes,
              contextLabel: item.contextLabel,
            }),
        }}
        cover={{
          imageUrl: item.videoCoverUrl,
          glyph: COVER_GLYPHS[lessonCardKind(item.sourceType)],
        }}
        description={[
          item.sentenceCount > 0 ? `${item.sentenceCount} câu` : null,
          item.durationLabel,
          // Every own lesson is on the phone; say it only for the catalog.
          item.type === 'catalog' && downloaded ? 'Đã tải' : null,
          createdProgressLabel(progress),
        ]
          .filter(Boolean)
          .join(' · ')}
        eyebrow={item.contextLabel ?? createdSourceLabel(item.sourceType)}
        footer={
          // Outside the card's open button, so it stays reachable.
          onPracticeLesson && item.practiceReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('library.practice_a11y', {
                title: item.title,
              })}
              accessibilityHint={t('practice.entry_hint')}
              onPress={() => onPracticeLesson(item.id)}
              style={styles.practice}
              testID={`lesson-practice-${item.id}`}
            >
              <AppText variant="label" color="primary">
                {t('practice.entry_button')}
              </AppText>
            </Pressable>
          ) : undefined
        }
        gutter={theme.gutter}
        onPress={() => navigation.openLesson(item.id)}
        testID={`lesson-item-${item.id}`}
        title={splitLessonTitle(item.title).title}
        tone={cardToneAt(index)}
        video={lessonCardKind(item.sourceType) === 'video'}
      />
    );
  };

  const renderSectionHeader = ({section}: {section: LessonSection}) =>
    section.title === '' ? null : (
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
