import React from 'react';
import {Platform, Pressable, StyleSheet, View} from 'react-native';

import type {TtsVoiceOption, TtsVoiceTier} from '@features/audio';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppText} from '@ui/components/AppText';
import {Chip, type ChipTone} from '@ui/components/Chip';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {useAppTheme} from '@ui/theme';

import {useVoiceSettings} from '../logic/useVoiceSettings';

type ChipSpec = {label: string; tone: ChipTone};

const TIER_CHIPS: Record<TtsVoiceTier, ChipSpec> = {
  premium: {label: 'Premium', tone: 'gold'},
  enhanced: {
    label: Platform.OS === 'android' ? 'Chất lượng cao' : 'Nâng cao',
    tone: 'accentSoft',
  },
  standard: {label: 'Chuẩn', tone: 'neutral'},
};

const NETWORK_CHIP: ChipSpec = {label: 'Cần mạng', tone: 'coralSoft'};

const DOWNLOAD_TIP =
  Platform.OS === 'android'
    ? 'Muốn thêm giọng? Vào Cài đặt › Đầu ra văn bản thành giọng nói › Dịch vụ lời nói của Google › Cài đặt giọng nói › English (US) để tải giọng. Giọng "Cần mạng" sẽ không đọc được khi offline.'
    : 'Muốn giọng tự nhiên hơn? Vào Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Anh và tải giọng "Nâng cao" hoặc "Premium". Giọng mới sẽ hiện ở đây.';

/** Android voice names are engine codes (`en-us-x-sfg-local`), not names. */
function voiceLabel(voice: TtsVoiceOption, index: number): string {
  return Platform.OS === 'android' ? `Giọng ${index + 1}` : voice.name;
}

function voiceChips(voice: TtsVoiceOption): ChipSpec[] {
  const chips = [TIER_CHIPS[voice.tier]];
  if (voice.networkRequired) {
    chips.push(NETWORK_CHIP);
  }
  return chips;
}

type RowProps = {
  label: string;
  chips: ChipSpec[];
  note?: string;
  selected: boolean;
  onSelect: () => void;
  onPreview?: () => void;
  testID: string;
};

function VoiceRow({
  label,
  chips,
  note,
  selected,
  onSelect,
  onPreview,
  testID,
}: RowProps) {
  const {theme} = useAppTheme();
  const ringColor = selected
    ? theme.colors.primary
    : theme.colors.outlineVariant;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint="Chạm để chọn và nghe thử"
        accessibilityLabel={`Giọng ${label}`}
        accessibilityRole="radio"
        accessibilityState={{selected}}
        onPress={onSelect}
        style={({pressed}) => [
          styles.select,
          pressed && {opacity: theme.states.pressedOpacity},
        ]}
        testID={testID}
      >
        <View style={[styles.radio, {borderColor: ringColor}]}>
          {selected ? (
            <View
              style={[styles.radioDot, {backgroundColor: theme.colors.primary}]}
            />
          ) : null}
        </View>
        <View style={styles.text}>
          <AppText style={styles.label}>{label}</AppText>
          <View style={styles.chips}>
            {chips.map(chip => (
              <Chip key={chip.label} label={chip.label} tone={chip.tone} />
            ))}
            {note ? (
              <AppText color="muted" variant="caption">
                {note}
              </AppText>
            ) : null}
          </View>
        </View>
      </Pressable>
      {onPreview ? (
        <ActionIconButton
          accessibilityHint="Chỉ nghe thử, không đổi giọng đang dùng"
          accessibilityLabel={`Nghe thử giọng ${label}`}
          icon="play_arrow"
          onPress={onPreview}
          testID={`${testID}-preview`}
        />
      ) : null}
    </View>
  );
}

/** "Giọng đọc" on the app settings page: pick and preview the TTS voice. */
export function VoiceSettingsGroup() {
  const {theme} = useAppTheme();
  const {state, selectedId, choose, preview} = useVoiceSettings();

  if (state.status === 'loading') {
    return null;
  }

  const notes = (
    <View style={[styles.notes, {gap: theme.spacing.xs}]}>
      <AppText color="secondary" variant="caption">
        {DOWNLOAD_TIP}
      </AppText>
    </View>
  );

  if (state.status === 'unavailable') {
    return (
      <View testID="voice-settings">
        <SettingsGroup title="Giọng đọc">
          <View style={styles.empty}>
            <AppText color="secondary">
              Máy chưa có giọng tiếng Anh (Mỹ) để đọc bài.
            </AppText>
          </View>
        </SettingsGroup>
        {notes}
      </View>
    );
  }

  const recommendedIndex = state.voices.findIndex(
    voice => voice.id === state.recommendedId,
  );
  const recommended = state.voices[recommendedIndex];

  return (
    <View testID="voice-settings">
      <SettingsGroup title="Giọng đọc">
        <VoiceRow
          chips={[{label: 'Khuyên dùng', tone: 'accent'}]}
          label="Tự động"
          note={
            recommended
              ? `Đang dùng: ${voiceLabel(recommended, recommendedIndex)}`
              : undefined
          }
          onSelect={() => choose(null)}
          selected={selectedId === null}
          testID="voice-option-auto"
        />
        {state.voices.map((voice, index) => (
          <VoiceRow
            chips={voiceChips(voice)}
            key={voice.id}
            label={voiceLabel(voice, index)}
            onPreview={() => preview(voice.id)}
            onSelect={() => choose(voice.id)}
            selected={selectedId === voice.id}
            testID={`voice-option-${index}`}
          />
        ))}
      </SettingsGroup>
      {notes}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  empty: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  notes: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  select: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingLeft: 16,
    paddingVertical: 9,
  },
  text: {
    flex: 1,
    gap: 4,
  },
});
