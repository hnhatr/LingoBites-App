import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {ScrollView} from 'react-native';

import {useLessonBookmarks} from '@features/lesson/library';
import {hasDownloadedLessons} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  LessonCard,
  lessonCardKind,
  type LessonCardProgress,
  splitLessonTitle,
} from '@ui/components/LessonCard';
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

/** Shadowing progress as the card's progress chip; "Chưa luyện" shows none. */
function shadowingProgress(
  lesson: ShadowingLessonProgressSummary,
): LessonCardProgress | null {
  if (lesson.statusChip === 'Xong') {
    return {state: 'completed', label: 'Đã luyện xong'};
  }
  if (lesson.statusChip === 'Đang dở') {
    return {
      state: 'in_progress',
      done: lesson.practicedSentenceCount,
      total: lesson.sentenceCount,
      label: `Đã luyện ${lesson.practicedSentenceCount}/${lesson.sentenceCount}`,
    };
  }
  return null;
}

export function ShadowingLessonPickerScreen({
  navigation,
}: ShadowingLessonPickerScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
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
        {lessons.map(lesson => {
          const {title, subtitle} = splitLessonTitle(lesson.titleVi);
          const sourceType = lesson.sourceType ?? 'admin_text';
          return (
            <LessonCard
              key={lesson.lessonId}
              accessibilityHint="Mở phiên luyện shadowing"
              bookmarked={isBookmarked(lesson.lessonId)}
              context={lesson.contextLabel}
              downloaded
              durationLabel={`~${lesson.estimatedMinutes} phút`}
              kind={lessonCardKind(sourceType)}
              onPress={() => openLesson(lesson)}
              onToggleBookmark={() =>
                toggleBookmark({
                  lessonId: lesson.lessonId,
                  title: lesson.titleVi,
                  sourceType,
                  sentenceCount: lesson.sentenceCount,
                  estimatedMinutes: lesson.estimatedMinutes,
                  contextLabel: lesson.contextLabel ?? null,
                })
              }
              progress={shadowingProgress(lesson)}
              reviewDueCount={lesson.reviewSentenceCount}
              sentenceCount={lesson.sentenceCount}
              subtitle={subtitle}
              testID={`shadowing-lesson-${lesson.lessonId}`}
              title={title}
            />
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}
