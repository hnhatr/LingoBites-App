import React from 'react';
import {StyleSheet, View} from 'react-native';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {withAlpha} from './layout';
import {MaterialIcon} from './MaterialIcon';

/**
 * Soft yellow of the offline notices. Kept the same in every theme, like the
 * hero cards, so "offline" always reads the same.
 */
export const OFFLINE_PALETTE = {
  face: '#fff3c4',
  edge: '#f3dc85',
  ink: '#594c00',
  body: '#6f6430',
  white: '#ffffff',
} as const;

/** `info` mint for news, `neutral` white for a note, `offline` soft yellow. */
type BannerVariant = 'info' | 'neutral' | 'offline';

type Props = {
  message: string;
  variant?: BannerVariant;
  /** Icon in the small white square; each variant has its own default. */
  icon?: HandoffIconName;
};

const DEFAULT_ICON: Record<BannerVariant, HandoffIconName> = {
  info: 'info',
  neutral: 'info',
  offline: 'cloud_off',
};

/** The app's one in-screen notice: a soft raised card, no outline. */
export function Banner({message, variant = 'info', icon}: Props) {
  const {theme} = useAppTheme();
  const look = lookFor(theme, variant);

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: look.face},
        getStickerEdge(3, look.edge),
      ]}
      testID="review-banner"
    >
      <View
        style={[
          styles.icon,
          {backgroundColor: look.iconFace},
          getStickerEdge(2, look.iconEdge),
        ]}
      >
        <MaterialIcon
          color={look.ink}
          name={icon ?? DEFAULT_ICON[variant]}
          size={17}
        />
      </View>
      <AppText style={[styles.message, {color: look.ink}]} variant="label">
        {message}
      </AppText>
    </View>
  );
}

function lookFor(
  theme: AppTheme,
  variant: BannerVariant,
): {
  face: string;
  edge: string;
  ink: string;
  iconFace: string;
  iconEdge: string;
} {
  if (variant === 'offline') {
    return {
      face: OFFLINE_PALETTE.face,
      edge: OFFLINE_PALETTE.edge,
      ink: OFFLINE_PALETTE.ink,
      iconFace: OFFLINE_PALETTE.white,
      iconEdge: OFFLINE_PALETTE.edge,
    };
  }
  if (variant === 'neutral') {
    return {
      face: theme.colors.surface,
      edge: theme.colors.surfaceHigh,
      ink: theme.colors.text.secondary,
      iconFace: theme.colors.surfaceMuted,
      iconEdge: theme.colors.surfaceHigh,
    };
  }
  return {
    face: theme.colors.accentSoft,
    edge: withAlpha(theme.colors.primary, 0.18),
    ink: theme.colors.primary,
    iconFace: theme.colors.surface,
    iconEdge: HERO_PALETTE.ghostShelf,
  };
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 10,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
