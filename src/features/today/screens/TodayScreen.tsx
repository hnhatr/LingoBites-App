import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {ComposeRequestCards} from '@features/lesson/player';
import {
  nextDownloadedPack,
  type NextPack,
  syncDownloadedPacks,
} from '@features/wordPath';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HeroFill} from '@ui/components/HeroFill';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useAppNavigation} from '@core/navigation';

import {
  AddLessonGrid,
  type AddLessonKind,
  AddLessonList,
  AddLessonSheet,
  enabledAddLessonOptions,
} from '../components/AddLessonOptions';
import {
  ACTIVITY_CATEGORY_LABELS_VI,
  ACTIVITY_CATEGORY_ORDER,
  type ActivityCategory,
  activityCategory,
} from '../logic/activityCategory';
import {
  generateStudyBlock,
  MODE_BUDGETS_MINUTES,
  REASON_CODE_VI_LABELS,
} from '../logic/adaptationEngine';
import {getLearnerStateSnapshot} from '../logic/todayAdapter';
import {
  readTodayFeatures,
  refreshTodayFeatures,
  type TodayFeatures,
} from '../logic/todayFeatures';
import {openStudyActivity} from '../logic/todayNavigation';
import type {
  StudyActivityItem,
  StudyBlockPlan,
  TodayMode,
} from '../logic/types';
import type {TodayRouteParams} from './navigationTypes';

const MODE_OPTIONS: readonly {
  mode: TodayMode;
  label: string;
  caption: string;
}[] = [
  {mode: '5-minute', label: '5 phút', caption: 'Nhanh'},
  {mode: 'normal', label: '20 phút', caption: 'Chuẩn'},
  {mode: 'deep-practice', label: '45 phút', caption: 'Luyện sâu'},
];

const CATEGORY_ICONS: Record<ActivityCategory, HandoffIconName> = {
  review: 'replay',
  lesson: 'menu_book',
  skill: 'record_voice_over',
};

const ACTIVITY_ICONS: Record<string, HandoffIconName> = {
  due_review: 'replay',
  error_remediation: 'rule',
  active_recall: 'psychology',
  continue_lesson: 'play_circle',
  next_lesson: 'auto_stories',
  prerequisite_lesson: 'school',
  old_situation_practice: 'history_edu',
  speaking_practice: 'mic',
  listening_remediation: 'hearing',
  interview_practice: 'person',
};

type Props = {
  route?: {params?: TodayRouteParams};
};

function categoryColors(theme: AppTheme, category: ActivityCategory) {
  switch (category) {
    case 'review':
      return {ink: theme.colors.secondary, soft: theme.colors.secondarySoft};
    case 'skill':
      return {ink: theme.colors.tertiary, soft: theme.colors.tertiarySoft};
    default:
      return {ink: theme.colors.primary, soft: theme.colors.accentSoft};
  }
}

function sameFeatures(a: TodayFeatures, b: TodayFeatures): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function TodayScreen({route}: Props = {}) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const navigation = useAppNavigation();

  const [mode, setMode] = useState<TodayMode>(route?.params?.mode ?? 'normal');
  const [plan, setPlan] = useState<StudyBlockPlan | null>(null);
  const [hasDownloads, setHasDownloads] = useState(true);
  const [nextPack, setNextPack] = useState<NextPack | null>(null);
  const [features, setFeatures] = useState<TodayFeatures>(readTodayFeatures);
  const [sheetOpen, setSheetOpen] = useState(false);
  const featuresRef = useRef(features);

  const loadPlan = useCallback(
    (selectedMode: TodayMode, activeFeatures: TodayFeatures) => {
      const snapshot = getLearnerStateSnapshot();
      setHasDownloads(snapshot.hasDownloadedLessons);
      // Vocab path P5: the word pack to learn next, from the packs on this device.
      try {
        setNextPack(nextDownloadedPack());
      } catch {
        setNextPack(null);
      }
      setPlan(
        generateStudyBlock(snapshot, selectedMode, undefined, activeFeatures),
      );
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadPlan(mode, featuresRef.current);
      // The admin's Today features: plan with the kept copy at once, then
      // again only if the Server's answer differs.
      refreshTodayFeatures().then(fresh => {
        if (!active || sameFeatures(fresh, featuresRef.current)) return;
        featuresRef.current = fresh;
        setFeatures(fresh);
        loadPlan(mode, fresh);
      });
      // Vocab path P5: drop packs the Server rebuilt away, then pick the next
      // pack again so the card never opens a pack that no longer exists.
      syncDownloadedPacks()
        .then(dropped => {
          if (!active || dropped === 0) return;
          setNextPack(nextDownloadedPack());
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [loadPlan, mode]),
  );

  function handleModeChange(newMode: TodayMode) {
    setMode(newMode);
    loadPlan(newMode, featuresRef.current);
  }

  function handleExecuteActivity(activity: StudyActivityItem) {
    openStudyActivity(navigation, activity);
  }

  function handleAddLesson(kind: AddLessonKind) {
    if (kind === 'create') navigation.openCreate();
    else if (kind === 'library') navigation.openCatalog();
    else navigation.openCourse();
  }

  const addOptions = enabledAddLessonOptions(features);
  const targetMinutes = MODE_BUDGETS_MINUTES[mode];
  const firstActivity = plan?.activities[0] ?? null;
  const freeMinutes = plan
    ? Math.max(0, targetMinutes - plan.totalEstimatedMinutes)
    : 0;

  const minutesByCategory = ACTIVITY_CATEGORY_ORDER.map(category => ({
    category,
    minutes: (plan?.activities ?? [])
      .filter(activity => activityCategory(activity.type) === category)
      .reduce((sum, activity) => sum + activity.estimatedMinutes, 0),
  })).filter(entry => entry.minutes > 0);

  return (
    <AppScreen testID="today-screen">
      <ScreenHeader onBack={navigation.goBack} title="Hôm nay" />

      <ScrollView
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* S4.3: six-step lessons still being made. */}
        <ComposeRequestCards testID="today-compose-cards" />

        {!hasDownloads ? (
          <View style={styles.section} testID="today-empty-downloads">
            <View style={themedStyles.emptyCard}>
              <AppText variant="h3">Chưa có bài học trên máy</AppText>
              <AppText color="secondary" variant="body">
                Thêm một bài để có kế hoạch học hôm nay. Bài đã tải học được cả
                khi offline.
              </AppText>
            </View>
            {addOptions.length > 0 ? (
              <AddLessonList
                onSelect={handleAddLesson}
                options={addOptions}
                testIDPrefix="today-empty"
              />
            ) : (
              <AppText color="secondary" variant="body">
                Các cách thêm bài đang tạm tắt. Hãy quay lại sau.
              </AppText>
            )}
          </View>
        ) : null}

        {/* Backlog Control Banner (REQ-14) */}
        {plan?.isConsolidation ? (
          <View
            style={themedStyles.consolidationBanner}
            testID="backlog-consolidation-banner"
          >
            <MaterialIcon
              color={theme.colors.secondary}
              name="warning"
              size={22}
            />
            <View style={styles.flexCopy}>
              <AppText variant="h3">Đang ôn tồn đọng</AppText>
              <AppText color="secondary" variant="caption">
                Có nhiều bài đến hạn ôn (trên 20 mục hoặc hơn 10 phút). Bài mới
                tạm dừng đến khi bạn ôn bớt.
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Plan card: time, minutes by group, start (REQ-12, REQ-13), on
            the mint-to-sky face of Home's "Hôm nay" card. */}
        <ShelfSurface
          borderRadius={26}
          containerTestID="today-plan-card"
          faceStyle={themedStyles.planCard}
          shelfColor={HERO_PALETTE.shelf}
          shelfHeight={6}
        >
          <HeroFill id="todayPlanFace" />
          <View
            accessibilityRole="radiogroup"
            style={themedStyles.modeSelector}
            testID="mode-selector"
          >
            {MODE_OPTIONS.map(option => (
              <ModeOption
                caption={option.caption}
                key={option.mode}
                label={option.label}
                onPress={() => handleModeChange(option.mode)}
                selected={mode === option.mode}
                testID={`mode-${option.mode}`}
              />
            ))}
          </View>

          {plan ? (
            <View style={styles.progress}>
              <View style={styles.progressHeader}>
                <AppText style={styles.onHeroSoft} variant="label">
                  Kế hoạch hôm nay
                </AppText>
                <AppText
                  style={styles.onHero}
                  testID="today-plan-minutes"
                  variant="h3"
                >
                  {plan.totalEstimatedMinutes} / {targetMinutes} phút
                </AppText>
              </View>
              <View style={themedStyles.progressTrack}>
                {minutesByCategory.map(entry => (
                  <View
                    key={entry.category}
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: categoryColors(theme, entry.category)
                          .ink,
                        flexGrow: entry.minutes,
                      },
                    ]}
                  />
                ))}
                {freeMinutes > 0 ? (
                  <View
                    style={[styles.progressSegment, {flexGrow: freeMinutes}]}
                  />
                ) : null}
              </View>
              <View style={styles.legend}>
                {minutesByCategory.map(entry => (
                  <View key={entry.category} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor: categoryColors(theme, entry.category)
                            .ink,
                        },
                      ]}
                    />
                    <AppText style={styles.onHeroSoft} variant="caption">
                      {ACTIVITY_CATEGORY_LABELS_VI[entry.category]}{' '}
                      {entry.minutes} phút
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {firstActivity ? (
            <Pressable
              accessibilityHint={`Mở ${firstActivity.titleVi}`}
              accessibilityLabel="Bắt đầu học"
              accessibilityRole="button"
              onPress={() => handleExecuteActivity(firstActivity)}
              style={({pressed}) => [
                themedStyles.startButton,
                pressed && themedStyles.pressed,
              ]}
              testID="today-start"
            >
              <MaterialIcon
                color={HERO_PALETTE.white}
                name="play_circle"
                size={30}
              />
              <View style={styles.flexCopy}>
                <AppText style={themedStyles.startTitle} variant="h3">
                  Bắt đầu học
                </AppText>
                <AppText style={themedStyles.startCaption} variant="caption">
                  {firstActivity.titleVi} · {firstActivity.estimatedMinutes}{' '}
                  phút
                </AppText>
              </View>
            </Pressable>
          ) : null}

          {/* Explainability (REQ-31): one short line, tags to scan. */}
          {plan ? (
            <View style={themedStyles.whyRow} testID="explainability-card">
              <MaterialIcon
                color={HERO_PALETTE.teal}
                name="auto_awesome"
                size={18}
              />
              <View style={styles.flexCopy}>
                <AppText style={styles.onHeroSoft} variant="caption">
                  <AppText variant="caption" style={styles.bold}>
                    Vì sao?{' '}
                  </AppText>
                  {plan.explanationVi}
                </AppText>
                {plan.reasonCodes.length > 0 ? (
                  <View style={styles.reasonCodeList}>
                    {plan.reasonCodes.map(code => (
                      <View key={code} style={themedStyles.reasonCodeChip}>
                        <AppText
                          variant="caption"
                          style={themedStyles.reasonCodeText}
                        >
                          {REASON_CODE_VI_LABELS[code]}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </ShelfSurface>

        {/* Activities grouped by kind; testIDs keep the plan order. */}
        {ACTIVITY_CATEGORY_ORDER.map(category => {
          const items = (plan?.activities ?? [])
            .map((activity, index) => ({activity, index}))
            .filter(
              ({activity}) => activityCategory(activity.type) === category,
            );
          if (items.length === 0) return null;
          const colors = categoryColors(theme, category);
          const minutes = items.reduce(
            (sum, {activity}) => sum + activity.estimatedMinutes,
            0,
          );
          return (
            <View
              key={category}
              style={styles.section}
              testID={`today-group-${category}`}
            >
              <View style={styles.groupHeader}>
                <View
                  style={[
                    themedStyles.groupIcon,
                    {backgroundColor: colors.soft},
                  ]}
                >
                  <MaterialIcon
                    color={colors.ink}
                    name={CATEGORY_ICONS[category]}
                    size={17}
                  />
                </View>
                <AppText style={styles.flexCopy} variant="h3">
                  {ACTIVITY_CATEGORY_LABELS_VI[category]}
                </AppText>
                <AppText color="secondary" variant="caption">
                  {items.length} mục · {minutes} phút
                </AppText>
              </View>
              {items.map(({activity, index}) => (
                <Pressable
                  key={activity.id}
                  accessibilityHint={activity.subtitleVi}
                  accessibilityLabel={activity.titleVi}
                  accessibilityRole="button"
                  onPress={() => handleExecuteActivity(activity)}
                  style={({pressed}) => [
                    themedStyles.activityItem,
                    index === 0 && {borderColor: colors.ink},
                    pressed && themedStyles.pressed,
                  ]}
                  testID={`activity-item-${index}`}
                >
                  <View
                    style={[
                      themedStyles.activityIcon,
                      {backgroundColor: colors.soft},
                    ]}
                  >
                    <MaterialIcon
                      color={colors.ink}
                      name={ACTIVITY_ICONS[activity.type] ?? 'menu_book'}
                      size={22}
                    />
                  </View>
                  <View style={styles.flexCopy}>
                    {index === 0 ? (
                      <AppText style={{color: colors.ink}} variant="caption">
                        Làm trước
                      </AppText>
                    ) : null}
                    <AppText variant="h3">{activity.titleVi}</AppText>
                    <AppText color="secondary" variant="caption">
                      {activity.subtitleVi}
                    </AppText>
                  </View>
                  <View style={themedStyles.minutesPill}>
                    <AppText color="secondary" variant="caption">
                      {activity.estimatedMinutes} phút
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}

        {/* Add a lesson: create, library or course, as the admin allows. */}
        {plan &&
        hasDownloads &&
        !plan.isConsolidation &&
        addOptions.length > 0 ? (
          freeMinutes > 0 ? (
            <View style={themedStyles.addBlock} testID="shortfall-container">
              <View style={styles.groupHeader}>
                <MaterialIcon
                  color={theme.colors.primary}
                  name="add"
                  size={20}
                />
                <AppText style={styles.flexCopy} variant="h3">
                  Còn trống {freeMinutes} phút
                </AppText>
                <AppText color="secondary" variant="caption">
                  Thêm bài cho đủ
                </AppText>
              </View>
              <AddLessonGrid onSelect={handleAddLesson} options={addOptions} />
            </View>
          ) : (
            <Pressable
              accessibilityHint="Mở bảng chọn cách thêm bài"
              accessibilityLabel="Thêm bài học"
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              style={({pressed}) => [
                styles.addLink,
                pressed && themedStyles.pressed,
              ]}
              testID="add-lesson-open"
            >
              <MaterialIcon color={theme.colors.primary} name="add" size={20} />
              <AppText style={themedStyles.addLinkText} variant="label">
                Thêm bài học
              </AppText>
            </Pressable>
          )
        ) : null}

        {features.word_pack && nextPack ? (
          <View style={styles.section}>
            <View style={styles.groupHeader}>
              <View
                style={[
                  themedStyles.groupIcon,
                  {backgroundColor: theme.colors.surfaceContainer},
                ]}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="style"
                  size={17}
                />
              </View>
              <AppText style={styles.flexCopy} variant="h3">
                Từ vựng
              </AppText>
              <AppText color="secondary" variant="caption">
                Gói tiếp theo
              </AppText>
            </View>
            <Pressable
              accessibilityHint="Mở gói từ vựng"
              accessibilityLabel={nextPack.titleVi}
              accessibilityRole="button"
              onPress={() => navigation.openWordPack(nextPack.packId)}
              style={({pressed}) => [
                themedStyles.activityItem,
                pressed && themedStyles.pressed,
              ]}
              testID="today-next-pack"
            >
              <View
                style={[
                  themedStyles.activityIcon,
                  {backgroundColor: theme.colors.surfaceContainer},
                ]}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="style"
                  size={22}
                />
              </View>
              <View style={styles.flexCopy}>
                <AppText variant="h3">{nextPack.titleVi}</AppText>
                <AppText color="secondary" variant="caption">
                  Đã nhớ {nextPack.learned}/{nextPack.total} từ
                </AppText>
                <View style={themedStyles.packTrack}>
                  <View
                    style={[
                      themedStyles.packFill,
                      {
                        width: `${
                          nextPack.total > 0
                            ? Math.round(
                                (nextPack.learned / nextPack.total) * 100,
                              )
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <MaterialIcon
                color={theme.colors.primary}
                name="chevron_right"
                size={22}
              />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <AddLessonSheet
        onDismiss={() => setSheetOpen(false)}
        onSelect={handleAddLesson}
        options={addOptions}
        visible={sheetOpen}
      />
    </AppScreen>
  );
}

type ModeOptionProps = {
  label: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
};

function ModeOption({
  label,
  caption,
  selected,
  onPress,
  testID,
}: ModeOptionProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      accessibilityHint={`Lập kế hoạch ${label}`}
      accessibilityLabel={`${label}, ${caption}`}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      onPress={onPress}
      style={[themedStyles.modeOption, selected && themedStyles.modeSelected]}
      testID={testID}
    >
      <AppText
        style={
          selected ? themedStyles.modeTextSelected : themedStyles.modeLabel
        }
        variant="label"
      >
        {label}
      </AppText>
      <AppText
        style={
          selected ? themedStyles.modeTextSelected : themedStyles.modeCaption
        }
        variant="caption"
      >
        {caption}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  bold: {
    color: HERO_PALETTE.tealInk,
    fontWeight: '700',
  },
  flexCopy: {
    flex: 1,
    gap: 2,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  onHero: {
    color: HERO_PALETTE.ink,
  },
  onHeroSoft: {
    color: HERO_PALETTE.tealInk,
  },
  progress: {
    gap: 6,
  },
  progressHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSegment: {
    flexBasis: 0,
    height: '100%',
  },
  reasonCodeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    activityIcon: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    activityItem: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      ...theme.shadow.soft,
    },
    addBlock: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    addLinkText: {
      color: theme.colors.primary,
    },
    consolidationBanner: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    emptyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.xs,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 5),
    },
    groupIcon: {
      alignItems: 'center',
      borderRadius: theme.radius.sm,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    minutesPill: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    modeOption: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      flex: 1,
      paddingVertical: theme.spacing.sm,
    },
    modeCaption: {
      color: HERO_PALETTE.tealInk,
    },
    modeLabel: {
      color: HERO_PALETTE.ink,
    },
    modeSelected: {
      backgroundColor: HERO_PALETTE.teal,
    },
    modeSelector: {
      backgroundColor: HERO_PALETTE.strip,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: 4,
      padding: 4,
    },
    modeTextSelected: {
      color: HERO_PALETTE.white,
    },
    packFill: {
      backgroundColor: theme.colors.primary,
      height: '100%',
    },
    packTrack: {
      backgroundColor: theme.colors.surfaceContainer,
      borderRadius: theme.radius.pill,
      height: 6,
      marginTop: 4,
      overflow: 'hidden',
    },
    planCard: {
      backgroundColor: HERO_PALETTE.faceFrom,
      gap: theme.spacing.md,
      overflow: 'hidden',
      padding: theme.spacing.md,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    progressTrack: {
      backgroundColor: HERO_PALETTE.strip,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      height: 10,
      overflow: 'hidden',
    },
    reasonCodeChip: {
      backgroundColor: HERO_PALETTE.chipStrong,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: theme.spacing.xs,
    },
    reasonCodeText: {
      color: HERO_PALETTE.teal,
    },
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    // The coral call to action of Home's card, with its shelf.
    startButton: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderBottomColor: HERO_PALETTE.coralShelf,
      borderBottomWidth: 4,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 2,
    },
    startCaption: {
      color: HERO_PALETTE.white,
    },
    startTitle: {
      color: HERO_PALETTE.white,
    },
    whyRow: {
      alignItems: 'flex-start',
      backgroundColor: HERO_PALETTE.strip,
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
    },
  });
}
