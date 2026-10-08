import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {EntryResult} from '../logic/activityOutcome';

export type EntrySequenceProps = {
  count: number;
  /** Renders entry `index`; it calls `report` once with its result. */
  renderEntry: (
    index: number,
    report: (result: EntryResult) => void,
  ) => React.ReactNode;
  onComplete: (results: EntryResult[]) => void;
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
  const [results, setResults] = useState<EntryResult[]>([]);
  const reported = results.length > index;
  const last = index + 1 >= count;

  const report = (result: EntryResult) => {
    setResults(previous =>
      previous.length > index ? previous : [...previous, result],
    );
  };

  return (
    <View style={themedStyles.container}>
      <AppText
        color="secondary"
        testID="lesson-flow-entry-count"
        variant="label"
      >
        {t('lessonFlow.entry_count', {current: index + 1, total: count})}
      </AppText>
      <View key={index}>{renderEntry(index, report)}</View>
      {reported ? (
        <AppButton
          accessibilityHint={t('lessonFlow.next_entry_hint')}
          onPress={() => (last ? onComplete(results) : setIndex(index + 1))}
          testID="lesson-flow-entry-next"
          title={
            last ? t('lessonFlow.finish_activity') : t('lessonFlow.next_entry')
          }
          variant="secondary"
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
  });
}
