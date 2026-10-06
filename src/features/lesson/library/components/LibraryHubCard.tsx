import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {useAppTheme} from '@ui/theme';
import type {AppTheme} from '@ui/theme/types';

export interface LibraryHubCardProps {
  icon: HandoffIconName;
  title: string;
  /** One line saying what the card holds. */
  description: string;
  /** "3 bài", or the empty hint when the section has nothing yet. */
  countLabel: string;
  /** The section has items; an empty card is shown muted. */
  hasItems: boolean;
  onPress: () => void;
  testID?: string;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    iconBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    text: {
      flex: 1,
      gap: theme.spacing.xs,
    },
  });
}

export function LibraryHubCard({
  icon,
  title,
  description,
  countLabel,
  hasItems,
  onPress,
  testID,
}: LibraryHubCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${countLabel}`}
      accessibilityHint={description}
      onPress={onPress}
      testID={testID}
    >
      <AppCard>
        <View style={styles.row}>
          <View style={styles.iconBadge}>
            <MaterialIcon color={theme.colors.primary} name={icon} size={26} />
          </View>
          <View style={styles.text}>
            <AppText variant="h3">{title}</AppText>
            <AppText variant="label" color="secondary">
              {description}
            </AppText>
            <AppText
              variant="caption"
              color={hasItems ? 'primary' : 'muted'}
              testID={testID ? `${testID}-count` : undefined}
            >
              {countLabel}
            </AppText>
          </View>
          <MaterialIcon
            color={theme.colors.text.secondary}
            name="chevron_right"
            size={24}
          />
        </View>
      </AppCard>
    </Pressable>
  );
}
