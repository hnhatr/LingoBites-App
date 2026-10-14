import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {RolePlayContent} from '@core/schemas/activityContent';
import type {LessonTask} from '@core/schemas/lesson';

import type {EntryReport} from '../../logic/activityOutcome';
import type {FlowItems} from '../../logic/flowContent';
import {hintLadder} from '../../logic/hints';
import {PartnerBubble, TurnBubble} from '../ChatBubble';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type RolePlayActivityProps = {
  content: RolePlayContent;
  items: FlowItems;
  task: LessonTask | null;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * The dialogue turn by turn: the other speaker's lines are shown with a play
 * button, and each of the learner's turns is said and self-judged, its
 * model line hidden until asked for. (PR 11 turns step 5 into independent
 * use without a model.)
 */
export function RolePlayActivity({
  content,
  items,
  task,
  onComplete,
}: RolePlayActivityProps) {
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
          <View style={themedStyles.chat}>
            {before.map(line => (
              <PartnerBubble
                key={line.id}
                speaker={line.speaker}
                testID="lesson-flow-partner-line"
                textEn={line.textEn}
                textVi={line.textVi}
              />
            ))}
            <TurnBubble>
              <AppText testID="lesson-flow-prompt" variant="title">
                {t('lessonFlow.your_turn', {
                  speaker: turn.speaker,
                  text: turn.textVi,
                })}
              </AppText>
            </TurnBubble>
            <SpeakSelfCheck
              hints={hintLadder({
                task,
                model: turn.textEn,
                frame: turn.patternItemId
                  ? items.get(turn.patternItemId)?.text
                  : null,
              })}
              model={turn.textEn}
              onReport={report}
            />
          </View>
        );
      }}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chat: {
      gap: theme.spacing.md,
    },
  });
}
