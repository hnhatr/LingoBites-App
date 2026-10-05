import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Alert, Linking} from 'react-native';

import {useAccountStore} from '@features/account';
import {
  formatCacheBytes,
  playReadyChapterAudio,
  useAudioLibrary,
} from '@features/audio';
import {
  applyReminderSettings,
  DAILY_REMINDER_TIME_OPTIONS,
  type GamificationSnapshot,
  getGamificationSnapshot,
  getReminderSettings,
  getWeeklyGoalTarget,
  type ReminderSettings,
  saveReminderSettings,
  setWeeklyGoalTarget,
  WEEKLY_GOAL_OPTIONS,
} from '@features/engagement';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '@features/profile/logic/LocalDataDeletionService';
import {formatLastSyncedLabel, readLastSyncedAt, syncNow} from '@features/sync';

import {getSupportEmail} from '@core/api/appConfig';
import {useFeatureFlags} from '@core/release';

import type {ProfileStackParamList} from '../screens/navigationTypes';
import {formatProfileAccuracy, formatProfileWordCount} from './profileMetrics';
import {useProgressReport} from './useProgressReport';

/**
 * Header copy: the account store (SETE-303 / T6) drives the display name
 * once boot completes; the placeholder below only shows pre-auth.
 */
const PROFILE_PLACEHOLDER = {
  initials: 'HV',
  name: 'Học viên',
  subtitle: 'Học tiếng Anh · Trình độ Beginner',
} as const;

/** Which Cài đặt picker sheet is open, if any (F6). */
export type ProfileSettingsSheet = 'weeklyGoal' | 'reminder' | null;

const REMINDER_OFF_KEY = 'off';
const REMINDER_GOLDEN_HOUR_KEY = 'golden-hour';

const WEEKLY_GOAL_SHEET_OPTIONS = WEEKLY_GOAL_OPTIONS.map(target => ({
  key: String(target),
  label: `${target} bài/tuần`,
}));

const REMINDER_SHEET_OPTIONS = [
  {key: REMINDER_OFF_KEY, label: 'Tắt nhắc nhở'},
  {
    key: REMINDER_GOLDEN_HOUR_KEY,
    label: 'Chỉ nhắc giờ vàng',
    caption: 'Nhắc khi có thẻ đến lịch ôn.',
  },
  ...DAILY_REMINDER_TIME_OPTIONS.map(time => ({
    key: time,
    label: `Mỗi ngày lúc ${time}`,
    caption: 'Kèm nhắc giờ vàng khi có thẻ đến lịch ôn.',
  })),
];

function reminderKey(settings: ReminderSettings): string {
  if (!settings.enabled) {
    return REMINDER_OFF_KEY;
  }
  return settings.dailyTime ?? REMINDER_GOLDEN_HOUR_KEY;
}

function reminderSettingsForKey(key: string): ReminderSettings {
  if (key === REMINDER_OFF_KEY) {
    return {enabled: false, dailyTime: null};
  }
  if (key === REMINDER_GOLDEN_HOUR_KEY) {
    return {enabled: true, dailyTime: null};
  }
  return {enabled: true, dailyTime: key};
}

function reminderTrailingLabel(settings: ReminderSettings): string {
  if (!settings.enabled) {
    return 'Tắt';
  }
  return settings.dailyTime ?? 'Giờ vàng';
}

export type ProfileScreenNavigation = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileMain'
>;

export function useProfileScreen(navigation: ProfileScreenNavigation) {
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
  const profileSubtitle = PROFILE_PLACEHOLDER.subtitle;
  const {t} = useTranslation();
  const {isFeatureEnabled} = useFeatureFlags();
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

  const [gamification, setGamification] = useState<GamificationSnapshot>(() =>
    getGamificationSnapshot(),
  );
  const [openSettingsSheet, setOpenSettingsSheet] =
    useState<ProfileSettingsSheet>(null);
  const [weeklyGoalTarget, setWeeklyGoalTargetState] = useState(() =>
    getWeeklyGoalTarget(),
  );
  const [reminderSettings, setReminderSettings] = useState(() =>
    getReminderSettings(),
  );
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readLastSyncedAt());
  const [isSyncing, setIsSyncing] = useState(false);
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
      setWeeklyGoalTargetState(getWeeklyGoalTarget());
      setReminderSettings(getReminderSettings());
      setLastSyncedAt(readLastSyncedAt());
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
      : 'Học một bài, ôn thẻ hoặc luyện nói để bắt đầu chuỗi.';

  const executeClearData = useCallback(() => {
    (async () => {
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
  }, [t]);

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
            (async () => {
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
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  /**
   * Confirmed logout (TASK-006): delegates to the single account-store
   * logout lifecycle. A second confirm while one is pending is rejected so
   * the UI issues at most one operation; the old token is never retained
   * or retried here.
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
            executeLogout();
          },
        },
      ],
    );
  }

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

  const openProgressReport = useCallback(() => {
    navigation.navigate('ProgressReport');
  }, [navigation]);

  const openPrivacyNote = useCallback(() => {
    navigation.navigate('PrivacyNote');
  }, [navigation]);

  const openFeatureStatus = useCallback(() => {
    navigation.navigate('FeatureStatus');
  }, [navigation]);

  const openTtsSpike = useCallback(() => {
    navigation.navigate('TtsSpike');
  }, [navigation]);

  const hideClearDataModal = useCallback(() => {
    setIsClearDataModalVisible(false);
  }, []);

  const dismissClearDataModal = useCallback(() => {
    setIsClearDataModalVisible(false);
    setClearDataConfirmText('');
  }, []);

  const openClearDataModal = useCallback(() => {
    setIsClearDataModalVisible(true);
  }, []);

  const closeSettingsSheet = useCallback(() => {
    setOpenSettingsSheet(null);
  }, []);

  const openWeeklyGoalSheet = useCallback(() => {
    setOpenSettingsSheet('weeklyGoal');
  }, []);

  const openReminderSheet = useCallback(() => {
    setOpenSettingsSheet('reminder');
  }, []);

  const selectWeeklyGoal = useCallback((key: string) => {
    setOpenSettingsSheet(null);
    const target = Number(key);
    if (!setWeeklyGoalTarget(target)) {
      setStatusMessage('Chưa lưu được mục tiêu tuần. Vui lòng thử lại.');
      return;
    }
    setWeeklyGoalTargetState(target);
    setGamification(getGamificationSnapshot());
  }, []);

  const selectReminder = useCallback((key: string) => {
    setOpenSettingsSheet(null);
    const next = reminderSettingsForKey(key);
    if (!saveReminderSettings(next)) {
      setStatusMessage('Chưa lưu được cài đặt nhắc nhở. Vui lòng thử lại.');
      return;
    }
    setReminderSettings(next);
    applyReminderSettings({prompt: next.enabled})
      .then(result => {
        if (result === 'denied') {
          Alert.alert(
            'Thông báo đang bị tắt',
            'Hãy cho phép LingoBites gửi thông báo trong Cài đặt của máy để nhận nhắc nhở.',
            [
              {text: 'Để sau', style: 'cancel'},
              {
                text: 'Mở Cài đặt',
                onPress: () => {
                  Linking.openSettings().catch(() => {});
                },
              },
            ],
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleSyncNow = useCallback(() => {
    if (isSyncing) {
      return;
    }
    setIsSyncing(true);
    syncNow()
      .then(ok => {
        if (!ok) {
          setStatusMessage(
            'Chưa đồng bộ được. Kiểm tra kết nối mạng rồi thử lại.',
          );
        }
      })
      .catch(() => {
        setStatusMessage(
          'Chưa đồng bộ được. Kiểm tra kết nối mạng rồi thử lại.',
        );
      })
      .finally(() => {
        setLastSyncedAt(readLastSyncedAt());
        setIsSyncing(false);
      });
  }, [isSyncing]);

  const weeklyGoalTrailingLabel = `${weeklyGoalTarget} bài/tuần`;
  const syncTrailingLabel = isSyncing
    ? 'Đang đồng bộ…'
    : `Lần cuối: ${formatLastSyncedLabel(lastSyncedAt)}`;

  const confirmClearData = useCallback(() => {
    setIsClearDataModalVisible(false);
    setClearDataConfirmText('');
    executeClearData();
  }, [executeClearData]);

  return {
    accountPhase,
    audioCacheTrailingLabel,
    closeSettingsSheet,
    handleSyncNow,
    isSyncing,
    openReminderSheet,
    openSettingsSheet,
    openWeeklyGoalSheet,
    reminderSelectedKey: reminderKey(reminderSettings),
    reminderSheetOptions: REMINDER_SHEET_OPTIONS,
    reminderTrailingLabel: reminderTrailingLabel(reminderSettings),
    selectReminder,
    selectWeeklyGoal,
    syncTrailingLabel,
    weeklyGoalSelectedKey: String(weeklyGoalTarget),
    weeklyGoalSheetOptions: WEEKLY_GOAL_SHEET_OPTIONS,
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
  };
}

export type ProfileScreenViewModel = ReturnType<typeof useProfileScreen>;
