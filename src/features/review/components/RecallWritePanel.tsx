import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {TileComposer} from '@ui/components/TileComposer';
import {useTileMode} from '@ui/components/useTileMode';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {normalizeAnswer} from '@core/learning';

type Props = {
  /** The English word or phrase to write. */
  word: string;
  meaningVi: string;
  /** Back to the card, flipped to its answer. */
  onDone: () => void;
};

/**
 * Daily review "Viết thử": before flipping, write the word from its
 * Vietnamese meaning with the tile keyboard. Practice only — the learner
 * still rates the card, so the review schedule is unchanged.
 */
export function RecallWritePanel({word, meaningVi, onDone}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState('');
  const [mode, setMode] = useTileMode();
  const [right, setRight] = useState<boolean | null>(null);

  const check = () =>
    setRight(normalizeAnswer(value) === normalizeAnswer(word));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="review-write-panel"
    >
      <AppText color="secondary" variant="label">
        {t('review.write_try_title')}
      </AppText>
      <AppText testID="review-write-meaning" variant="h2">
        {meaningVi}
      </AppText>
      <TileComposer
        accessibilityHint={t('review.write_try_hint')}
        accessibilityLabel={t('review.write_try_title')}
        answer={word}
        editable={right === null}
        mode={mode}
        modes={['letters', 'keyboard']}
        onChangeText={setValue}
        onModeChange={setMode}
        seed={word}
        status={right === null ? null : right ? 'right' : 'wrong'}
        testID="review-write-input"
        value={value}
      />
      {right === null ? (
        <AppButton
          accessibilityHint={t('review.write_check_hint')}
          disabled={value.trim() === ''}
          onPress={check}
          testID="review-write-check"
          title={t('review.write_check')}
        />
      ) : (
        <>
          <AppText
            color={right ? 'primary' : 'danger'}
            testID="review-write-verdict"
            variant="label"
          >
            {right ? t('review.write_right') : t('review.write_wrong', {word})}
          </AppText>
          <AppButton
            accessibilityHint={t('review.write_show_card_hint')}
            onPress={onDone}
            testID="review-write-done"
            title={t('review.write_show_card')}
          />
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {gap: theme.spacing.md, paddingBottom: theme.spacing.lg},
  });
}
