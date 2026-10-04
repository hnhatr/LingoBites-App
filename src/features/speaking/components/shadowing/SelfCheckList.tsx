import React from 'react';
import {Pressable, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme} from '@ui/theme';

import type {ShadowingSelfCheck} from '../../logic/shadowing/useShadowingSession';

export const SHADOWING_SELF_CHECK_ITEMS: {
  key: keyof ShadowingSelfCheck;
  label: string;
}[] = [
  {key: 'fullSentence', label: 'nói hết câu'},
  {key: 'keyWords', label: 'phát âm rõ từ chính'},
  {key: 'rhythm', label: 'theo kịp nhịp'},
];

export type SelfCheckListProps = {
  values: ShadowingSelfCheck;
  saving: boolean;
  showUploadHint: boolean;
  isLastSentence: boolean;
  onToggle: (key: keyof ShadowingSelfCheck) => void;
  onSave: () => void;
  onPlaySample: () => void;
  onPlayMyTake: () => void;
  onReRecord: () => void;
  myTakeLabel: string;
};

export function SelfCheckList({
  values,
  saving,
  showUploadHint,
  isLastSentence,
  onToggle,
  onSave,
  onPlaySample,
  onPlayMyTake,
  onReRecord,
  myTakeLabel,
}: SelfCheckListProps) {
  const {theme} = useAppTheme();

  return (
    <AppCard style={{gap: theme.spacing.sm}} testID="shadowing-self-check">
      <View style={{flexDirection: 'row', gap: theme.spacing.sm}}>
        <Pressable
          accessibilityRole="button"
          onPress={onPlaySample}
          testID="shadowing-play-sample-compact"
        >
          <AppText style={{color: theme.colors.accent}}>Mẫu</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onPlayMyTake}
          testID="shadowing-play-my-take"
        >
          <AppText style={{color: theme.colors.accent}}>
            Của tôi {myTakeLabel}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReRecord}
          testID="shadowing-rerecord"
        >
          <AppText style={{color: theme.colors.accent}}>↻</AppText>
        </Pressable>
      </View>
      <AppText variant="h3">Tự kiểm tra</AppText>
      {SHADOWING_SELF_CHECK_ITEMS.map(item => (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: values[item.key]}}
          key={item.key}
          onPress={() => onToggle(item.key)}
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
          }}
          testID={`shadowing-self-check-${item.key}`}
        >
          <IconButton
            accessibilityLabel={item.label}
            icon="check_circle"
            onPress={() => onToggle(item.key)}
            tone={values[item.key] ? 'accent' : 'ghost'}
          />
          <AppText>{item.label}</AppText>
        </Pressable>
      ))}
      {showUploadHint ? (
        <AppText color="secondary" testID="shadowing-upload-hint">
          Bản ghi sẽ được lưu lên tài khoản khi có mạng
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={onSave}
        style={({pressed}) => ({
          alignItems: 'center',
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radius.lg,
          marginTop: theme.spacing.sm,
          minHeight: 48,
          justifyContent: 'center',
          opacity: saving
            ? theme.states.disabledOpacity
            : pressed
            ? theme.states.pressedOpacity
            : 1,
        })}
        testID="shadowing-save-continue"
      >
        <AppText style={{color: theme.colors.accentInk, fontWeight: '700'}}>
          {isLastSentence ? 'Lưu & xem tóm tắt' : 'Lưu & câu tiếp'}
        </AppText>
      </Pressable>
    </AppCard>
  );
}
