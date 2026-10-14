import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {speak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerFace} from '@ui/theme/hardShadow';

import {parseFrame} from '@core/learning';
import {itemCardIds, type LessonBlock} from '@core/schemas/lesson';

import {
  itemCardText,
  slotLabels,
} from '../../player/components/CanonicalBlockView';
import type {FlowItems} from '../logic/flowContent';
import {useFlowFooter} from './FlowFooter';

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
  // Redesign: the bottom button walks the deck before it leaves the step.
  useFlowFooter(
    index + 1 < cards.length
      ? {
          title: t('lessonFlow.card_understood'),
          hint: t('lessonFlow.card_next_hint'),
          testID: 'lesson-flow-card-understood',
          onPress: () => setIndex(current => current + 1),
        }
      : null,
    1,
  );

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
            <AppText variant="h1">
              {item.kind === 'pattern'
                ? frameParts(item.text, slotLabels(item.payload)).map(
                    (part, position) =>
                      part.slot ? (
                        <AppText
                          key={position}
                          style={themedStyles.slot}
                          variant="h1"
                        >
                          {` ${part.text} `}
                        </AppText>
                      ) : (
                        part.text
                      ),
                  )
                : itemCardText(item)}
            </AppText>
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
              <Pressable
                accessibilityHint={t('lessonFlow.listen_model_hint')}
                accessibilityLabel={t('lessonFlow.listen_model')}
                accessibilityRole="button"
                onPress={() => {
                  speak(item.text).catch(() => undefined);
                }}
                style={({pressed}) => [
                  themedStyles.play,
                  pressed && themedStyles.pressed,
                ]}
                testID="lesson-flow-card-listen"
              >
                <MaterialIcon
                  color={theme.colors.text.inverse}
                  name="volume_up"
                  size={34}
                />
              </Pressable>
              <Pressable
                accessibilityHint={t('lessonFlow.listen_slow_hint')}
                accessibilityLabel={t('lessonFlow.listen_slow')}
                accessibilityRole="button"
                onPress={() => {
                  speak(item.text, undefined, SLOW_TTS_RATE).catch(
                    () => undefined,
                  );
                }}
                style={({pressed}) => [
                  themedStyles.slow,
                  pressed && themedStyles.pressed,
                ]}
                testID="lesson-flow-card-listen-slow"
              >
                <MaterialIcon
                  color={theme.colors.text.primary}
                  name="timer"
                  size={20}
                />
                <AppText variant="label">{t('lessonFlow.listen_slow')}</AppText>
              </Pressable>
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

/** A pattern frame split into text and slot labels, to highlight slots. */
function frameParts(
  frame: string,
  labels: Record<string, string>,
): {text: string; slot: boolean}[] {
  const parsed = parseFrame(frame);
  if (!parsed.ok) return [{text: frame, slot: false}];
  return parsed.segments.map(segment =>
    segment.type === 'text'
      ? {text: segment.value, slot: false}
      : {text: labels[segment.name] ?? '…', slot: true},
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
    play: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      width: 72,
      ...getStickerFace(theme, 5),
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    slot: {
      backgroundColor: colors.tertiaryFixed,
      color: colors.onTertiaryContainer,
    },
    slow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 52,
      paddingHorizontal: theme.spacing.md,
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
