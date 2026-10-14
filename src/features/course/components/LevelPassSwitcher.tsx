import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

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

const NOTCH = 6;

/**
 * A course's levels as small ticket stubs in one row that scrolls sideways,
 * so B1, B2… fit: the level code, then its name, the chosen one filled.
 * Each opens that level's units.
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
    <ScrollView
      contentContainerStyle={themedStyles.row}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={themedStyles.scroller}
      testID={testID}
    >
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
    </ScrollView>
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
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    code: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
    },
    codeOn: {
      color: theme.colors.accent,
    },
    name: {
      color: theme.colors.text.secondary,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      maxWidth: 160,
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
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      minHeight: 44,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    passOff: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderWidth: 1.5,
    },
    passOn: {
      backgroundColor: theme.colors.primary,
    },
    row: {
      gap: 8,
      paddingHorizontal: theme.gutter,
    },
    // Runs to the screen edges so a long row scrolls past the sheet padding.
    scroller: {
      flexGrow: 0,
      marginHorizontal: -theme.gutter,
    },
  });
}
