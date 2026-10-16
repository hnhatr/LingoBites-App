import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  type ChecklistEntry,
  usesEntry,
  wordsOf,
} from '../logic/summativeChecklist';

type Props = {
  entries: readonly ChecklistEntry[];
  /** What the learner wrote; empty for a spoken answer (a reminder only). */
  text: string;
  /** The Server's check after sending (tenses included); null before. */
  coverage: ReadonlyMap<string, boolean> | null;
};

/** A pattern frame with its slots shown as `…`. */
function shown(entry: ChecklistEntry): string {
  return entry.kind === 'pattern'
    ? entry.text.replace(/\{[a-z][a-z_]*\}/g, '…')
    : entry.text;
}

/**
 * Vocab path P6 (F7): the words, patterns and tenses the summative task asks
 * for, ticked as the learner writes; tenses are ticked by the Server's check
 * once the answer is sent. A reminder, never a gate: sending is not blocked.
 */
export function SummativeChecklist({entries, text, coverage}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const words = useMemo(() => wordsOf(text), [text]);
  const used = entries.map(entry =>
    coverage?.has(entry.code)
      ? coverage.get(entry.code)!
      : usesEntry(words, entry.match),
  );
  const done = used.filter(value => value === true).length;

  return (
    <View style={styles.box} testID="unit-summative-checklist">
      <AppText variant="label">
        {t('summativeTask.checklist_title', {done, total: entries.length})}
      </AppText>
      {entries.map((entry, index) => {
        const state = used[index];
        return (
          <View
            key={entry.code}
            style={styles.row}
            testID={`unit-summative-check-${entry.code}`}
          >
            <MaterialIcon
              color={
                state === true ? theme.colors.primary : theme.colors.outline
              }
              name={state === true ? 'check_circle' : 'circle'}
              size={18}
            />
            <View style={styles.copy}>
              <AppText
                style={state === true ? styles.doneText : undefined}
                testID={`unit-summative-check-${entry.code}-${
                  state === true ? 'used' : state === null ? 'later' : 'missing'
                }`}
              >
                {shown(entry)}
              </AppText>
              <AppText color="secondary" variant="caption">
                {state === null
                  ? `${entry.meaning_vi} · ${t('summativeTask.checklist_on_send')}`
                  : entry.meaning_vi}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    copy: {
      flex: 1,
    },
    doneText: {
      fontWeight: '700',
    },
    row: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
