import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {LibraryCover} from '@ui/components/LibraryCover';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import type {LessonSnapshot} from '@core/schemas/lesson';

/** Most cards shown; the "Từ & cụm" section lists them all. */
const RAIL_LIMIT = 10;

type Props = {
  snapshot: LessonSnapshot;
  /** Item id → picture URL (from the lesson pictures). */
  itemImages: ReadonlyMap<string, string>;
  /** Opens the words & phrases section. */
  onOpen: () => void;
};

/**
 * The lesson's words and phrases as picture cards, so the overview shows
 * what the lesson teaches at a glance. Items without a picture get the
 * default cover. Hidden when the lesson has no words or phrases.
 */
export function LessonItemPictureRail({snapshot, itemImages, onOpen}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const items = useMemo(
    () =>
      [...(snapshot.lesson_items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(entry => entry.item)
        .filter(item => item.kind === 'word' || item.kind === 'phrase'),
    [snapshot],
  );

  if (items.length === 0) return null;
  return (
    <View style={styles.section} testID="canonical-hub-item-rail">
      <View style={styles.titleRow}>
        <AppText variant="h3">
          {t('lessonPlayer.explore_items_vocabulary_title')}
        </AppText>
        <Pressable
          accessibilityHint={t('lessonPlayer.item_rail_all_hint')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpen}
          testID="canonical-hub-item-rail-all"
        >
          <AppText color="primary" variant="label">
            {t('lessonPlayer.item_rail_all', {count: items.length})}
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {items.slice(0, RAIL_LIMIT).map(item => (
          <Pressable
            accessibilityHint={t('lessonPlayer.item_rail_all_hint')}
            accessibilityLabel={`${item.text}, ${item.meaning_vi}`}
            accessibilityRole="button"
            key={item.id}
            onPress={onOpen}
            style={styles.card}
            testID={`canonical-hub-item-${item.id}`}
          >
            <View style={styles.picture}>
              <LibraryCover
                compact
                glyph={item.kind === 'phrase' ? 'chat' : 'cards'}
                imageUrl={itemImages.get(item.id) ?? null}
                shape="pack"
                testID={`canonical-hub-item-${item.id}-cover`}
              />
            </View>
            <View style={styles.copy}>
              <AppText numberOfLines={1} style={styles.text}>
                {item.text}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {item.meaning_vi}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
    },
    titleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    rail: {
      gap: 10,
      paddingBottom: 6,
      paddingRight: theme.spacing.sm,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      width: 116,
      ...getStickerFace(theme, 3),
    },
    picture: {
      // Round the top here, not on the card, so its hard shadow survives.
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      overflow: 'hidden',
    },
    copy: {
      gap: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    text: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
