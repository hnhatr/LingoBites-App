import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {CreateStackParamList} from '@modules/input';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {AppButton} from '@components/AppButton';
import {HandoffProgressTrack} from '@components/HandoffProgressTrack';
import {ScreenHeader} from '@components/ScreenHeader';
import {runYouTubeJob, type YouTubeJobProgress} from '../api/youtubeApi';
import {useTranslation} from 'react-i18next';
import {saveYouTubeLesson} from '@shared/db/YouTubeLessonRepository';
import {useAppTheme} from '@theme';

type Props = NativeStackScreenProps<CreateStackParamList, 'YouTubeProcessing'>;

export type YouTubeProcessingScreenProps = Props;

export function YouTubeProcessingScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [runKey, setRunKey] = useState(0);
  const [progress, setProgress] = useState<YouTubeJobProgress>({
    percent: 0,
    stage: null,
  });
  const [error, setError] = useState<{code: string; message: string} | null>(
    null,
  );

  useEffect(() => {
    setError(null);
    setProgress({percent: 0, stage: null});
    const controller = new AbortController();
    runYouTubeJob(
      route.params.url,
      route.params.manualCues,
      setProgress,
      controller.signal,
    ).then(result => {
      if (result.ok) {
        // SETE-283 (HVB-07): a failed local save must not block the lesson
        // and must never be presented as saved — the Lesson screen warns.
        const saved = saveYouTubeLesson({lesson: result.lesson});
        navigation.replace(
          'YouTubeLesson',
          saved.ok
            ? {lesson: result.lesson}
            : {lesson: result.lesson, saveFailed: true},
        );
      } else if ('cancelled' in result && result.cancelled) {
        return;
      } else {
        if (!('errorCode' in result)) return;
        if (
          result.errorCode === 'TRANSCRIPT_UNAVAILABLE' ||
          result.errorCode === 'TRANSCRIPT_SOURCE_BLOCKED'
        )
          // SETE-316 (Option A2): return to the EXISTING YouTubeInput
          // instance — never push a second one — and MERGE (not replace)
          // the params so the fromHome exit contract fixed in
          // SETE-287/289/310 survives the round-trip. The input screen
          // pre-opens Step 2 with a recovery banner when it sees
          // transcriptRequired.
          navigation.navigate({
            name: 'YouTubeInput',
            params: {
              url: route.params.url,
              transcriptRequired: result.errorCode,
            },
            merge: true,
          });
        else setError({code: result.errorCode, message: result.message});
      }
    });
    return () => controller.abort();
  }, [navigation, route.params, runKey]);

  const stageLabel =
    progress.stage ?? (error ? null : t('youtube.processing_wait'));
  const progressLabel = t('youtube.processing_progress', {
    percent: Math.round(progress.percent),
  });

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('youtube.processing_title')}
      />
      <View
        style={{
          flex: 1,
          gap: theme.spacing.lg,
          padding: theme.gutter,
        }}
      >
        {error ? (
          <>
            <AppText variant="h2">
              {t('youtube.processing_failed_title')}
            </AppText>
            <AppText color="secondary" testID="youtube-processing-url">
              {route.params.url}
            </AppText>
            <AppText color="danger" accessibilityRole="alert">
              {error.message}
            </AppText>
            <AppButton
              onPress={() => setRunKey(key => key + 1)}
              testID="youtube-processing-retry"
              title={t('youtube.processing_retry')}
            />
            <AppButton
              onPress={() => navigation.goBack()}
              testID="youtube-processing-back"
              title={t('youtube.processing_change_url')}
              variant="secondary"
            />
          </>
        ) : (
          <>
            <AppText variant="h2">{t('youtube.processing')}</AppText>
            <AppText color="secondary" testID="youtube-processing-url">
              {route.params.url}
            </AppText>
            {stageLabel ? (
              <AppText color="secondary" testID="youtube-processing-stage">
                {stageLabel}
              </AppText>
            ) : null}
            <HandoffProgressTrack
              label={progressLabel}
              progress={progress.percent / 100}
            />
            <AppText testID="youtube-progress">
              {Math.round(progress.percent)}%
            </AppText>
          </>
        )}
      </View>
    </AppScreen>
  );
}
