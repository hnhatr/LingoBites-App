import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonTask} from '@core/schemas/lesson';

import {studyCardStyle} from '../../player/components/StudyControls';
import type {Criterion} from '../logic/independent';

export type CriteriaChecklistProps = {
  criteria: LessonTask['criteria'];
  ticked: ReadonlySet<Criterion>;
  onToggle: (criterion: Criterion) => void;
  disabled?: boolean;
};

/**
 * The task's criteria as self-check questions (decision G6) on a white card;
 * required ones carry a "Cần có" tag and decide the result.
 */
export function CriteriaChecklist({
  criteria,
  ticked,
  onToggle,
  disabled = false,
}: CriteriaChecklistProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.card}>
      <AppText style={themedStyles.question} variant="h3">
        {t('lessonFlow.criteria_question')}
      </AppText>
      {criteria.map((entry, position) => {
        const checked = ticked.has(entry.criterion);
        const text = t(`lessonFlow.criterion_${entry.criterion}`);
        const label = entry.required
          ? `${text}, ${t('lessonFlow.criterion_required')}`
          : text;
        return (
          <Pressable
            accessibilityHint={t('lessonFlow.criterion_hint')}
            accessibilityLabel={label}
            accessibilityRole="checkbox"
            accessibilityState={{checked, disabled}}
            disabled={disabled}
            key={entry.criterion}
            onPress={() => onToggle(entry.criterion)}
            style={[themedStyles.row, position > 0 ? themedStyles.line : null]}
            testID={`lesson-flow-criterion-${entry.criterion}`}
          >
            <View
              style={[themedStyles.box, checked ? themedStyles.boxOn : null]}
            >
              {checked ? <View style={themedStyles.tick} /> : null}
            </View>
            <AppText style={themedStyles.flex}>{text}</AppText>
            {entry.required ? (
              <View style={themedStyles.required}>
                <AppText style={themedStyles.requiredText}>
                  {t('lessonFlow.criterion_required')}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    boxOn: {
      backgroundColor: theme.colors.primary,
    },
    card: {
      ...studyCardStyle(theme),
      paddingBottom: 4,
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    flex: {
      flex: 1,
    },
    line: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    question: {
      marginBottom: 4,
    },
    required: {
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    requiredText: {
      color: theme.colors.secondary,
      fontSize: 11,
      fontWeight: '700',
    },
    tick: {
      borderBottomWidth: 3,
      borderColor: theme.colors.text.inverse,
      borderLeftWidth: 3,
      height: 7,
      marginTop: -3,
      transform: [{rotate: '-45deg'}],
      width: 12,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 48,
      paddingVertical: 6,
    },
  });
}
