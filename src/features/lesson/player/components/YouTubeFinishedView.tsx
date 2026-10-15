import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type YouTubeFinishedViewProps = {
  sentenceCount: number;
  savedWordCount: number;
  savedSentenceCount: number;
  /** The completion could not be written on this device. */
  saveFailed?: boolean;
  onReviewSaved: () => void;
  onReplay: () => void;
  onOtherVideo: () => void;
};

/**
 * YouTube lesson FR-09: shown when the video ends or the learner moves past
 * the last sentence. The screen records the completion; this view sums up
 * the lesson and offers what to do next.
 */
export function YouTubeFinishedView({
  sentenceCount,
  savedWordCount,
  savedSentenceCount,
  saveFailed = false,
  onReviewSaved,
  onReplay,
  onOtherVideo,
}: YouTubeFinishedViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const stats = [
    {
      key: 'sentences',
      label: t('youtube.finished.stat_sentences'),
      value: sentenceCount,
    },
    {
      key: 'words',
      label: t('youtube.finished.stat_words'),
      value: savedWordCount,
    },
    {
      key: 'saved-sentences',
      label: t('youtube.finished.stat_saved_sentences'),
      value: savedSentenceCount,
    },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      testID="youtube-finished"
    >
      <AppText accessibilityRole="header" style={styles.center} variant="h2">
        {t('youtube.completed_title')}
      </AppText>
      <AppText color="secondary" style={styles.center} variant="body">
        {t('youtube.finished.body', {count: sentenceCount})}
      </AppText>
      <View style={styles.stats}>
        {stats.map(stat => (
          <View
            key={stat.key}
            style={styles.stat}
            testID={`youtube-finished-stat-${stat.key}`}
          >
            <AppText variant="h2">{String(stat.value)}</AppText>
            <AppText color="secondary" style={styles.center} variant="caption">
              {stat.label}
            </AppText>
          </View>
        ))}
      </View>
      {saveFailed ? (
        <AppText color="danger" testID="youtube-finished-save-failed">
          {t('youtube.finished.save_failed')}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <AppButton
          accessibilityHint={t('youtube.finished.review_hint')}
          iconLeft="style"
          onPress={onReviewSaved}
          testID="youtube-finished-review"
          title={t('youtube.finished.review')}
        />
        <AppButton
          accessibilityHint={t('youtube.completed_replay_hint')}
          iconLeft="replay"
          onPress={onReplay}
          testID="youtube-finished-replay"
          title={t('youtube.completed_replay_title')}
          variant="outline"
        />
        <AppButton
          accessibilityHint={t('youtube.finished.other_video_hint')}
          iconLeft="play_circle"
          onPress={onOtherVideo}
          testID="youtube-finished-other"
          title={t('youtube.finished.other_video')}
          variant="outline"
        />
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      gap: theme.spacing.sm,
    },
    center: {
      textAlign: 'center',
    },
    content: {
      gap: theme.spacing.lg,
      padding: theme.gutter,
      paddingTop: theme.spacing.xl,
    },
    stat: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      flex: 1,
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
    },
    stats: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
