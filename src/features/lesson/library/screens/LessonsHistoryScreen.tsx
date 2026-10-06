import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {CourseListContent} from '@features/course';
import {useCanonicalCatalog} from '@features/lesson/player';
import {useFlashcardLibrary} from '@features/review';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';

import {GrammarTabContent} from '../components/GrammarTabContent';
import {LessonsTabContent} from '../components/LessonsTabContent';
import {SearchAndFilterBar} from '../components/SearchAndFilterBar';
import {
  type LibraryTabId,
  SegmentedTabBar,
} from '../components/SegmentedTabBar';
import {VocabularyTabContent} from '../components/VocabularyTabContent';
import {
  isSegmentFilterActive,
  matchesSegmentFilter,
  useLibrarySegments,
} from '../logic/useLibrarySegments';
import type {LessonsStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

export function LessonsHistoryScreen(_props: Props) {
  const navigation = useAppNavigation();
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const {getDueFlashcards} = useFlashcardLibrary();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const [dueCount, setDueCount] = useState(0);

  const [activeTab, setActiveTab] = useState<LibraryTabId>('lessons');

  const {
    packagedLessons,
    vocabulary,
    grammar,
    lessonsFilter,
    vocabularyFilter,
    grammarFilter,
    setLessonsFilter,
    setVocabularyFilter,
    setGrammarFilter,
    refresh,
  } = useLibrarySegments();
  const {state: catalogState, refresh: refreshCatalog} = useCanonicalCatalog();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshCatalog();
      setDueCount(getDueFlashcards().length);
    }, [refresh, refreshCatalog, getDueFlashcards]),
  );

  const catalogLessons = useMemo(
    () =>
      catalogState.status === 'ready'
        ? catalogState.lessons.filter(lesson =>
            matchesSegmentFilter(lessonsFilter, {
              texts: [lesson.title, lesson.description],
              sourceType: lesson.source_type,
            }),
          )
        : [],
    [catalogState, lessonsFilter],
  );

  const currentFilter =
    activeTab === 'lessons'
      ? lessonsFilter
      : activeTab === 'vocabulary'
      ? vocabularyFilter
      : grammarFilter;

  const setCurrentFilter =
    activeTab === 'lessons'
      ? setLessonsFilter
      : activeTab === 'vocabulary'
      ? setVocabularyFilter
      : setGrammarFilter;

  const isFiltered = isSegmentFilterActive(currentFilter);

  return (
    <AppScreen>
      <View style={themedStyles.header}>
        <AppText variant="h2" style={themedStyles.title}>
          {t('library.title')}
        </AppText>
        <Pressable
          accessibilityLabel={t('library.speaking_a11y')}
          accessibilityRole="button"
          onPress={() => navigation.openSpeakingRoom()}
          style={({pressed}) => [
            themedStyles.speakingButton,
            pressed && themedStyles.pressed,
          ]}
          testID="library-practice-speaking"
        >
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="mic"
            size={22}
          />
        </Pressable>
      </View>

      {dueCount > 0 ? (
        <View style={themedStyles.practiceRow} testID="library-practice-row">
          <Pressable
            accessibilityLabel={`${t('library.review_banner_cta')}. ${t(
              'library.review_banner_due',
              {count: dueCount},
            )}`}
            accessibilityRole="button"
            onPress={() => navigation.openReview()}
            style={({pressed}) => [
              themedStyles.reviewBanner,
              pressed && themedStyles.pressed,
            ]}
            testID="library-practice-review"
          >
            <MaterialIcon
              color={theme.colors.primary}
              name="refresh"
              size={20}
            />
            <AppText
              variant="label"
              style={themedStyles.reviewText}
              numberOfLines={1}
            >
              {t('library.review_banner_due', {count: dueCount})}
            </AppText>
            <AppText variant="label" style={themedStyles.reviewCta}>
              {t('library.review_banner_cta')}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      <SegmentedTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab !== 'courses' && (
        <SearchAndFilterBar
          searchQuery={currentFilter.searchQuery}
          sourceFilter={currentFilter.sourceFilter}
          onSearchChange={query =>
            setCurrentFilter({...currentFilter, searchQuery: query})
          }
          onFilterChange={filter =>
            setCurrentFilter({...currentFilter, sourceFilter: filter})
          }
        />
      )}

      {activeTab === 'lessons' && (
        <View style={themedStyles.tabContent} testID="lessons-tab-content">
          <LessonsTabContent
            packagedLessons={packagedLessons}
            catalogLessons={catalogLessons}
            onViewAllCatalog={navigation.openCatalog}
            isFiltered={isFiltered}
            onPracticeLesson={
              practiceEnabled ? navigation.openPractice : undefined
            }
          />
        </View>
      )}
      {activeTab === 'courses' && (
        <View style={themedStyles.tabContent} testID="courses-tab-content">
          <CourseListContent />
        </View>
      )}
      {activeTab === 'vocabulary' && (
        <View style={themedStyles.tabContent} testID="vocabulary-tab-content">
          <VocabularyTabContent
            vocabulary={vocabulary}
            isFiltered={isFiltered}
          />
        </View>
      )}
      {activeTab === 'grammar' && (
        <View style={themedStyles.tabContent} testID="grammar-tab-content">
          <GrammarTabContent grammar={grammar} isFiltered={isFiltered} />
        </View>
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.md,
    },
    title: {
      color: theme.colors.text.primary,
    },
    speakingButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    practiceRow: {
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
    },
    reviewBanner: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
    },
    reviewText: {color: theme.colors.text.primary, flex: 1},
    reviewCta: {color: theme.colors.primary},
    pressed: {opacity: theme.states.pressedOpacity},
    tabContent: {
      flex: 1,
    },
  });
}
