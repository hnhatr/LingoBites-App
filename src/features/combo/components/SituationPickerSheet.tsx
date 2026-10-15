import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type Situation = {code: string; title_vi: string; title_en?: string};

type Props = {
  situations: Situation[];
  selected: string | null;
  bookmarks: string[];
  recent: string[];
  onSelect: (code: string) => void;
  onToggleBookmark: (code: string) => void;
  onDismiss: () => void;
};

/** Lower case without Vietnamese marks, so "nha hang" finds "Nhà hàng". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Vocab path P5: bottom sheet to pick the situation of a combo set. With no
 * search it lists the bookmarked, the recently used and then all situations;
 * a search lists the matches, bookmarked first.
 */
export function SituationPickerSheet({
  situations,
  selected,
  bookmarks,
  recent,
  onSelect,
  onToggleBookmark,
  onDismiss,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const needle = fold(query.trim());
  const saved = situations.filter(entry => bookmarks.includes(entry.code));
  const recentEntries = recent
    .filter(code => !bookmarks.includes(code))
    .map(code => situations.find(entry => entry.code === code))
    .filter((entry): entry is Situation => entry !== undefined);
  const matches = situations
    .filter(entry => fold(entry.title_vi).includes(needle))
    .sort(
      (a, b) =>
        Number(bookmarks.includes(b.code)) - Number(bookmarks.includes(a.code)),
    );

  const renderRow = (entry: Situation, section: string) => {
    const on = entry.code === selected;
    const marked = bookmarks.includes(entry.code);
    return (
      <View key={`${section}-${entry.code}`} style={themedStyles.row}>
        <Pressable
          accessibilityHint={t('combo.setup.situation_pick_hint')}
          accessibilityLabel={entry.title_vi}
          accessibilityRole="radio"
          accessibilityState={{selected: on}}
          onPress={() => onSelect(entry.code)}
          style={({pressed}) => [
            styles.rowMain,
            pressed && themedStyles.pressed,
          ]}
          testID={`combo-setup-situation-${entry.code}`}
        >
          <AppText
            style={on ? themedStyles.selectedText : undefined}
            variant="body"
          >
            {entry.title_vi}
          </AppText>
          {on ? (
            <MaterialIcon
              color={theme.colors.primary}
              name="check_circle"
              size={20}
            />
          ) : null}
        </Pressable>
        <Pressable
          accessibilityHint={t('combo.setup.bookmark_hint')}
          accessibilityLabel={
            marked
              ? t('combo.setup.unbookmark', {name: entry.title_vi})
              : t('combo.setup.bookmark', {name: entry.title_vi})
          }
          accessibilityRole="button"
          accessibilityState={{selected: marked}}
          hitSlop={8}
          onPress={() => onToggleBookmark(entry.code)}
          style={styles.bookmark}
          testID={`combo-setup-bookmark-${entry.code}`}
        >
          <MaterialIcon
            color={marked ? theme.colors.primary : theme.colors.outline}
            name={marked ? 'bookmark' : 'bookmark_add'}
            size={22}
          />
        </Pressable>
      </View>
    );
  };

  const heading = (label: string) => (
    <AppText color="muted" style={styles.heading} variant="caption">
      {label}
    </AppText>
  );

  return (
    <Modal animationType="slide" onRequestClose={onDismiss} transparent visible>
      <Pressable
        accessibilityHint={t('combo.setup.close_hint')}
        accessibilityLabel={t('combo.setup.close')}
        onPress={onDismiss}
        style={themedStyles.backdrop}
      />
      <View style={themedStyles.sheet} testID="combo-setup-situation-sheet">
        <View style={styles.head}>
          <AppText variant="h3">{t('combo.setup.situation_pick')}</AppText>
          <Pressable
            accessibilityHint={t('combo.setup.close_hint')}
            accessibilityLabel={t('combo.setup.close')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDismiss}
            testID="combo-setup-situation-close"
          >
            <MaterialIcon
              color={theme.colors.text.secondary}
              name="close"
              size={24}
            />
          </Pressable>
        </View>
        <TextField
          accessibilityHint={t('combo.setup.situation_search_hint')}
          accessibilityLabel={t('combo.setup.situation_search')}
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={t('combo.setup.situation_search')}
          returnKeyType="search"
          testID="combo-setup-situation-search"
          value={query}
        />
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {needle ? (
            matches.length > 0 ? (
              matches.map(entry => renderRow(entry, 'match'))
            ) : (
              <AppText
                color="muted"
                style={styles.empty}
                testID="combo-setup-situation-empty"
              >
                {t('combo.setup.situation_none', {query: query.trim()})}
              </AppText>
            )
          ) : (
            <>
              {saved.length > 0 ? (
                <>
                  {heading(t('combo.setup.situation_saved'))}
                  {saved.map(entry => renderRow(entry, 'saved'))}
                </>
              ) : (
                <AppText color="muted" style={styles.hint} variant="caption">
                  {t('combo.setup.situation_saved_hint')}
                </AppText>
              )}
              {recentEntries.length > 0 ? (
                <>
                  {heading(t('combo.setup.situation_recent'))}
                  {recentEntries.map(entry => renderRow(entry, 'recent'))}
                </>
              ) : null}
              {heading(t('combo.setup.situation_all'))}
              {situations.map(entry => renderRow(entry, 'all'))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bookmark: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  empty: {
    paddingVertical: 24,
    textAlign: 'center',
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    letterSpacing: 0.5,
    paddingTop: 12,
    textTransform: 'uppercase',
  },
  hint: {
    paddingTop: 4,
  },
  list: {
    paddingBottom: 24,
  },
  rowMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingRight: 4,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      alignItems: 'center',
      borderBottomColor: theme.colors.surfaceHigh,
      borderBottomWidth: 1,
      flexDirection: 'row',
    },
    selectedText: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.bold,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      height: '80%',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
  });
}
