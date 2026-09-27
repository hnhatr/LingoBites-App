import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {AppButton} from '@components/AppButton';
import {AppCard} from '@components/AppCard';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {IconButton} from '@components/IconButton';
import {ScreenHeader} from '@components/ScreenHeader';
import {Medallion} from '@components/Medallion';
import {useAppTheme} from '@theme';
import {bootstrapContentPackage} from '../bootstrap';
import {useContentLibrary} from './useContentLibrary';
import type {ContentLessonListItem} from './useContentLibrary';
import {useFloatingTabBarClearance} from '@components/layout';

export type ContentLessonListScreenProps = {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
  };
};

type Props = ContentLessonListScreenProps;

export function ContentLessonListScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const [lessons, setLessons] = useState<ContentLessonListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {listActivePackageLessons} = useContentLibrary();
  const floatingClearance = useFloatingTabBarClearance();

  const loadLessons = useCallback(async () => {
    let items = listActivePackageLessons();
    if (items.length === 0) {
      setLoading(true);
      setError(null);
      try {
        const res = await bootstrapContentPackage();
        items = listActivePackageLessons();
        if (!res.ok && items.length === 0) {
          setError(res.error.message || 'Không thể chuẩn bị nội dung bài học.');
        }
      } catch (e) {
        items = listActivePackageLessons();
        if (items.length === 0) {
          setError((e as Error).message || 'Gói bài học chưa thể chuẩn bị.');
        }
      } finally {
        setLoading(false);
      }
    }
    setLessons(items);
  }, [listActivePackageLessons]);

  useFocusEffect(
    useCallback(() => {
      loadLessons();
    }, [loadLessons]),
  );

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <IconButton
            accessibilityLabel="Phòng luyện nói"
            icon="mic"
            onPress={() => navigation.navigate('SpeakingRoom')}
            tone="ghost"
          />
        }
        title="Bài học đóng gói"
      />
      <FlatList
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.gutter,
          paddingBottom: floatingClearance,
        }}
        data={lessons}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          loading ? (
            <View
              style={{
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: 32,
              }}
            >
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <AppText color="secondary">Đang nạp gói bài học…</AppText>
            </View>
          ) : error ? (
            <View
              style={{
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: 32,
              }}
            >
              <Medallion label="⚠️" />
              <AppText color="danger" style={styles.textCenter} variant="h3">
                Không thể chuẩn bị nội dung bài học
              </AppText>
              <AppText color="secondary" style={styles.textCenter}>
                {error}
              </AppText>
              <AppButton
                accessibilityLabel="Thử lại"
                onPress={loadLessons}
                title="Thử lại"
              />
            </View>
          ) : (
            <View
              style={{
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: 32,
              }}
            >
              <Medallion label="📦" />
              <AppText color="secondary" style={styles.textCenter}>
                Chưa có bài học nào được nhập vào máy.
              </AppText>
            </View>
          )
        }
        renderItem={({item}) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ContentLessonDetail', {lessonId: item.id})
            }
            testID={`content-lesson-${item.id}`}
          >
            <AppCard style={{gap: theme.spacing.xs}}>
              <AppText variant="h3">{item.titleVi}</AppText>
              <AppText color="secondary">{item.blurbVi}</AppText>
              <AppText color="muted" variant="label">
                {`${item.level} · ${item.estimatedDurationMinutes} phút`}
              </AppText>
            </AppCard>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  textCenter: {
    textAlign: 'center',
  },
});
