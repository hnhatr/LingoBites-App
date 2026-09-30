import React from 'react';
import {Text, View} from 'react-native';

import {useAppTheme} from '@ui/theme';

import {blockBaseStyles} from '../logic/blockStyles';
import type {CurriculumLessonActivityBlockData} from '../logic/curriculumLessonSchema';

type Props = {
  data: CurriculumLessonActivityBlockData;
};

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  listen_and_repeat: 'Listen and repeat',
  speaking_drill: 'Speaking drill',
  role_play: 'Role play',
  fill_blank: 'Fill in the blank',
  multiple_choice: 'Multiple choice',
  translation: 'Translation',
};

/**
 * Renders an `activity` block: the activity kind, its Vietnamese title,
 * optional instructions, and optional dialogue lines. Linked exercises
 * render as their own `exercise` blocks; this renderer never dispatches
 * on `linkedExerciseIds` and never branches on lesson origin.
 */
export function ActivityBlockView({data}: Props) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const kindLabel =
    ACTIVITY_KIND_LABELS[data.activityKind] ?? data.activityKind;
  const lines = data.lines ?? data.dialogueTurns ?? [];
  return (
    <View testID="block-activity">
      <Text testID="block-activity-kind" style={styles.caption}>
        {kindLabel}
      </Text>
      <Text testID="block-activity-title" style={styles.title}>
        {data.titleVi}
      </Text>
      {data.instructionsVi ? (
        <Text testID="block-activity-instructions" style={styles.secondary}>
          {data.instructionsVi}
        </Text>
      ) : null}
      {lines.map(turn => (
        <View key={turn.id} testID={`block-activity-line-${turn.id}`}>
          <Text
            testID={`block-activity-line-speaker-${turn.id}`}
            style={styles.caption}
          >
            {turn.speaker === 'A' ? 'Speaker A' : 'Speaker B'}
          </Text>
          <Text
            testID={`block-activity-line-en-${turn.id}`}
            style={styles.body}
          >
            {turn.textEn}
          </Text>
          <Text
            testID={`block-activity-line-vi-${turn.id}`}
            style={styles.secondary}
          >
            {turn.textVi}
          </Text>
        </View>
      ))}
    </View>
  );
}
