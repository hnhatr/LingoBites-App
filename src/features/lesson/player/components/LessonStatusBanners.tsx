import React from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {Banner} from '@ui/components/Banner';

import {useIsOffline} from '@core/api/connectivity';

export type LessonStatusBannersProps = {
  /** Snapshot came from the offline download row. */
  offline?: boolean;
  /** The status check saw a higher revision than the stored copy. */
  hasUpdate?: boolean;
};

/**
 * Offline-copy and newer-revision notices shown above lesson content. While
 * the device is offline the screen's offline bar already says the lesson is
 * the downloaded copy, so the offline-copy notice stays hidden then.
 */
export function LessonStatusBanners({
  offline,
  hasUpdate,
}: LessonStatusBannersProps) {
  const {t} = useTranslation();
  const deviceOffline = useIsOffline();
  return (
    <>
      {offline && !deviceOffline ? (
        <View testID="canonical-player-offline">
          <Banner
            icon="download_done"
            message={t('lessonPlayer.offline_banner')}
            variant="neutral"
          />
        </View>
      ) : null}
      {hasUpdate ? (
        <View testID="canonical-player-update">
          <Banner
            icon="auto_awesome"
            message={t('lessonPlayer.update_banner')}
          />
        </View>
      ) : null}
    </>
  );
}
