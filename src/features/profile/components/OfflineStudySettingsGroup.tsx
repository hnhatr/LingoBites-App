import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {formatCacheBytes} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {useAppTheme} from '@ui/theme';

import {
  MEDIA_CONSENT_LABELS,
  useOfflineStudySettings,
} from '../logic/useOfflineStudySettings';
import {SettingsOptionSheet} from './SettingsOptionSheet';

const CONSENT_OPTIONS = [
  {
    key: 'auto',
    label: 'Tự động tải',
    caption: 'Tải ảnh và âm thanh mỗi khi mở bài có mạng.',
  },
  {
    key: 'manual',
    label: 'Tôi tự chọn bài',
    caption: 'Chỉ tải khi bạn bấm "Tải để học offline" trong bài.',
  },
] as const;

type Props = {
  onOpenDownloads: () => void;
};

/**
 * "Học offline" on the data settings page: what the app stores for offline
 * study, the learner's media download choice, and the stored media.
 */
export function OfflineStudySettingsGroup({onOpenDownloads}: Props) {
  const {theme} = useAppTheme();
  const {consent, chooseConsent, entries, totalBytes} =
    useOfflineStudySettings();
  const [choosing, setChoosing] = useState(false);

  return (
    <View>
      <SettingsGroup testID="offline-study-settings" title="Học offline">
        <ProfileSettingsRow
          accessibilityHint="Chạm để chọn cách tải ảnh và âm thanh"
          accessibilityLabel={`Tải ảnh và âm thanh bài học: ${MEDIA_CONSENT_LABELS[consent]}`}
          icon="smartphone"
          label="Tải ảnh & âm thanh bài học"
          medallionTone="teal"
          onPress={() => setChoosing(true)}
          trailing={{text: MEDIA_CONSENT_LABELS[consent]}}
        />
        <ProfileSettingsRow
          accessibilityHint="Chạm để xem và xoá file đã tải"
          accessibilityLabel={`Bài đã tải: ${
            entries.length
          } bài, ${formatCacheBytes(totalBytes)}`}
          icon="menu_book"
          label="Bài đã tải"
          medallionTone="teal"
          onPress={onOpenDownloads}
          trailing={{
            text: `${formatCacheBytes(totalBytes)} · ${entries.length} bài`,
          }}
        />
      </SettingsGroup>
      <View style={[styles.notes, {gap: theme.spacing.xs}]}>
        <AppText color="secondary" variant="caption">
          • Phần chữ của các bài bạn đã mở (câu, nghĩa, từ vựng, ngữ pháp) luôn
          được lưu trên máy. Nhờ vậy bạn vẫn học, ôn tập và giữ tiến độ khi
          không có mạng. Phần này nhỏ và cần cho ứng dụng hoạt động.
        </AppText>
        <AppText color="secondary" variant="caption">
          • Ảnh và âm thanh của bài nặng hơn, tốn dung lượng máy và dữ liệu di
          động. Ứng dụng chỉ tải khi bạn cho phép.
        </AppText>
        <AppText color="secondary" variant="caption">
          • Dữ liệu chỉ nằm trên máy này. Xoá file đã tải không ảnh hưởng tiến
          độ học. Muốn xoá cả phần chữ, dùng "Xóa dữ liệu học trên máy" bên
          dưới.
        </AppText>
      </View>
      {choosing ? (
        <SettingsOptionSheet
          onDismiss={() => setChoosing(false)}
          onSelect={key => {
            chooseConsent(key as 'auto' | 'manual');
            setChoosing(false);
          }}
          options={CONSENT_OPTIONS}
          selectedKey={consent}
          testID="offline-study-consent-sheet"
          title="Tải ảnh & âm thanh bài học"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notes: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
