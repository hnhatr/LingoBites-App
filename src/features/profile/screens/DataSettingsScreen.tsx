import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Modal, StyleSheet, View} from 'react-native';

import {SpeakingRecordingsSettingsRow} from '@features/speaking';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';

import {ProfileSubpage} from '../components/ProfileSubpage';
import {useDataSettings} from '../logic/useDataSettings';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataSettings'>;

/** Offline audio, speaking recordings and local-data deletion. */
export function DataSettingsScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const {
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
  } = useDataSettings();

  return (
    <ProfileSubpage
      onBack={() => navigation.goBack()}
      statusMessage={statusMessage}
      title="Dữ liệu & bộ nhớ"
    >
      <SettingsGroup title="Âm thanh">
        <ProfileSettingsRow
          accessibilityHint="Chạm để thay đổi"
          accessibilityLabel="Dung lượng âm thanh chương học đã tải về máy — bấm để nghe thử clip đã tải"
          icon="volume_up"
          label="Âm thanh chương học"
          medallionTone="teal"
          onPress={handlePlayCachedAudio}
          trailing={{text: audioCacheTrailingLabel}}
        />
      </SettingsGroup>

      <SettingsGroup title="Bản ghi giọng nói">
        <SpeakingRecordingsSettingsRow />
      </SettingsGroup>

      <SettingsGroup title="Vùng nguy hiểm">
        <View>
          <ProfileSettingsRow
            accessibilityHint="Chạm để xóa dữ liệu"
            accessibilityLabel="Xóa dữ liệu luyện nói"
            destructive
            icon="delete"
            label="Xóa dữ liệu luyện nói & ghi âm"
            onPress={handleClearSpeakingData}
            trailing="chevron"
          />
          <AppText
            color="secondary"
            style={[styles.caption, {paddingBottom: theme.spacing.sm}]}
            variant="caption"
          >
            Xóa toàn bộ bản ghi âm và lịch sử luyện nói. Không thể khôi phục.
          </AppText>
        </View>
        <View>
          <ProfileSettingsRow
            accessibilityHint="Chạm để xóa dữ liệu"
            accessibilityLabel="Xóa dữ liệu học trên máy"
            destructive
            icon="delete"
            label="Xóa dữ liệu học trên máy"
            onPress={openClearDataModal}
            trailing="chevron"
          />
          <AppText
            color="secondary"
            style={[styles.caption, {paddingBottom: theme.spacing.sm}]}
            variant="caption"
          >
            Xóa toàn bộ tiến trình học, XP, và lịch sử. Không thể khôi phục.
          </AppText>
        </View>
      </SettingsGroup>

      <Modal
        animationType="fade"
        transparent
        visible={isClearDataModalVisible}
        onRequestClose={hideClearDataModal}
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: theme.colors.overlay,
              padding: theme.spacing.xl,
            },
          ]}
        >
          <AppCard style={{gap: theme.spacing.sm, padding: theme.spacing.lg}}>
            <AppText style={styles.mb8} variant="h2">
              Xóa dữ liệu học trên máy
            </AppText>
            <AppText color="secondary" style={styles.mb16}>
              Hành động này sẽ xóa toàn bộ tiến trình học, XP, và lịch sử. Không
              thể khôi phục.
            </AppText>
            <AppText style={styles.mb8}>
              Nhập chữ <AppText style={styles.bold}>XOA</AppText> để xác nhận:
            </AppText>
            <TextField
              autoCapitalize="characters"
              onChangeText={setClearDataConfirmText}
              placeholder="XOA"
              value={clearDataConfirmText}
            />
            <View
              style={[
                styles.modalActions,
                {gap: theme.spacing.md, marginTop: theme.spacing.md},
              ]}
            >
              <AppButton
                onPress={dismissClearDataModal}
                style={styles.flex1}
                title="Hủy"
                variant="secondary"
              />
              <AppButton
                disabled={clearDataConfirmText !== 'XOA'}
                onPress={confirmClearData}
                style={[styles.flex1, {backgroundColor: theme.colors.danger}]}
                title="Xóa"
                variant="primary"
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </ProfileSubpage>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: 'bold',
  },
  caption: {
    paddingHorizontal: 16,
  },
  flex1: {
    flex: 1,
  },
  mb16: {
    marginBottom: 16,
  },
  mb8: {
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
});
