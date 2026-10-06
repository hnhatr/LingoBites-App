import React from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AccountProfileSection} from '@features/account';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SectionHeader} from '@ui/components/SectionHeader';
import {TextField} from '@ui/components/TextField';
import {ThemePicker} from '@ui/components/ThemePicker';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerFace} from '@ui/theme/hardShadow';

import {SettingsOptionSheet} from '../components/SettingsOptionSheet';
import type {ProfileScreenViewModel} from '../logic/useProfileScreen';

export type ProfileScreenViewProps = ProfileScreenViewModel & {
  speakingRecordingsSection?: React.ReactNode;
};

export function ProfileScreenView({
  accountPhase,
  audioCacheTrailingLabel,
  closeSettingsSheet,
  handleSyncNow,
  isSyncing,
  openReminderSheet,
  openSettingsSheet,
  openWeeklyGoalSheet,
  reminderSelectedKey,
  reminderSheetOptions,
  reminderTrailingLabel,
  selectReminder,
  selectWeeklyGoal,
  syncTrailingLabel,
  weeklyGoalSelectedKey,
  weeklyGoalSheetOptions,
  weeklyGoalTrailingLabel,
  clearDataConfirmText,
  displayName,
  gamification,
  initials,
  isClearDataModalVisible,
  isLoggingOut,
  learningMetrics,
  profileSubtitle,
  showThemePicker,
  statusMessage,
  streakSubtitle,
  streakTitle,
  confirmClearData,
  dismissClearDataModal,
  hideClearDataModal,
  handleClearSpeakingData,
  handlePlayCachedAudio,
  handleSignOut,
  handleSupport,
  openClearDataModal,
  openFeatureStatus,
  openPrivacyNote,
  openProgressReport,
  openTtsSpike,
  setClearDataConfirmText,
  t,
  speakingRecordingsSection,
}: ProfileScreenViewProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <AppScreen>
      <View style={themedStyles.header}>
        <AppText style={themedStyles.headerTitle}>Hồ sơ</AppText>
      </View>

      <ScrollView
        contentContainerStyle={[
          themedStyles.scrollContent,
          {paddingBottom: feedClearance},
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.profileCard}>
          <View style={themedStyles.avatar}>
            <AppText style={themedStyles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.profileCopy}>
            <AppText variant="h3">{displayName}</AppText>
            <AppText color="secondary" variant="caption">
              {profileSubtitle}
            </AppText>
          </View>
        </AppCard>

        <AccountProfileSection />

        <View style={themedStyles.streakCard}>
          <MaterialIcon
            color={theme.colors.accentInk}
            name="local_fire_department"
            size={42}
          />
          <View style={styles.streakCopy}>
            <AppText style={themedStyles.streakTitle}>{streakTitle}</AppText>
            <AppText style={themedStyles.streakSubtitle}>
              {streakSubtitle}
            </AppText>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, themedStyles.metricTertiary]}>
              <AppText style={themedStyles.metricValueTertiary}>
                {gamification.totalXp}
              </AppText>
              <AppText style={themedStyles.metricLabelTertiary}>
                XP đã đạt
              </AppText>
            </View>
            <View style={[styles.metricCard, themedStyles.metricSecondary]}>
              <AppText style={themedStyles.metricValueSecondary}>
                {gamification.badges.length}
              </AppText>
              <AppText style={themedStyles.metricLabelSecondary}>
                Huy hiệu
              </AppText>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, themedStyles.metricTertiary]}>
              <AppText style={themedStyles.metricValueTertiary}>
                {learningMetrics.wordsKnownLabel}
              </AppText>
              <AppText style={themedStyles.metricLabelTertiary}>
                Từ đã biết
              </AppText>
            </View>
            <View style={[styles.metricCard, themedStyles.metricSecondary]}>
              <AppText style={themedStyles.metricValueSecondary}>
                {learningMetrics.accuracyLabel}
              </AppText>
              <AppText style={themedStyles.metricLabelSecondary}>
                Độ chính xác
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <SectionHeader title="Cài đặt" />
          <ProfileSettingsRow
            accessibilityLabel={`Mục tiêu tuần: ${weeklyGoalTrailingLabel}`}
            icon="flag"
            label="Mục tiêu tuần"
            medallionTone="teal"
            onPress={openWeeklyGoalSheet}
            trailing={{text: weeklyGoalTrailingLabel}}
          />
          <ProfileSettingsRow
            accessibilityLabel={`Nhắc nhở: ${reminderTrailingLabel}`}
            icon="notifications"
            label="Nhắc nhở"
            medallionTone="coral"
            onPress={openReminderSheet}
            trailing={{text: reminderTrailingLabel}}
          />
          {accountPhase === 'authenticated' ? (
            <ProfileSettingsRow
              accessibilityHint="Gửi và nhận dữ liệu học với tài khoản ngay bây giờ"
              accessibilityLabel={`Đồng bộ ngay. ${syncTrailingLabel}`}
              icon="refresh"
              label="Đồng bộ ngay"
              medallionTone="gold"
              onPress={isSyncing ? undefined : handleSyncNow}
              trailing={{text: syncTrailingLabel}}
            />
          ) : null}
          <ProfileSettingsRow
            accessibilityLabel="Dung lượng âm thanh chương học đã tải về máy — bấm để nghe thử clip đã tải"
            icon="volume_up"
            label="Âm thanh chương học"
            medallionTone="teal"
            onPress={handlePlayCachedAudio}
            trailing={{text: audioCacheTrailingLabel}}
          />
          {speakingRecordingsSection}
          <ProfileSettingsRow
            accessibilityLabel="Báo cáo tiến độ và năng lực"
            icon="analytics"
            label="Báo cáo tiến độ & Năng lực"
            medallionTone="teal"
            onPress={openProgressReport}
            trailing="chevron"
          />
          <ProfileSettingsRow
            accessibilityLabel="Quyền riêng tư"
            icon="visibility"
            label="Quyền riêng tư"
            medallionTone="gold"
            onPress={openPrivacyNote}
            trailing="chevron"
          />
          <ProfileSettingsRow
            accessibilityLabel="Trợ giúp và góp ý"
            icon="help"
            label="Trợ giúp & góp ý"
            medallionTone="coral"
            onPress={handleSupport}
            trailing="chevron"
          />
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel={t('settings.feature_status')}
              icon="bolt"
              label={t('settings.feature_status')}
              medallionTone="teal"
              onPress={openFeatureStatus}
              trailing="chevron"
            />
          ) : null}
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel="Mở bản demo native TTS"
              icon="volume_up"
              label="Demo native TTS"
              medallionTone="coral"
              onPress={openTtsSpike}
              trailing="chevron"
            />
          ) : null}
        </View>

        {showThemePicker ? (
          <AppCard style={themedStyles.themeCard}>
            <AppText variant="h3">Giao diện</AppText>
            <AppText color="secondary" variant="caption">
              Chọn theme — áp dụng ngay cho toàn app.
            </AppText>
            <ThemePicker />
          </AppCard>
        ) : null}

        <View style={styles.settingsSection}>
          <SectionHeader title="Vùng nguy hiểm" />

          <View style={styles.dangerActionContainer}>
            <Pressable
              accessibilityLabel="Xóa dữ liệu luyện nói"
              accessibilityRole="button"
              onPress={handleClearSpeakingData}
              style={({pressed}) => [
                themedStyles.dangerButton,
                pressed && themedStyles.pressed,
              ]}
            >
              <AppText color="danger" style={themedStyles.dangerButtonText}>
                Xóa dữ liệu luyện nói & ghi âm
              </AppText>
            </Pressable>
            <AppText
              color="secondary"
              variant="caption"
              style={styles.dangerCaption}
            >
              Xóa toàn bộ bản ghi âm và lịch sử luyện nói. Không thể khôi phục.
            </AppText>
          </View>

          <View style={styles.dangerActionContainer}>
            <Pressable
              accessibilityLabel="Xóa dữ liệu học trên máy"
              accessibilityRole="button"
              onPress={openClearDataModal}
              style={({pressed}) => [
                themedStyles.dangerButton,
                pressed && themedStyles.pressed,
              ]}
            >
              <AppText color="danger" style={themedStyles.dangerButtonText}>
                Xóa dữ liệu học trên máy
              </AppText>
            </Pressable>
            <AppText
              color="secondary"
              variant="caption"
              style={styles.dangerCaption}
            >
              Xóa toàn bộ tiến trình học, XP, và lịch sử. Không thể khôi phục.
            </AppText>
          </View>

          {accountPhase === 'authenticated' ? (
            <View style={styles.dangerActionContainer}>
              <Pressable
                accessibilityHint={t('account.sign_out_hint')}
                accessibilityLabel={t('account.sign_out')}
                accessibilityRole="button"
                disabled={isLoggingOut}
                onPress={handleSignOut}
                style={({pressed}) => [
                  themedStyles.dangerButton,
                  pressed && themedStyles.pressed,
                ]}
              >
                <AppText color="danger" style={themedStyles.dangerButtonText}>
                  {t('account.sign_out')}
                </AppText>
              </Pressable>
              <AppText
                color="secondary"
                variant="caption"
                style={styles.dangerCaption}
              >
                {t('account.sign_out_caption')}
              </AppText>
            </View>
          ) : null}
        </View>

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

      <Modal
        animationType="fade"
        transparent
        visible={isClearDataModalVisible}
        onRequestClose={hideClearDataModal}
      >
        <View style={themedStyles.modalOverlay}>
          <AppCard style={themedStyles.modalContent}>
            <AppText variant="h2" style={themedStyles.mb8}>
              Xóa dữ liệu học trên máy
            </AppText>
            <AppText color="secondary" style={themedStyles.mb16}>
              Hành động này sẽ xóa toàn bộ tiến trình học, XP, và lịch sử. Không
              thể khôi phục.
            </AppText>
            <AppText style={themedStyles.mb8}>
              Nhập chữ <AppText style={themedStyles.boldText}>XOA</AppText> để
              xác nhận:
            </AppText>
            <TextField
              value={clearDataConfirmText}
              onChangeText={setClearDataConfirmText}
              placeholder="XOA"
              autoCapitalize="characters"
            />
            <View style={themedStyles.modalActions}>
              <AppButton
                title="Hủy"
                variant="secondary"
                onPress={dismissClearDataModal}
                style={themedStyles.flex1}
              />
              <AppButton
                title="Xóa"
                variant="primary"
                disabled={clearDataConfirmText !== 'XOA'}
                onPress={confirmClearData}
                style={[
                  themedStyles.flex1,
                  {backgroundColor: theme.colors.danger},
                ]}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  dangerActionContainer: {
    gap: 6,
    marginBottom: 8,
  },
  dangerCaption: {
    textAlign: 'center',
  },
  metricCard: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  metricsContainer: {
    gap: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  settingsSection: {
    gap: 10,
  },
  streakCopy: {
    flex: 1,
    gap: 4,
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
    dangerButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.danger,
      borderRadius: 20,
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 48,
      opacity: 1,
      paddingHorizontal: theme.spacing.lg,
    },
    dangerButtonText: {
      fontWeight: theme.typography.weight.bold,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      height: 56,
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
    },
    headerTitle: {
      color: theme.colors.text.primary,
      fontSize: theme.typography.presets.h2.fontSize,
      fontWeight: theme.typography.weight.bold,
      marginLeft: theme.spacing.xs,
    },
    metricLabelSecondary: {
      color: theme.colors.secondary,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.medium,
    },
    metricLabelTertiary: {
      color: theme.colors.tertiary,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.medium,
    },
    metricSecondary: {
      backgroundColor: solidOver(
        theme.colors.secondarySoft,
        theme.colors.surface,
      ),
      ...getStickerFace(theme, 3),
    },
    metricTertiary: {
      backgroundColor: solidOver(
        theme.colors.tertiarySoft,
        theme.colors.surface,
      ),
      ...getStickerFace(theme, 3),
    },
    metricValueSecondary: {
      color: theme.colors.secondary,
      fontSize: 26,
      fontWeight: '700',
    },
    metricValueTertiary: {
      color: theme.colors.tertiary,
      fontSize: 26,
      fontWeight: '700',
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    modalContent: {
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    modalOverlay: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    petMetricValue: {
      color: theme.colors.primary,
      fontSize: theme.typography.size.lg,
      fontWeight: '700',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    streakCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: 14,
      padding: theme.spacing.lg,
      ...(getStickerFace(theme, 4) ?? theme.shadow.medium),
    },
    streakSubtitle: {
      color: theme.colors.accentInk,
      fontSize: theme.typography.size.xs,
      opacity: 0.85,
    },
    streakTitle: {
      color: theme.colors.accentInk,
      fontSize: theme.typography.presets.h2.fontSize,
      fontWeight: theme.typography.weight.medium,
    },
    themeCard: {
      gap: theme.spacing.sm,
    },
    flex1: {
      flex: 1,
    },
    mb8: {
      marginBottom: 8,
    },
    mb16: {
      marginBottom: 16,
    },
    boldText: {
      fontWeight: 'bold',
    },
  });
}
