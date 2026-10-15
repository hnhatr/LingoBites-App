import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import type {ReminderSettings} from '@features/engagement';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {SettingsOptionCard, SettingsSheetFrame} from './SettingsOptionSheet';

/** The daily time picked when "Mỗi ngày" is chosen without one. */
const DEFAULT_DAILY_TIME = '20:00';

type Props = {
  settings: ReminderSettings;
  timeOptions: readonly string[];
  /** Saves `next`; `keepOpen` leaves the sheet up (daily time changes). */
  onSelect: (next: ReminderSettings, options?: {keepOpen?: boolean}) => void;
  onDismiss: () => void;
};

/**
 * Profile → Nhắc nhở (F6): off, Golden Hour only, or a daily time. Picking
 * "Mỗi ngày" opens the four times inside its card; Golden Hour reminders
 * stay on with a daily time, as before.
 */
export function ReminderSheet({
  settings,
  timeOptions,
  onSelect,
  onDismiss,
}: Props) {
  const {theme} = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const mode = !settings.enabled
    ? 'off'
    : settings.dailyTime
      ? 'daily'
      : 'golden-hour';

  return (
    <SettingsSheetFrame
      onDismiss={onDismiss}
      subtitle="Chọn khi nào LingoBites gửi thông báo cho bạn."
      testID="profile-reminder-sheet"
      title="Nhắc nhở"
    >
      <SettingsOptionCard
        onPress={() => onSelect({enabled: false, dailyTime: null})}
        option={{
          key: 'off',
          label: 'Tắt nhắc nhở',
          caption: 'Không gửi thông báo nào',
          icon: 'notifications',
          tone: 'muted',
        }}
        selected={mode === 'off'}
      />
      <SettingsOptionCard
        onPress={() => onSelect({enabled: true, dailyTime: null})}
        option={{
          key: 'golden-hour',
          label: 'Chỉ nhắc giờ vàng',
          caption: 'Nhắc khi có thẻ đến lịch ôn',
          icon: 'auto_awesome',
          tone: 'gold',
        }}
        selected={mode === 'golden-hour'}
      />
      <SettingsOptionCard
        expanded={
          <View style={styles.times}>
            {timeOptions.map(time => {
              const on = settings.dailyTime === time;
              return (
                <Pressable
                  accessibilityHint="Chạm để nhắc vào giờ này"
                  accessibilityLabel={`Mỗi ngày lúc ${time}`}
                  accessibilityRole="radio"
                  accessibilityState={{selected: on}}
                  key={time}
                  onPress={() =>
                    onSelect({enabled: true, dailyTime: time}, {keepOpen: true})
                  }
                  style={({pressed}) => [
                    styles.time,
                    on ? styles.timeOn : styles.timeOff,
                    pressed && styles.pressed,
                  ]}
                  testID={`profile-reminder-time-${time}`}
                >
                  <AppText style={[styles.timeLabel, on && styles.timeLabelOn]}>
                    {time}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        }
        onPress={() => {
          if (mode !== 'daily') {
            onSelect(
              {enabled: true, dailyTime: DEFAULT_DAILY_TIME},
              {keepOpen: true},
            );
          }
        }}
        option={{
          key: 'daily',
          label: 'Mỗi ngày, đúng giờ',
          caption:
            mode === 'daily' && settings.dailyTime
              ? `Nhắc lúc ${settings.dailyTime} mỗi ngày`
              : 'Chọn một giờ cố định trong ngày',
          icon: 'schedule',
          tone: 'teal',
        }}
        selected={mode === 'daily'}
      />
      {mode !== 'off' ? (
        <View style={styles.note}>
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="auto_awesome"
            size={18}
          />
          <AppText style={styles.noteText}>
            <AppText style={styles.noteStrong}>Giờ vàng</AppText>
            {mode === 'daily'
              ? ' là lúc thẻ ôn sắp quên. Vẫn nhắc thêm khi có thẻ đến lịch ôn.'
              : ' là lúc thẻ ôn sắp quên. App chỉ nhắc vào những lúc đó.'}
          </AppText>
        </View>
      ) : null}
    </SettingsSheetFrame>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  return StyleSheet.create({
    times: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingBottom: 14,
      paddingHorizontal: 14,
    },
    time: {
      alignItems: 'center',
      borderRadius: 13,
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
    },
    timeOff: {
      backgroundColor: theme.colors.surface,
      ...getStickerEdge(3, mintEdge),
    },
    timeOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(3, theme.colors.primaryPressed),
    },
    timeLabel: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    timeLabelOn: {
      color: HERO_PALETTE.white,
    },
    pressed: {
      transform: [{translateY: 2}],
    },
    note: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noteText: {
      color: theme.colors.text.secondary,
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
    },
    noteStrong: {
      color: theme.colors.onTertiaryContainer,
      fontSize: 13,
      fontWeight: '800',
    },
  });
}
