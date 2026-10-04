import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {hasDownloadedLessons} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {
  listShadowingLessonProgressSummaries,
  type ShadowingLessonProgressSummary,
} from '../logic/shadowing/shadowingProgress';

export type ShadowingLessonPickerScreenProps = {
  navigation: {
    goBack: () => void;
    navigate: (
      screen: 'ShadowingSession',
      params: {lessonId: string; sentenceIndex: number},
    ) => void;
  };
};

function statusTone(
  status: ShadowingLessonProgressSummary['statusChip'],
): 'default' | 'gold' | 'primary' {
  if (status === 'Xong') {
    return 'primary';
  }
  if (status === 'Đang dở') {
    return 'gold';
  }
  return 'default';
}

export function ShadowingLessonPickerScreen({
  navigation,
}: ShadowingLessonPickerScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const [lessons, setLessons] = React.useState<
    ShadowingLessonProgressSummary[]
  >(() => listShadowingLessonProgressSummaries());
  const [showDownloadHint, setShowDownloadHint] = React.useState(
    () => !hasDownloadedLessons(),
  );

  useFocusEffect(
    React.useCallback(() => {
      setLessons(listShadowingLessonProgressSummaries());
      setShowDownloadHint(!hasDownloadedLessons());
    }, []),
  );

  function openLesson(summary: ShadowingLessonProgressSummary) {
    navigation.navigate('ShadowingSession', {
      lessonId: summary.lessonId,
      sentenceIndex: summary.resumeSentenceIndex,
    });
  }

  return (
    <AppScreen testID="shadowing-lesson-picker">
      <ScreenHeader
        title="Chọn bài để luyện"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: floatingClearance,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        <AppText color="secondary" variant="body">
          Chọn một bài đã tải để luyện shadowing theo từng câu.
        </AppText>
        {showDownloadHint ? (
          <AppCard testID="shadowing-picker-empty-downloads">
            <AppText variant="h3">Chưa có bài học trên máy</AppText>
            <AppText color="secondary" variant="body">
              Tải một bài trong thư viện để bắt đầu luyện shadowing.
            </AppText>
          </AppCard>
        ) : null}
        {lessons.map(lesson => (
          <Pressable
            key={lesson.lessonId}
            accessibilityRole="button"
            onPress={() => openLesson(lesson)}
            testID={`shadowing-lesson-${lesson.lessonId}`}
          >
            <AppCard style={{gap: theme.spacing.sm}}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <AppText variant="h3">{lesson.titleVi}</AppText>
                <Chip
                  label={lesson.statusChip}
                  tone={statusTone(lesson.statusChip)}
                />
              </View>
              <AppText color="secondary" variant="body">
                {lesson.sentenceCount} câu · ~{lesson.estimatedMinutes} phút
              </AppText>
              {lesson.statusChip === 'Đang dở' ? (
                <AppText
                  testID={`shadowing-lesson-progress-${lesson.lessonId}`}
                  variant="body"
                >
                  Đã luyện {lesson.practicedSentenceCount}/
                  {lesson.sentenceCount} câu
                </AppText>
              ) : null}
              {lesson.reviewSentenceCount > 0 ? (
                <AppText
                  color="secondary"
                  testID={`shadowing-lesson-review-${lesson.lessonId}`}
                  variant="caption"
                >
                  {lesson.reviewSentenceCount} câu cần ôn
                </AppText>
              ) : null}
              <View style={styles.chevronRow}>
                <MaterialIcon
                  color={theme.colors.text.secondary}
                  name="chevron_right"
                  size={22}
                />
              </View>
            </AppCard>
          </Pressable>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chevronRow: {
    alignItems: 'flex-end',
  },
});
