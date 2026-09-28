import React from 'react';
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native';
import {AppCard} from './AppCard';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';
import {useAppTheme} from '../theme';

export interface FlipCardProps {
  flipped: boolean;
  onFlip: () => void;
  front: React.ReactNode;
  back: React.ReactNode;
  frontHint?: string;
  backHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function FlipCard({
  flipped,
  onFlip,
  front,
  back,
  frontHint = 'Nhấn để xem mặt sau',
  backHint = 'Nhấn để xem mặt trước',
  style,
  testID = 'flip-card',
}: FlipCardProps) {
  const {theme} = useAppTheme();

  return (
    <Pressable
      accessibilityHint="Chạm để lật thẻ"
      accessibilityRole="button"
      accessibilityState={{expanded: flipped}}
      accessibilityValue={{text: flipped ? 'Mặt sau' : 'Mặt trước'}}
      onPress={onFlip}
      testID={testID}
    >
      <AppCard
        style={StyleSheet.flatten([
          {
            minHeight: 320,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: flipped ? theme.colors.primary : theme.colors.border,
          },
          style,
        ])}
      >
        <View style={styles.contentContainer}>{flipped ? back : front}</View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.hintRow}
          testID="flip-card-hint"
        >
          <MaterialIcon
            color={theme.colors.text.muted}
            name="refresh"
            size={16}
          />
          <AppText color="muted" style={styles.hintText} variant="caption">
            {flipped ? backHint : frontHint}
          </AppText>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: '100%',
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
  },
  hintText: {
    textAlign: 'center',
  },
});
