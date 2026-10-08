import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {RolePlayContent} from '@core/schemas/activityContent';

import type {EntryResult} from '../../logic/activityOutcome';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type RolePlayActivityProps = {
  content: RolePlayContent;
  onComplete: (results: EntryResult[]) => void;
};

/**
 * The dialogue turn by turn: the other speaker's lines are shown with a play
 * button, and each of the learner's turns is said and self-judged, its
 * model line hidden until asked for. (PR 11 turns step 5 into independent
 * use without a model.)
 */
export function RolePlayActivity({content, onComplete}: RolePlayActivityProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const learnerTurns = useMemo(
    () =>
      content.turns.flatMap((turn, position) =>
        turn.speaker === content.learnerSpeaker ? [position] : [],
      ),
    [content],
  );

  return (
    <EntrySequence
      count={learnerTurns.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const position = learnerTurns[index]!;
        const turn = content.turns[position]!;
        const before = content.turns.slice(
          index === 0 ? 0 : learnerTurns[index - 1]! + 1,
          position,
        );
        return (
          <>
            {before.map(line => (
              <View
                key={line.id}
                style={themedStyles.line}
                testID="lesson-flow-partner-line"
              >
                <View style={themedStyles.flex}>
                  <AppText variant="label">
                    {line.speaker}: {line.textEn}
                  </AppText>
                  <AppText color="secondary">{line.textVi}</AppText>
                </View>
                <IconButton
                  accessibilityHint={t('lessonFlow.listen_line_hint')}
                  accessibilityLabel={t('lessonFlow.listen_line')}
                  icon="volume_up"
                  onPress={() => {
                    speak(line.textEn).catch(() => undefined);
                  }}
                />
              </View>
            ))}
            <AppText testID="lesson-flow-prompt" variant="h3">
              {t('lessonFlow.your_turn', {
                speaker: turn.speaker,
                text: turn.textVi,
              })}
            </AppText>
            <SpeakSelfCheck
              model={turn.textEn}
              modelVisible={false}
              onReport={report}
            />
          </>
        );
      }}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    line: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
