import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {CourseLevel} from '../logic/courseClient';

type Props = {
  levels: CourseLevel[];
  selectedId: string;
  onSelect: (level: CourseLevel) => void;
  accessibilityHint: string;
  testID?: string;
};

const NOTCH = 9;

/**
 * A course's levels as boarding passes, side by side: the level code large,
 * its name under it, the chosen one filled. Each opens that level's units.
 */
export function LevelPassSwitcher({
  levels,
  selectedId,
  onSelect,
  accessibilityHint,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row} testID={testID}>
      {levels.map(level => {
        const selected = level.id === selectedId;
        return (
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={level.title}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            key={level.id}
            onPress={() => onSelect(level)}
            style={[
              themedStyles.pass,
              selected ? themedStyles.passOn : themedStyles.passOff,
            ]}
            testID={`course-levels-chip-${level.id}`}
          >
            <AppText
              style={[themedStyles.code, selected && themedStyles.codeOn]}
            >
              {level.code}
            </AppText>
            <AppText
              numberOfLines={1}
              style={[themedStyles.name, selected && themedStyles.nameOn]}
            >
              {levelName(level)}
            </AppText>
            <View
              style={[themedStyles.notch, styles.notchLeft]}
              pointerEvents="none"
            />
            <View
              style={[themedStyles.notch, styles.notchRight]}
              pointerEvents="none"
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** "A1 – Du lịch cơ bản" → "Du lịch cơ bản": the pass shows the code itself. */
export function levelName(level: Pick<CourseLevel, 'code' | 'title'>) {
  const rest = level.title
    .replace(new RegExp(`^\\s*${escapeRegExp(level.code)}\\s*[–—:-]?\\s*`), '')
    .trim();
  return rest.length > 0 ? rest : level.title;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const styles = StyleSheet.create({
  notchLeft: {
    left: -NOTCH,
  },
  notchRight: {
    right: -NOTCH,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    code: {
      color: theme.colors.text.primary,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 30,
    },
    codeOn: {
      color: theme.colors.accent,
    },
    name: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    nameOn: {
      color: theme.colors.text.inverse,
    },
    // Round cut-outs on both edges, in the page colour, like a ticket stub.
    notch: {
      backgroundColor: theme.colors.background,
      borderRadius: NOTCH,
      height: NOTCH * 2,
      marginTop: -NOTCH,
      position: 'absolute',
      top: '50%',
      width: NOTCH * 2,
    },
    pass: {
      borderRadius: 20,
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    passOff: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderWidth: 2,
    },
    passOn: {
      backgroundColor: theme.colors.primary,
    },
  });
}
