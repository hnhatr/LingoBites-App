import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {TextField} from '@ui/components/TextField';
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
  styles,
}: {
  exercise: OrderExercise;
  checked: boolean | null;
  onCheck: (correct: boolean) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {t} = useTranslation();
  // Positions in `shuffled`, in the order the learner picked them.
  const [picked, setPicked] = useState<number[]>([]);
  const words = picked.map(index => exercise.shuffled[index]!);
  return (
    <>
      <AppText color="secondary" variant="label">
        {t('itemReview.apply_order_title')}
      </AppText>
      <AppText testID="item-review-apply-prompt" variant="h3">
        {exercise.promptVi}
      </AppText>
      <View style={styles.answerLine} testID="item-review-apply-line">
        {picked.length === 0 ? (
          <AppText color="muted">{t('itemReview.apply_order_hint')}</AppText>
        ) : (
          picked.map((position, index) => (
            <Chip
              key={`${position}-${index}`}
              label={exercise.shuffled[position]!}
              onPress={
                checked === null
                  ? () => setPicked(value => value.filter(p => p !== position))
                  : undefined
              }
              selected
              testID={`item-review-apply-picked-${index}`}
            />
          ))
        )}
      </View>
      <View style={styles.pool}>
        {exercise.shuffled.map((word, position) =>
          picked.includes(position) ? null : (
            <Chip
              key={position}
              label={word}
              onPress={
                checked === null
                  ? () => setPicked(value => [...value, position])
                  : undefined
              }
              testID={`item-review-apply-word-${position}`}
            />
          ),
        )}
      </View>
      {checked === null ? (
        <AppButton
          disabled={picked.length !== exercise.shuffled.length}
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
  styles,
}: {
  exercise: SwapExercise;
  checked: boolean | null;
  onCheck: (correct: boolean) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {t} = useTranslation();
  const [typed, setTyped] = useState('');
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
      <View style={styles.blankRow}>
        {exercise.before ? <AppText>{exercise.before}</AppText> : null}
        <TextField
          accessibilityHint={t('itemReview.apply_swap_hint')}
          accessibilityLabel={t('itemReview.apply_swap_blank')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={checked === null}
          onChangeText={setTyped}
          onSubmitEditing={() =>
            typed.trim() ? onCheck(isSwapCorrect(exercise, typed)) : undefined
          }
          style={styles.blank}
          testID="item-review-apply-input"
          value={typed}
        />
        {exercise.after ? <AppText>{exercise.after}</AppText> : null}
      </View>
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
        <OrderCard
          checked={checked}
          exercise={exercise}
          onCheck={check}
          styles={styles}
        />
      ) : (
        <SwapCard
          checked={checked}
          exercise={exercise}
          onCheck={check}
          styles={styles}
        />
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
    answerLine: {
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
      minHeight: 44,
      paddingVertical: theme.spacing.xs,
    },
    blank: {
      minWidth: 120,
    },
    blankRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    card: {
      gap: theme.spacing.sm,
    },
    pool: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    verdict: {
      gap: theme.spacing.xs,
    },
  });
}
