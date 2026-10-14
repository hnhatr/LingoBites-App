import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {SpeakingDrillContent} from '@core/schemas/activityContent';
import type {LessonTask} from '@core/schemas/lesson';

import type {EntryReport} from '../../logic/activityOutcome';
import {
  comboSentence,
  fillFrame,
  type FlowItems,
} from '../../logic/flowContent';
import {hintLadder} from '../../logic/hints';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type SpeakingDrillActivityProps = {
  content: SpeakingDrillContent;
  items: FlowItems;
  task: LessonTask | null;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * Say the pattern with each combination of slot values; the model sentence
 * (the frame filled in) stays hidden until the learner asks for it.
 * Redesign: the frame with its slots blank, the values to say as large
 * tokens, and the next combination previewed.
 */
export function SpeakingDrillActivity({
  content,
  items,
  task,
  onComplete,
}: SpeakingDrillActivityProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const frame = items.get(content.patternItemId)?.text;
  return (
    <>
      {frame ? (
        <View style={themedStyles.frame}>
          <AppText testID="lesson-flow-drill-frame" variant="title">
            {t('lessonFlow.drill_pattern', {frame: fillFrame(frame, {})})}
          </AppText>
        </View>
      ) : null}
      <EntrySequence
        count={content.combos.length}
        onComplete={onComplete}
        renderEntry={(index, report) => {
          const combo = content.combos[index]!;
          const upcoming = content.combos[index + 1];
          const model = comboSentence(
            items,
            content.patternItemId,
            combo.values,
          );
          return (
            <View style={themedStyles.entry}>
              <View style={themedStyles.say}>
                <AppText color="secondary" variant="label">
                  {t('lessonFlow.drill_say_with')}
                </AppText>
                <View
                  style={themedStyles.values}
                  testID="lesson-flow-drill-values"
                >
                  {Object.entries(combo.values).map(([slot, value]) => (
                    <View key={slot} style={themedStyles.value}>
                      <AppText variant="h3">{value}</AppText>
                    </View>
                  ))}
                </View>
                {upcoming ? (
                  <AppText color="muted" variant="caption">
                    {t('lessonFlow.drill_up_next', {
                      values: Object.values(upcoming.values).join(' · '),
                    })}
                  </AppText>
                ) : null}
              </View>
              <SpeakSelfCheck
                hints={hintLadder({task, model, frame})}
                model={model}
                onReport={report}
              />
            </View>
          );
        }}
      />
    </>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    entry: {
      gap: theme.spacing.md,
    },
    frame: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
    },
    say: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    value: {
      backgroundColor: colors.tertiaryFixed,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      ...getStickerFace(theme, 3),
    },
    values: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'center',
    },
  });
}
