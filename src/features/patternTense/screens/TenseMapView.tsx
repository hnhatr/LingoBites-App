import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  type LibraryTense,
  type MemoryLevel,
  memoryLevel,
  TENSE_ASPECTS,
  TENSE_TIMES,
  tenseGrid,
} from '../logic/libraryModel';
import {memoryOf} from '../logic/libraryRepository';
import {useTenseLibrary} from '../logic/useLibrary';

const LEVELS: readonly MemoryLevel[] = [
  'new',
  'started',
  'recalling',
  'stable',
];

/** Face and ink of a cell by how well the tense is remembered. */
function levelColors(theme: AppTheme, level: MemoryLevel) {
  const {colors} = theme;
  switch (level) {
    case 'new':
      return {face: colors.surfaceContainer, ink: colors.text.secondary};
    case 'started':
      return {face: colors.tertiarySoft, ink: colors.text.primary};
    case 'recalling':
      return {face: colors.secondarySoft, ink: colors.text.primary};
    case 'stable':
      return {face: colors.accentSoft, ink: colors.accentInk};
  }
}

type CellProps = {
  tense: LibraryTense;
  level: MemoryLevel;
  onPress: () => void;
};

function TenseCell({tense, level, onPress}: CellProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colors = levelColors(theme, level);
  return (
    <Pressable
      accessibilityHint={t('patternTense.open_tense_hint')}
      accessibilityLabel={`${tense.item.text}, ${t(`patternTense.level_${level}`)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.cell, {backgroundColor: colors.face}]}
      testID={`tense-cell-${tense.item.code}`}
    >
      <AppText
        numberOfLines={3}
        style={[styles.cellText, {color: colors.ink}]}
        variant="caption"
      >
        {tense.item.text}
      </AppText>
    </Pressable>
  );
}

/**
 * Vocab path P6 (F3): the tense map, a Library section. Time down, aspect
 * across; each cell coloured by how well the learner remembers that tense
 * (`item_memory`). Tenses outside the grid (be going to) follow below.
 */
export function TenseMapView() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const {data, loading, offline, reload} = useTenseLibrary();

  if (!data) {
    return loading ? (
      <ActivityIndicator style={styles.loading} />
    ) : (
      <View style={styles.message} testID="tense-map-offline">
        <AppText color="secondary">{t('patternTense.needs_network')}</AppText>
        <AppButton
          onPress={reload}
          title={t('patternTense.retry')}
          variant="outline"
        />
      </View>
    );
  }
  if (data.length === 0) {
    return (
      <AppText color="secondary" style={styles.empty}>
        {t('patternTense.no_tenses')}
      </AppText>
    );
  }

  const grid = tenseGrid(data);
  const levelOf = (tense: LibraryTense) =>
    memoryLevel(memoryOf(tense.item.code));
  const open = (tense: LibraryTense) =>
    appNavigation.openTenseDetail(tense.item.code);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="tense-map">
      {offline ? (
        <AppText color="secondary" testID="tense-map-stale">
          {t('patternTense.offline_kept')}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <View style={styles.rowLabel} />
        {TENSE_ASPECTS.map(aspect => (
          <AppText
            color="secondary"
            key={aspect}
            style={styles.columnLabel}
            variant="caption"
          >
            {t(`patternTense.aspect_${aspect}`)}
          </AppText>
        ))}
      </View>
      {TENSE_TIMES.map((time, row) => (
        <View key={time} style={styles.row}>
          <AppText style={styles.rowLabel} variant="label">
            {t(`patternTense.time_${time}`)}
          </AppText>
          {grid.cells[row]!.map((tense, column) =>
            tense ? (
              <TenseCell
                key={tense.item.code}
                level={levelOf(tense)}
                onPress={() => open(tense)}
                tense={tense}
              />
            ) : (
              <View key={`${time}-${column}`} style={styles.cell} />
            ),
          )}
        </View>
      ))}
      {grid.others.length > 0 ? (
        <View style={styles.others}>
          <AppText color="secondary" variant="caption">
            {t('patternTense.other_tenses')}
          </AppText>
          <View style={styles.row}>
            {grid.others.map(tense => (
              <TenseCell
                key={tense.item.code}
                level={levelOf(tense)}
                onPress={() => open(tense)}
                tense={tense}
              />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.legend} testID="tense-map-legend">
        {LEVELS.map(level => (
          <View key={level} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                {backgroundColor: levelColors(theme, level).face},
              ]}
            />
            <AppText color="secondary" variant="caption">
              {t(`patternTense.level_${level}`)}
            </AppText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    cell: {
      borderRadius: theme.radius.md,
      flex: 1,
      justifyContent: 'center',
      minHeight: 64,
      padding: theme.spacing.xs,
    },
    cellText: {
      fontWeight: '700',
      textAlign: 'center',
    },
    columnLabel: {
      flex: 1,
      textAlign: 'center',
    },
    content: {
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },
    empty: {
      marginTop: theme.spacing.lg,
      textAlign: 'center',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    loading: {
      marginTop: 32,
    },
    message: {
      alignItems: 'center',
      gap: theme.spacing.md,
      marginTop: 32,
      paddingHorizontal: theme.spacing.md,
    },
    others: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    rowLabel: {
      alignSelf: 'center',
      width: 64,
    },
    swatch: {
      borderRadius: 4,
      height: 14,
      width: 14,
    },
  });
}
