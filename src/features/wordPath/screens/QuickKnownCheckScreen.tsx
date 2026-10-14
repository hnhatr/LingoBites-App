import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {readCatalogItems} from '@core/db/catalogItems';
import {
  buildKnownCheck,
  knownCodesFrom,
  type QuizQuestion,
} from '@core/learning/packQuiz';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {PackQuestion, PackSessionHeader} from '../components/PackSessionParts';
import {findDownloadedPack} from '../logic/wordPackRepository';
import {learnWordPack} from '../logic/wordPathClient';
import type {QuickKnownCheckRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: QuickKnownCheckRouteParams};
  /** Tests pass the questions; the screen builds them from the pack otherwise. */
  questions?: QuizQuestion[];
};

type Answer = {itemCode: string; correct: boolean};

/**
 * Vocab path P5, quick known check: ten questions over five words. A word the
 * learner gets right both times is sent as known; it starts on the review
 * schedule at level 2.

 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function QuickKnownCheckScreen({
  navigation,
  route,
  questions: given,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {speak: say} = useSpeak();
  const packId = route?.params.packId ?? '';
  const [questions] = useState<QuizQuestion[]>(() => {
    if (given) return given;
    const pack = findDownloadedPack(packId);
    if (!pack) return [];
    const byCode = readCatalogItems(pack.itemCodes);
    const items: CatalogItem[] = pack.itemCodes.flatMap(
      code => byCode.get(code) ?? [],
    );
    return buildKnownCheck(items);
  });
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [known, setKnown] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = questions[index];

  const choose = (option: number) => {
    if (!current || chosen !== null) return;
    setChosen(option);
    const next = [
      ...answers,
      {itemCode: current.itemCode, correct: option === current.answerIndex},
    ];
    setAnswers(next);
    if (index + 1 >= questions.length) {
      setKnown(knownCodesFrom(next));
    }
  };

  const advance = () => {
    setChosen(null);
    setIndex(value => value + 1);
  };

  const submit = async () => {
    if (!known || known.length === 0) {
      appNavigation.goBack();
      return;
    }
    setSubmitting(true);
    setFailed(false);
    const result = await learnWordPack(packId, {
      itemCodes: known,
      mode: 'known',
    });
    setSubmitting(false);
    if (result.ok) {
      appNavigation.goBack();
    } else {
      setFailed(true);
    }
  };

  const finished = known !== null;

  const shownIndex = finished ? questions.length : index + 1;

  return (
    <AppScreen>
      <PackSessionHeader
        current={shownIndex}
        onClose={() => navigation?.goBack?.()}
        progressLabel={t('quickCheck.title')}
        total={questions.length}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {questions.length === 0 ? (
          <AppCard testID="quick-check-empty">
            <AppText color="secondary">{t('quickCheck.empty')}</AppText>
          </AppCard>
        ) : null}
        {current && !finished ? (
          <PackQuestion
            answerIndex={current.answerIndex}
            chosen={chosen}
            onChoose={choose}
            onSpeak={() => say(current.prompt)}
            optionTestID="quick-check-option"
            options={current.options}
            prompt={current.prompt}
            containerTestID={`quick-check-question-${index}`}
          />
        ) : null}
        {finished ? (
          <AppCard testID="quick-check-done">
            <AppText variant="h3">
              {t('quickCheck.summary', {count: known?.length ?? 0})}
            </AppText>
            {failed ? (
              <AppText color="danger">{t('quickCheck.submit_failed')}</AppText>
            ) : null}
            <AppButton
              disabled={submitting}
              onPress={submit}
              testID="quick-check-save"
              title={failed ? t('quickCheck.retry') : t('quickCheck.save')}
              variant="secondary"
            />
          </AppCard>
        ) : null}
      </ScrollView>
      {current && !finished ? (
        <View style={themedStyles.footer}>
          <AppButton
            disabled={chosen === null}
            iconRight="chevron_right"
            onPress={advance}
            testID="quick-check-next"
            title={t('quickCheck.next')}
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
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
  });
}
