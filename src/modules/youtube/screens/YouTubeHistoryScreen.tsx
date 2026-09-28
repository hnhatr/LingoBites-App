import React, {useCallback, useContext, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@modules/input';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {useTranslation} from 'react-i18next';
import {deleteYouTubeLesson, listYouTubeLessons} from '../youtubeQueryPort';
import type {YouTubeTranscript} from '../youtubeTranscriptPort';

type Props = NativeStackScreenProps<RootStackParamList, 'YouTubeHistory'>;

export type YouTubeHistoryScreenProps = Props;

function HistorySeparator() {
  const {theme} = useAppTheme();
  return <View style={{height: theme.spacing.sm}} />;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    list: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    row: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    rowIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: theme.radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    emptyWrap: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      padding: theme.gutter,
    },
    errorWrap: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      padding: theme.gutter,
    },
  });
}

export function YouTubeHistoryScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  // SETE-289: History renders on the RootStack above the tabs, so there is
  // no floating tab bar to clear — only the bottom safe-area inset keeps
  // the last row clear of the home indicator. Read via context (not the
  // throwing hook) so Jest renders fall back to a zero inset.
  const insets = useContext(SafeAreaInsetsContext);
  const bottomClearance = (insets?.bottom ?? 0) + theme.spacing.md;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [lessons, setLessons] = useState<YouTubeTranscript[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // SETE-289: History is a RootStack route, so Back always pops to the tab
  // that opened it (Home or Create) — no fromHome branch, no reset.
  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const refresh = useCallback(() => {
    try {
      setLessons(listYouTubeLessons());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const openLesson = useCallback(
    (lessonId: string) => {
      navigation.navigate('YouTubeLesson', {lessonId});
    },
    [navigation],
  );

  // SETE-283 (HVB-11): entry to a fresh lesson. Input always starts with
  // an empty URL and existing rows are never touched.
  // SETE-289: Input lives in the Create tab, so this leaves the History
  // route and enters Tabs > Create > YouTubeInput.
  // SETE-310: pass `fromHome: true` (same contract as the Home empty-store
  // branch) so the entry is not a trap: header Back exits to Home with a
  // stack reset, Android system Back is intercepted, and the TabBar resets
  // to CreateMain on re-entry instead of resurfacing this screen with no
  // way back to the composer.
  const createNew = useCallback(() => {
    navigation.navigate('Tabs', {
      screen: 'Create',
      params: {screen: 'YouTubeInput', params: {fromHome: true}},
    });
  }, [navigation]);

  const confirmDelete = useCallback(
    (lesson: YouTubeTranscript) => {
      Alert.alert(
        t('youtube.history_delete_title'),
        t('youtube.history_delete_body', {title: lesson.video.title}),
        [
          {text: t('youtube.history_delete_cancel'), style: 'cancel'},
          {
            text: t('youtube.history_delete_confirm'),
            style: 'destructive',
            onPress: () => {
              setDeleteError(null);
              const removed = deleteYouTubeLesson(lesson.video.id);
              if (!removed) {
                setDeleteError(t('youtube.history_delete_failed'));
                return;
              }
              refresh();
            },
          },
        ],
        {cancelable: true},
      );
    },
    [refresh, t],
  );

  if (loadError) {
    return (
      <AppScreen>
        <ScreenHeader onBack={goBack} title={t('youtube.history_title')} />
        <View style={styles.errorWrap}>
          <AppText color="danger" testID="youtube-history-error">
            {t('youtube.history_load_failed')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            testID="youtube-history-retry"
          >
            <AppText color="primary">{t('youtube.history_retry')}</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  // SETE-290: the empty state keeps a creation CTA so deleting the last
  // lesson never strands the user without a way forward.
  if (lessons.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader onBack={goBack} title={t('youtube.history_title')} />
        <View style={styles.emptyWrap} testID="youtube-history-empty">
          <AppText variant="h2">{t('youtube.history_empty_title')}</AppText>
          <AppText color="secondary">{t('youtube.history_empty_body')}</AppText>
          <AppButton
            accessibilityLabel={t('youtube.history_create_new_a11y')}
            accessibilityHint={t('youtube.history_create_new_hint')}
            iconLeft="play_circle"
            onPress={createNew}
            testID="youtube-history-empty-create-new"
            title={t('youtube.history_create_new')}
            variant="secondary"
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader onBack={goBack} title={t('youtube.history_title')} />
      <View style={{paddingHorizontal: theme.gutter}}>
        <AppButton
          accessibilityLabel={t('youtube.history_create_new_a11y')}
          accessibilityHint={t('youtube.history_create_new_hint')}
          iconLeft="play_circle"
          onPress={createNew}
          testID="youtube-history-create-new"
          title={t('youtube.history_create_new')}
          variant="secondary"
        />
      </View>
      {deleteError ? (
        <View style={{paddingHorizontal: theme.gutter}}>
          <AppText color="danger" testID="youtube-history-delete-error">
            {deleteError}
          </AppText>
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={[styles.list, {paddingBottom: bottomClearance}]}
        data={lessons}
        ItemSeparatorComponent={HistorySeparator}
        keyExtractor={item => item.video.id}
        renderItem={({item}) => (
          <Pressable
            accessibilityHint={t('youtube.history_open_hint')}
            accessibilityLabel={t('youtube.history_open_a11y', {
              title: item.video.title,
            })}
            accessibilityRole="button"
            onPress={() => openLesson(item.video.id)}
            style={styles.row}
            testID={`youtube-history-item-${item.video.id}`}
          >
            <View style={styles.rowIcon}>
              <MaterialIcon
                color={theme.colors.onPrimaryContainer}
                name="play_circle"
                size={24}
              />
            </View>
            <View style={styles.rowCopy}>
              <AppText numberOfLines={2} variant="h3">
                {item.video.title}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="label">
                {t('youtube.history_meta', {
                  channel: item.video.channel_title,
                  count: item.segments.length,
                })}
              </AppText>
            </View>
            <IconButton
              accessibilityHint={t('youtube.history_delete_hint')}
              accessibilityLabel={t('youtube.history_delete_a11y', {
                title: item.video.title,
              })}
              icon="delete"
              onPress={() => confirmDelete(item)}
              testID={`youtube-history-delete-${item.video.id}`}
              tone="surface"
            />
          </Pressable>
        )}
        testID="youtube-history-list"
      />
    </AppScreen>
  );
}
