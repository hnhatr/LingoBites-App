import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  dueItemCodes,
  getDueFlashcardsByItemKeys,
  recordFlashcardRating,
  recordItemReview,
} from '@features/review';
import {requestSync} from '@features/sync';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {FlashcardRecord, ReviewRating} from '@core/db/types';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {
  lessonItemCodes,
  relatedReviewRows,
  type ReviewRow,
} from '../logic/relatedReview';

export type StepReviewProps = {
  snapshot: LessonSnapshot;
  onSpeakText: (text: string) => void;
  onOpenLesson: (lessonId: string) => void;
};

function readDueCards(snapshot: LessonSnapshot): FlashcardRecord[] {
  try {
    return getDueFlashcardsByItemKeys(lessonItemCodes(snapshot));
  } catch {
    return [];
  }
}

function readDueItems(snapshot: LessonSnapshot): Set<string> {
  try {
    return dueItemCodes(lessonItemCodes(snapshot));
  } catch {
    return new Set();
  }
}

/**
 * Step 1 "Ôn liên quan" (decision G5): prerequisite lessons, the items this
 * lesson builds on and lesson items whose cards are due. Due cards are rated
 * "Nhớ" / "Quên" like in the daily review; nothing here is a lesson attempt.
 */
export function StepReview({
  snapshot,
  onSpeakText,
  onOpenLesson,
}: StepReviewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [dueCards] = useState(() => readDueCards(snapshot));
  const [dueItems] = useState(() => readDueItems(snapshot));
  const rows = useMemo(
    () => relatedReviewRows(snapshot, dueCards, dueItems),
    [snapshot, dueCards, dueItems],
  );
  const prerequisites = snapshot.spec?.prerequisites ?? [];

  if (rows.length === 0 && prerequisites.length === 0) {
    return (
      <AppText color="secondary" testID="lesson-flow-review-empty">
        {t('lessonFlow.review_empty')}
      </AppText>
    );
  }
  return (
    <View style={themedStyles.container}>
      {prerequisites.length > 0 ? (
        <View style={themedStyles.container}>
          <AppText variant="label">
            {t('lessonFlow.review_prerequisites')}
          </AppText>
          {prerequisites.map(lesson => (
            <AppButton
              accessibilityHint={t('lessonFlow.open_prerequisite_hint')}
              key={lesson.lesson_id}
              onPress={() => onOpenLesson(lesson.lesson_id)}
              testID={`lesson-flow-prerequisite-${lesson.lesson_id}`}
              title={lesson.title}
              variant="outline"
            />
          ))}
        </View>
      ) : null}
      {rows.map(row => (
        <ReviewCard key={row.item.id} onSpeakText={onSpeakText} row={row} />
      ))}
    </View>
  );
}

function ReviewCard({
  row,
  onSpeakText,
}: {
  row: ReviewRow;
  onSpeakText: (text: string) => void;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState<ReviewRating | null>(null);
  const [failed, setFailed] = useState(false);

  const [shownAt] = useState(() => Date.now());
  const rate = (rating: ReviewRating) => {
    if (rated) return;
    let ok = false;
    if (row.dueItem) {
      ok = recordItemReview({
        itemCode: row.item.code,
        result: rating === 'remembered' ? 'correct' : 'incorrect',
        durationMs: Math.min(Date.now() - shownAt, 3_600_000),
      });
    } else if (row.dueCard) {
      ok = recordFlashcardRating({flashcardId: row.dueCard.id, rating}).ok;
    } else {
      return;
    }
    if (!ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRated(rating);
    requestSync();
  };

  return (
    <AppCard testID={`lesson-flow-review-${row.item.code}`}>
      <View style={themedStyles.row}>
        <Pressable
          accessibilityHint={t('lessonFlow.reveal_meaning_hint')}
          accessibilityRole="button"
          onPress={() => setRevealed(value => !value)}
          style={themedStyles.flex}
          testID="lesson-flow-review-reveal"
        >
          <AppText variant="h3">{row.item.text}</AppText>
          <AppText color="secondary">
            {revealed ? row.item.meaning_vi : t('lessonFlow.reveal_meaning')}
          </AppText>
        </Pressable>
        <IconButton
          accessibilityHint={t('lessonFlow.listen_line_hint')}
          accessibilityLabel={t('lessonFlow.listen_line')}
          icon="volume_up"
          onPress={() => onSpeakText(row.item.text)}
        />
      </View>
      {row.dueCard || row.dueItem ? (
        rated ? (
          <AppText
            color="secondary"
            testID="lesson-flow-review-rated"
            variant="label"
          >
            {t('lessonFlow.review_rated')}
          </AppText>
        ) : (
          <View style={themedStyles.row}>
            <AppButton
              accessibilityHint={t('lessonFlow.review_remembered_hint')}
              onPress={() => rate('remembered')}
              style={themedStyles.flex}
              testID="lesson-flow-review-remembered"
              title={t('lessonFlow.review_remembered')}
              variant="secondary"
            />
            <AppButton
              accessibilityHint={t('lessonFlow.review_forgot_hint')}
              onPress={() => rate('forgot')}
              style={themedStyles.flex}
              testID="lesson-flow-review-forgot"
              title={t('lessonFlow.review_forgot')}
              variant="outline"
            />
          </View>
        )
      ) : null}
      {failed ? (
        <AppText color="danger">{t('lessonFlow.save_failed')}</AppText>
      ) : null}
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
