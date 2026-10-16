import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppTabs} from '@ui/components/AppTabs';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {PatternRow} from '../components/PatternRow';
import {
  filterPatterns,
  functionLabels,
  type LibraryFilter,
  patternLevels,
} from '../logic/libraryModel';
import {memoryOf} from '../logic/libraryRepository';
import {usePatternLibrary} from '../logic/useLibrary';

type ChipRowProps = {
  label: string;
  options: LibraryFilter[];
  value: string | null;
  onChange: (code: string | null) => void;
  testID: string;
};

/** One filter: "Tất cả" and one chip per option; a second press clears it. */
function ChipRow({label, options, value, onChange, testID}: ChipRowProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (options.length === 0) return null;
  return (
    <View style={styles.chipBlock} testID={testID}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <ScrollView
        horizontal
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
      >
        <Chip
          label={t('patternTense.filter_all')}
          onPress={() => onChange(null)}
          selected={value === null}
          testID={`${testID}-all`}
        />
        {options.map(option => (
          <Chip
            key={option.code}
            label={option.labelVi}
            onPress={() => onChange(value === option.code ? null : option.code)}
            selected={value === option.code}
            testID={`${testID}-${option.code}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Vocab path P6 (F2): the pattern library, a Library section. Filter by what
 * the learner wants to say (function), by level and by exam; the search box
 * above matches the frame or its meaning. Works offline on the kept list.
 */
export function PatternLibraryList({query}: {query: string}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const {data, loading, offline, reload} = usePatternLibrary();
  const [functionCode, setFunctionCode] = useState<string | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [examCode, setExamCode] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      data
        ? filterPatterns(data.patterns, {
            text: query,
            functionCode,
            cefrLevel,
            examCode,
          })
        : [],
    [data, query, functionCode, cefrLevel, examCode],
  );

  if (!data) {
    return loading ? (
      <ActivityIndicator style={styles.loading} />
    ) : (
      <View style={styles.message} testID="pattern-library-offline">
        <AppText color="secondary">{t('patternTense.needs_network')}</AppText>
        <AppButton
          onPress={reload}
          title={t('patternTense.retry')}
          variant="outline"
        />
      </View>
    );
  }

  const levels = patternLevels(data.patterns);
  // Level counts follow the other filters, so each tab says what it opens.
  const otherFilters = filterPatterns(data.patterns, {
    text: query,
    functionCode,
    cefrLevel: null,
    examCode,
  });
  const levelTabs = [
    {
      id: 'all',
      label: t('patternTense.filter_all'),
      count: otherFilters.length,
    },
    ...levels.map(level => ({
      id: level,
      label: level,
      count: otherFilters.filter(pattern => pattern.cefrLevel === level).length,
    })),
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      testID="pattern-library-list"
    >
      {offline ? (
        <AppText color="secondary" testID="pattern-library-stale">
          {t('patternTense.offline_kept')}
        </AppText>
      ) : null}
      <ChipRow
        label={t('patternTense.filter_function')}
        onChange={setFunctionCode}
        options={data.functions}
        testID="pattern-filter-function"
        value={functionCode}
      />
      {levels.length > 0 ? (
        <AppTabs
          accessibilityHint={t('patternTense.filter_level')}
          onChange={id => setCefrLevel(id === 'all' ? null : id)}
          tabs={levelTabs}
          testID="pattern-filter-level"
          value={cefrLevel ?? 'all'}
        />
      ) : null}
      <ChipRow
        label={t('patternTense.filter_exam')}
        onChange={setExamCode}
        options={data.exams}
        testID="pattern-filter-exam"
        value={examCode}
      />
      {shown.length === 0 ? (
        <AppText color="secondary" style={styles.empty}>
          {t('patternTense.no_patterns')}
        </AppText>
      ) : (
        <>
          <AppText color="muted" variant="caption">
            {t('patternTense.pattern_count', {count: shown.length})}
          </AppText>
          {shown.map(pattern => (
            <PatternRow
              inReview={memoryOf(pattern.item.code) !== null}
              item={pattern.item}
              key={pattern.item.code}
              labels={functionLabels(pattern, data.functions)}
              level={pattern.cefrLevel}
              onPress={() => appNavigation.openPatternDetail(pattern.item.code)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chipBlock: {
      gap: theme.spacing.xs,
    },
    chips: {
      gap: theme.spacing.xs,
      paddingVertical: 2,
    },
    content: {
      gap: 14,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.xs,
    },
    empty: {
      marginTop: theme.spacing.lg,
      textAlign: 'center',
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
  });
}
