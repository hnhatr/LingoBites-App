import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Alert} from 'react-native';

import {
  formatCacheBytes,
  playReadyChapterAudio,
  useAudioLibrary,
} from '@features/audio';

import {
  clearAllLocalDataWithFiles,
  clearSpeakingLocalData,
} from './LocalDataDeletionService';

export function useDataSettings() {
  const {t} = useTranslation();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [clearDataConfirmText, setClearDataConfirmText] = useState('');
  const {getAudioCacheStats, listReadyAudioAssets} = useAudioLibrary();
  const audioCacheStats = getAudioCacheStats();
  const audioCacheTrailingLabel = `${formatCacheBytes(
    audioCacheStats.readyBytes,
  )} · ${audioCacheStats.chapterCount} chương`;

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
    audioCacheTrailingLabel,
    clearDataConfirmText,
    confirmClearData,
    dismissClearDataModal,
    handleClearSpeakingData,
    handlePlayCachedAudio,
    hideClearDataModal,
    isClearDataModalVisible,
    openClearDataModal,
    setClearDataConfirmText,
    statusMessage,
  };
}
