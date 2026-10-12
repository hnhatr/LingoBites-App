import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {buildRecognitionQuestions, type QuizQuestion} from '../logic/packQuiz';
import {findDownloadedPack} from '../logic/wordPackRepository';
import {learnWordPack} from '../logic/wordPathClient';
import type {PackLearnRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: PackLearnRouteParams};
  /** Tests pass the words; the screen reads the pack otherwise. */
  items?: CatalogItem[];
};

type Stage = 'cards' | 'recognition' | 'saving' | 'done';

/**
 * Vocab path P5, learn a pack: each word's card (meaning, IPA, one example),
 * then one recognition question per word. The words answered right are learned
 * (stage 0 on the review schedule); the others wait in the pack.

 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PackLearnScreen({navigation, route, items: given}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const packId = route?.params.packId ?? '';
  const [items] = useState<CatalogItem[]>(() => {
    if (given) return given;
    const pack = findDownloadedPack(packId);
    if (!pack) return [];
    const byCode = readCatalogItems(pack.itemCodes);
    return pack.itemCodes.flatMap(code => byCode.get(code) ?? []);
  });
  const [questions] = useState<QuizQuestion[]>(() =>
    buildRecognitionQuestions(items),
  );
  const [stage, setStage] = useState<Stage>('cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [learned, setLearned] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const card = items[cardIndex];
  const question = questions[questionIndex];

  const save = async (codes: string[]) => {
    setStage('saving');
    setFailed(false);
    if (codes.length === 0) {
      setStage('done');
      return;
    }
    const result = await learnWordPack(packId, {
      itemCodes: codes,
      mode: 'learn',
    });
    if (result.ok) {
      setStage('done');
    } else {
      setFailed(true);
      setStage('recognition');
    }
  };

  const answer = (option: number) => {
    if (!question || chosen !== null) return;
    setChosen(option);
    const next =
      option === question.answerIndex
        ? [...learned, question.itemCode]
        : learned;
    setLearned(next);
  };

  const nextQuestion = () => {
    setChosen(null);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(value => value + 1);
    } else {
      save(learned).catch(() => setFailed(true));
    }
  };

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('packLearn.title')}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {items.length === 0 ? (
          <AppCard testID="pack-learn-empty">
            <AppText color="secondary">{t('packLearn.empty')}</AppText>
          </AppCard>
        ) : null}

        {stage === 'cards' && card ? (
          <AppCard testID={`pack-learn-card-${card.code}`}>
            <AppText color="secondary" variant="label">
              {t('packLearn.progress', {
                current: cardIndex + 1,
                total: items.length,
              })}
            </AppText>
            <AppText variant="h2">{card.text}</AppText>
            {card.ipa ? <AppText color="secondary">{card.ipa}</AppText> : null}
            <AppText>{card.meaning_vi}</AppText>
            {card.examples[0] ? (
              <AppText color="secondary">{card.examples[0].text_en}</AppText>
            ) : null}
            <AppButton
              onPress={() => {
                if (cardIndex + 1 < items.length) {
                  setCardIndex(value => value + 1);
                } else {
                  setStage('recognition');
                }
              }}
              testID="pack-learn-next-card"
              title={t('packLearn.next')}
              variant="secondary"
            />
          </AppCard>
        ) : null}

        {stage === 'recognition' && question ? (
          <AppCard testID={`pack-learn-question-${questionIndex}`}>
            <AppText color="secondary" variant="label">
              {t('packLearn.recognition', {
                current: questionIndex + 1,
                total: questions.length,
              })}
            </AppText>
            <AppText variant="h2">{question.prompt}</AppText>
            {question.options.map((option, optionIndex) => (
              <AppButton
                key={`${questionIndex}-${optionIndex}`}
                onPress={() => answer(optionIndex)}
                testID={`pack-learn-option-${optionIndex}`}
                title={option}
                variant={
                  chosen === null
                    ? 'outline'
                    : optionIndex === question.answerIndex
                    ? 'secondary'
                    : 'outline'
                }
              />
            ))}
            {chosen !== null ? (
              <AppButton
                onPress={nextQuestion}
                testID="pack-learn-next-question"
                title={
                  questionIndex + 1 < questions.length
                    ? t('packLearn.next')
                    : t('packLearn.finish')
                }
              />
            ) : null}
            {failed ? (
              <AppText color="danger">{t('packLearn.save_failed')}</AppText>
            ) : null}
          </AppCard>
        ) : null}

        {stage === 'done' ? (
          <AppCard testID="pack-learn-done">
            <AppText variant="h3">
              {t('packLearn.done', {count: learned.length})}
            </AppText>
            <AppButton
              onPress={() => appNavigation.goBack()}
              testID="pack-learn-back"
              title={t('packLearn.back')}
              variant="outline"
            />
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
  });
}
