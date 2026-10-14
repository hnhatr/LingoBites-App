import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {
  buildRecognitionQuestions,
  type QuizQuestion,
} from '@core/learning/packQuiz';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {PackFlashCard} from '../components/PackFlashCard';
import {
  PackQuestion,
  PackSessionHeader,
  PackSessionSteps,
} from '../components/PackSessionParts';
import {topicLabelOf} from '../logic/packRows';
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
  const {speak: say} = useSpeak();
  const packId = route?.params.packId ?? '';
  const [pack] = useState(() => (given ? null : findDownloadedPack(packId)));
  const [items] = useState<CatalogItem[]>(() => {
    if (given) return given;
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

  const packLabel = pack
    ? (topicLabelOf(pack.topicCode) ??
      t('wordPath.pack_title', {position: pack.position}))
    : null;
  const close = () => navigation?.goBack?.();
  const header =
    stage === 'cards'
      ? {
          current: Math.min(cardIndex + 1, items.length),
          total: items.length,
          label: t('packLearn.progress', {
            current: cardIndex + 1,
            total: items.length,
          }),
        }
      : {
          current:
            stage === 'recognition' ? questionIndex + 1 : questions.length,
          total: questions.length,
          label: t('packLearn.recognition', {
            current: questionIndex + 1,
            total: questions.length,
          }),
        };

  return (
    <AppScreen>
      <PackSessionHeader
        current={header.current}
        onClose={close}
        progressLabel={header.label}
        total={header.total}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {items.length === 0 ? (
          <AppCard testID="pack-learn-empty">
            <AppText color="secondary">{t('packLearn.empty')}</AppText>
          </AppCard>
        ) : null}

        {items.length > 0 && stage !== 'done' ? (
          <PackSessionSteps
            active={stage === 'cards' ? 0 : 1}
            labels={[t('packLearn.step_cards'), t('packLearn.step_quiz')]}
          />
        ) : null}

        {stage === 'cards' && card ? (
          <PackFlashCard
            example={card.examples[0]?.text_en ?? null}
            ipa={card.ipa}
            meaning={card.meaning_vi}
            onSpeak={() => say(card.text)}
            packLabel={packLabel}
            testID={`pack-learn-card-${card.code}`}
            word={card.text}
          />
        ) : null}

        {stage !== 'cards' && stage !== 'done' && question ? (
          <PackQuestion
            answerIndex={question.answerIndex}
            chosen={chosen}
            onChoose={answer}
            onSpeak={() => say(question.prompt)}
            optionTestID="pack-learn-option"
            options={question.options}
            prompt={question.prompt}
            containerTestID={`pack-learn-question-${questionIndex}`}
          />
        ) : null}
        {failed ? (
          <AppText color="danger">{t('packLearn.save_failed')}</AppText>
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

      {stage === 'cards' && card ? (
        <View style={themedStyles.footer}>
          <IconButton
            accessibilityHint={t('packLearn.prev_hint')}
            accessibilityLabel={t('packLearn.prev')}
            disabled={cardIndex === 0}
            icon="chevron_left"
            onPress={() => setCardIndex(value => Math.max(0, value - 1))}
            size={52}
            testID="pack-learn-prev-card"
            tone="ghost"
          />
          <AppButton
            iconRight="chevron_right"
            onPress={() => {
              if (cardIndex + 1 < items.length) {
                setCardIndex(value => value + 1);
              } else {
                setStage('recognition');
              }
            }}
            style={themedStyles.grow}
            testID="pack-learn-next-card"
            title={t('packLearn.next')}
            variant="secondary-coral"
          />
        </View>
      ) : null}

      {(stage === 'recognition' || stage === 'saving') && question ? (
        <View style={themedStyles.footer}>
          <AppButton
            disabled={chosen === null || stage === 'saving'}
            loading={stage === 'saving'}
            onPress={nextQuestion}
            style={themedStyles.grow}
            testID="pack-learn-next-question"
            title={
              questionIndex + 1 < questions.length
                ? t('packLearn.next')
                : t('packLearn.finish')
            }
            variant="primary"
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    grow: {
      flex: 1,
    },
  });
}
