import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {useAppTheme} from '../theme';
import type {AppTheme} from '../theme/types';
import {AppCard} from './AppCard';
import {AppText} from './AppText';
import {Chip} from './Chip';
import {IconButton} from './IconButton';

/**
 * - `card`: standalone word card in a list (wrapped in `AppCard`).
 * - `inline`: a row inside another surface (analysis panel), hairline divider.
 */
export type WordCardVariant = 'card' | 'inline';

export type WordCardProps = {
  word: string;
  meaning?: string | null;
  ipa?: string | null;
  pos?: string | null;
  cefr?: string | null;
  example?: string | null;
  exampleTranslation?: string | null;
  variant?: WordCardVariant;
  /** Keep the meaning and example hidden (recall cue). */
  hideMeaning?: boolean;
  /** Speaks the word (TTS); omitted = no speak button. */
  onSpeak?: () => void;
  speakAccessibilityLabel?: string;
  speakAccessibilityHint?: string;
  speakTestID?: string;
  /** Makes the text block a button (e.g. open the source lesson). */
  onPress?: () => void;
  pressAccessibilityLabel?: string;
  pressAccessibilityHint?: string;
  pressTestID?: string;
  /** Screen-specific controls next to the speak button (e.g. bookmark). */
  trailing?: React.ReactNode;
  /** Screen-specific controls under the content (e.g. "Lưu thẻ"). */
  actions?: React.ReactNode;
  testID?: string;
};

/** Normalizes `/ipa/`, `ipa` and `/ipa` to a single `/ipa/` form. */
export function formatIpa(ipa: string): string {
  return `/${ipa.trim().replace(/^\/|\/$/g, '')}/`;
}

/**
 * Shared word layout: word, IPA + part of speech + CEFR, meaning, example.
 * Every screen shows the same anatomy and passes its own controls through
 * `trailing` / `actions`.
 */
export function WordCard({
  word,
  meaning,
  ipa,
  pos,
  cefr,
  example,
  exampleTranslation,
  variant = 'card',
  hideMeaning = false,
  onSpeak,
  speakAccessibilityLabel,
  speakAccessibilityHint,
  speakTestID,
  onPress,
  pressAccessibilityLabel,
  pressAccessibilityHint,
  pressTestID,
  trailing,
  actions,
  testID,
}: WordCardProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const showMeaning = !hideMeaning && !!meaning;
  const showExample = !hideMeaning && !!example;

  const content = (
    <>
      <AppText testID="word-text" variant="h3">
        {word}
      </AppText>
      {ipa || pos || cefr ? (
        <View style={styles.meta} testID="phonetic-text">
          {ipa ? (
            <AppText color="muted" variant="caption">
              {formatIpa(ipa)}
            </AppText>
          ) : null}
          {pos ? <Chip label={pos} tone="accentSoft" /> : null}
          {cefr ? <Chip label={cefr} tone="neutral" /> : null}
        </View>
      ) : null}
      {showMeaning ? (
        <AppText color="secondary" testID="meaning-text" variant="bodyLg">
          {meaning}
        </AppText>
      ) : null}
      {showExample ? (
        <View style={themedStyles.example} testID="word-example">
          <AppText
            color="secondary"
            style={styles.italic}
            testID="example-text"
          >
            {example}
          </AppText>
          {exampleTranslation ? (
            <AppText
              color="muted"
              testID="example-translation-text"
              variant="caption"
            >
              {exampleTranslation}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </>
  );

  const textBlock = onPress ? (
    <Pressable
      accessibilityHint={pressAccessibilityHint}
      accessibilityLabel={pressAccessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.body}
      testID={pressTestID}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.body}>{content}</View>
  );

  const speakButton = onSpeak ? (
    <IconButton
      accessibilityHint={speakAccessibilityHint}
      accessibilityLabel={speakAccessibilityLabel ?? word}
      icon="volume_up"
      onPress={onSpeak}
      testID={speakTestID}
      tone={variant === 'inline' ? 'ghost' : 'accent'}
    />
  ) : null;

  const side =
    speakButton || trailing ? (
      <View style={styles.side}>
        {speakButton}
        {trailing}
      </View>
    ) : null;

  const inner = (
    <>
      <View style={styles.row}>
        {textBlock}
        {side}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </>
  );

  if (variant === 'inline') {
    return (
      <View style={themedStyles.inline} testID={testID}>
        {inner}
      </View>
    );
  }
  return <AppCard testID={testID}>{inner}</AppCard>;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    example: {
      borderLeftColor: theme.colors.accentSoft,
      borderLeftWidth: 3,
      gap: 2,
      marginTop: theme.spacing.xs,
      paddingLeft: theme.spacing.sm,
    },
    inline: {
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
  });
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  italic: {
    fontStyle: 'italic',
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  side: {
    alignItems: 'center',
    gap: 4,
  },
});
