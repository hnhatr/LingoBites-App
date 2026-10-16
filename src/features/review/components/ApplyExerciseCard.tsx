import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {TileComposer} from '@ui/components/TileComposer';
import {useTileMode} from '@ui/components/useTileMode';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  type ApplyExercise,
  isOrderCorrect,
  isSwapCorrect,
  type OrderExercise,
  type SwapExercise,
} from '../logic/applyExercise';

type Props = {
  exercise: ApplyExercise;
  /** Called once, when the learner checks the answer. */
  onResult: (result: 'correct' | 'incorrect') => void;
  onNext: () => void;
  /** Shown under the card when the answer could not be saved. */
  failed: boolean;
};

function Verdict({
  correct,
  textEn,
  styles,
}: {
  correct: boolean;
  textEn: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.verdict} testID="item-review-apply-verdict">
      <AppText color={correct ? 'primary' : 'danger'} variant="label">
        {t(correct ? 'itemReview.apply_correct' : 'itemReview.apply_wrong')}
      </AppText>
      <AppText testID="item-review-apply-answer">{textEn}</AppText>
    </View>
  );
}

function OrderCard({
  exercise,
  checked,
  onCheck,
}: {
  exercise: OrderExercise;
  checked: boolean | null;
  onCheck: (correct: boolean) => void;
}) {
  const {t} = useTranslation();
  const [typed, setTyped] = useState('');
  const words = typed.split(' ').filter(Boolean);
  return (
    <>
      <AppText color="secondary" variant="label">
        {t('itemReview.apply_order_title')}
      </AppText>
      <AppText testID="item-review-apply-prompt" variant="h3">
        {exercise.promptVi}
      </AppText>
      <TileComposer
        accessibilityHint={t('itemReview.apply_order_hint')}
        accessibilityLabel={t('itemReview.apply_order_title')}
        editable={checked === null}
        mode="words"
        onChangeText={setTyped}
        placeholder={t('itemReview.apply_order_hint')}
        status={checked === null ? null : checked ? 'right' : 'wrong'}
        testID="item-review-apply"
        value={typed}
        wordTiles={exercise.shuffled}
      />
      {checked === null ? (
        <AppButton
          disabled={words.length !== exercise.shuffled.length}
          onPress={() => onCheck(isOrderCorrect(exercise, words))}
          testID="item-review-apply-check"
          title={t('itemReview.apply_check')}
          variant="secondary"
        />
      ) : null}
    </>
  );
}

function SwapCard({
  exercise,
  checked,
  onCheck,
}: {
  exercise: SwapExercise;
  checked: boolean | null;
  onCheck: (correct: boolean) => void;
}) {
  const {t} = useTranslation();
  const [typed, setTyped] = useState('');
  const [mode, setMode] = useTileMode();
  return (
    <>
      <AppText color="secondary" variant="label">
        {t('itemReview.apply_swap_title')}
      </AppText>
      <AppText testID="item-review-apply-model">{exercise.model}</AppText>
      <AppText variant="h3">
        {t('itemReview.apply_swap_subject', {subject: exercise.subject})}
      </AppText>
      <AppText color="secondary">{exercise.promptVi}</AppText>
      <TileComposer
        accessibilityHint={t('itemReview.apply_swap_hint')}
        accessibilityLabel={t('itemReview.apply_swap_blank')}
        answer={exercise.answer}
        editable={checked === null}
        extraLetters={exercise.model}
        frame={{before: exercise.before, after: exercise.after}}
        mode={mode}
        modes={['letters', 'keyboard']}
        onChangeText={setTyped}
        onModeChange={setMode}
        seed={exercise.sentenceId}
        status={checked === null ? null : checked ? 'right' : 'wrong'}
        testID="item-review-apply-input"
        value={typed}
      />
      {checked === null ? (
        <AppButton
          disabled={typed.trim() === ''}
          onPress={() => onCheck(isSwapCorrect(exercise, typed))}
          testID="item-review-apply-check"
          title={t('itemReview.apply_check')}
          variant="secondary"
        />
      ) : null}
    </>
  );
}

/**
 * Vocab path P6: a stage-4 card (bậc 3) written from the learner's own combo
 * sentences: put the words in order, or type the verb for another subject.
 * Graded on the device; the answer is recorded once, then "Tiếp".
 */
export function ApplyExerciseCard({exercise, onResult, onNext, failed}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const check = (correct: boolean) => {
    if (checked !== null) return;
    setChecked(correct);
    onResult(correct ? 'correct' : 'incorrect');
  };
  return (
    <AppCard style={styles.card} testID={`item-review-apply-${exercise.kind}`}>
      {exercise.kind === 'order' ? (
        <OrderCard checked={checked} exercise={exercise} onCheck={check} />
      ) : (
        <SwapCard checked={checked} exercise={exercise} onCheck={check} />
      )}
      {checked !== null ? (
        <>
          <Verdict correct={checked} styles={styles} textEn={exercise.textEn} />
          <AppButton
            iconRight="chevron_right"
            onPress={onNext}
            testID="item-review-next"
            title={t('itemReview.next')}
            variant="primary"
          />
        </>
      ) : null}
      {failed ? (
        <AppText color="danger">{t('itemReview.save_failed')}</AppText>
      ) : null}
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
    },
    verdict: {
      gap: theme.spacing.xs,
    },
  });
}
