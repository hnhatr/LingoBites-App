/**
 * HomeSavedRail — saved lessons horizontal rail (LING-256, LING-267, §VS-5).
 *
 * Section title: "Bài đã lưu" (§VS-0 style)
 * "Xem tất cả ›" only when items.length > 0.
 * Cards are the Library's tone cards at rail width, colours cycling as in
 * the Library; the bookmark unsaves.
 * Empty state: dashed container with one sentence, no button.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {splitLessonTitle} from '@ui/components/LessonCard';
import {cardToneAt, ToneCard} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {LINK_HIT_SLOP, type RecentItem} from '../logic/homeScreenModel';
import {HomeIcon} from './HomeSvgIcons';

/** Width of one rail card: the next one peeks in at the edge. */
const RAIL_CARD_WIDTH = 270;

type Props = {
  items: RecentItem[];
  onItem: (item: RecentItem) => void;
  onViewAll: () => void;
  /** Unsaves a lesson from its card's bookmark. */
  onUnsave?: (item: RecentItem) => void;
};

export function HomeSavedRail({items, onItem, onViewAll, onUnsave}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const hasItems = items.length > 0;

  return (
    <View style={styles.section} testID="home-lessons-section">
      {/* Section header row (§VS-5) */}
      <View style={styles.sectionHeader}>
        <AppText style={styles.sectionTitle}>
          {t('home.saved_rail_title')}
        </AppText>
        {hasItems ? (
          <Pressable
            accessibilityLabel={t('home.saved_rail_view_all_a11y')}
            accessibilityRole="button"
            hitSlop={LINK_HIT_SLOP}
            onPress={onViewAll}
            style={styles.viewAllButton}
            testID="home-saved-view-all"
          >
            <AppText style={styles.viewAllText} numberOfLines={1}>
              {t('home.saved_rail_view_all')}
            </AppText>
            <HomeIcon
              name="chevron_right"
              size={20}
              color={theme.colors.primary}
            />
          </Pressable>
        ) : null}
      </View>

      {hasItems ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.railContent}
          showsHorizontalScrollIndicator={false}
          testID="home-continue-rail"
        >
          {items.map((item, index) => {
            const {title, subtitle} = splitLessonTitle(item.title);
            const meta = [
              item.minutes != null
                ? t('home.rail_minutes', {minutes: item.minutes})
                : null,
              item.isDownloaded ? t('home.rail_downloaded') : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const inProgress = item.progress?.state === 'in_progress';
            return (
              <ToneCard
                accessibilityHint={t('home.rail_open_hint')}
                action={{
                  label: inProgress
                    ? t('home.rail_continue')
                    : t('home.rail_open'),
                  glyph: 'play',
                  solid: true,
                }}
                bookmark={
                  onUnsave
                    ? {saved: true, onToggle: () => onUnsave(item)}
                    : undefined
                }
                cover={{
                  imageUrl: null,
                  glyph: item.sourceType === 'youtube' ? 'subtitles' : 'book',
                }}
                description={[subtitle, meta].filter(Boolean).join(' · ')}
                eyebrow={item.levelTitle ?? t(item.typeLabelKey)}
                gutter={theme.gutter}
                key={item.id}
                onPress={() => onItem(item)}
                testID={`home-recent-item-${item.id}`}
                title={title}
                tone={cardToneAt(index)}
                width={RAIL_CARD_WIDTH}
              />
            );
          })}
        </ScrollView>
      ) : (
        /* Empty state (§VS-5): dashed box with 1 sentence, no button */
        <View style={styles.emptyBox}>
          <AppText style={styles.emptyText}>
            {t('home.saved_rail_empty')}
          </AppText>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 10,
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    viewAllButton: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    railContent: {
      gap: 12,
      paddingBottom: 8,
      paddingRight: 16,
      paddingTop: 4,
    },
    emptyBox: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.text.muted,
      borderRadius: 18,
      borderStyle: 'dashed',
      borderWidth: 2,
      justifyContent: 'center',
      padding: 16,
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
}
