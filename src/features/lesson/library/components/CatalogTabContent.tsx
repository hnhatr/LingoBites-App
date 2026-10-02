import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect} from 'react';

import {
  CanonicalCatalogList,
  openLesson,
  useCanonicalCatalog,
} from '@features/lesson/player';

import {useFloatingTabBarClearance} from '@ui/components/layout';

import type {LessonsStackParamList} from '../screens/navigationTypes';

/**
 * Library "Tất cả bài" segment: the server canonical catalog, loaded when
 * the segment is shown. Rows open the lesson in the Lessons stack.
 */
export function CatalogTabContent() {
  const feedClearance = useFloatingTabBarClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<LessonsStackParamList>>();
  const {state, refresh, loadMore} = useCanonicalCatalog();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CanonicalCatalogList
      state={state}
      onRefresh={refresh}
      onLoadMore={loadMore}
      onOpenLesson={lessonId => openLesson(navigation, lessonId)}
      contentPaddingBottom={feedClearance}
    />
  );
}
