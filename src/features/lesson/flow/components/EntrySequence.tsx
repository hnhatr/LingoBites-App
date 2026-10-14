import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryReport, EntryResult} from '../logic/activityOutcome';

export type EntrySequenceProps = {
  count: number;
  /**
   * Renders entry `index`; it calls `report` once with its result and the
   * highest hint it opened.
   */
  renderEntry: (
    index: number,
    report: (result: EntryResult, support?: LessonSupportLevel) => void,
  ) => React.ReactNode;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * The entries of an activity one at a time: an entry reports its result,
 * then "Tiếp" moves on; after the last one the results go to `onComplete`.
 */
export function EntrySequence({
  count,
  renderEntry,
  onComplete,
}: EntrySequenceProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<EntryReport[]>([]);
  const reported = results.length > index;
  const last = index + 1 >= count;

  const report = (
    result: EntryResult,
    support: LessonSupportLevel = 'none',
  ) => {
    setResults(previous =>
      previous.length > index ? previous : [...previous, {result, support}],
    );
  };

  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.header}>
        <AppText
          color="secondary"
          testID="lesson-flow-entry-count"
          variant="label"
        >
          {t('lessonFlow.entry_count', {current: index + 1, total: count})}
        </AppText>
        {count > 1 ? (
          <View style={themedStyles.dots}>
            {Array.from({length: count}, (_, position) => (
              <View
                key={position}
                style={[
                  themedStyles.dot,
                  position < index || (position === index && reported)
                    ? themedStyles.dotDone
                    : position === index
                    ? themedStyles.dotCurrent
                    : null,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
      <View key={index}>{renderEntry(index, report)}</View>
      {reported ? (
        <AppButton
          accessibilityHint={t('lessonFlow.next_entry_hint')}
          iconRight={last ? 'check_circle' : 'chevron_right'}
          onPress={() => (last ? onComplete(results) : setIndex(index + 1))}
          testID="lesson-flow-entry-next"
          title={
            last ? t('lessonFlow.finish_activity') : t('lessonFlow.next_entry')
          }
          variant="deep"
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    dot: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      height: 8,
      width: 8,
    },
    dotCurrent: {
      backgroundColor: theme.colors.accent,
      width: 20,
    },
    dotDone: {
      backgroundColor: theme.colors.primary,
    },
    dots: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
  });
}
