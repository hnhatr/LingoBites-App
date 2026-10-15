import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {ComboOptions} from '../logic/comboClient';
import {comboEdges} from './comboEdges';

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

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "Hiện tại đơn": the Vietnamese name from the grid's time and aspect. */
export function tenseNameVi(t: Translate, tense: Tense): string {
  const inGrid =
    (TIMES as readonly string[]).includes(tense.time) &&
    (ASPECTS as readonly string[]).includes(tense.aspect);
  return inGrid
    ? `${t(`combo.setup.time.${tense.time}`)} ${t(
        `combo.setup.aspect_full.${tense.aspect}`,
      )}`
    : tense.name_en;
}

/** How many of the 12 grid cells the Server offers. */
export function openTenseCount(tenses: Tense[]): number {
  return tenses.filter(
    tense =>
      (TIMES as readonly string[]).includes(tense.time) &&
      (ASPECTS as readonly string[]).includes(tense.aspect),
  ).length;
}

/**
 * Vocab path P5: the tenses as a time x aspect grid. A cell the Server did not
 * offer shows a lock; a tense outside the grid shows as a chip below it.
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
    <View style={themedStyles.grid}>
      <View style={styles.row}>
        <View style={styles.rowHead} />
        {ASPECTS.map(aspect => (
          <AppText
            color="muted"
            key={aspect}
            numberOfLines={2}
            style={styles.colHead}
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
              return (
                <View
                  accessibilityHint={t('combo.setup.tense_locked_hint')}
                  accessibilityLabel={t('combo.setup.tense_locked', {
                    name: `${t(`combo.setup.time.${time}`)} ${t(
                      `combo.setup.aspect_full.${aspect}`,
                    )}`,
                  })}
                  accessible
                  key={aspect}
                  style={[styles.cell, themedStyles.cellLocked]}
                >
                  <MaterialIcon
                    color={theme.colors.outline}
                    name="lock"
                    size={14}
                  />
                </View>
              );
            }
            const on = tense.code === selected;
            return (
              <Pressable
                accessibilityHint={t('combo.setup.tense_hint')}
                accessibilityLabel={tenseNameVi(t, tense)}
                accessibilityRole="radio"
                accessibilityState={{selected: on}}
                key={aspect}
                onPress={() => onSelect(tense.code)}
                style={[
                  styles.cell,
                  themedStyles.cellOpen,
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
          <AppText color="muted" variant="label">
            {t('combo.setup.tense_picked')}
          </AppText>
          <AppText style={themedStyles.pickedName} variant="label">
            {tenseNameVi(t, picked)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colHead: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  rowHead: {
    width: 64,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    cellLocked: {
      borderColor: theme.colors.outlineVariant,
      borderStyle: 'dashed',
      borderWidth: 1.5,
    },
    cellOpen: {
      backgroundColor: theme.colors.accentSoft,
    },
    cellOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(3, comboEdges(theme).teal),
    },
    grid: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      gap: 6,
      padding: 12,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    picked: {
      alignItems: 'center',
      borderTopColor: theme.colors.surfaceHigh,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.xs,
      paddingHorizontal: 2,
      paddingTop: 9,
    },
    pickedName: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.bold,
    },
  });
}
