import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';

import {GrammarTabContent} from '../components/GrammarTabContent';
import {LessonsTabContent} from '../components/LessonsTabContent';
import {PublicLessonsList} from '../components/PublicLessonsList';
import {SearchAndFilterBar} from '../components/SearchAndFilterBar';
import {VocabularyTabContent} from '../components/VocabularyTabContent';
import {
  getLibrarySection,
  isOwnLessonSection,
  lessonBelongsToSection,
} from '../logic/librarySections';
import {useLibrarySegments} from '../logic/useLibrarySegments';
import type {LessonsStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LibraryList'>;

export type LibraryListScreenProps = Props;

/** One Library section: a search field above that section's list. */
export function LibraryListScreen({navigation, route}: Props) {
  const section = getLibrarySection(route.params.section);
  const appNavigation = useAppNavigation();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    packagedLessons,
    vocabulary,
    grammar,
    setLessonsFilter,
    setVocabularyFilter,
    setGrammarFilter,
    refresh,
  } = useLibrarySegments();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      const filter = {searchQuery: query, sourceFilter: 'all' as const};
      if (section.catalog) {
        // Public lessons are searched client-side over the loaded catalog.
        return;
      }
      if (isOwnLessonSection(section)) {
        setLessonsFilter(filter);
      } else if (section.id === 'vocabulary') {
        setVocabularyFilter(filter);
      } else {
        setGrammarFilter(filter);
      }
    },
    [section, setLessonsFilter, setVocabularyFilter, setGrammarFilter],
  );

  const lessons = useMemo(
    () =>
      packagedLessons.filter(lesson => lessonBelongsToSection(section, lesson)),
    [packagedLessons, section],
  );
  const isFiltered = searchQuery.trim() !== '';

  return (
    <AppScreen>
      <ScreenHeader
        title={section.title}
        onBack={() => navigation.goBack()}
        numberOfLines={1}
      />
      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
      <View style={styles.content} testID={`library-list-${section.id}`}>
        {section.catalog ? (
          <PublicLessonsList
            origin={section.catalog.origin}
            sourceType={section.catalog.sourceType}
            searchQuery={searchQuery}
          />
        ) : isOwnLessonSection(section) ? (
          <LessonsTabContent
            packagedLessons={lessons}
            packagedTitle={null}
            isFiltered={isFiltered}
            onPracticeLesson={
              practiceEnabled ? appNavigation.openPractice : undefined
            }
          />
        ) : section.id === 'vocabulary' ? (
          <VocabularyTabContent
            vocabulary={vocabulary}
            isFiltered={isFiltered}
          />
        ) : (
          <GrammarTabContent grammar={grammar} isFiltered={isFiltered} />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
