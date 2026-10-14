import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {listLocalComboSets} from '@features/combo';
import {getDueFlashcards} from '@features/review';

import {AppText} from '@ui/components/AppText';
import type {GridTileTone} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getHardShadow} from '@ui/theme/hardShadow';

import {type LibrarySectionKey, useAppNavigation} from '@core/navigation';

import {
  useLibrarySegments,
  useRefreshOnRefocus,
} from '../../logic/useLibrarySegments';
import {shelfTone} from '../LibraryShelf';

/** How many saved items a kind card previews. */
export const SAVED_PREVIEW_LIMIT = 4;

/** "word:coffee" → "coffee": the readable part of a catalog item code. */
export function itemCodeLabel(code: string): string {
  return code.slice(code.indexOf(':') + 1);
}

interface SavedKind {
  id: LibrarySectionKey;
  title: string;
  icon: HandoffIconName;
  tone: GridTileTone;
  items: string[];
}

/**
 * "Đã lưu": today's review first, then the saved words, grammar rules and
 * sentence sets, each with a few of its items so the learner sees what is
 * inside without opening it.
 */
export function SavedTab() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  // Read the saved items once the tab has been drawn, so switching to it is
  // not held up by the local read.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  const {vocabulary, grammar, refresh} = useLibrarySegments({
    vocabulary: ready,
    grammar: ready,
  });
  // Cards due today and the sentence sets, read beside the saved items.
  const [local, setLocal] = useState<{
    dueCount: number;
    combos: ReturnType<typeof listLocalComboSets>;
  }>({dueCount: 0, combos: []});
  const readLocal = useCallback(() => {
    setLocal({
      dueCount: getDueFlashcards().length,
      combos: listLocalComboSets(),
    });
  }, []);
  useEffect(() => {
    if (ready) readLocal();
  }, [ready, readLocal]);
  const {dueCount, combos} = local;

  const refreshAll = useCallback(() => {
    refresh();
    readLocal();
  }, [refresh, readLocal]);
  useRefreshOnRefocus(refreshAll);

  if (!ready) {
    return (
      <ActivityIndicator color={theme.colors.primary} style={styles.loading} />
    );
  }

  const kinds: SavedKind[] = [
    {
      id: 'vocabulary',
      title: 'Từ vựng',
      icon: 'translate',
      tone: 'accent',
      items: vocabulary.map(card => card.word),
    },
    {
      id: 'grammar',
      title: 'Ngữ pháp',
      icon: 'rule',
      tone: 'secondary',
      items: grammar.map(bookmark => bookmark.title ?? bookmark.grammarId),
    },
    {
      id: 'combos',
      title: 'Bộ câu',
      icon: 'style',
      tone: 'tertiary',
      items: combos.map(set => itemCodeLabel(set.itemCode)),
    },
  ];
  const nothingSaved = kinds.every(kind => kind.items.length === 0);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
      testID="library-saved-tab"
    >
      {dueCount > 0 ? (
        <Pressable
          accessibilityHint="Mở phần ôn tập"
          accessibilityLabel={`Ôn hôm nay. ${dueCount} từ đến hạn ôn`}
          accessibilityRole="button"
          onPress={() => appNavigation.openReview()}
          style={({pressed}) => [
            styles.review,
            {
              backgroundColor: solidOver(
                theme.colors.tertiarySoft,
                theme.colors.surface,
              ),
            },
            pressed && styles.pressed,
          ]}
          testID="library-saved-review"
        >
          <View style={styles.grow}>
            <AppText style={styles.reviewTitle}>Ôn hôm nay</AppText>
            <AppText
              style={[
                styles.reviewMeta,
                {color: theme.colors.onTertiaryContainer},
              ]}
              testID="library-saved-due"
            >
              {`${dueCount} từ đến hạn ôn`}
            </AppText>
          </View>
          <View style={styles.play}>
            <MaterialIcon
              color={theme.colors.surface}
              name="play_arrow"
              size={28}
            />
          </View>
        </Pressable>
      ) : null}
      {nothingSaved ? (
        <View style={styles.hint} testID="library-saved-hint">
          <MaterialIcon color={theme.colors.secondary} name="heart" size={18} />
          <AppText color="secondary" style={styles.grow} variant="caption">
            Bấm ♡ trong bài học để lưu từ và quy tắc
          </AppText>
        </View>
      ) : null}
      {kinds.map(kind => {
        const {face, ink} = shelfTone(theme, kind.tone);
        const preview = kind.items.slice(0, SAVED_PREVIEW_LIMIT);
        return (
          <Pressable
            accessibilityHint={`Mở danh sách ${kind.title}`}
            accessibilityLabel={`${kind.title}. ${kind.items.length}`}
            accessibilityRole="button"
            key={kind.id}
            onPress={() => appNavigation.openLibrarySection(kind.id)}
            style={({pressed}) => [styles.kind, pressed && styles.pressedSoft]}
            testID={`library-saved-${kind.id}`}
          >
            <View style={styles.kindHead}>
              <View style={[styles.kindIcon, {backgroundColor: face}]}>
                <MaterialIcon color={ink} name={kind.icon} size={18} />
              </View>
              <AppText style={[styles.kindTitle, styles.grow]}>
                {kind.title}
              </AppText>
              <AppText
                style={styles.kindCount}
                testID={`library-saved-${kind.id}-count`}
              >
                {kind.items.length}
              </AppText>
              <MaterialIcon
                color={theme.colors.text.muted}
                name="chevron_right"
                size={22}
              />
            </View>
            {preview.length > 0 ? (
              <View style={styles.chips}>
                {preview.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.chip}>
                    <AppText numberOfLines={1} style={styles.chipText}>
                      {item}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
    grow: {
      flex: 1,
    },
    review: {
      alignItems: 'center',
      borderRadius: 22,
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      ...getHardShadow(4, theme.colors.ink),
    },
    pressed: {
      transform: [{translateY: 3}],
      ...getHardShadow(1, theme.colors.ink),
    },
    pressedSoft: {
      opacity: theme.states.pressedOpacity,
    },
    reviewTitle: {
      fontSize: 17,
      fontWeight: '800',
    },
    reviewMeta: {
      fontSize: 13,
      fontWeight: '700',
    },
    play: {
      alignItems: 'center',
      backgroundColor: theme.colors.ink,
      borderRadius: 23,
      height: 46,
      justifyContent: 'center',
      width: 46,
    },
    hint: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    kind: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md + 2,
      paddingVertical: theme.spacing.md,
    },
    kindHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    kindIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    kindTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    kindCount: {
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs + 2,
    },
    chip: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      maxWidth: '100%',
      paddingHorizontal: theme.spacing.md - 2,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
