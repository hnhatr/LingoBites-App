import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';
import {requestSync} from '@features/sync';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {createRequestId} from '@core/api/requestId';

import {
  type ItemReviewQueue,
  itemReviewQueue,
  recordItemReview,
} from '../logic/itemReview';

type Props = {
  navigation?: {goBack?: () => void};
  /** Tests pass a fixed queue; the screen reads today's otherwise. */
  queue?: ItemReviewQueue;
};

function readQueue(): ItemReviewQueue {
  try {
    return itemReviewQueue();
  } catch {
    return {items: [], missing: 0, doneToday: 0};
  }
}

/**
 * PR 16 (decision G9): today's lesson items on the Server's schedule. The
 * learner recalls the meaning, turns the card and says whether they knew
 * it; each answer is a review attempt the Server schedules from.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ItemReviewScreen({navigation, queue: given}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [queue] = useState(() => given ?? readQueue());
  const [sessionId] = useState(createRequestId);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [tally, setTally] = useState({correct: 0, incorrect: 0});
  const [failed, setFailed] = useState(false);
  const current = queue.items[index];

  const answer = (result: 'correct' | 'incorrect') => {
    if (!current) return;
    const ok = recordItemReview({
      itemCode: current.item.code,
      result,
      sessionId,
      durationMs: Math.min(Date.now() - shownAt, 3_600_000),
    });
    if (!ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setTally(value => ({...value, [result]: value[result] + 1}));
    setIndex(value => value + 1);
    setRevealed(false);
    setShownAt(Date.now());
    requestSync();
  };

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('itemReview.title')}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {queue.missing > 0 ? (
          <AppText
            color="secondary"
            testID="item-review-missing"
            variant="label"
          >
            {t('itemReview.missing', {count: queue.missing})}
          </AppText>
        ) : null}
        {current ? (
          <AppCard testID={`item-review-card-${current.item.code}`}>
            <AppText color="secondary" variant="label">
              {t('itemReview.progress', {
                current: index + 1,
                total: queue.items.length,
              })}
            </AppText>
            <View style={themedStyles.row}>
              <Pressable
                accessibilityHint={t('itemReview.reveal_hint')}
                accessibilityRole="button"
                onPress={() => setRevealed(value => !value)}
                style={themedStyles.flex}
                testID="item-review-reveal"
              >
                <AppText variant="h2">{current.item.text}</AppText>
                <AppText color="secondary" testID="item-review-meaning">
                  {revealed ? current.item.meaning_vi : t('itemReview.reveal')}
                </AppText>
              </Pressable>
              <IconButton
                accessibilityHint={t('itemReview.listen_hint')}
                accessibilityLabel={t('itemReview.listen')}
                icon="volume_up"
                onPress={() => {
                  speak(current.item.text).catch(() => undefined);
                }}
              />
            </View>
            <View style={themedStyles.row}>
              <AppButton
                accessibilityHint={t('itemReview.remembered_hint')}
                onPress={() => answer('correct')}
                style={themedStyles.flex}
                testID="item-review-remembered"
                title={t('itemReview.remembered')}
                variant="secondary"
              />
              <AppButton
                accessibilityHint={t('itemReview.forgot_hint')}
                onPress={() => answer('incorrect')}
                style={themedStyles.flex}
                testID="item-review-forgot"
                title={t('itemReview.forgot')}
                variant="outline"
              />
            </View>
            {failed ? (
              <AppText color="danger">{t('itemReview.save_failed')}</AppText>
            ) : null}
          </AppCard>
        ) : (
          <AppCard testID="item-review-done">
            <AppText variant="h3">
              {queue.items.length === 0
                ? t('itemReview.empty')
                : t('itemReview.done')}
            </AppText>
            {queue.items.length > 0 ? (
              <AppText color="secondary" testID="item-review-summary">
                {t('itemReview.summary', tally)}
              </AppText>
            ) : null}
            <AppButton
              accessibilityHint={t('itemReview.back_hint')}
              onPress={() => navigation?.goBack?.()}
              testID="item-review-back"
              title={t('itemReview.back')}
              variant="outline"
            />
          </AppCard>
        )}
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
