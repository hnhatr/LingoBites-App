import React, {useMemo} from 'react';
import {Pressable, SectionList, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {SectionHeader} from '@ui/components/SectionHeader';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

import {useAppNavigation} from '@core/navigation';
import type {LessonCatalogItem} from '@core/schemas/lesson';

import {LibraryEmptyState} from './LibraryEmptyState';

export interface LessonsTabContentProps {
  packagedLessons: any[];
  /** First page of the canonical catalog, shown as a capped preview. */
  catalogLessons?: LessonCatalogItem[];
  onViewAllCatalog?: () => void;
  /** A search/source filter is active, so an empty list means no matches. */
  isFiltered?: boolean;
}

/** How many catalog lessons the "Tất cả bài học" section previews. */
export const CATALOG_PREVIEW_LIMIT = 5;

type LessonType = 'packaged' | 'catalog';

interface LessonItem {
  id: string;
  title: string;
  summary: string | null;
  type: LessonType;
}

interface LessonSection {
  title: string;
  data: LessonItem[];
  type: LessonType;
}

const LESSON_HINTS: Record<LessonType, string> = {
  packaged: 'Bài học theo lộ trình. Chạm để xem chi tiết.',
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
    pressable: {
      flex: 1,
    },
    cardContent: {
      gap: theme.spacing.xs,
    },
    lessonTitle: {
      marginBottom: theme.spacing.xs,
    },
    viewAll: {
      paddingVertical: theme.spacing.xs,
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
}: LessonsTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation = useAppNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sections = useMemo((): LessonSection[] => {
    const result: LessonSection[] = [];

    if (packagedLessons && packagedLessons.length > 0) {
      const packagedItems: LessonItem[] = packagedLessons.map(lesson => ({
        id: lesson.id,
        title: lesson.titleVi || lesson.title,
        summary: lesson.blurbVi || lesson.summary || null,
        type: 'packaged' as const,
      }));

      result.push({
        title: 'Bài học theo lộ trình',
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
          summary: lesson.description || `${lesson.sentence_count} câu`,
          type: 'catalog' as const,
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
        </View>
      </AppCard>
    </Pressable>
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
