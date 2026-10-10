import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonMediaStatus} from '../logic/useLessonMediaDownload';

export type LessonMediaDownloadCardProps = {
  status: LessonMediaStatus;
  offline: boolean;
  onDownload: () => void;
  onRemove: () => void;
};

/**
 * Offline state of the lesson's media on the lesson hub: what is stored,
 * and the learner's own download / delete actions. Hidden for lessons
 * without media.
 */
export function LessonMediaDownloadCard({
  status,
  offline,
  onDownload,
  onRemove,
}: LessonMediaDownloadCardProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  if (status === 'none') return null;

  const message =
    status === 'saved'
      ? t('lessonMedia.saved')
      : status === 'failed'
      ? t('lessonMedia.failed')
      : offline
      ? t('lessonMedia.missing_offline')
      : t('lessonMedia.missing');

  return (
    <View style={themedStyles.card} testID="lesson-media-card">
      <AppText color="secondary" testID="lesson-media-message" variant="body">
        {message}
      </AppText>
      {status === 'saved' ? (
        <AppButton
          accessibilityHint={t('lessonMedia.remove_hint')}
          onPress={onRemove}
          testID="lesson-media-remove"
          title={t('lessonMedia.remove')}
          variant="ghost"
        />
      ) : offline ? null : (
        <AppButton
          accessibilityHint={t('lessonMedia.download_hint')}
          disabled={status === 'downloading'}
          loading={status === 'downloading'}
          onPress={onDownload}
          testID="lesson-media-download"
          title={
            status === 'failed'
              ? t('lessonMedia.retry')
              : t('lessonMedia.download')
          }
          variant="secondary"
        />
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
  });
}
