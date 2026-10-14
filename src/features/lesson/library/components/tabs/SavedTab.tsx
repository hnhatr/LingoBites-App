import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {listLocalComboSets} from '@features/combo';
import {getDueFlashcards} from '@features/review';

import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {type LibrarySectionKey, useAppNavigation} from '@core/navigation';

import {
  useLibrarySegments,
  useRefreshOnRefocus,
} from '../../logic/useLibrarySegments';
import {ToneCard} from '../ExploreCards';
import {LibraryShelf} from '../LibraryShelf';
import type {CardTone} from '../libraryTones';
import {KindCard} from '../ToneTiles';

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
  tone: CardTone;
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
      <LibraryShelf
        label="đã lưu"
        subtitle="Từ, ngữ pháp và bộ câu bạn đã lưu"
        title="Đã lưu"
        tone="coral"
      >
        {dueCount > 0 ? (
          <ToneCard
            accessibilityHint="Mở phần ôn tập"
            action={{label: 'Ôn ngay', glyph: 'play', solid: true}}
            cover={{imageUrl: null, glyph: 'cards'}}
            description={`${dueCount} từ đến hạn ôn`}
            eyebrow="Ôn tập"
            gutter={theme.gutter}
            onPress={() => appNavigation.openReview()}
            testID="library-saved-review"
            title="Ôn hôm nay"
            tone="tertiary"
          />
        ) : null}
        {nothingSaved ? (
          <View style={styles.hint} testID="library-saved-hint">
            <MaterialIcon
              color={theme.colors.secondary}
              name="heart"
              size={18}
            />
            <AppText color="secondary" style={styles.grow} variant="caption">
              Bấm ♡ trong bài học để lưu từ và quy tắc
            </AppText>
          </View>
        ) : null}
        {kinds.map(kind => (
          <KindCard
            accessibilityHint={`Mở danh sách ${kind.title}`}
            count={kind.items.length}
            emptyText="Chưa có mục nào"
            icon={kind.icon}
            items={kind.items.slice(0, SAVED_PREVIEW_LIMIT)}
            key={kind.id}
            onPress={() => appNavigation.openLibrarySection(kind.id)}
            testID={`library-saved-${kind.id}`}
            title={kind.title}
            tone={kind.tone}
          />
        ))}
      </LibraryShelf>
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      padding: theme.gutter,
    },
    loading: {
      marginTop: theme.spacing.xl,
    },
    grow: {
      flex: 1,
    },
    hint: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
