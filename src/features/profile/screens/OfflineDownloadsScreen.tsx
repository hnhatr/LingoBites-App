import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Alert, StyleSheet, View} from 'react-native';

import {formatCacheBytes} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {useAppTheme} from '@ui/theme';

import {ProfileSubpage} from '../components/ProfileSubpage';
import {useOfflineStudySettings} from '../logic/useOfflineStudySettings';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'OfflineDownloads'>;

/** Lessons whose images and audio are stored on the device, with delete. */
export function OfflineDownloadsScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {entries, loaded, totalBytes, removeOne, removeAll} =
    useOfflineStudySettings();

  const confirmRemoveOne = (lessonId: string, title: string) => {
    Alert.alert(
      'Xoá file đã tải',
      `Xoá ảnh và âm thanh của "${title}" khỏi máy? Phần chữ, tiến độ và từ đã lưu vẫn giữ. Bạn có thể tải lại trong bài khi có mạng.`,
      [
        {text: 'Hủy', style: 'cancel'},
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            removeOne(lessonId);
          },
        },
      ],
    );
  };

  const confirmRemoveAll = () => {
    Alert.alert(
      'Xoá tất cả file đã tải',
      `Xoá ảnh và âm thanh của ${entries.length} bài (${formatCacheBytes(
        totalBytes,
      )}) khỏi máy? Phần chữ, tiến độ và từ đã lưu vẫn giữ.`,
      [
        {text: 'Hủy', style: 'cancel'},
        {
          text: 'Xoá tất cả',
          style: 'destructive',
          onPress: () => {
            removeAll();
          },
        },
      ],
    );
  };

  return (
    <ProfileSubpage onBack={() => navigation.goBack()} title="Bài đã tải">
      <AppText color="secondary" style={styles.intro} variant="body">
        Ảnh và âm thanh của các bài dưới đây đang lưu trên máy để học khi không
        có mạng. Xoá file chỉ xoá ảnh và âm thanh; phần chữ, tiến độ và từ đã
        lưu vẫn giữ nguyên.
      </AppText>
      {loaded && entries.length === 0 ? (
        <AppText
          color="secondary"
          style={styles.intro}
          testID="offline-downloads-empty"
        >
          Chưa có bài nào tải ảnh và âm thanh về máy.
        </AppText>
      ) : null}
      {entries.length > 0 ? (
        <>
          <SettingsGroup
            testID="offline-downloads-list"
            title={`${entries.length} bài · ${formatCacheBytes(totalBytes)}`}
          >
            {entries.map(entry => (
              <ProfileSettingsRow
                accessibilityHint="Chạm để xoá ảnh và âm thanh của bài này"
                accessibilityLabel={`${entry.title}, ${formatCacheBytes(
                  entry.bytes,
                )}`}
                icon="delete"
                key={entry.lessonId}
                label={entry.title}
                onPress={() => confirmRemoveOne(entry.lessonId, entry.title)}
                trailing={{text: formatCacheBytes(entry.bytes)}}
              />
            ))}
          </SettingsGroup>
          <View style={{paddingTop: theme.spacing.md}}>
            <AppButton
              accessibilityHint="Xoá ảnh và âm thanh của mọi bài đã tải"
              onPress={confirmRemoveAll}
              testID="offline-downloads-remove-all"
              title="Xoá tất cả file đã tải"
              variant="secondary-coral"
            />
          </View>
        </>
      ) : null}
    </ProfileSubpage>
  );
}

const styles = StyleSheet.create({
  intro: {
    paddingHorizontal: 16,
  },
});
