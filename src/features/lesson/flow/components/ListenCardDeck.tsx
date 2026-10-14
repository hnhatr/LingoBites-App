import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerFace} from '@ui/theme/hardShadow';

import {itemCardIds, type LessonBlock} from '@core/schemas/lesson';

import {itemCardText} from '../../player/components/CanonicalBlockView';
import type {FlowItems} from '../logic/flowContent';

/** Text-to-speech rate of "Nghe chậm" (the default rate is 0.5). */
export const SLOW_TTS_RATE = 0.3;

export type ListenCardDeckProps = {
  block: LessonBlock;
  items: FlowItems;
};

/**
 * Step 2 redesign: an `item_cards` block as a deck, one card at a time. The
 * learner hears the item (normal or slow), then taps the card to see its
 * meaning. Nothing here is an attempt.
 */
export function ListenCardDeck({block, items}: ListenCardDeckProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const cards = useMemo(
    () =>
      itemCardIds(block).flatMap(id => {
        const item = items.get(id);
        return item ? [{id, item}] : [];
      }),
    [block, items],
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const card = cards[index];
  if (!card) return null;
  const {id, item} = card;
  const shown = revealed.has(id);
  const speakable = item.kind !== 'pattern';
  const reveal = () => setRevealed(previous => new Set(previous).add(id));

  return (
    <View
      style={themedStyles.container}
      testID={`lesson-flow-deck-${block.id}`}
    >
      {block.title ? <AppText variant="h3">{block.title}</AppText> : null}
      <View style={themedStyles.stack}>
        {cards.length > 2 ? (
          <View style={[themedStyles.layer, themedStyles.layerBack]} />
        ) : null}
        {cards.length > 1 ? (
          <View style={[themedStyles.layer, themedStyles.layerMiddle]} />
        ) : null}
        <View style={themedStyles.card} testID={`lesson-flow-card-${id}`}>
          <View style={themedStyles.cardTop}>
            <Chip
              label={t(`lessonPlayer.item_kind_${item.kind}`)}
              tone="accentSoft"
            />
            <AppText
              color="secondary"
              testID="lesson-flow-card-count"
              variant="label"
            >
              {t('lessonFlow.card_count', {
                current: index + 1,
                total: cards.length,
              })}
            </AppText>
          </View>
          <Pressable
            accessibilityHint={t('lessonFlow.card_reveal_hint')}
            accessibilityLabel={itemCardText(item)}
            accessibilityRole="button"
            accessibilityState={{expanded: shown}}
            onPress={reveal}
            style={themedStyles.face}
            testID="lesson-flow-card-reveal"
          >
            <AppText variant="h2">{itemCardText(item)}</AppText>
            <View style={themedStyles.divider} />
            {shown ? (
              <AppText
                color="secondary"
                testID="lesson-flow-card-meaning"
                variant="bodyLg"
              >
                {item.meaning_vi}
              </AppText>
            ) : (
              <AppText color="muted" variant="label">
                {t('lessonFlow.card_reveal')}
              </AppText>
            )}
          </Pressable>
          {speakable ? (
            <View style={themedStyles.actions}>
              <IconButton
                accessibilityHint={t('lessonFlow.listen_model_hint')}
                accessibilityLabel={t('lessonFlow.listen_model')}
                icon="volume_up"
                iconSize={30}
                onPress={() => {
                  speak(item.text).catch(() => undefined);
                }}
                size={64}
                testID="lesson-flow-card-listen"
                tone="accent"
              />
              <IconButton
                accessibilityHint={t('lessonFlow.listen_slow_hint')}
                accessibilityLabel={t('lessonFlow.listen_slow')}
                icon="timer"
                onPress={() => {
                  speak(item.text, undefined, SLOW_TTS_RATE).catch(
                    () => undefined,
                  );
                }}
                size={52}
                testID="lesson-flow-card-listen-slow"
                tone="ghost"
              />
              <AppText color="secondary" variant="label">
                {t('lessonFlow.listen_slow')}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      {cards.length > 1 ? (
        <View style={themedStyles.footer}>
          <IconButton
            accessibilityHint={t('lessonFlow.card_previous_hint')}
            accessibilityLabel={t('lessonFlow.card_previous')}
            disabled={index === 0}
            icon="chevron_left"
            onPress={() => setIndex(index - 1)}
            testID="lesson-flow-card-previous"
            tone="ghost"
          />
          <View style={themedStyles.dots}>
            {cards.map((entry, position) => (
              <View
                key={entry.id}
                style={[
                  themedStyles.dot,
                  position === index ? themedStyles.dotActive : null,
                ]}
              />
            ))}
          </View>
          <IconButton
            accessibilityHint={t('lessonFlow.card_next_hint')}
            accessibilityLabel={t('lessonFlow.card_next')}
            disabled={index + 1 >= cards.length}
            icon="chevron_right"
            onPress={() => setIndex(index + 1)}
            testID="lesson-flow-card-next"
            tone="ghost"
          />
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 5),
    },
    cardTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    container: {
      gap: theme.spacing.md,
    },
    divider: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 1,
      height: 2,
    },
    dot: {
      backgroundColor: colors.outlineVariant,
      borderRadius: theme.radius.pill,
      height: 8,
      width: 8,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 24,
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    face: {
      gap: theme.spacing.sm,
      minHeight: 120,
    },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    layer: {
      borderRadius: theme.radius.xl,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      ...getStickerFace(theme, 0),
    },
    layerBack: {
      backgroundColor: solidOver(colors.secondarySoft, colors.surface),
      transform: [{rotate: '3deg'}, {translateY: 10}],
    },
    layerMiddle: {
      backgroundColor: solidOver(colors.tertiaryFixed, colors.surface),
      transform: [{rotate: '-2deg'}, {translateY: 6}],
    },
    stack: {
      marginBottom: theme.spacing.md,
    },
  });
}
