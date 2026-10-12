import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';

import {
  buildMinimalPairQuestion,
  isCorrectChoice,
  type MinimalPair,
  type MinimalPairQuestion,
} from '../logic/minimalPairQuiz';

export type MinimalPairQuizProps = {
  pairs: readonly MinimalPair[];
  onSpeakText: (text: string) => void;
  testID: string;
};

/**
 * Listen and choose: the app plays one word of a minimal pair and the learner
 * picks which word they heard. Correctness is exact, so no speech scoring is
 * needed.
 */
export function MinimalPairQuiz({
  pairs,
  onSpeakText,
  testID,
}: MinimalPairQuizProps) {
  const {t} = useTranslation();
  const [question, setQuestion] = useState<MinimalPairQuestion | null>(() =>
    buildMinimalPairQuestion(pairs),
  );
  const [chosen, setChosen] = useState<string | null>(null);

  if (question === null) {
    return null;
  }

  const answered = chosen !== null;
  const correct = answered && isCorrectChoice(question, chosen);

  const nextQuestion = () => {
    setQuestion(buildMinimalPairQuestion(pairs));
    setChosen(null);
  };

  return (
    <View style={styles.quiz} testID={testID}>
      <AppText variant="label" color="muted" style={styles.label}>
        {t('lessonPlayer.pair_quiz_title')}
      </AppText>
      <AppButton
        accessibilityLabel={t('lessonPlayer.pair_quiz_listen')}
        accessibilityHint={t('lessonPlayer.pair_quiz_listen_hint')}
        iconLeft="volume_up"
        onPress={() => onSpeakText(question.target)}
        testID={`${testID}-listen`}
        title={t('lessonPlayer.pair_quiz_listen')}
        variant="secondary"
      />
      <View style={styles.options}>
        {question.options.map((word, index) => (
          <AppButton
            key={`${index}-${word}`}
            accessibilityState={{selected: chosen === word}}
            disabled={answered}
            onPress={() => setChosen(word)}
            testID={`${testID}-option-${index}`}
            title={word}
            variant={
              answered && word === question.target ? 'primary' : 'outline'
            }
          />
        ))}
      </View>
      {answered ? (
        <View testID={`${testID}-feedback`} style={styles.feedback}>
          <AppText
            color={correct ? 'primary' : 'danger'}
            testID={`${testID}-result`}
          >
            {correct
              ? t('lessonPlayer.pair_quiz_correct')
              : t('lessonPlayer.pair_quiz_wrong', {word: question.target})}
          </AppText>
          <AppButton
            onPress={nextQuestion}
            testID={`${testID}-next`}
            title={t('lessonPlayer.pair_quiz_next')}
            variant="ghost"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: {
    gap: 6,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  options: {
    gap: 8,
  },
  quiz: {
    gap: 10,
  },
});
