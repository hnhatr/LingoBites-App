import {useCallback, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Alert} from 'react-native';

import {useAccountStore} from '@features/account';
import {formatLastSyncedLabel, readLastSyncedAt, syncNow} from '@features/sync';

import {useConnectivityStore} from '@core/api/connectivity';

export function useAccountSettings() {
  const {t} = useTranslation();
  const accountPhase = useAccountStore(state => state.phase);
  const accountLogout = useAccountStore(state => state.logout);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => readLastSyncedAt());
  const [isSyncing, setIsSyncing] = useState(false);

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
    // Offline mode (#32): signing out offline locks the app until the
    // network is back, so the confirmation says so.
    const offline = useConnectivityStore.getState().status === 'offline';
    Alert.alert(
      t('account.sign_out_confirm_title'),
      offline
        ? t('offline.sign_out_warning')
        : t('account.sign_out_confirm_message'),
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

  const syncTrailingLabel = isSyncing
    ? 'Đang đồng bộ…'
    : `Lần cuối: ${formatLastSyncedLabel(lastSyncedAt)}`;

  return {
    accountPhase,
    handleSignOut,
    handleSyncNow,
    isLoggingOut,
    isSyncing,
    statusMessage,
    syncTrailingLabel,
    t,
  };
}
