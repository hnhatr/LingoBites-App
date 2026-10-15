import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryReport, EntryResult} from '../logic/activityOutcome';
import {
  type FlowFooterAction,
  FlowFooterBar,
  useFlowFooter,
} from './FlowFooter';

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
 * Redesign: "Tiếp" and the entry's result sit in the player's bottom sheet
 * (inline when rendered outside the player).
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

  const result = reported ? results[index]?.result : undefined;
  const next: FlowFooterAction | null = reported
    ? {
        title: last
          ? t('lessonFlow.finish_activity')
          : t('lessonFlow.next_entry'),
        hint: t('lessonFlow.next_entry_hint'),
        testID: 'lesson-flow-entry-next',
        icon: last ? 'check_circle' : 'chevron_right',
        onPress: () => (last ? onComplete(results) : setIndex(index + 1)),
        feedback:
          result === 'not_yet'
            ? {
                tone: 'retry',
                title: t('lessonFlow.entry_feedback_retry'),
                body: t('lessonFlow.entry_feedback_retry_body'),
              }
            : {
                tone: 'pass',
                title: t('lessonFlow.entry_feedback_pass'),
                body: t('lessonFlow.entry_feedback_pass_body'),
              },
      }
    : null;
  // Until this entry is done, "Câu tiếp" stays greyed out with a note.
  const hosted = useFlowFooter(
    next ?? {
      title: last
        ? t('lessonFlow.finish_activity')
        : t('lessonFlow.next_entry'),
      hint: t('lessonFlow.entry_locked_note'),
      testID: 'lesson-flow-entry-next',
      onPress: () => undefined,
      disabled: true,
      note: t('lessonFlow.entry_locked_note'),
    },
    2,
  );

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
      </View>
      {count > 1 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={themedStyles.strip}
        >
          {Array.from({length: count}, (_, position) => (
            <View
              key={position}
              style={[
                themedStyles.segment,
                position < index || (position === index && reported)
                  ? themedStyles.segmentDone
                  : position === index
                    ? themedStyles.segmentCurrent
                    : null,
              ]}
            />
          ))}
        </View>
      ) : null}
      <View key={index} style={themedStyles.entry}>
        {renderEntry(index, report)}
      </View>
      {next && !hosted ? <FlowFooterBar action={next} /> : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    entry: {
      gap: theme.spacing.md,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: -theme.spacing.sm,
    },
    segment: {
      backgroundColor: theme.colors.outlineVariant,
      borderRadius: 4,
      flex: 1,
      height: 8,
    },
    segmentCurrent: {
      backgroundColor: HERO_PALETTE.coral,
    },
    segmentDone: {
      backgroundColor: theme.colors.accent,
    },
    strip: {
      flexDirection: 'row',
      gap: 4,
    },
  });
}
