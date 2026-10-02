import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';

import type {LessonsStackParamList} from '@features/lesson/library';

import {AppScreen} from '@ui/components/AppScreen';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';

import {CanonicalCatalogList} from '../components/CanonicalCatalogList';
import {openLesson} from '../logic/lessonNavigation';
import {useCanonicalCatalog} from '../logic/useCanonicalCatalog';

type Props = NativeStackScreenProps<LessonsStackParamList, 'CanonicalCatalog'>;

/**
 * Canonical catalog: every visible lesson (admin and learner sources) in one
 * list; each row opens the same player. Old library routes stay callable
 * until TASK-008 removes them.
 */
export function CanonicalLessonCatalogScreen({navigation}: Props) {
  const floatingClearance = useFloatingTabBarClearance();
  const {state, refresh, loadMore} = useCanonicalCatalog();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <AppScreen>
      <ScreenHeader title="Lessons" onBack={() => navigation.goBack()} />
      <CanonicalCatalogList
        state={state}
        onRefresh={refresh}
        onLoadMore={loadMore}
        onOpenLesson={lessonId => openLesson(navigation, lessonId)}
        contentPaddingBottom={floatingClearance}
      />
    </AppScreen>
  );
}
