import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useIsOffline} from '@core/api/connectivity';

import {useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {AppText} from './AppText';
import {OFFLINE_PALETTE} from './Banner';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  topInset?: number;
  /** The screen shows a copy saved on the device: adds a "Đã tải" chip. */
  downloaded?: boolean;
};

/**
 * Soft yellow bar shown while the Server is unreachable
 * (docs/architecture/offline-mode.md §3). Renders nothing online.
 */
export function OfflineBanner({topInset = 0, downloaded = false}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const offline = useIsOffline();
  if (!offline) {
    return null;
  }
  return (
    <View
      style={{
        paddingHorizontal: theme.gutter,
        paddingTop: theme.spacing.sm + topInset,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.bar, getStickerEdge(3, OFFLINE_PALETTE.edge)]}
        testID="offline-banner"
      >
        <View style={[styles.icon, getStickerEdge(2, OFFLINE_PALETTE.edge)]}>
          <MaterialIcon
            color={OFFLINE_PALETTE.ink}
            name="cloud_off"
            size={19}
          />
        </View>
        <View style={styles.copy}>
          <AppText style={styles.title}>{t('offline.banner_title')}</AppText>
          <AppText style={styles.body}>{t('offline.banner_body')}</AppText>
        </View>
        {downloaded ? (
          <View
            style={[styles.chip, getStickerEdge(2, OFFLINE_PALETTE.edge)]}
            testID="offline-banner-downloaded"
          >
            <MaterialIcon
              color={OFFLINE_PALETTE.ink}
              name="download_done"
              size={14}
            />
            <AppText style={styles.chipText}>
              {t('offline.banner_downloaded')}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: OFFLINE_PALETTE.face,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: OFFLINE_PALETTE.white,
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: OFFLINE_PALETTE.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  body: {
    color: OFFLINE_PALETTE.body,
    fontSize: 12,
    lineHeight: 16,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: OFFLINE_PALETTE.white,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    color: OFFLINE_PALETTE.ink,
    fontSize: 12,
    fontWeight: '800',
  },
});
