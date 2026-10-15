import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {TtsErrorCode} from '../logic/ttsService';

type Props = {
  notice: TtsErrorCode | null;
  testID?: string;
};

/** Says why the model did not play: no en-US voice, or no audio at all. */
export function SpeechNotice({notice, testID = 'speech-notice'}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (!notice) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={themedStyles.box}
      testID={testID}
    >
      <AppText color="danger">
        {notice === 'VOICE_UNAVAILABLE'
          ? t('lessonPlayer.speech_voice_missing')
          : t('lessonPlayer.speech_unavailable')}
      </AppText>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
    },
  });
}
