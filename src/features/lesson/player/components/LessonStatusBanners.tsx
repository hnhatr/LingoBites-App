import React from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {Banner} from '@ui/components/Banner';

export type LessonStatusBannersProps = {
  /** Snapshot came from the offline download row. */
  offline?: boolean;
  /** The status check saw a higher revision than the stored copy. */
  hasUpdate?: boolean;
};

/** Offline-copy and newer-revision notices shown above lesson content. */
export function LessonStatusBanners({
  offline,
  hasUpdate,
}: LessonStatusBannersProps) {
  const {t} = useTranslation();
  return (
    <>
      {offline ? (
        <View testID="canonical-player-offline">
          <Banner
            message={t('lessonPlayer.offline_banner')}
            variant="neutral"
          />
        </View>
      ) : null}
      {hasUpdate ? (
        <View testID="canonical-player-update">
          <Banner message={t('lessonPlayer.update_banner')} />
        </View>
      ) : null}
    </>
  );
}
