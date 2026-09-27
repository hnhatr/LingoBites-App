import React, {useCallback, useState} from 'react';
import {View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {LessonsStackParamList} from '@modules/lesson';
import {AppButton} from '@components/AppButton';
import {AppCard} from '@components/AppCard';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {ScreenHeader} from '@components/ScreenHeader';
import {useAppTheme} from '@theme';
import {useContentLibrary} from './useContentLibrary';
import type {ContentLessonRow} from './useContentLibrary';
type Props = NativeStackScreenProps<
  LessonsStackParamList,
  'ContentLessonDetail'
>;

export type ContentLessonDetailScreenProps = Props;

export function ContentLessonDetailScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const [lesson, setLesson] = useState<ContentLessonRow | null>(null);
  const {getContentLessonById} = useContentLibrary();

  useFocusEffect(
    useCallback(() => {
      setLesson(getContentLessonById(route.params.lessonId));
    }, [getContentLessonById, route.params.lessonId]),
  );

  if (!lesson) {
    return (
      <AppScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title="Bài học" />
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            padding: theme.spacing.xl,
          }}
        >
          <AppText color="danger">Không tìm thấy bài học.</AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={lesson.titleVi} />
      <View style={{flex: 1, gap: theme.spacing.lg, padding: theme.gutter}}>
        <AppCard style={{gap: theme.spacing.sm}}>
          <AppText variant="h2">{lesson.titleEn}</AppText>
          <AppText color="secondary">{lesson.blurbVi}</AppText>
          <AppText color="muted" variant="label">
            {`${lesson.level} · ${lesson.estimatedDurationMinutes} phút`}
          </AppText>
        </AppCard>
        <AppButton
          onPress={() =>
            navigation.navigate('ContentLessonRuntime', {lessonId: lesson.id})
          }
          title="Bắt đầu học"
        />
      </View>
    </AppScreen>
  );
}
