import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {frameText} from '../logic/frameText';
import {
  filterPatterns,
  functionLabels,
  type LibraryFilter,
  patternLevels,
} from '../logic/libraryModel';
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
    <View accessibilityLabel={label} style={styles.chipBlock} testID={testID}>
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

  const levels = patternLevels(data.patterns).map(level => ({
    code: level,
    labelVi: level,
  }));

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
      <ChipRow
        label={t('patternTense.filter_level')}
        onChange={setCefrLevel}
        options={levels}
        testID="pattern-filter-level"
        value={cefrLevel}
      />
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
        shown.map(pattern => {
          const labels = [
            pattern.cefrLevel,
            ...functionLabels(pattern, data.functions),
          ].filter(Boolean);
          return (
            <Pressable
              accessibilityHint={t('patternTense.open_pattern_hint')}
              accessibilityRole="button"
              key={pattern.item.code}
              onPress={() => appNavigation.openPatternDetail(pattern.item.code)}
              testID={`pattern-row-${pattern.item.code}`}
            >
              <AppCard style={styles.card}>
                <AppText variant="subtitle">{frameText(pattern.item)}</AppText>
                <AppText color="secondary">{pattern.item.meaning_vi}</AppText>
                {labels.length > 0 ? (
                  <AppText color="muted" variant="caption">
                    {labels.join(' · ')}
                  </AppText>
                ) : null}
              </AppCard>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    chipBlock: {
      gap: theme.spacing.xs,
    },
    chips: {
      gap: theme.spacing.xs,
      paddingVertical: 2,
    },
    content: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
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
