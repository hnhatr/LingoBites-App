import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

export type ConsentSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onChooseUploadOn: () => void;
  onChooseLocalOnly: () => void;
};

export function ConsentSheet({
  visible,
  onDismiss,
  onChooseUploadOn,
  onChooseLocalOnly,
}: ConsentSheetProps) {
  const {theme} = useAppTheme();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Đóng"
        onPress={onDismiss}
        style={styles.backdrop}
        testID="shadowing-consent-backdrop"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
          },
        ]}
        testID="shadowing-consent-sheet"
      >
        <AppText variant="h2">Lưu bản ghi lên tài khoản?</AppText>
        <AppText color="secondary">
          Khi bật, bản ghi luyện nói có thể được tải lên tài khoản để nghe lại
          trên thiết bị khác. Bạn có thể tắt hoặc xóa bản ghi trên tài khoản
          trong Cài đặt.
        </AppText>
        <AppButton
          onPress={onChooseUploadOn}
          testID="shadowing-consent-upload-on"
          title="Đồng ý lưu lên tài khoản"
        />
        <AppButton
          onPress={onChooseLocalOnly}
          testID="shadowing-consent-local-only"
          title="Chỉ lưu trên máy này"
          variant="secondary"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    marginTop: 'auto',
  },
});
