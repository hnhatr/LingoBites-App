import React from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';

import {AccountProfileSection} from '@features/account';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SectionHeader} from '@ui/components/SectionHeader';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {StatTile} from '@ui/components/StatTile';
import {TextField} from '@ui/components/TextField';
import {ThemePicker} from '@ui/components/ThemePicker';
import {type AppTheme, useAppTheme} from '@ui/theme';
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
        <AppCard>
          <View style={styles.cardStack}>
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
            </View>
            <AccountProfileSection />
          </View>
        </AppCard>

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
          <ProfileSettingsRow
            accessibilityLabel="Báo cáo tiến độ và năng lực"
            icon="analytics"
            label="Báo cáo tiến độ & Năng lực"
            medallionTone="teal"
            onPress={openProgressReport}
            trailing="chevron"
          />
        </SettingsGroup>

        <SettingsGroup title="Dữ liệu & đồng bộ">
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
        </SettingsGroup>

        {speakingRecordingsSection ? (
          <SettingsGroup title="Bản ghi giọng nói">
            {speakingRecordingsSection}
          </SettingsGroup>
        ) : null}

        {showThemePicker ? (
          <SettingsGroup title="Giao diện">
            <View style={themedStyles.themeBody}>
              <AppText color="secondary" variant="caption">
                Chọn theme — áp dụng ngay cho toàn app.
              </AppText>
              <ThemePicker />
            </View>
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Hỗ trợ">
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
        </SettingsGroup>

        {__DEV__ ? (
          <SettingsGroup title="Dành cho dev">
            <ProfileSettingsRow
              accessibilityLabel={t('settings.feature_status')}
              icon="bolt"
              label={t('settings.feature_status')}
              medallionTone="teal"
              onPress={openFeatureStatus}
              trailing="chevron"
            />
            <ProfileSettingsRow
              accessibilityLabel="Mở bản demo native TTS"
              icon="volume_up"
              label="Demo native TTS"
              medallionTone="coral"
              onPress={openTtsSpike}
              trailing="chevron"
            />
          </SettingsGroup>
        ) : null}

        {accountPhase === 'authenticated' ? (
          <SettingsGroup title="Tài khoản">
            <View>
              <ProfileSettingsRow
                accessibilityHint={t('account.sign_out_hint')}
                accessibilityLabel={t('account.sign_out')}
                icon="person"
                label={t('account.sign_out')}
                medallionTone="teal"
                disabled={isLoggingOut}
                onPress={handleSignOut}
                trailing="chevron"
              />
              <AppText
                color="secondary"
                style={themedStyles.rowCaption}
                variant="caption"
              >
                {t('account.sign_out_caption')}
              </AppText>
            </View>
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Vùng nguy hiểm">
          <View>
            <ProfileSettingsRow
              accessibilityLabel="Xóa dữ liệu luyện nói"
              destructive
              icon="delete"
              label="Xóa dữ liệu luyện nói & ghi âm"
              onPress={handleClearSpeakingData}
              trailing="chevron"
            />
            <AppText
              color="secondary"
              style={themedStyles.rowCaption}
              variant="caption"
            >
              Xóa toàn bộ bản ghi âm và lịch sử luyện nói. Không thể khôi phục.
            </AppText>
          </View>
          <View>
            <ProfileSettingsRow
              accessibilityLabel="Xóa dữ liệu học trên máy"
              destructive
              icon="delete"
              label="Xóa dữ liệu học trên máy"
              onPress={openClearDataModal}
              trailing="chevron"
            />
            <AppText
              color="secondary"
              style={themedStyles.rowCaption}
              variant="caption"
            >
              Xóa toàn bộ tiến trình học, XP, và lịch sử. Không thể khôi phục.
            </AppText>
          </View>
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
    rowCaption: {
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    streakBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    themeBody: {
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
      color: theme.colors.text.primary,
      fontSize: theme.typography.presets.h2.fontSize,
      fontWeight: theme.typography.weight.bold,
      marginLeft: theme.spacing.xs,
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
    scrollContent: {
      gap: theme.spacing.lg,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
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
