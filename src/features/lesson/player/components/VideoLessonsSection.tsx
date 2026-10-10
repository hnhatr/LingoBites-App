import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {
  LessonCard,
  lessonCardDurationLabel,
  lessonContextLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonCatalogItem} from '@core/schemas/lesson';

export type VideoLessonsSectionProps = {
  lessons: readonly LessonCatalogItem[];
  onOpenLesson: (lessonId: string) => void;
};

/**
 * "Bài học từ video này": the published six-step lessons made from the
 * video, under a public video. Nothing renders until there is one.
 */
export function VideoLessonsSection({
  lessons,
  onOpenLesson,
}: VideoLessonsSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (lessons.length === 0) {
    return null;
  }
  return (
    <View style={styles.section} testID="youtube-video-lessons">
      <AppText variant="h3">{t('youtube.study.video_lessons_title')}</AppText>
      {lessons.map(lesson => {
        const {title, subtitle} = splitLessonTitle(lesson.title);
        return (
          <LessonCard
            key={lesson.id}
            accessibilityHint={t('youtube.study.video_lessons_hint')}
            context={lessonContextLabel(lesson.unit)}
            durationLabel={lessonCardDurationLabel({
              estimatedMinutes: lesson.estimated_minutes,
              youtubeDurationMs: null,
              sentenceCount: lesson.sentence_count,
            })}
            exerciseCount={lesson.activity_count}
            kind="text"
            onPress={() => onOpenLesson(lesson.id)}
            sentenceCount={lesson.sentence_count}
            subtitle={subtitle}
            testID={`youtube-video-lesson-${lesson.id}`}
            title={title}
          />
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
  });
}
