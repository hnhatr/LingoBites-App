import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type ReviewCardContent = {
  word: string;
  meaning: string;
  ipa?: string | null;
  pos?: string | null;
  cefr?: string | null;
  example?: string | null;
  exampleTranslation?: string | null;
};

type FaceProps = {
  card: ReviewCardContent;
  hint: string;
  onSpeak: () => void;
  speakAccessibilityLabel: string;
  speakTestID: string;
  testID: string;
};

/**
 * Front: the recall cue only — chips, the word with its IPA directly under it
 * (one centered column), and a big speak button. Fills the whole card.
 */
export function ReviewCardFront({
  card,
  hint,
  onSpeak,
  speakAccessibilityLabel,
  speakTestID,
  testID,
}: FaceProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.shelfFront}>
      <View style={[themedStyles.face, themedStyles.front]} testID={testID}>
        <View pointerEvents="none" style={themedStyles.blobTop} />
        <View pointerEvents="none" style={themedStyles.blobBottom} />
        <View style={styles.chips}>
          {card.pos ? <Chip label={card.pos} tone="accentSoft" /> : <View />}
          {card.cefr ? <Chip label={card.cefr} tone="gold" /> : null}
        </View>
        <View style={styles.center}>
          <AppText
            adjustsFontSizeToFit
            numberOfLines={2}
            style={styles.word}
            variant="display"
          >
            {card.word}
          </AppText>
          {card.ipa ? (
            <AppText color="muted" style={styles.ipa} variant="bodyLg">
              {formatIpa(card.ipa)}
            </AppText>
          ) : null}
          <IconButton
            accessibilityLabel={speakAccessibilityLabel}
            icon="volume_up"
            iconSize={28}
            onPress={onSpeak}
            size={64}
            style={styles.speak}
            testID={speakTestID}
            tone="accent"
          />
        </View>
        <View style={styles.hintRow}>
          <MaterialIcon
            color={theme.colors.text.muted}
            name="refresh"
            size={16}
          />
          <AppText color="muted" variant="label">
            {hint}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/**
 * Back: same card size, inverted colors so the answer reads as a new side.
 * The word stays small at the top; the meaning is the hero; the example sits
 * in a light panel at the bottom.
 */
export function ReviewCardBack({
  card,
  hint,
  onSpeak,
  speakAccessibilityLabel,
  speakTestID,
  testID,
}: FaceProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const inverse = {color: theme.colors.text.inverse};
  const meta = [card.ipa ? formatIpa(card.ipa) : null, card.pos]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={themedStyles.shelfBack}>
      <View style={[themedStyles.face, themedStyles.back]} testID={testID}>
        <View pointerEvents="none" style={themedStyles.blobBack} />
        <View style={styles.backTop}>
          <View style={styles.flex1}>
            <AppText numberOfLines={2} style={inverse} variant="h2">
              {card.word}
            </AppText>
            {meta ? (
              <AppText style={[inverse, styles.soft]} variant="label">
                {meta}
              </AppText>
            ) : null}
          </View>
          <IconButton
            accessibilityLabel={speakAccessibilityLabel}
            icon="volume_up"
            onPress={onSpeak}
            size={44}
            testID={speakTestID}
            tone="accent"
          />
        </View>
        <View style={styles.center}>
          <AppText
            adjustsFontSizeToFit
            numberOfLines={4}
            style={[inverse, styles.meaning]}
            variant="display"
          >
            {card.meaning}
          </AppText>
        </View>
        {card.example ? (
          <View style={themedStyles.examplePanel} testID="review-card-example">
            <AppText color="secondary" style={styles.exampleText}>
              {card.example}
            </AppText>
            {card.exampleTranslation ? (
              <AppText color="muted" variant="caption">
                {card.exampleTranslation}
              </AppText>
            ) : null}
          </View>
        ) : null}
        <View style={styles.hintRow}>
          <MaterialIcon
            color={theme.colors.text.inverse}
            name="chevron_left"
            size={18}
          />
          <AppText style={[inverse, styles.soft]} variant="label">
            {hint}
          </AppText>
          <MaterialIcon
            color={theme.colors.text.inverse}
            name="chevron_right"
            size={18}
          />
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const blob = {
    borderRadius: 999,
    position: 'absolute' as const,
  };
  // Solid "shelf" under the card, like the app's other raised surfaces.
  const shelf = {
    alignSelf: 'stretch' as const,
    borderRadius: theme.radius.xl,
    flex: 1,
    paddingBottom: 6,
  };
  return StyleSheet.create({
    back: {
      backgroundColor: theme.colors.primary,
    },
    blobBack: {
      ...blob,
      backgroundColor: theme.colors.text.inverse,
      height: 260,
      opacity: 0.08,
      right: -90,
      top: -90,
      width: 260,
    },
    blobBottom: {
      ...blob,
      backgroundColor: theme.colors.tertiaryFixed,
      bottom: -50,
      height: 160,
      left: -60,
      opacity: 0.25,
      width: 160,
    },
    blobTop: {
      ...blob,
      backgroundColor: theme.colors.accentSoft,
      height: 260,
      right: -90,
      top: -90,
      width: 260,
    },
    examplePanel: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      gap: 4,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 2,
    },
    face: {
      borderRadius: theme.radius.xl,
      flex: 1,
      overflow: 'hidden',
      padding: theme.spacing.lg - 4,
    },
    front: {
      backgroundColor: theme.colors.surface,
    },
    shelfBack: {
      ...shelf,
      backgroundColor:
        theme.shelf?.primary.color ?? theme.colors.primaryPressed,
    },
    shelfFront: {
      ...shelf,
      backgroundColor: theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
    },
  });
}

const styles = StyleSheet.create({
  backTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exampleText: {
    fontStyle: 'italic',
  },
  flex1: {
    flex: 1,
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  ipa: {
    textAlign: 'center',
  },
  meaning: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  soft: {
    opacity: 0.85,
  },
  speak: {
    marginTop: 12,
  },
  word: {
    fontSize: 38,
    lineHeight: 46,
    textAlign: 'center',
  },
});
