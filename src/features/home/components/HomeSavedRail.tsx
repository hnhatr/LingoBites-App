/**
 * HomeSavedRail — saved lessons horizontal rail (DQ-006).
 *
 * Section title is "Bài đã lưu" / "Saved lessons" (renamed from "Tiếp tục học").
 * "Xem tất cả" navigates to the Lessons tab.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {LINK_HIT_SLOP, type RecentItem} from '../logic/homeScreenModel';

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
  onCreateFirst?: () => void;
};

export function HomeSavedRail({
  items,
  onItem,
  onViewAll,
  onCreateFirst,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section} testID="home-lessons-section">
      {/* Section header — "Bài đã lưu" (DQ-006) */}
      <View style={styles.sectionHeader}>
        <AppText variant="h3" style={styles.sectionTitle}>
          {t('home.saved_rail_title')}
        </AppText>
        <Pressable
          accessibilityLabel={t('home.saved_rail_view_all_a11y')}
          accessibilityRole="button"
          hitSlop={LINK_HIT_SLOP}
          onPress={onViewAll}
          style={styles.textLink}
          testID="home-saved-view-all"
        >
          <AppText
            variant="label"
            style={styles.textLinkLabel}
            numberOfLines={1}
          >
            {t('home.saved_rail_view_all')}
          </AppText>
        </Pressable>
      </View>

      {items.length > 0 ? (
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
              key={item.id}
              onPress={() => onItem(item)}
              testID={`home-recent-item-${item.id}`}
              style={styles.cardWrap}
            >
              {({pressed}) => (
                <View style={[styles.card, pressed && styles.pressed]}>
                  <View style={styles.thumb}>
                    <MaterialIcon
                      color={theme.colors.primary}
                      name={item.icon}
                      size={24}
                    />
                  </View>
                  <View style={styles.copy}>
                    <View style={styles.topRow}>
                      {item.levelTitle ? (
                        <View style={styles.tag}>
                          <AppText variant="caption" style={styles.tagLabel}>
                            {item.levelTitle}
                          </AppText>
                        </View>
                      ) : null}
                      {item.isDownloaded ? (
                        <View style={styles.savedTag}>
                          <AppText variant="caption" style={styles.savedLabel}>
                            {t('home.rail_saved')}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                    <AppText variant="label" numberOfLines={2}>
                      {item.title}
                    </AppText>
                    <AppText color="muted" variant="caption" numberOfLines={1}>
                      {railMetaLine(t, item)}
                    </AppText>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <AppText color="secondary">{t('home.saved_rail_empty')}</AppText>
          {onCreateFirst ? (
            <AppButton
              accessibilityLabel={t('home.empty_create_a11y')}
              title={t('home.empty_create')}
              variant="primary-accent"
              onPress={onCreateFirst}
              testID="home-lessons-create"
              style={styles.fullWidthButton}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {gap: theme.spacing.md},
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'space-between',
    },
    sectionTitle: {flex: 1, minWidth: 0},
    textLink: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    textLinkLabel: {color: theme.colors.primary},
    railContent: {
      gap: theme.spacing.sm,
      paddingRight: theme.gutter,
    },
    cardWrap: {width: 248},
    card: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 96,
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    thumb: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 14,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    copy: {flex: 1, gap: 4, minWidth: 0},
    topRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    tag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    tagLabel: {color: theme.colors.primary},
    savedTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    savedLabel: {color: theme.colors.onTertiaryContainer},
    empty: {gap: theme.spacing.md},
    fullWidthButton: {
      alignSelf: 'stretch',
      height: 'auto',
      minHeight: 52,
      paddingVertical: theme.spacing.sm,
    },
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
