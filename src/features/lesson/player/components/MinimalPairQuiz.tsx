import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge, getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

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
 * "Thử tai" (listen and choose): the app plays one word of a minimal pair
 * and the learner picks which word they heard. Correctness is exact, so no
 * speech scoring is needed.
 */
export function MinimalPairQuiz({
  pairs,
  onSpeakText,
  testID,
}: MinimalPairQuizProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
      <View style={styles.top}>
        <Pressable
          accessibilityHint={t('lessonPlayer.pair_quiz_listen_hint')}
          accessibilityLabel={t('lessonPlayer.pair_quiz_listen')}
          accessibilityRole="button"
          onPress={() => onSpeakText(question.target)}
          style={({pressed}) => [styles.play, pressed ? styles.pressed : null]}
          testID={`${testID}-listen`}
        >
          <MaterialIcon
            color={HERO_PALETTE.white}
            name="play_arrow"
            size={24}
          />
        </Pressable>
        <View style={styles.flex}>
          <AppText style={styles.title}>
            {t('lessonPlayer.pair_quiz_heading')}
          </AppText>
          <AppText color="muted" variant="caption">
            {t('lessonPlayer.pair_quiz_question')}
          </AppText>
        </View>
      </View>
      <View style={styles.options}>
        {question.options.map((word, index) => {
          const picked = chosen === word;
          const isTarget = word === question.target;
          return (
            <Pressable
              key={`${index}-${word}`}
              accessibilityLabel={word}
              accessibilityRole="button"
              accessibilityState={{disabled: answered, selected: picked}}
              disabled={answered}
              onPress={() => setChosen(word)}
              style={[
                styles.option,
                answered && isTarget ? styles.optionRight : null,
                answered && picked && !isTarget ? styles.optionWrong : null,
              ]}
              testID={`${testID}-option-${index}`}
            >
              <AppText style={styles.optionText}>{word}</AppText>
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <View testID={`${testID}-feedback`} style={styles.feedback}>
          <AppText
            color={correct ? 'primary' : 'danger'}
            style={styles.result}
            testID={`${testID}-result`}
          >
            {correct
              ? t('lessonPlayer.pair_quiz_correct')
              : t('lessonPlayer.pair_quiz_wrong', {word: question.target})}
          </AppText>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={nextQuestion}
            testID={`${testID}-next`}
          >
            <AppText color="primary" variant="label">
              {t('lessonPlayer.pair_quiz_next')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    quiz: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 18,
      gap: 10,
      padding: 12,
    },
    top: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    flex: {
      flex: 1,
    },
    play: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
      ...getStickerEdge(3, HERO_PALETTE.coralShelf),
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    options: {
      flexDirection: 'row',
      gap: 8,
    },
    option: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 2,
      flex: 1,
      justifyContent: 'center',
      minHeight: 48,
      ...getStickerFace(theme, 3),
    },
    optionRight: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primary,
    },
    optionWrong: {
      borderColor: theme.colors.danger,
    },
    optionText: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    feedback: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    result: {
      flex: 1,
      fontWeight: '700',
    },
  });
}
