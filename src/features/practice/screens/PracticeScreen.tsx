import React from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HandoffProgressTrack} from '@ui/components/HandoffProgressTrack';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {QuizOption, type QuizOptionState} from '@ui/components/QuizOption';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {useFeatureEnabled} from '@core/release';

import {usePracticeSession} from '../logic/usePracticeSession';
import type {PracticeRouteParams} from './navigationTypes';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export type PracticeScreenProps = {
  navigation: {goBack: () => void};
  route: {params: PracticeRouteParams};
};

export function PracticeScreen({navigation, route}: PracticeScreenProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const enabled = useFeatureEnabled('shortPractice');
  const {lessonId} = route.params;
  const session = usePracticeSession(lessonId);
  const {state} = session;

  const close = () => navigation.goBack();
  const closeButton = (
    <HeaderIconButton
      accessibilityHint={t('practice.close_hint')}
      accessibilityLabel={t('practice.close_a11y')}
      icon="close"
      onPress={close}
      testID="practice-close"
    />
  );

  if (!enabled || state.status === 'unavailable') {
    const message = !enabled
      ? t('practice.unavailable_disabled')
      : state.status === 'unavailable' && state.reason === 'not_downloaded'
      ? t('practice.unavailable_not_downloaded')
      : t('practice.unavailable_not_enough');
    return (
      <AppScreen testID="practice-screen">
        <ScreenHeader rightAction={closeButton} title={t('practice.title')} />
        <View style={[styles.centered, {padding: theme.gutter}]}>
          <AppText color="secondary" testID="practice-unavailable">
            {message}
          </AppText>
          <AppButton
            onPress={close}
            testID="practice-unavailable-back"
            title={t('practice.back_to_lesson')}
            variant="outline"
          />
        </View>
      </AppScreen>
    );
  }

  if (state.status === 'finished') {
    const {summary, missed} = state;
    const allSaved =
      missed.length > 0 &&
      missed.every(word => session.savedItemKeys.has(word.itemKey));
    return (
      <AppScreen testID="practice-screen">
        <ScreenHeader
          rightAction={closeButton}
          title={t('practice.result_title')}
        />
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {gap: theme.spacing.md, padding: theme.gutter},
          ]}
          testID="practice-result"
        >
          <AppCard>
            <AppText testID="practice-result-score" variant="h1">
              {t('practice.result_score', {
                correct: summary.correct,
                total: summary.total,
              })}
            </AppText>
            <AppText color="secondary" testID="practice-result-accuracy">
              {t('practice.result_accuracy', {accuracy: summary.accuracy})}
            </AppText>
            <AppText color="secondary">
              {summary.accuracy >= 80
                ? t('practice.result_great')
                : summary.accuracy >= 50
                ? t('practice.result_ok')
                : t('practice.result_retry_hint')}
            </AppText>
          </AppCard>

          {missed.length > 0 ? (
            <View style={{gap: theme.spacing.sm}} testID="practice-missed">
              <AppText variant="h3">{t('practice.missed_title')}</AppText>
              {missed.map(word => {
                const saved = session.savedItemKeys.has(word.itemKey);
                return (
                  <AppCard key={word.itemKey}>
                    <View style={styles.missedRow}>
                      <View style={styles.flex1}>
                        <AppText variant="h3">{word.word}</AppText>
                        <AppText color="secondary">{word.meaningVi}</AppText>
                      </View>
                      <AppButton
                        accessibilityHint={t('practice.missed_save_hint')}
                        accessibilityLabel={t('practice.missed_save_a11y', {
                          word: word.word,
                        })}
                        disabled={saved}
                        onPress={() => session.saveMissed(word.itemKey)}
                        testID={`practice-save-${word.itemKey}`}
                        title={
                          saved
                            ? t('practice.missed_saved')
                            : t('practice.missed_save')
                        }
                        variant="outline"
                      />
                    </View>
                  </AppCard>
                );
              })}
              {missed.length > 1 && !allSaved ? (
                <AppButton
                  onPress={session.saveAllMissed}
                  testID="practice-save-all"
                  title={t('practice.missed_save_all')}
                  variant="secondary"
                />
              ) : null}
            </View>
          ) : null}

          <AppButton
            onPress={session.restart}
            testID="practice-retry"
            title={t('practice.retry')}
          />
          <AppButton
            onPress={close}
            testID="practice-back"
            title={t('practice.back_to_lesson')}
            variant="outline"
          />
        </ScrollView>
      </AppScreen>
    );
  }

  const {question, answer, index, total} = state;
  const answered = answer !== null;
  const optionState = (optionId: string): QuizOptionState => {
    if (!answer) {
      return 'default';
    }
    if (optionId === question.correctOptionId) {
      return 'correct';
    }
    return optionId === answer.optionId ? 'wrong' : 'default';
  };
  const isLast = index + 1 >= total;

  return (
    <AppScreen testID="practice-screen">
      <ScreenHeader rightAction={closeButton} title={t('practice.title')} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {gap: theme.spacing.md, padding: theme.gutter},
        ]}
      >
        <HandoffProgressTrack
          label={t('practice.progress_a11y')}
          progress={(index + (answered ? 1 : 0)) / total}
        />
        <AppText color="secondary" testID="practice-progress">
          {t('practice.progress', {current: index + 1, total})}
        </AppText>

        <AppCard>
          <AppText color="secondary" variant="label">
            {t(`practice.prompt_${question.variant}`)}
          </AppText>
          <AppText testID="practice-prompt" variant="h2">
            {question.prompt}
          </AppText>
          {question.hintVi ? (
            <AppText color="secondary" testID="practice-hint">
              {question.hintVi}
            </AppText>
          ) : null}
        </AppCard>

        <View style={{gap: theme.spacing.sm}}>
          {question.options.map((option, optionIndex) => {
            const key = OPTION_KEYS[optionIndex] ?? String(optionIndex + 1);
            return (
              <QuizOption
                accessibilityHint={t('practice.option_hint')}
                accessibilityLabel={t('practice.option_a11y', {
                  key,
                  text: option.text,
                })}
                disabled={answered}
                key={option.id}
                label={option.text}
                onPress={() => session.select(option.id)}
                optionKey={key}
                state={optionState(option.id)}
                testID={`practice-option-${optionIndex}`}
              />
            );
          })}
        </View>

        {answer ? (
          <AppText
            accessibilityLiveRegion="polite"
            color={answer.grade.correct ? 'primary' : 'secondary'}
            testID="practice-feedback"
            variant="label"
          >
            {answer.grade.correct
              ? t('practice.feedback_correct')
              : t('practice.feedback_wrong', {answer: answer.grade.answerText})}
          </AppText>
        ) : null}

        <AppButton
          disabled={!answered}
          onPress={session.next}
          testID="practice-next"
          title={isLast ? t('practice.finish') : t('practice.next')}
        />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  flex1: {
    flex: 1,
  },
  missedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  scroll: {
    flexGrow: 1,
  },
});
