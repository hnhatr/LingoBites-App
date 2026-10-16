import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  levelColors,
  memoryLevel,
  TENSE_ASPECTS,
  TENSE_TIMES,
} from '@features/patternTense';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useOptionalAppNavigation} from '@core/navigation';

import {
  fetchVocabProgress,
  lastVocabProgress,
  type VocabProgress,
} from '../logic/vocabProgressClient';

type Counts = {total: number; learning: number; stable: number};

/** Patterns listed by function, at most. */
const FUNCTIONS_SHOWN = 6;

function sum(rows: readonly Counts[]): Counts {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      learning: acc.learning + row.learning,
      stable: acc.stable + row.stable,
    }),
    {total: 0, learning: 0, stable: 0},
  );
}

function ProgressBar({counts, styles}: {counts: Counts; styles: Styles}) {
  const rest = Math.max(0, counts.total - counts.stable - counts.learning);
  return (
    <View style={styles.track}>
      <View style={[styles.stable, {flex: counts.stable}]} />
      <View style={[styles.learning, {flex: counts.learning}]} />
      <View style={{flex: rest}} />
    </View>
  );
}

function CountRow({
  label,
  counts,
  styles,
  testID,
}: {
  label: string;
  counts: Counts;
  styles: Styles;
  testID: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <View style={styles.rowBar}>
        <ProgressBar counts={counts} styles={styles} />
      </View>
      <AppText color="secondary" style={styles.rowValue}>
        {counts.stable}/{counts.total}
      </AppText>
    </View>
  );
}

/**
 * Vocab path P6 (F9): "Từ · Mẫu · Thì" in the progress report. Words
 * remembered of those published, level by level; patterns by function; the
 * tense map in small. Read from the Server; the session keeps the last
 * answer for when the network drops.
 */
export function VocabProgressSection() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useOptionalAppNavigation();
  const [progress, setProgress] = useState<VocabProgress | null>(
    lastVocabProgress,
  );
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchVocabProgress()
      .then(result => {
        if (result.ok) setProgress(result.value);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const heading = <AppText style={styles.heading}>Từ · Mẫu · Thì</AppText>;
  if (!progress) {
    return (
      <View style={styles.section} testID="vocab-progress">
        {heading}
        <AppCard>
          <View style={styles.card}>
            <AppText color="secondary" testID="vocab-progress-status">
              {failed ? 'Cần mạng để xem tiến độ từ vựng.' : 'Đang tải…'}
            </AppText>
            {failed ? (
              <Pressable
                accessibilityHint="Tải lại tiến độ từ vựng"
                accessibilityRole="button"
                onPress={load}
                testID="vocab-progress-retry"
              >
                <AppText style={styles.link}>Thử lại</AppText>
              </Pressable>
            ) : null}
          </View>
        </AppCard>
      </View>
    );
  }

  const words = sum(progress.words);
  const patterns = progress.pattern_summary;
  const tenseAt = (time: string, aspect: string) =>
    progress.tenses.find(
      tense => tense.time === time && tense.aspect === aspect,
    );

  return (
    <View style={styles.section} testID="vocab-progress">
      {heading}
      <AppCard>
        <View style={styles.card}>
          <AppText style={styles.title}>Từ vựng đã nhớ</AppText>
          <AppText style={styles.big} testID="vocab-progress-words">
            {words.stable}
            <AppText color="secondary"> / {words.total} từ</AppText>
          </AppText>
          {progress.words.map(level => (
            <CountRow
              counts={level}
              key={level.cefr_level}
              label={level.cefr_level}
              styles={styles}
              testID={`vocab-progress-level-${level.cefr_level}`}
            />
          ))}
          <AppText color="muted" style={styles.note}>
            Đậm: đã nhớ chắc · nhạt: đang học ({words.learning} từ)
          </AppText>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.card}>
          <AppText style={styles.title}>Mẫu câu</AppText>
          <AppText style={styles.big} testID="vocab-progress-patterns">
            {patterns.stable}
            <AppText color="secondary"> / {patterns.total} mẫu</AppText>
          </AppText>
          {progress.patterns.slice(0, FUNCTIONS_SHOWN).map(entry => (
            <CountRow
              counts={entry}
              key={entry.function}
              label={entry.label_vi}
              styles={styles}
              testID={`vocab-progress-function-${entry.function}`}
            />
          ))}
        </View>
      </AppCard>

      {progress.tenses.length > 0 ? (
        <AppCard>
          <View style={styles.card}>
            <AppText style={styles.title}>Thì</AppText>
            {TENSE_TIMES.map(time => (
              <View key={time} style={styles.tenseRow}>
                {TENSE_ASPECTS.map(aspect => {
                  const tense = tenseAt(time, aspect);
                  if (!tense) {
                    return <View key={aspect} style={styles.tenseCell} />;
                  }
                  const level = memoryLevel(
                    tense.stage === null
                      ? null
                      : {
                          stage: tense.stage,
                          stableAt: tense.stable ? 'stable' : null,
                        },
                  );
                  const colors = levelColors(theme, level);
                  return (
                    <Pressable
                      accessibilityHint="Mở thì này"
                      accessibilityLabel={tense.text}
                      accessibilityRole="button"
                      disabled={!appNavigation}
                      key={aspect}
                      onPress={() => appNavigation?.openTenseDetail(tense.code)}
                      style={[styles.tenseCell, {backgroundColor: colors.face}]}
                      testID={`vocab-progress-tense-${tense.code}`}
                    />
                  );
                })}
              </View>
            ))}
            {appNavigation ? (
              <Pressable
                accessibilityHint="Mở bản đồ thì trong thư viện"
                accessibilityRole="link"
                onPress={() => appNavigation.openLibrarySection('tenses')}
                testID="vocab-progress-tense-map"
              >
                <AppText style={styles.link}>Xem bản đồ thì</AppText>
              </Pressable>
            ) : null}
          </View>
        </AppCard>
      ) : null}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    big: {
      fontSize: 24,
      fontWeight: '800',
    },
    card: {
      gap: 8,
    },
    heading: {
      color: theme.colors.primary,
      fontSize: 12.5,
      fontWeight: '800',
      letterSpacing: 1,
      paddingHorizontal: 2,
      paddingTop: 4,
    },
    learning: {
      backgroundColor: theme.colors.accentSoft,
      height: '100%',
    },
    link: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    note: {
      fontSize: 12,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    rowBar: {
      flex: 1,
    },
    rowLabel: {
      fontWeight: '700',
      width: 96,
    },
    rowValue: {
      fontSize: 13,
      minWidth: 56,
      textAlign: 'right',
    },
    section: {
      gap: 10,
    },
    stable: {
      backgroundColor: theme.colors.primary,
      height: '100%',
    },
    tenseCell: {
      borderRadius: 6,
      flex: 1,
      height: 22,
    },
    tenseRow: {
      flexDirection: 'row',
      gap: 4,
    },
    title: {
      fontWeight: '700',
    },
    track: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 999,
      flexDirection: 'row',
      height: 8,
      overflow: 'hidden',
    },
  });
}
