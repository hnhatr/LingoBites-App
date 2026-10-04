import React from 'react';
import {Pressable, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

import type {ShadowingSentence} from '../../logic/shadowing/shadowingLessons';

export type SentenceCardProps = {
  sentence: ShadowingSentence;
  sentenceIndex: number;
  sentenceCount: number;
  showSampleButtons: boolean;
  onPlayNormal: () => void;
  onPlaySlow: () => void;
  compact?: boolean;
};

export function SentenceCard({
  sentence,
  sentenceIndex,
  sentenceCount,
  showSampleButtons,
  onPlayNormal,
  onPlaySlow,
  compact = false,
}: SentenceCardProps) {
  const {theme} = useAppTheme();
  const progress = sentenceCount > 0 ? (sentenceIndex + 1) / sentenceCount : 0;

  return (
    <AppCard style={{gap: theme.spacing.sm}} testID="shadowing-sentence-card">
      <AppText testID="shadowing-sentence-progress" variant="label">
        Câu {sentenceIndex + 1}/{sentenceCount}
      </AppText>
      <View
        accessibilityRole="progressbar"
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.sm,
          height: 4,
          overflow: 'hidden',
        }}
        testID="shadowing-progress-bar"
      >
        <View
          style={{
            backgroundColor: theme.colors.accent,
            height: 4,
            width: `${Math.round(progress * 100)}%`,
          }}
        />
      </View>
      {!compact ? (
        <>
          <AppText testID="shadowing-text-en" variant="h3">
            {sentence.textEn}
          </AppText>
          <AppText color="secondary" testID="shadowing-text-ipa">
            {sentence.ipa}
          </AppText>
          <AppText color="secondary" testID="shadowing-text-vi">
            {sentence.textVi}
          </AppText>
        </>
      ) : null}
      {showSampleButtons ? (
        <View style={{flexDirection: 'row', gap: theme.spacing.sm}}>
          <Pressable
            accessibilityRole="button"
            onPress={onPlayNormal}
            testID="shadowing-play-normal"
          >
            <AppText style={{color: theme.colors.accent, fontWeight: '600'}}>
              Nghe mẫu
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onPlaySlow}
            testID="shadowing-play-slow"
          >
            <AppText style={{color: theme.colors.accent, fontWeight: '600'}}>
              Nghe chậm
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </AppCard>
  );
}
