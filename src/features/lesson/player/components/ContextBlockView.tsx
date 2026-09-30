import React from 'react';
import {Text, View} from 'react-native';

import {useAppTheme} from '@ui/theme';

import {blockBaseStyles} from '../logic/blockStyles';
import type {
  CurriculumLessonContextBlockData,
  CurriculumLessonDialogueTurn,
} from '../logic/curriculumLessonSchema';

type Props = {
  data: CurriculumLessonContextBlockData;
};

function DialogueTurnRow({turn}: {turn: CurriculumLessonDialogueTurn}) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  return (
    <View testID={`block-context-turn-${turn.id}`}>
      <Text
        testID={`block-context-turn-speaker-${turn.id}`}
        style={styles.caption}
      >
        {turn.speaker === 'A' ? 'Speaker A' : 'Speaker B'}
      </Text>
      <Text testID={`block-context-turn-en-${turn.id}`} style={styles.body}>
        {turn.textEn}
      </Text>
      <Text
        testID={`block-context-turn-vi-${turn.id}`}
        style={styles.secondary}
      >
        {turn.textVi}
      </Text>
    </View>
  );
}

/**
 * Renders a `context` block: the target phrase with its Vietnamese
 * meaning, an explanation, an optional usage sentence, and optional
 * dialogue turns. All content is display-only.
 */
export function ContextBlockView({data}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  return (
    <View testID="block-context">
      <Text testID="block-context-phrase-en" style={styles.title}>
        {data.phraseEn}
      </Text>
      <Text testID="block-context-phrase-vi" style={styles.body}>
        {data.phraseVi}
      </Text>
      <Text testID="block-context-explanation" style={styles.secondary}>
        {data.explanationVi}
      </Text>
      {data.contextSentenceEn ? (
        <Text testID="block-context-sentence-en" style={styles.body}>
          {data.contextSentenceEn}
        </Text>
      ) : null}
      {data.contextSentenceVi ? (
        <Text testID="block-context-sentence-vi" style={styles.secondary}>
          {data.contextSentenceVi}
        </Text>
      ) : null}
      {data.dialogueTurns?.map(turn => (
        <DialogueTurnRow key={turn.id} turn={turn} />
      ))}
    </View>
  );
}
