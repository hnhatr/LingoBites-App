import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SectionHeader} from '@ui/components/SectionHeader';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {StatTile} from '@ui/components/StatTile';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {SettingsOptionSheet} from '../components/SettingsOptionSheet';
import type {ProfileScreenViewModel} from '../logic/useProfileScreen';

export type ProfileScreenViewProps = ProfileScreenViewModel;

export function ProfileScreenView({
  accountPhase,
  audioCacheTrailingLabel,
  closeSettingsSheet,
  displayName,
  gamification,
  initials,
  lastSyncedLabel,
  learningMetrics,
  openAccountSettings,
  openAppSettings,
  openDataSettings,
  openProgressReport,
  openLearningProfile,
  learningLevel,
  openReminderSheet,
  openSettingsSheet,
  openSupportAbout,
  openWeeklyGoalSheet,
  profileSubtitle,
  reminderSelectedKey,
  reminderSheetOptions,
  reminderTrailingLabel,
  selectReminder,
  selectWeeklyGoal,
  showThemePicker,
  statusMessage,
  streakSubtitle,
  streakTitle,
  weeklyGoalSelectedKey,
  weeklyGoalSheetOptions,
  weeklyGoalTrailingLabel,
}: ProfileScreenViewProps) {
  const {theme} = useAppTheme();
  const isAuthenticated = accountPhase === 'authenticated';
  const feedClearance = useFloatingTabBarClearance();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <AppScreen>
      <ScreenHeader title="Hồ sơ" />

      <ScrollView
        contentContainerStyle={[
          themedStyles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityHint="Mở trang tài khoản"
          accessibilityLabel={`Tài khoản của ${displayName}`}
          accessibilityRole="button"
          disabled={!isAuthenticated}
          onPress={openAccountSettings}
        >
          <AppCard>
            <View style={styles.profileRow}>
              <View style={themedStyles.avatar}>
                <AppText style={themedStyles.avatarText}>{initials}</AppText>
              </View>
              <View style={styles.profileCopy}>
                <AppText variant="h3">{displayName}</AppText>
                <AppText color="secondary" variant="caption">
                  {profileSubtitle}
                </AppText>
              </View>
              {isAuthenticated ? (
                <MaterialIcon
                  color={theme.colors.text.secondary}
                  name="chevron_right"
                  size={22}
                />
              ) : null}
            </View>
          </AppCard>
        </Pressable>

        <View>
          <SectionHeader title="Tiến trình" />
          <AppCard>
            <View style={styles.cardStack}>
              <View style={styles.streakRow}>
                <View style={themedStyles.streakBadge}>
                  <MaterialIcon
                    color={theme.colors.accentInk}
                    name="local_fire_department"
                    size={28}
                  />
                </View>
                <View style={styles.streakCopy}>
                  <AppText variant="h3">{streakTitle}</AppText>
                  <AppText color="secondary" variant="caption">
                    {streakSubtitle}
                  </AppText>
                </View>
              </View>
              <View style={styles.statsRow}>
                <StatTile
                  icon="bolt"
                  label="XP đã đạt"
                  tone="gold"
                  value={gamification.totalXp}
                />
                <StatTile
                  icon="emoji_events"
                  label="Huy hiệu"
                  tone="coral"
                  value={gamification.badges.length}
                />
              </View>
              <View style={styles.statsRow}>
                <StatTile
                  icon="menu_book"
                  label="Từ đã biết"
                  tone="teal"
                  value={learningMetrics.wordsKnownLabel}
                />
                <StatTile
                  icon="check_circle"
                  label="Độ chính xác"
                  tone="teal"
                  value={learningMetrics.accuracyLabel}
                />
              </View>
            </View>
          </AppCard>
        </View>

        <SettingsGroup title="Học tập">
          <ProfileSettingsRow
            accessibilityHint="Chạm để thay đổi"
            accessibilityLabel={`Hồ sơ học tập: ${learningLevel ?? 'chưa có'}`}
            icon="school"
            label="Hồ sơ học tập"
            medallionTone="gold"
            onPress={openLearningProfile}
            trailing={learningLevel ? {text: learningLevel} : 'chevron'}
          />
          <ProfileSettingsRow
            accessibilityHint="Chạm để thay đổi"
            accessibilityLabel={`Mục tiêu tuần: ${weeklyGoalTrailingLabel}`}
            icon="flag"
            label="Mục tiêu tuần"
            medallionTone="teal"
            onPress={openWeeklyGoalSheet}
            trailing={{text: weeklyGoalTrailingLabel}}
          />
          <ProfileSettingsRow
            accessibilityHint="Chạm để thay đổi"
            accessibilityLabel={`Nhắc nhở: ${reminderTrailingLabel}`}
            icon="notifications"
            label="Nhắc nhở"
            medallionTone="coral"
            onPress={openReminderSheet}
            trailing={{text: reminderTrailingLabel}}
          />
          <ProfileSettingsRow
            accessibilityHint="Chạm để mở"
            accessibilityLabel="Báo cáo tiến độ và năng lực"
            icon="analytics"
            label="Báo cáo tiến độ & Năng lực"
            medallionTone="teal"
            onPress={openProgressReport}
            trailing="chevron"
          />
        </SettingsGroup>

        <SettingsGroup title="Cài đặt">
          {isAuthenticated ? (
            <ProfileSettingsRow
              accessibilityHint="Chạm để thay đổi"
              accessibilityLabel={`Tài khoản. Đồng bộ: ${lastSyncedLabel}`}
              icon="person"
              label="Tài khoản"
              medallionTone="teal"
              onPress={openAccountSettings}
              trailing={{text: lastSyncedLabel}}
            />
          ) : null}
          <ProfileSettingsRow
            accessibilityHint="Chạm để thay đổi"
            accessibilityLabel={`Dữ liệu và bộ nhớ: ${audioCacheTrailingLabel}`}
            icon="smartphone"
            label="Dữ liệu & bộ nhớ"
            medallionTone="gold"
            onPress={openDataSettings}
            trailing={{text: audioCacheTrailingLabel}}
          />
          {showThemePicker ? (
            <ProfileSettingsRow
              accessibilityHint="Chạm để mở"
              accessibilityLabel="Cài đặt ứng dụng"
              icon="settings"
              label="Cài đặt ứng dụng"
              medallionTone="coral"
              onPress={openAppSettings}
              trailing="chevron"
            />
          ) : null}
          <ProfileSettingsRow
            accessibilityHint="Chạm để mở"
            accessibilityLabel="Hỗ trợ và thông tin"
            icon="help"
            label="Hỗ trợ & thông tin"
            medallionTone="teal"
            onPress={openSupportAbout}
            trailing="chevron"
          />
        </SettingsGroup>

        {statusMessage ? (
          <AppText color="secondary">{statusMessage}</AppText>
        ) : null}
      </ScrollView>

      {openSettingsSheet === 'weeklyGoal' ? (
        <SettingsOptionSheet
          onDismiss={closeSettingsSheet}
          onSelect={selectWeeklyGoal}
          options={weeklyGoalSheetOptions}
          selectedKey={weeklyGoalSelectedKey}
          testID="profile-weekly-goal-sheet"
          title="Mục tiêu tuần"
        />
      ) : null}
      {openSettingsSheet === 'reminder' ? (
        <SettingsOptionSheet
          onDismiss={closeSettingsSheet}
          onSelect={selectReminder}
          options={reminderSheetOptions}
          selectedKey={reminderSelectedKey}
          testID="profile-reminder-sheet"
          title="Nhắc nhở"
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardStack: {
    gap: 12,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCopy: {
    flex: 1,
    gap: 2,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    avatar: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      ...getStickerFace(theme),
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    avatarText: {
      color: theme.colors.accentInk,
      fontSize: theme.typography.size.xl,
      fontWeight: '700',
    },
    streakBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
  });
}
