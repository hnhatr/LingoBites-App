import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';
import {
  reconcileReminders,
  type ReviewSession,
  startReviewSession,
} from '@features/engagement';
import {requestSync} from '@features/sync';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Banner} from '@ui/components/Banner';
import {ErrorCard} from '@ui/components/ErrorCard';
import {FlipCard} from '@ui/components/FlipCard';
import {HandoffProgressTrack} from '@ui/components/HandoffProgressTrack';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {IconButton} from '@ui/components/IconButton';
import {Medallion} from '@ui/components/Medallion';
import {RatingControl} from '@ui/components/RatingControl';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import type {FlashcardRecord, ReviewRating} from '@core/db/types';
import {useFeatureEnabled} from '@core/release';

import {useFlashcardLibrary} from '../logic/useFlashcardLibrary';

const DEFAULT_SOFT_CAP = 10;

/** Runs an async side effect without returning its promise to the caller. */
function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

type Props = {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string) => void;
    popToTop?: () => void;
  };
  softCap?: number;
};

type Summary = {
  reviewed: number;
  remembered: number;
  forgot: number;
};

function FlashcardFace({
  card,
  side,
}: {
  card: FlashcardRecord;
  side: 'front' | 'back';
}) {
  const {t} = useTranslation();

  // SETE-253: the flip must reveal something new. The front is the English
  // prompt only (recall cue); the back leads with the Vietnamese meaning as
  // the answer and repeats the English smaller as context. Cards without a
  // translation never reach this component — they are filtered out of the due
  // queue in `getDueFlashcards`.
  if (side === 'back') {
    return (
      <View style={styles.cardFace} testID="review-card-back">
        <AppText color="primary" style={styles.meaning} variant="h2">
          {card.meaningVi}
        </AppText>
        <AppText color="muted" style={styles.contextWord}>
          {card.word}
        </AppText>
        <IconButton
          accessibilityLabel={t('review.listen_answer_a11y')}
          icon="play_circle"
          onPress={() => {
            fireAndForget(speak(card.word));
          }}
          testID="review-speak-back"
        />
        {/* A word saved from an analysis has no curated example, but it does
            carry the sentence it was found in: show that as context. */}
        {card.example || card.sourceSentence ? (
          <AppText
            color="secondary"
            style={styles.example}
            testID="review-card-example"
          >
            {card.example ?? card.sourceSentence}
          </AppText>
        ) : null}
        {card.example && card.exampleTranslation ? (
          <AppText color="secondary" style={styles.example}>
            {card.exampleTranslation}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.cardFace} testID="review-card-front">
      <AppText style={styles.word} variant="h2">
        {card.word}
      </AppText>
      {card.wordType || card.ipa ? (
        <AppText color="secondary">
          {card.wordType ? `[${card.wordType}] ` : ''}
          {card.ipa ? `/${card.ipa}/` : ''}
        </AppText>
      ) : null}
      <IconButton
        accessibilityLabel={t('review.listen_prompt_a11y')}
        icon="play_circle"
        onPress={() => {
          fireAndForget(speak(card.word));
        }}
        testID="review-speak-front"
      />
    </View>
  );
}

export function DailyReviewScreen({
  navigation,
  softCap = DEFAULT_SOFT_CAP,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const reviewSystemEnabled = useFeatureEnabled('reviewSystem');
  const {
    getCardDueAt,
    getDueFlashcards,
    listFlashcards,
    recordFlashcardRating,
  } = useFlashcardLibrary();
  const [allDueCount] = useState(() => getDueFlashcards().length);
  const [sessionCards] = useState(() => getDueFlashcards({limit: softCap}));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({
    reviewed: 0,
    remembered: 0,
    forgot: 0,
  });
  const [complete, setComplete] = useState(false);
  // Engagement session (SETE-89): records the rated cards and, when the session
  // ends, writes the gamification events that drive streak/XP/badges/pet state.
  const [session] = useState<ReviewSession>(() => startReviewSession());
  const [sessionXpEarned, setSessionXpEarned] = useState<number | null>(null);

  const savedCardCount = useMemo(
    () => listFlashcards().length,
    [listFlashcards],
  );
  const carryOverCount = Math.max(0, allDueCount - sessionCards.length);
  const activeCard = sessionCards[currentIndex] ?? null;

  function finishNext(nextSummary: Summary) {
    setRatingError(null);
    setFlipped(false);
    if (currentIndex + 1 >= sessionCards.length) {
      setSummary(nextSummary);
      setComplete(true);
      finalizeSession();
      return;
    }
    setSummary(nextSummary);
    setCurrentIndex(index => index + 1);
  }

  /** Persists the session's gamification events (idempotent, no-op if empty). */
  function finalizeSession() {
    const outcome = session.finish();
    if (outcome?.ok) {
      setSessionXpEarned(outcome.xpEarned);
      // Ratings just moved several due times: reconcile reminders so stale ones
      // are cancelled and the new due times are scheduled (REQ-10 / VC-5).
      reconcileReminders();
    }
  }

  function handleRate(rating: ReviewRating) {
    // SETE-254: ratings are gated behind the flip — the RatingControl is
    // disabled pre-flip, and this guard keeps a pre-flip rating from ever
    // being recorded even if the handler is invoked directly.
    if (!flipped) {
      return;
    }
    const card = sessionCards[currentIndex];
    if (!card) {
      return;
    }

    const reviewedAt = new Date().toISOString();
    // Due instant before rating — needed to tell whether this was on time.
    const dueAt = getCardDueAt(card.id);
    const result = recordFlashcardRating({flashcardId: card.id, rating});

    if (!result.ok) {
      // Persistence failed: keep the learner on this card and surface the
      // translated error instead of silently advancing the session.
      setRatingError(
        result.errorCode === 'FLASHCARD_NOT_FOUND'
          ? t('errors.flashcard_not_found')
          : t('errors.flashcard_rating_save_failed'),
      );
      return;
    }

    session.record({
      flashcardId: card.id,
      rating,
      dueAt,
      reviewedAt,
    });
    requestSync();

    const nextSummary = {
      reviewed: summary.reviewed + 1,
      remembered: summary.remembered + (rating === 'remembered' ? 1 : 0),
      forgot: summary.forgot + (rating === 'forgot' ? 1 : 0),
    };
    finishNext(nextSummary);
  }

  function handleSkip() {
    // SETE-254: same flip gate as handleRate — the skip control is disabled
    // pre-flip, and this keeps a pre-flip skip from advancing the session.
    if (!flipped) {
      return;
    }
    finishNext({
      ...summary,
      reviewed: summary.reviewed + 1,
    });
  }

  function exitSession() {
    // Leaving after rating at least one card still closes the session.
    finalizeSession();
    navigation?.goBack?.();
  }

  function requestExit() {
    // Nothing at stake on the first card with no answers given: exit directly.
    if (summary.reviewed === 0) {
      exitSession();
      return;
    }
    Alert.alert(
      t('review.exit_title'),
      t('review.exit_body', {
        reviewed: summary.reviewed,
        total: sessionCards.length,
      }),
      [
        {text: t('review.exit_stay'), style: 'cancel'},
        {
          text: t('review.exit_quit'),
          style: 'destructive',
          onPress: exitSession,
        },
      ],
    );
  }

  if (!reviewSystemEnabled) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ErrorCard message={t('review.feature_disabled')} />
        </View>
      </AppScreen>
    );
  }

  const closeButton = (
    <HeaderIconButton
      accessibilityLabel={t('review.close_a11y')}
      icon="close"
      onPress={requestExit}
      testID="review-close"
    />
  );

  if (sessionCards.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader rightAction={closeButton} title={t('review.title')} />
        <View style={styles.emptyState}>
          <Medallion label={savedCardCount === 0 ? '0' : '✓'} />
          <AppText style={styles.emptyTitle} variant="h2">
            {savedCardCount === 0
              ? t('review.empty_no_cards_title')
              : t('review.empty_done_title')}
          </AppText>
          <AppText color="secondary" style={styles.emptyCopy}>
            {savedCardCount === 0
              ? t('review.empty_no_cards_body')
              : t('review.empty_done_body')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if (complete) {
    return (
      <AppScreen>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {paddingHorizontal: theme.gutter},
          ]}
          testID="review-summary"
        >
          <AppText variant="h1">{t('review.summary_title')}</AppText>
          {carryOverCount > 0 ? (
            <Banner
              message={t('review.carry_over', {count: carryOverCount})}
              variant="neutral"
            />
          ) : null}
          <AppCard style={styles.summaryCard}>
            <View style={styles.statRow}>
              <Medallion label={`${summary.reviewed}`} size={76} />
              <View style={styles.statText}>
                <AppText color="secondary" variant="label">
                  {t('review.summary_reviewed_label')}
                </AppText>
                <AppText testID="summary-reviewed-count" variant="h2">
                  {summary.reviewed}
                </AppText>
              </View>
            </View>
            <View style={styles.breakdown}>
              <View style={styles.breakdownItem}>
                <AppText color="secondary" variant="label">
                  {t('review.summary_remembered_label')}
                </AppText>
                <AppText testID="summary-remembered-count" variant="h3">
                  {summary.remembered}
                </AppText>
              </View>
              <View style={styles.breakdownItem}>
                <AppText color="secondary" variant="label">
                  {t('review.summary_forgot_label')}
                </AppText>
                <AppText testID="summary-forgot-count" variant="h3">
                  {summary.forgot}
                </AppText>
              </View>
            </View>
            {sessionXpEarned != null && sessionXpEarned > 0 ? (
              <View
                style={[
                  styles.xpRow,
                  {backgroundColor: theme.colors.accentSoft},
                ]}
              >
                <AppText
                  style={[styles.xpText, {color: theme.colors.primary}]}
                  testID="summary-xp-earned"
                >
                  {t('review.summary_xp', {xp: sessionXpEarned})}
                </AppText>
              </View>
            ) : null}
          </AppCard>
          <AppButton
            accessibilityLabel={t('review.back_to_home_a11y')}
            onPress={() => navigation?.popToTop?.() ?? navigation?.goBack?.()}
            title={t('review.back_to_home')}
          />
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader rightAction={closeButton} title={t('review.title')} />
      <View
        style={[styles.progress, {paddingHorizontal: theme.gutter}]}
        testID="review-progress"
      >
        <HandoffProgressTrack
          label={`${currentIndex + 1} / ${sessionCards.length}`}
          progress={(currentIndex + 1) / sessionCards.length}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: theme.gutter,
          },
        ]}
        style={styles.flex1}
      >
        {carryOverCount > 0 ? (
          <Banner
            message={t('review.carry_over', {count: carryOverCount})}
            variant="neutral"
          />
        ) : null}
        {ratingError ? <ErrorCard message={ratingError} /> : null}
        {activeCard ? (
          <FlipCard
            back={<FlashcardFace card={activeCard} side="back" />}
            backHint={t('review.show_prompt_hint')}
            flipped={flipped}
            front={<FlashcardFace card={activeCard} side="front" />}
            frontHint={t('review.show_answer_hint')}
            onFlip={() => setFlipped(value => !value)}
            testID="daily-review-flip-card"
          />
        ) : null}
        <RatingControl
          disabled={!flipped}
          onRate={handleRate}
          onSkip={handleSkip}
        />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  breakdownItem: {
    flexBasis: '46%',
    flexGrow: 1,
    gap: 4,
  },
  cardFace: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  contextWord: {
    textAlign: 'center',
  },
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  emptyCopy: {
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  example: {
    textAlign: 'center',
  },
  meaning: {
    textAlign: 'center',
  },
  progress: {
    paddingBottom: 8,
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  statText: {
    flex: 1,
    gap: 4,
  },
  summaryCard: {
    gap: 16,
  },
  word: {
    textAlign: 'center',
  },
  xpRow: {
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  xpText: {
    fontWeight: '700',
  },
  flex1: {
    flex: 1,
  },
});
