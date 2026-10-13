import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {ComboOptions} from '../logic/comboClient';

type Tense = ComboOptions['tenses'][number];

const TIMES = ['past', 'present', 'future'] as const;
const ASPECTS = [
  'simple',
  'continuous',
  'perfect',
  'perfect_continuous',
] as const;

type Props = {
  tenses: Tense[];
  selected: string | null;
  onSelect: (code: string) => void;
};

/**
 * Vocab path P5: the tenses as a time x aspect grid. A cell the Server did not
 * offer stays empty; a tense outside the grid shows as a chip below it.
 */
export function TenseGrid({tenses, selected, onSelect}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  const byCell = new Map(
    tenses.map(tense => [`${tense.time}:${tense.aspect}`, tense]),
  );
  const outside = tenses.filter(
    tense =>
      !(TIMES as readonly string[]).includes(tense.time) ||
      !(ASPECTS as readonly string[]).includes(tense.aspect),
  );
  const picked = tenses.find(tense => tense.code === selected);

  return (
    <View style={styles.wrap}>
      <View style={themedStyles.grid}>
        <View style={styles.row}>
          <View style={styles.rowHead} />
          {ASPECTS.map(aspect => (
            <AppText
              color="muted"
              key={aspect}
              numberOfLines={2}
              style={styles.colHead}
              variant="caption"
            >
              {t(`combo.setup.aspect.${aspect}`)}
            </AppText>
          ))}
        </View>
        {TIMES.map(time => (
          <View key={time} style={styles.row}>
            <AppText color="secondary" style={styles.rowHead} variant="label">
              {t(`combo.setup.time.${time}`)}
            </AppText>
            {ASPECTS.map(aspect => {
              const tense = byCell.get(`${time}:${aspect}`);
              if (!tense) {
                return <View key={aspect} style={styles.cell} />;
              }
              const on = tense.code === selected;
              return (
                <Pressable
                  accessibilityHint={t('combo.setup.tense_hint')}
                  accessibilityLabel={tense.name_en}
                  accessibilityRole="radio"
                  accessibilityState={{selected: on}}
                  key={aspect}
                  onPress={() => onSelect(tense.code)}
                  style={[
                    styles.cell,
                    themedStyles.cellButton,
                    on && themedStyles.cellOn,
                  ]}
                  testID={`combo-setup-tense-${tense.code}`}
                >
                  {on ? (
                    <MaterialIcon
                      color={theme.colors.text.inverse}
                      name="check_circle"
                      size={18}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {outside.length > 0 ? (
        <View style={styles.chips}>
          {outside.map(tense => (
            <Chip
              key={tense.code}
              label={tense.name_en}
              onPress={() => onSelect(tense.code)}
              selected={tense.code === selected}
              testID={`combo-setup-tense-${tense.code}`}
            />
          ))}
        </View>
      ) : null}
      {picked ? (
        <View style={themedStyles.picked} testID="combo-setup-tense-picked">
          <AppText color="secondary" variant="label">
            {t('combo.setup.tense_picked')}
          </AppText>
          <AppText style={themedStyles.pickedName} variant="label">
            {picked.name_en}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    height: 40,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colHead: {
    flex: 1,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  rowHead: {
    width: 64,
  },
  wrap: {
    gap: 8,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    cellButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceLow,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
    },
    cellOn: {
      backgroundColor: theme.colors.primary,
    },
    grid: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    picked: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    pickedName: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.bold,
    },
  });
}
