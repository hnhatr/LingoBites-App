import React from 'react';
import {StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme';

import {isRedundantContextSentence} from '../../../logic/runtime/contextSentenceDisplay';
import type {ContextStepData} from '../../../logic/runtime/types';
import {StepActions} from './StepActions';

type Props = {
  data: ContextStepData;
  onPlayAudio: (assetId: string | null) => void;
  onComplete: () => void;
  onSkip: () => void;
};

/** Context-first input: the English phrase in context + a Vietnamese explanation. */
export function ContextCard({data, onPlayAudio, onComplete, onSkip}: Props) {
  const {theme} = useAppTheme();
  const showContextEn =
    data.contextSentenceEn &&
    !isRedundantContextSentence(data.contextSentenceEn, data.phraseEn);
  const showContextVi =
    data.contextSentenceVi &&
    !isRedundantContextSentence(data.contextSentenceVi, data.phraseVi);

  return (
    <View style={{gap: theme.spacing.lg}}>
      <AppCard style={{gap: theme.spacing.md}}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
          testID="context-phrase-row"
        >
          <AppText
            style={styles.phrase}
            testID="context-phrase-en"
            variant="h2"
          >
            {data.phraseEn}
          </AppText>
          <IconButton
            accessibilityLabel="Nghe phát âm"
            icon="volume_up"
            onPress={() => onPlayAudio(data.audioAssetId)}
            tone="ghost"
          />
        </View>
        <AppText color="primary" variant="h3">
          {data.phraseVi}
        </AppText>
        {showContextEn ? (
          <AppText color="secondary">{data.contextSentenceEn}</AppText>
        ) : null}
        {showContextVi ? (
          <AppText color="muted">{data.contextSentenceVi}</AppText>
        ) : null}
        <AppText testID="context-explanation-vi">{data.explanationVi}</AppText>
      </AppCard>
      <StepActions onComplete={onComplete} onSkip={onSkip} />
    </View>
  );
}

const styles = StyleSheet.create({
  phrase: {
    flex: 1,
    flexShrink: 1,
  },
});
