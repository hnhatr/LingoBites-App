import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {HomeStackParamList, RootTabParamList} from '@modules/input';
import type {LessonsStackParamList} from '@modules/lesson';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SectionHeader} from '@ui/components/SectionHeader';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import {generateStudyBlock, REASON_CODE_VI_LABELS} from './adaptationEngine';
import {getLearnerStateSnapshot} from './todayAdapter';
import {resolveTodayNavigation} from './todayNavigation';
import type {StudyActivityItem, StudyBlockPlan, TodayMode} from './types';

type TodayNavigationParamList = HomeStackParamList &
  LessonsStackParamList &
  RootTabParamList;
type NavigationProp = NativeStackNavigationProp<TodayNavigationParamList>;

const TARGET_MINUTES: Record<TodayMode, number> = {
  '5-minute': 5,
  normal: 20,
  'deep-practice': 45,
};

export function TodayScreen() {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NavigationProp>();

  const [mode, setMode] = useState<TodayMode>('normal');
  const [plan, setPlan] = useState<StudyBlockPlan | null>(null);

  const loadPlan = useCallback((selectedMode: TodayMode) => {
    const snapshot = getLearnerStateSnapshot();
    const newPlan = generateStudyBlock(snapshot, selectedMode);
    setPlan(newPlan);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlan(mode);
    }, [loadPlan, mode]),
  );

  function handleModeChange(newMode: TodayMode) {
    setMode(newMode);
    loadPlan(newMode);
  }

  function handleExecuteActivity(activity: StudyActivityItem) {
    const resolved = resolveTodayNavigation(activity.navigationTarget);
    // Map navigation target to a surviving screen (LING-48 / TASK-007):
    // `ContentLessonRuntime` targets open the content-package runtime
    // screen (never the removed v1 `SavedLessonDetail`), and `FlashcardList`
    // targets fall back to `DailyReview` (never the removed v1
    // `FlashcardList` screen).
    if (resolved.screen === 'ContentLessonRuntime') {
      navigation.navigate('ContentLessonRuntime', {
        lessonId: resolved.lessonId,
      });
    } else if (resolved.screen === 'LessonsList') {
      navigation.navigate('LessonsList');
    } else {
      navigation.navigate('DailyReview');
    }
  }

  return (
    <AppScreen testID="today-screen">
      <View style={themedStyles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialIcon
            color={theme.colors.primary}
            name="event_note"
            size={26}
          />
          <AppText style={themedStyles.headerTitle}>Hôm nay</AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector (REQ-12, REQ-13) */}
        <View style={styles.modeBlock}>
          <AppText variant="label" color="secondary">
            Chọn thời gian học hôm nay:
          </AppText>
          <View style={styles.modeSelector} testID="mode-selector">
            <Chip
              label="⚡ 5 phút"
              selected={mode === '5-minute'}
              onPress={() => handleModeChange('5-minute')}
              testID="mode-5-minute"
            />
            <Chip
              label="🎯 Tiêu chuẩn (20m)"
              selected={mode === 'normal'}
              onPress={() => handleModeChange('normal')}
              testID="mode-normal"
            />
            <Chip
              label="🔥 Luyện sâu (45m)"
              selected={mode === 'deep-practice'}
              onPress={() => handleModeChange('deep-practice')}
              testID="mode-deep-practice"
            />
          </View>
        </View>

        {/* Backlog Control Banner (REQ-14) */}
        {plan?.isConsolidation ? (
          <View
            style={themedStyles.consolidationBanner}
            testID="backlog-consolidation-banner"
          >
            <View style={styles.inlineHeader}>
              <MaterialIcon
                color={theme.colors.primary}
                name="warning"
                size={24}
              />
              <AppText variant="h3" style={{color: theme.colors.primary}}>
                Khối củng cố (Tồn đọng cao)
              </AppText>
            </View>
            <AppText color="secondary" variant="body">
              Lượng bài cần ôn tập đang vượt ngưỡng (&gt; 20 mục hoặc thời gian
              ôn &gt; 10 phút). Hệ thống đã tạm dừng bài học mới để giúp bạn tập
              trung củng cố kiến thức cũ.
            </AppText>
          </View>
        ) : null}

        {/* Explainability UI Card (REQ-31) */}
        {plan ? (
          <AppCard testID="explainability-card" style={styles.explainCard}>
            <View style={styles.inlineHeader}>
              <MaterialIcon
                color={theme.colors.tertiary}
                name="auto_awesome"
                size={22}
              />
              <AppText variant="h3">Lý do chọn bài học</AppText>
            </View>
            <AppText color="secondary" variant="body">
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
          </AppCard>
        ) : null}

        {/* Executable Study Block Activity List */}
        <View style={styles.activityList}>
          <SectionHeader
            title="Chuỗi bài học gợi ý"
            action={
              plan ? (
                <AppText color="secondary" variant="caption">
                  Tổng thời lượng: ~{plan.totalEstimatedMinutes} phút
                </AppText>
              ) : null
            }
          />

          {plan?.activities.map((activity, index) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              onPress={() => handleExecuteActivity(activity)}
              style={({pressed}) => [
                themedStyles.activityItem,
                pressed && themedStyles.pressedActivityItem,
              ]}
              testID={`activity-item-${index}`}
            >
              <View style={themedStyles.activityIndexBadge}>
                <AppText style={styles.activityIndexText}>{index + 1}</AppText>
              </View>

              <View style={styles.activityCopy}>
                <AppText variant="h3">{activity.titleVi}</AppText>
                <AppText color="secondary" variant="caption">
                  {activity.subtitleVi}
                </AppText>
              </View>

              <View style={styles.activityMeta}>
                <AppText variant="caption" color="secondary">
                  ~{activity.estimatedMinutes}m
                </AppText>
                <MaterialIcon
                  color={theme.colors.primary}
                  name="chevron_right"
                  size={22}
                />
              </View>
            </Pressable>
          ))}
          {plan && plan.totalEstimatedMinutes < TARGET_MINUTES[mode] ? (
            <View
              style={themedStyles.shortfallContainer}
              testID="shortfall-container"
            >
              <AppText
                color="secondary"
                variant="body"
                style={styles.shortfallText}
              >
                Chỉ còn ~{plan.totalEstimatedMinutes} phút nội dung đến hạn hôm
                nay.
              </AppText>
              <AppButton
                title="Thêm bài mới"
                variant="outline"
                onPress={() => navigation.navigate('Create')}
                testID="shortfall-action"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  activityCopy: {
    flex: 1,
    gap: 4,
  },
  activityIndexText: {
    fontSize: 18,
    fontWeight: '700',
  },
  activityList: {
    gap: 12,
  },
  activityMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  explainCard: {
    gap: 10,
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  inlineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modeBlock: {
    gap: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonCodeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  shortfallText: {
    textAlign: 'center',
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    activityIndexBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    activityItem: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.md,
      opacity: 1,
      padding: theme.spacing.lg,
      ...theme.shadow.soft,
    },
    consolidationBanner: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.accent,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      height: 56,
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
    },
    headerTitle: {
      color: theme.colors.primary,
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.medium,
    },
    pressedActivityItem: {
      opacity: theme.states.pressedOpacity,
    },
    reasonCodeChip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: theme.spacing.xs,
    },
    reasonCodeText: {
      color: theme.colors.primary,
    },
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    shortfallContainer: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });
}
