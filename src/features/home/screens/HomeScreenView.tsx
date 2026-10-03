import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  HERO_BADGE_BG,
  HERO_BADGE_INK,
  HERO_BLUE,
  HERO_CORAL,
  HERO_CTA_BG,
  HERO_CTA_INK,
  HERO_MINT,
  HERO_TITLE,
  LINK_HIT_SLOP,
  type RecentItem,
} from '../logic/homeScreenModel';
import type {HomeScreenViewModel} from '../logic/useHomeScreenController';

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

export function HomeScreenView(props: HomeScreenViewModel) {
  const {
    streak,
    trimmedDisplayName,
    showStarter,
    starterBare,
    heroPick,
    libraryCount,
    startedLesson,
    exploreCells,
    railItems,
    youtubeEnabled,
    goLessonsTab,
    openVideoCell,
    openRecentItem,
    onNavigateCreate,
    onNavigateLessonList,
    onContinueStartedLesson,
  } = props;
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();

  return (
    <AppScreen>
      <View style={styles.header} testID="home-header">
        <Image
          source={require('@ui/assets/home-hero-cat.png')}
          style={styles.headerLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.headerCopy}>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {t('home.header_subtitle')}
          </AppText>
          <AppText variant="h3" numberOfLines={1}>
            {t('home.header_brand')}
          </AppText>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
        showsVerticalScrollIndicator={false}
      >
        {showStarter ? (
          <View
            style={styles.heroCard}
            testID="home-starter-section"
            accessibilityRole="none"
          >
            <HeroDecor />
            <View style={styles.heroCopy} testID="home-starter-hero">
              <AppText variant="h3" style={styles.heroTitle} numberOfLines={2}>
                {starterBare
                  ? t('home.empty_title')
                  : heroPick
                  ? t('home.starter_pick')
                  : t('home.starter_title')}
              </AppText>
              <AppText variant="caption" style={styles.heroBody}>
                {starterBare
                  ? t('home.empty_body')
                  : heroPick && libraryCount !== null
                  ? t('home.starter_pick_meta', {n: libraryCount})
                  : t('home.starter_create_meta')}
              </AppText>
              {starterBare ? (
                <HeroCta
                  accessibilityLabel={t('home.empty_create_a11y')}
                  label={t('home.empty_create')}
                  onPress={onNavigateCreate}
                  testID="home-starter-first"
                />
              ) : heroPick ? (
                <HeroCta
                  accessibilityLabel={t('home.starter_pick')}
                  label={t('home.starter_pick')}
                  onPress={onNavigateLessonList}
                  testID="home-starter-pick"
                />
              ) : (
                <HeroCta
                  accessibilityLabel={`${t('home.starter_create')}. ${t(
                    'home.starter_create_meta',
                  )}`}
                  label={t('home.starter_create')}
                  onPress={onNavigateCreate}
                  testID="home-starter-create"
                />
              )}
            </View>
            <HeroMascot />
          </View>
        ) : null}
        {startedLesson ? (
          <View style={styles.heroCard} testID="home-continue-section">
            <HeroDecor />
            <View style={styles.heroCopy} testID="home-continue-hero">
              {streak > 0 ? (
                <View style={styles.heroBadge}>
                  <AppText variant="label" style={styles.heroBadgeLabel}>
                    {t('home.hero_streak', {count: streak})}
                  </AppText>
                </View>
              ) : null}
              <AppText variant="h3" style={styles.heroTitle} numberOfLines={2}>
                {trimmedDisplayName
                  ? t('home.hero_greeting_named', {name: trimmedDisplayName})
                  : t('home.hero_greeting_fallback')}
              </AppText>
              <AppText variant="caption" style={styles.heroBody}>
                {t('home.hero_continue_body')}
              </AppText>
              <HeroCta
                accessibilityLabel={t('home.hero_continue_cta_a11y', {
                  minutes: startedLesson.estimatedDurationMinutes,
                })}
                label={t('home.hero_continue_cta', {
                  minutes: startedLesson.estimatedDurationMinutes,
                })}
                onPress={onContinueStartedLesson}
                testID="home-continue-action"
              />
            </View>
            <HeroMascot />
          </View>
        ) : null}
        <View style={styles.section} testID="home-explore-section">
          <View style={styles.sectionHeader}>
            <AppText variant="h3" style={styles.sectionTitle}>
              {t('home.explore_title')}
            </AppText>
            <Pressable
              accessibilityLabel={t('home.view_all_a11y')}
              accessibilityRole="button"
              hitSlop={LINK_HIT_SLOP}
              onPress={goLessonsTab}
              style={styles.textLink}
              testID="home-explore-view-all"
            >
              <AppText
                variant="label"
                style={styles.textLinkLabel}
                numberOfLines={1}
              >
                {t('home.view_all')}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.exploreGrid}>
            {exploreCells.map(cell => {
              const backgroundColor = theme.colors[cell.backgroundKey];
              const ink =
                cell.inkKey === 'text.primary'
                  ? theme.colors.text.primary
                  : theme.colors[cell.inkKey];
              const isVideoCell = cell.testID === 'home-explore-video';
              const isDisabled = isVideoCell && !youtubeEnabled;
              const a11yLabel = isDisabled
                ? `${t(cell.titleKey)}. ${t('home.explore_video_unavailable')}`
                : `${t(cell.titleKey)}. ${t(cell.metaKey)}`;
              const shelf = theme.shelf?.surface;
              const tileShelf = theme.shelf?.iconButton;
              return (
                <Pressable
                  accessibilityLabel={a11yLabel}
                  accessibilityRole="button"
                  accessibilityState={isDisabled ? {disabled: true} : undefined}
                  disabled={isDisabled}
                  key={cell.testID}
                  onPress={isVideoCell ? openVideoCell : goLessonsTab}
                  testID={cell.testID}
                  style={styles.exploreCellWrap}
                >
                  {({pressed}) => (
                    <ShelfSurface
                      shelfHeight={shelf?.height}
                      shelfColor={shelf?.color}
                      borderRadius={theme.radius.lg}
                      isPressed={pressed}
                      isDisabled={isDisabled}
                      containerStyle={theme.shadow.soft}
                      faceStyle={[
                        styles.exploreCell,
                        {backgroundColor},
                        !shelf && pressed && !isDisabled && styles.pressed,
                      ]}
                    >
                      <ShelfSurface
                        shelfHeight={tileShelf?.height}
                        shelfColor={tileShelf?.color}
                        borderRadius={16}
                        isPressed={pressed}
                        isDisabled={isDisabled}
                        faceStyle={[
                          styles.exploreIconTile,
                          {backgroundColor: theme.colors.surface},
                        ]}
                      >
                        <MaterialIcon color={ink} name={cell.icon} size={24} />
                      </ShelfSurface>
                      <AppText
                        variant="label"
                        style={[styles.exploreTitle, {color: ink}]}
                        numberOfLines={2}
                      >
                        {t(cell.titleKey)}
                      </AppText>
                      <AppText
                        variant="caption"
                        style={[styles.exploreMeta, {color: ink}]}
                        numberOfLines={2}
                      >
                        {isDisabled
                          ? t('home.explore_video_unavailable')
                          : t(cell.metaKey)}
                      </AppText>
                    </ShelfSurface>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.section} testID="home-lessons-section">
          <View style={styles.sectionHeader}>
            <AppText variant="h3" style={styles.sectionTitle}>
              {t('home.continue_rail_title')}
            </AppText>
          </View>
          {railItems.length > 0 ? (
            <ScrollView
              horizontal
              contentContainerStyle={styles.railContent}
              showsHorizontalScrollIndicator={false}
              testID="home-continue-rail"
            >
              {railItems.map(item => (
                <Pressable
                  accessibilityLabel={`${item.title}, ${railMetaLine(t, item)}`}
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => openRecentItem(item)}
                  testID={`home-recent-item-${item.id}`}
                  style={styles.railCardWrap}
                >
                  {({pressed}) => (
                    <View style={[styles.railCard, pressed && styles.pressed]}>
                      <View style={styles.railThumb}>
                        <MaterialIcon
                          color={theme.colors.primary}
                          name={item.icon}
                          size={24}
                        />
                      </View>
                      <View style={styles.railCopy}>
                        <View style={styles.railTopRow}>
                          {item.levelTitle ? (
                            <View style={styles.railTag}>
                              <AppText
                                variant="caption"
                                style={styles.railTagLabel}
                              >
                                {item.levelTitle}
                              </AppText>
                            </View>
                          ) : null}
                          {item.isDownloaded ? (
                            <View style={styles.railSavedTag}>
                              <AppText
                                variant="caption"
                                style={styles.railSavedLabel}
                              >
                                {t('home.rail_saved')}
                              </AppText>
                            </View>
                          ) : null}
                        </View>
                        <AppText variant="label" numberOfLines={2}>
                          {item.title}
                        </AppText>
                        <AppText
                          color="muted"
                          variant="caption"
                          numberOfLines={1}
                        >
                          {railMetaLine(t, item)}
                        </AppText>
                      </View>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.lessonsEmpty}>
              <AppText color="secondary">
                {t('home.lessons_empty_lead')}
              </AppText>
              {startedLesson ? (
                <AppButton
                  accessibilityLabel={t('home.empty_create_a11y')}
                  title={t('home.empty_create')}
                  variant="primary-accent"
                  onPress={onNavigateCreate}
                  testID="home-lessons-create"
                  style={styles.fullWidthButton}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function HeroCta({
  accessibilityLabel,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.heroCta,
        pressed && {opacity: theme.states.pressedOpacity},
      ]}
    >
      <AppText variant="label" style={styles.heroCtaLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

function HeroDecor() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={styles.heroDecor}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.heroBlobCoral} />
      <View style={styles.heroBlobMint} />
    </View>
  );
}

function HeroMascot() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={styles.heroMascot}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={require('@ui/assets/home-hero-cat.png')}
        style={styles.heroMascotImage}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 56,
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.sm,
    },
    headerLogo: {
      height: 40,
      width: 40,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    scrollContent: {
      flexGrow: 1,
      gap: theme.spacing.xl,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    section: {gap: theme.spacing.md},
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'space-between',
    },
    sectionTitle: {flex: 1, minWidth: 0},
    heroCard: {
      alignItems: 'center',
      backgroundColor: HERO_BLUE,
      borderRadius: theme.radius.xl,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 250,
      overflow: 'hidden',
      padding: theme.spacing.lg,
      ...theme.shadow.soft,
    },
    heroDecor: {
      ...StyleSheet.absoluteFill,
    },
    heroBlobCoral: {
      backgroundColor: HERO_CORAL,
      borderRadius: 60,
      height: 120,
      position: 'absolute',
      right: -40,
      top: -48,
      width: 120,
    },
    heroBlobMint: {
      backgroundColor: HERO_MINT,
      borderRadius: 45,
      bottom: -60,
      height: 90,
      left: -44,
      position: 'absolute',
      width: 80,
    },
    heroCopy: {flex: 1, gap: theme.spacing.sm, minWidth: 0},
    heroBadge: {
      alignSelf: 'flex-start',
      backgroundColor: HERO_BADGE_BG,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
    },
    heroBadgeLabel: {
      color: HERO_BADGE_INK,
    },
    heroTitle: {
      color: HERO_TITLE,
    },
    heroBody: {
      color: HERO_TITLE,
      opacity: 0.92,
    },
    heroMascot: {
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: -110,
      marginRight: -18,
      width: 128,
    },
    heroMascotImage: {
      height: 140,
      width: 112,
    },
    heroCta: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: HERO_CTA_BG,
      borderRadius: 999,
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
      minHeight: 48,
      minWidth: 160,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    heroCtaLabel: {
      color: HERO_CTA_INK,
      textAlign: 'center',
    },
    fullWidthButton: {
      alignSelf: 'stretch',
      height: 'auto',
      minHeight: 52,
      paddingVertical: theme.spacing.sm,
    },
    lessonsEmpty: {
      gap: theme.spacing.md,
    },
    exploreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    exploreCellWrap: {
      flexBasis: '47%',
      flexGrow: 1,
      minWidth: 140,
    },
    exploreCell: {
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      minHeight: 160,
      padding: theme.spacing.md,
    },
    exploreIconTile: {
      alignItems: 'center',
      borderRadius: 16,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    exploreTitle: {},
    exploreMeta: {},
    railContent: {
      gap: theme.spacing.sm,
      paddingRight: theme.gutter,
    },
    railCardWrap: {
      width: 248,
    },
    railCard: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 96,
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    railThumb: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: 14,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    railCopy: {flex: 1, gap: 4, minWidth: 0},
    railTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    railTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    railTagLabel: {
      color: theme.colors.primary,
    },
    railSavedTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    railSavedLabel: {
      color: theme.colors.onTertiaryContainer,
    },
    textLink: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    textLinkLabel: {
      color: theme.colors.primary,
    },
    pressed: {opacity: theme.states.pressedOpacity},
  });
}
