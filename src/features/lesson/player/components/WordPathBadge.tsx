import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {addToReview} from '@features/patternTense';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {getItemMemory} from '@core/sync/learningOutcomes';

import type {WordListMatch} from '../logic/wordListMatches';

type Status = 'idle' | 'choosing' | 'busy' | 'added' | 'offline' | 'failed';

function scheduled(matches: readonly WordListMatch[]): boolean {
  try {
    return matches.some(match => getItemMemory(match.code) !== null);
  } catch {
    return false;
  }
}

/** "A2" or "A2 · B1" when the senses sit at different levels. */
function levelLabel(matches: readonly WordListMatch[]): string | null {
  const levels = [
    ...new Set(
      matches
        .map(match => match.cefr_level)
        .filter((level): level is string => level !== null),
    ),
  ];
  return levels.length > 0 ? levels.join(' · ') : null;
}

/**
 * Vocab path P6 (F8): under a word of the learner's own lesson that is in the
 * word list: its CEFR level and "Thêm vào lộ trình". A word with several
 * senses asks which one first.
 */
export function WordPathBadge({
  matches,
  testID,
}: {
  matches: readonly WordListMatch[];
  testID: string;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [status, setStatus] = useState<Status>(() =>
    scheduled(matches) ? 'added' : 'idle',
  );
  const level = levelLabel(matches);

  const add = (code: string) => {
    setStatus('busy');
    addToReview(code)
      .then(result =>
        setStatus(result.ok ? 'added' : result.offline ? 'offline' : 'failed'),
      )
      .catch(() => setStatus('failed'));
  };

  return (
    <View style={styles.row} testID={testID}>
      {level ? (
        <View style={styles.level}>
          <AppText style={styles.levelText} testID={`${testID}-level`}>
            {level}
          </AppText>
        </View>
      ) : null}
      {status === 'added' ? (
        <AppText color="secondary" testID={`${testID}-added`} variant="caption">
          {t('lessonPlayer.word_path_added')}
        </AppText>
      ) : status === 'choosing' ? (
        <View style={styles.senses}>
          <AppText color="secondary" variant="caption">
            {t('lessonPlayer.word_path_pick_sense')}
          </AppText>
          {matches.map(match => (
            <Pressable
              accessibilityHint={t('lessonPlayer.word_path_add_hint')}
              accessibilityRole="button"
              key={match.code}
              onPress={() => add(match.code)}
              testID={`${testID}-sense-${match.code}`}
            >
              <AppText style={styles.link} variant="caption">
                {match.meaning_vi}
                {match.cefr_level ? ` (${match.cefr_level})` : ''}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityHint={t('lessonPlayer.word_path_add_hint')}
          accessibilityRole="button"
          disabled={status === 'busy'}
          onPress={() =>
            matches.length > 1 ? setStatus('choosing') : add(matches[0]!.code)
          }
          testID={`${testID}-add`}
        >
          <AppText style={styles.link} variant="caption">
            {status === 'busy'
              ? t('lessonPlayer.word_path_adding')
              : t('lessonPlayer.word_path_add')}
          </AppText>
        </Pressable>
      )}
      {status === 'offline' || status === 'failed' ? (
        <AppText color="danger" testID={`${testID}-error`} variant="caption">
          {t(
            status === 'offline'
              ? 'lessonPlayer.word_path_offline'
              : 'lessonPlayer.word_path_failed',
          )}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    level: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    levelText: {
      color: theme.colors.accentInk,
      fontSize: 12,
      fontWeight: '700',
    },
    link: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    senses: {
      gap: theme.spacing.xs,
    },
  });
}
