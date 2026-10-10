import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  View,
} from 'react-native';

import {ComposeRequestCards} from '@features/lesson/player';

import {AppScreen} from '@ui/components/AppScreen';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';

import {GrammarTabContent} from '../components/GrammarTabContent';
import {LessonsTabContent} from '../components/LessonsTabContent';
import {MomentLibraryList} from '../components/MomentLibraryList';
import {PublicLessonsList} from '../components/PublicLessonsList';
import {SearchAndFilterBar} from '../components/SearchAndFilterBar';
import {VocabularyTabContent} from '../components/VocabularyTabContent';
import {
  getLibrarySection,
  isOwnLessonSection,
  lessonBelongsToSection,
} from '../logic/librarySections';
import {
  useLibrarySegments,
  useRefreshOnRefocus,
} from '../logic/useLibrarySegments';
import type {LibraryFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LibraryFlowParamList, 'LibraryList'>;

export type LibraryListScreenProps = Props;

/** One Library section: a search field above that section's list. */
export function LibraryListScreen({navigation, route}: Props) {
  const section = getLibrarySection(route.params.section);
  const appNavigation = useAppNavigation();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const [searchQuery, setSearchQuery] = useState('');
  // Load local data only once the push animation has finished, so tapping a
  // card transitions immediately instead of freezing on the data read.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  const {
    packagedLessons,
    vocabulary,
    grammar,
    setLessonsFilter,
    setVocabularyFilter,
    setGrammarFilter,
    refresh,
  } = useLibrarySegments({
    lessons: ready && isOwnLessonSection(section),
    vocabulary: ready && section.id === 'vocabulary',
    grammar: ready && section.id === 'grammar',
  });

  useRefreshOnRefocus(refresh);

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
      <ScreenHeader title={section.title} onBack={() => navigation.goBack()} />
      <SearchAndFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
      <View style={styles.content} testID={`library-list-${section.id}`}>
        {section.moments ? (
          <MomentLibraryList emptyHint={section.emptyHint} />
        ) : section.catalog ? (
          <PublicLessonsList
            origin={section.catalog.origin}
            sourceType={section.catalog.sourceType}
            kind={section.catalog.kind}
            searchQuery={searchQuery}
          />
        ) : !ready ? (
          <ActivityIndicator style={styles.loading} />
        ) : isOwnLessonSection(section) ? (
          <>
            {/* S4.3: six-step lessons still being made. */}
            <View style={styles.cards}>
              <ComposeRequestCards />
            </View>
            <LessonsTabContent
              packagedLessons={lessons}
              packagedTitle={null}
              isFiltered={isFiltered}
              onPracticeLesson={
                practiceEnabled ? appNavigation.openPractice : undefined
              }
            />
          </>
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
  cards: {
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  loading: {
    marginTop: 32,
  },
});
