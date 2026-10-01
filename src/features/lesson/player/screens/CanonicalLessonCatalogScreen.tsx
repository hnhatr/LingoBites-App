import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type {LessonsStackParamList} from '@features/lesson/library';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useCanonicalCatalog} from '../logic/useCanonicalCatalog';

type Props = NativeStackScreenProps<LessonsStackParamList, 'CanonicalCatalog'>;

function catalogStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    list: {gap: theme.spacing.sm, padding: theme.spacing.lg},
  });
}

/**
 * Canonical catalog: every visible lesson (admin and learner sources) in one
 * list; each row opens the same player. Old library routes stay callable
 * until TASK-008 removes them.
 */
export function CanonicalLessonCatalogScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const styles = catalogStyles(theme);
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
      {state.status === 'loading' || state.status === 'idle' ? (
        <ActivityIndicator testID="canonical-catalog-loading" />
      ) : state.status === 'error' ? (
        <View>
          <AppText testID="canonical-catalog-error">
            {state.error.message}
          </AppText>
          <Pressable
            accessibilityRole="button"
            testID="canonical-catalog-retry"
            onPress={refresh}
          >
            <AppText>Retry</AppText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="canonical-catalog-list"
          data={state.lessons}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <Pressable
              accessibilityRole="button"
              testID={`canonical-catalog-row-${item.id}`}
              onPress={() =>
                navigation.navigate('CanonicalLessonPlayer', {
                  lessonId: item.id,
                })
              }
            >
              <View style={styles.row}>
                <AppText testID={`canonical-catalog-title-${item.id}`}>
                  {item.title}
                </AppText>
                <AppText>
                  {`${item.origin} · ${item.source_type} · ${item.sentence_count} sentences`}
                </AppText>
              </View>
            </Pressable>
          )}
          onEndReached={state.nextCursor ? loadMore : undefined}
          contentContainerStyle={[
            styles.list,
            {paddingBottom: floatingClearance},
          ]}
        />
      )}
    </AppScreen>
  );
}
