import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {ScrollView} from 'react-native';

import {useLessonBookmarks} from '@features/lesson/library';
import {hasDownloadedLessons} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {splitLessonTitle} from '@ui/components/LessonCard';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type CardAction, cardToneAt, ToneCard} from '@ui/components/ToneCard';
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

/** "Đã luyện 4/12" or "Đã luyện xong"; null before the first sentence. */
function shadowingProgressLabel(
  lesson: ShadowingLessonProgressSummary,
): string | null {
  if (lesson.statusChip === 'Xong') return 'Đã luyện xong';
  if (lesson.statusChip === 'Đang dở') {
    return `Đã luyện ${lesson.practicedSentenceCount}/${lesson.sentenceCount}`;
  }
  return null;
}

/** The card's pill: start, carry on or practise again. */
function shadowingAction(lesson: ShadowingLessonProgressSummary): CardAction {
  if (lesson.statusChip === 'Xong') {
    return {label: 'Luyện lại', glyph: 'check', solid: true};
  }
  if (lesson.statusChip === 'Đang dở') {
    return {label: 'Luyện tiếp', glyph: 'play', solid: true};
  }
  return {label: 'Luyện', glyph: 'play', solid: true};
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
        {lessons.map((lesson, index) => {
          const sourceType = lesson.sourceType ?? 'admin_text';
          return (
            <ToneCard
              key={lesson.lessonId}
              accessibilityHint="Mở phiên luyện shadowing"
              action={shadowingAction(lesson)}
              bookmark={{
                saved: isBookmarked(lesson.lessonId),
                onToggle: () =>
                  toggleBookmark({
                    lessonId: lesson.lessonId,
                    title: lesson.titleVi,
                    sourceType,
                    sentenceCount: lesson.sentenceCount,
                    estimatedMinutes: lesson.estimatedMinutes,
                    contextLabel: lesson.contextLabel ?? null,
                  }),
              }}
              cover={{
                imageUrl: null,
                glyph: sourceType === 'youtube' ? 'subtitles' : 'chat',
              }}
              description={[
                `~${lesson.estimatedMinutes} phút`,
                `${lesson.sentenceCount} câu`,
                lesson.reviewSentenceCount
                  ? `${lesson.reviewSentenceCount} câu cần ôn`
                  : null,
                shadowingProgressLabel(lesson),
              ]
                .filter(Boolean)
                .join(' · ')}
              eyebrow={lesson.contextLabel}
              gutter={theme.gutter}
              onPress={() => openLesson(lesson)}
              testID={`shadowing-lesson-${lesson.lessonId}`}
              title={splitLessonTitle(lesson.titleVi).title}
              tone={cardToneAt(index)}
            />
          );
        })}
      </ScrollView>
    </AppScreen>
  );
}
