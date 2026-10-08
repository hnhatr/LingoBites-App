import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {SpeakingDrillContent} from '@core/schemas/activityContent';

import type {EntryReport} from '../../logic/activityOutcome';
import {comboSentence, type FlowItems} from '../../logic/flowContent';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type SpeakingDrillActivityProps = {
  content: SpeakingDrillContent;
  items: FlowItems;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * Say the pattern with each combination of slot values; the model sentence
 * (the frame filled in) stays hidden until the learner asks for it.
 */
export function SpeakingDrillActivity({
  content,
  items,
  onComplete,
}: SpeakingDrillActivityProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const frame = items.get(content.patternItemId)?.text;
  return (
    <>
      {frame ? (
        <AppText testID="lesson-flow-drill-frame" variant="label">
          {t('lessonFlow.drill_pattern', {frame})}
        </AppText>
      ) : null}
      <EntrySequence
        count={content.combos.length}
        onComplete={onComplete}
        renderEntry={(index, report) => {
          const combo = content.combos[index]!;
          return (
            <>
              <AppText color="secondary">
                {t('lessonFlow.drill_say_with')}
              </AppText>
              <View
                style={themedStyles.chips}
                testID="lesson-flow-drill-values"
              >
                {Object.entries(combo.values).map(([slot, value]) => (
                  <Chip key={slot} label={value} tone="gold" />
                ))}
              </View>
              <SpeakSelfCheck
                model={comboSentence(
                  items,
                  content.patternItemId,
                  combo.values,
                )}
                modelVisible={false}
                onReport={report}
              />
            </>
          );
        }}
      />
    </>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
