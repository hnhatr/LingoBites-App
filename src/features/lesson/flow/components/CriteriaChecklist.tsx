import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonTask} from '@core/schemas/lesson';

import type {Criterion} from '../logic/independent';

export type CriteriaChecklistProps = {
  criteria: LessonTask['criteria'];
  ticked: ReadonlySet<Criterion>;
  onToggle: (criterion: Criterion) => void;
  disabled?: boolean;
};

/**
 * The task's criteria as self-check questions (decision G6); required ones
 * carry a star and decide the result.
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
    <View style={themedStyles.container}>
      {criteria.map(entry => {
        const checked = ticked.has(entry.criterion);
        const label = `${t(`lessonFlow.criterion_${entry.criterion}`)}${
          entry.required ? ' *' : ''
        }`;
        return (
          <Pressable
            accessibilityHint={t('lessonFlow.criterion_hint')}
            accessibilityLabel={label}
            accessibilityRole="checkbox"
            accessibilityState={{checked, disabled}}
            disabled={disabled}
            key={entry.criterion}
            onPress={() => onToggle(entry.criterion)}
            style={themedStyles.row}
            testID={`lesson-flow-criterion-${entry.criterion}`}
          >
            <MaterialIcon
              color={theme.colors.primary}
              name={checked ? 'check_circle' : 'circle'}
              size={22}
            />
            <AppText style={themedStyles.flex}>{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 44,
    },
  });
}
