/**
 * HomeSavedRail — saved lessons horizontal rail (LING-256, LING-267, §VS-5).
 *
 * Section title: "Bài đã lưu" (§VS-0 style)
 * "Xem tất cả ›" only when items.length > 0.
 * Thumbs use SVG HomeIcon (no MaterialIcon).
 * Empty state: dashed container with one sentence, no button.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {LINK_HIT_SLOP, type RecentItem} from '../logic/homeScreenModel';
import {getHardShadow} from './HomeDecorations';
import {HomeIcon} from './HomeSvgIcons';

function railMetaLine(
  t: (key: string, opts?: Record<string, string | number>) => string,
  item: RecentItem,
): string {
  const typeLabel = t(item.typeLabelKey);
  if (item.minutes == null) {
    return typeLabel;
  }
  return t('home.rail_meta', {type: typeLabel, minutes: item.minutes});
}

type Props = {
  items: RecentItem[];
  onItem: (item: RecentItem) => void;
  onViewAll: () => void;
};

export function HomeSavedRail({items, onItem, onViewAll}: Props) {
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
          {items.map(item => (
            <Pressable
              accessibilityLabel={`${item.title}, ${railMetaLine(t, item)}`}
              accessibilityRole="button"
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              key={item.id}
              onPress={() => onItem(item)}
              testID={`home-recent-item-${item.id}`}
              style={styles.cardWrap}
            >
              {({pressed}) => (
                <View style={[styles.card, pressed && styles.cardPressed]}>
                  {/* Thumb: 48x48 radius 14 accentSoft with 26pt primary SVG icon */}
                  <View style={styles.thumb}>
                    <HomeIcon
                      name={
                        item.icon === 'play_circle' ? 'play_circle' : 'article'
                      }
                      size={26}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={styles.copy}>
                    {/* Tags row (§VS-5) */}
                    <View style={styles.topRow}>
                      {item.levelTitle ? (
                        <View style={styles.levelTag}>
                          <AppText style={styles.levelTagLabel}>
                            {item.levelTitle}
                          </AppText>
                        </View>
                      ) : null}
                      {item.isDownloaded ? (
                        <View style={styles.savedTag}>
                          <HomeIcon
                            name="bookmark"
                            size={12}
                            color={theme.colors.onTertiaryContainer}
                          />
                          <AppText style={styles.savedTagLabel}>
                            {t('home.rail_saved')}
                          </AppText>
                        </View>
                      ) : null}
                    </View>

                    {/* Title: 14/18 weight 700 */}
                    <AppText style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </AppText>

                    {/* Meta: 12pt weight 600 */}
                    <AppText style={styles.itemMeta} numberOfLines={1}>
                      {railMetaLine(t, item)}
                    </AppText>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
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
      gap: 10,
      paddingBottom: 8,
      paddingRight: 16,
    },
    cardWrap: {
      width: 230,
    },
    card: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.ink,
      borderRadius: 18,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 10,
      minHeight: 96,
      padding: 12,
      ...getHardShadow(4, theme.colors.ink),
    },
    cardPressed: {
      transform: [{translateY: 2}],
      ...getHardShadow(2, theme.colors.ink),
    },
    thumb: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 14,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    copy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 3,
    },
    levelTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    levelTagLabel: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    savedTag: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 6,
      flexDirection: 'row',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    savedTagLabel: {
      color: theme.colors.onTertiaryContainer,
      fontSize: 11,
      fontWeight: '800',
    },
    itemTitle: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    },
    itemMeta: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '600',
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
