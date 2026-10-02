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

import type {ProfileScreenViewModel} from '../logic/useProfileScreen';

/** Settings without a backing store yet — show an honest "not set" value. */
const UNSET_TRAILING = {chip: 'Chưa đặt', chipTone: 'neutral' as const};

export type ProfileScreenViewProps = ProfileScreenViewModel;

export function ProfileScreenView({
  accountPhase,
  audioCacheTrailingLabel,
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
  openLessonCatalogDev,
  setClearDataConfirmText,
  t,
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
            <View style={[styles.metricCard, themedStyles.metricAccent]}>
              <AppText style={themedStyles.metricValuePrimary}>
                {t(`gamification.pet_stage.${gamification.pet.stageId}`)}
              </AppText>
              <AppText style={themedStyles.metricLabelPrimary}>Cây ảo</AppText>
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
            <View style={themedStyles.flex1} />
          </View>
        </View>

        <View style={styles.settingsSection}>
          <SectionHeader title="Cài đặt" />
          <ProfileSettingsRow
            icon="flag"
            label="Mục tiêu hàng ngày"
            medallionTone="teal"
            trailing={UNSET_TRAILING}
          />
          <ProfileSettingsRow
            icon="translate"
            label="Ngôn ngữ app"
            medallionTone="coral"
            trailing={UNSET_TRAILING}
          />
          <ProfileSettingsRow
            icon="subtitles"
            label="Dịch sang"
            medallionTone="gold"
            trailing={UNSET_TRAILING}
          />
          <ProfileSettingsRow
            icon="notifications"
            label="Nhắc nhở"
            medallionTone="teal"
            trailing={UNSET_TRAILING}
          />
          <ProfileSettingsRow
            accessibilityLabel="Dung lượng âm thanh chương học đã tải về máy — bấm để nghe thử clip đã tải"
            icon="volume_up"
            label="Âm thanh chương học"
            medallionTone="teal"
            onPress={handlePlayCachedAudio}
            trailing={{text: audioCacheTrailingLabel}}
          />
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
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel="Mở danh mục bài học (dev)"
              icon="school"
              label="Lesson Catalog (dev)"
              medallionTone="gold"
              onPress={openLessonCatalogDev}
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
    borderRadius: 18,
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
      borderRadius: theme.radius.lg,
      borderWidth: 1,
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
      color: theme.colors.primary,
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.medium,
      marginLeft: theme.spacing.xs,
    },
    metricAccent: {
      backgroundColor: theme.colors.accentSoft,
    },
    metricLabelPrimary: {
      color: theme.colors.primary,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.medium,
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
      backgroundColor: theme.colors.secondarySoft,
    },
    metricTertiary: {
      backgroundColor: theme.colors.tertiarySoft,
    },
    metricValuePrimary: {
      color: theme.colors.primary,
      fontSize: 26,
      fontWeight: '700',
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
      ...theme.shadow.medium,
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
