import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

export type PartnerBubbleProps = {
  /** The speaker's label (`A`, `B`). */
  speaker: string;
  textEn: string;
  textVi?: string;
  testID?: string;
};

/**
 * Redesign (steps 4–5): the other speaker's line as a chat bubble on the
 * left, with an avatar and a play button.
 */
export function PartnerBubble({
  speaker,
  textEn,
  textVi,
  testID,
}: PartnerBubbleProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.partnerRow} testID={testID}>
      <View style={themedStyles.avatar}>
        <AppText style={themedStyles.avatarText} variant="title">
          {speaker}
        </AppText>
      </View>
      <View style={themedStyles.partner}>
        <AppText variant="bodyLg">{textEn}</AppText>
        {textVi ? <AppText color="secondary">{textVi}</AppText> : null}
        <IconButton
          accessibilityHint={t('lessonFlow.listen_line_hint')}
          accessibilityLabel={t('lessonFlow.listen_line')}
          icon="volume_up"
          onPress={() => {
            speak(textEn).catch(() => undefined);
          }}
          tone="ghost"
        />
      </View>
    </View>
  );
}

/** The learner's turn: a dashed bubble on the right, filled by speaking. */
export function TurnBubble({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.turn} testID={testID}>
      {children}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    avatar: {
      alignItems: 'center',
      backgroundColor: colors.secondaryContainer,
      borderRadius: theme.radius.pill,
      height: 40,
      justifyContent: 'center',
      width: 40,
      ...getStickerFace(theme, 0),
    },
    avatarText: {
      color: colors.text.inverse,
    },
    partner: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderBottomLeftRadius: theme.radius.sm,
      borderRadius: theme.radius.lg,
      flexShrink: 1,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      ...getStickerFace(theme, 0),
    },
    partnerRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingRight: theme.spacing.xl,
    },
    turn: {
      alignSelf: 'flex-end',
      backgroundColor: colors.accentSoft,
      borderBottomRightRadius: theme.radius.sm,
      borderColor: colors.primary,
      borderRadius: theme.radius.lg,
      borderStyle: 'dashed',
      borderWidth: 1.5,
      gap: theme.spacing.xs,
      marginLeft: theme.spacing.xl,
      padding: theme.spacing.md,
    },
  });
}
