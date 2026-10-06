import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

export type SettingsOption = {
  key: string;
  label: string;
  caption?: string;
};

export type SettingsOptionSheetProps = {
  title: string;
  options: readonly SettingsOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onDismiss: () => void;
  testID?: string;
};

/** Bottom sheet with a single-choice list for a Profile setting (F6). */
export function SettingsOptionSheet({
  title,
  options,
  selectedKey,
  onSelect,
  onDismiss,
  testID,
}: SettingsOptionSheetProps) {
  const {theme} = useAppTheme();
  const themedStyles = React.useMemo(() => makeStyles(theme), [theme]);

  return (
    <Modal animationType="slide" onRequestClose={onDismiss} transparent visible>
      <Pressable
        accessibilityLabel="Đóng"
        onPress={onDismiss}
        style={themedStyles.backdrop}
      />
      <View style={themedStyles.sheet} testID={testID}>
        <AppText variant="h2">{title}</AppText>
        {options.map(option => {
          const selected = option.key === selectedKey;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{selected}}
              key={option.key}
              onPress={() => onSelect(option.key)}
              style={({pressed}) => [
                themedStyles.option,
                selected && themedStyles.optionSelected,
                pressed && themedStyles.pressed,
              ]}
            >
              <View style={styles.optionCopy}>
                <AppText>{option.label}</AppText>
                {option.caption ? (
                  <AppText color="secondary" variant="caption">
                    {option.caption}
                  </AppText>
                ) : null}
              </View>
              {selected ? (
                <MaterialIcon
                  color={theme.colors.primary}
                  name="check_circle"
                  size={22}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  optionCopy: {
    flex: 1,
    gap: 2,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    option: {
      alignItems: 'center',
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      ...getStickerFace(theme),
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 52,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    optionSelected: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primary,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      marginTop: 'auto',
      padding: theme.spacing.lg,
    },
  });
}
