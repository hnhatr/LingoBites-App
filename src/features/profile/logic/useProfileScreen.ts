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
  type GamificationSnapshot,
  getGamificationSnapshot,
} from '@features/engagement';
import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from '@features/profile/logic/LocalDataDeletionService';

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

  const confirmClearData = useCallback(() => {
    setIsClearDataModalVisible(false);
    setClearDataConfirmText('');
    executeClearData();
  }, [executeClearData]);

  return {
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
    setClearDataConfirmText,
    t,
  };
}

export type ProfileScreenViewModel = ReturnType<typeof useProfileScreen>;
