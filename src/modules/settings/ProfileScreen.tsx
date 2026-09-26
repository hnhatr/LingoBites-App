import React, {useCallback, useRef, useState} from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ProfileStackParamList} from '@/app/navigation/types';
import {AppButton} from '@components/AppButton';
import {AppCard} from '@components/AppCard';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {MaterialIcon} from '@components/MaterialIcon';
import {ProfileSettingsRow} from '@components/ProfileSettingsRow';
import {SectionHeader} from '@components/SectionHeader';
import {TextField} from '@components/TextField';
import {ThemePicker} from '@components/ThemePicker';
import {getSupportEmail} from '@shared/api/appConfig';
import {
  formatCacheBytes,
  playReadyChapterAudio,
  useAudioLibrary,
} from '../audio';
import {
  getGamificationSnapshot,
  type GamificationSnapshot,
} from '@modules/engagement';
import {useTranslation} from 'react-i18next';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '@shared/localData/LocalDataDeletionService';
import {useFeatureFlags} from '@/release';
import {useAppTheme, type AppTheme} from '@theme';
import {useFloatingTabBarClearance} from '@/app/navigation/tabBarMetrics';
import {formatProfileAccuracy, formatProfileWordCount} from './profileMetrics';
import {useProgressReport} from './useProgressReport';
import {AccountProfileSection, useAccountStore} from '@modules/account';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

/**
 * Header copy: the account store (SETE-303 / T6) drives the display name
 * once boot completes; the placeholder below only shows pre-auth.
 */
const PROFILE_PLACEHOLDER = {
  initials: 'HV',
  name: 'Học viên',
  subtitle: 'Học tiếng Anh · Trình độ Beginner',
} as const;

/** Settings without a backing store yet — show an honest "not set" value. */
const UNSET_TRAILING = {chip: 'Chưa đặt', chipTone: 'neutral' as const};

export function ProfileScreen({navigation}: Props) {
  const accountUser = useAccountStore(state => state.user);
  const accountPhase = useAccountStore(state => state.phase);
  const accountLogout = useAccountStore(state => state.logout);
  const displayName = accountUser?.display_name ?? PROFILE_PLACEHOLDER.name;
  const initials =
    accountUser?.display_name
      ?.normalize('NFC')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => [...part][0] ?? '')
      .join('')
      .toUpperCase() || PROFILE_PLACEHOLDER.initials;
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const {t} = useTranslation();
  const {isFeatureEnabled} = useFeatureFlags();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [clearDataConfirmText, setClearDataConfirmText] = useState('');
  const supportEmail = getSupportEmail();
  const {getAudioCacheStats, listReadyAudioAssets} = useAudioLibrary();
  const {getCapabilityProgressReport} = useProgressReport();
  const audioCacheStats = getAudioCacheStats();
  const audioCacheTrailingLabel = `${formatCacheBytes(
    audioCacheStats.readyBytes,
  )} · ${audioCacheStats.chapterCount} chương`;
  const showThemePicker = isFeatureEnabled('themeSwitcher');

  // Streak / XP / badge / pet state is recomputed from the local gamification
  // event log on every focus so the screen never shows stale engagement data.
  const [gamification, setGamification] = useState<GamificationSnapshot>(() =>
    getGamificationSnapshot(),
  );
  const [learningMetrics, setLearningMetrics] = useState(() => {
    const report = getCapabilityProgressReport();
    return {
      wordsKnownLabel: formatProfileWordCount(0),
      accuracyLabel: formatProfileAccuracy(report.firstListenComprehensionRate),
    };
  });
  useFocusEffect(
    useCallback(() => {
      setGamification(getGamificationSnapshot());
      const report = getCapabilityProgressReport();
      setLearningMetrics({
        wordsKnownLabel: formatProfileWordCount(0),
        accuracyLabel: formatProfileAccuracy(
          report.firstListenComprehensionRate,
        ),
      });
    }, [getCapabilityProgressReport]),
  );
  const streak = gamification.currentStreak;
  const streakTitle =
    streak > 0 ? `Chuỗi ${streak} ngày` : 'Chưa có chuỗi ngày';
  const streakSubtitle =
    streak > 0
      ? 'Tiếp tục duy trì — học gì đó hôm nay nhé!'
      : 'Hoàn thành một phiên ôn tập để bắt đầu chuỗi.';

  function executeClearData() {
    void (async () => {
      const result = await clearAllLocalDataWithFiles();
      if (!result.dbCleared) {
        setStatusMessage(t('settings.clear_data_partial_failure'));
        return;
      }
      setStatusMessage(
        result.ok
          ? t('settings.clear_data_done')
          : t('settings.clear_data_partial_failure'),
      );
    })();
  }

  function handleClearSpeakingData() {
    Alert.alert(
      'Xóa dữ liệu luyện nói',
      t('settings.clear_speaking_data_confirm'),
      [
        {text: 'Hủy', style: 'cancel'},
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await clearSpeakingLocalData();
              setStatusMessage(
                result.ok
                  ? t('settings.clear_speaking_data_done')
                  : t('settings.clear_speaking_data_partial_failure'),
              );
            })();
          },
        },
      ],
    );
  }

  function handleSupport() {
    const subject = encodeURIComponent('LingoBites — Góp ý / báo lỗi');
    void Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  /**
   * Confirmed logout (TASK-006): delegates to the single account-store
   * logout lifecycle. A second confirm while one is pending is rejected so
   * the UI issues at most one operation; the old token is never retained
   * or retried here. Success transitions away through the account gate;
   * only a local secure-storage failure shows a message — never a false
   * success, and never a claim about remote revocation.
   */
  async function executeLogout() {
    if (isLoggingOutRef.current) {
      return;
    }
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    try {
      await accountLogout();
      if (useAccountStore.getState().phase !== 'signed-out') {
        setStatusMessage(t('account.sign_out_failed'));
      }
    } finally {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      t('account.sign_out_confirm_title'),
      t('account.sign_out_confirm_message'),
      [
        {text: t('account.sign_out_cancel'), style: 'cancel'},
        {
          text: t('account.sign_out_confirm'),
          style: 'destructive',
          onPress: () => {
            void executeLogout();
          },
        },
      ],
    );
  }

  /** Plays the first downloaded pronunciation clip — offline playback QA (VC-4). */
  async function handlePlayCachedAudio() {
    const ready = listReadyAudioAssets();
    if (ready.length === 0) {
      Alert.alert(
        'Âm thanh chương học',
        'Chưa có âm thanh được tải về máy. Tải chương học khi có mạng rồi thử lại.',
      );
      return;
    }
    const result = await playReadyChapterAudio(ready[0].id);
    if (!result.ok) {
      Alert.alert('Âm thanh chương học', result.message);
    }
  }

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
              {PROFILE_PLACEHOLDER.subtitle}
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
            <View style={{flex: 1}} />
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
            onPress={() => navigation.navigate('ProgressReport')}
            trailing="chevron"
          />
          <ProfileSettingsRow
            accessibilityLabel="Quyền riêng tư"
            icon="visibility"
            label="Quyền riêng tư"
            medallionTone="gold"
            onPress={() => navigation.navigate('PrivacyNote')}
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
          {/* Developer diagnostics — hidden on production builds (__DEV__ is read
              at render time so tests can toggle it). */}
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel={t('settings.feature_status')}
              icon="bolt"
              label={t('settings.feature_status')}
              medallionTone="teal"
              onPress={() => navigation.navigate('FeatureStatus')}
              trailing="chevron"
            />
          ) : null}
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel="Mở bản demo native TTS"
              icon="volume_up"
              label="Demo native TTS"
              medallionTone="coral"
              onPress={() => navigation.navigate('TtsSpike')}
              trailing="chevron"
            />
          ) : null}
          {/* LING-21 manual verification entry (per reporter request):
              opens the unified Lesson catalog directly without enabling
              the rollout flag. Dev builds only. */}
          {__DEV__ ? (
            <ProfileSettingsRow
              accessibilityLabel="Mở bản xem trước Unified Lessons"
              icon="school"
              label="Unified Lessons (Preview)"
              medallionTone="gold"
              onPress={() => navigation.navigate('UnifiedLessonsPreview')}
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
              onPress={() => setIsClearDataModalVisible(true)}
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
        onRequestClose={() => setIsClearDataModalVisible(false)}
      >
        <View style={themedStyles.modalOverlay}>
          <AppCard style={themedStyles.modalContent}>
            <AppText variant="h2" style={{marginBottom: 8}}>
              Xóa dữ liệu học trên máy
            </AppText>
            <AppText color="secondary" style={{marginBottom: 16}}>
              Hành động này sẽ xóa toàn bộ tiến trình học, XP, và lịch sử. Không
              thể khôi phục.
            </AppText>
            <AppText style={{marginBottom: 8}}>
              Nhập chữ <AppText style={{fontWeight: 'bold'}}>XOA</AppText> để
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
                onPress={() => {
                  setIsClearDataModalVisible(false);
                  setClearDataConfirmText('');
                }}
                style={{flex: 1}}
              />
              <AppButton
                title="Xóa"
                variant="primary"
                disabled={clearDataConfirmText !== 'XOA'}
                onPress={() => {
                  setIsClearDataModalVisible(false);
                  setClearDataConfirmText('');
                  executeClearData();
                }}
                style={{backgroundColor: theme.colors.danger, flex: 1}}
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
  });
}
