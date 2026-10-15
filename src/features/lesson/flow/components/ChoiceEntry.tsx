import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {QuizOption, type QuizOptionState} from '@ui/components/QuizOption';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonSupportLevel} from '@core/schemas/sync';

import type {EntryResult} from '../logic/activityOutcome';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ChoiceEntryProps = {
  options: ReadonlyArray<{id: string; text: string}>;
  rightId: string;
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
};

/**
 * Pick one option. A wrong pick is marked and the learner picks again; the
 * right one ends the entry (after a wrong pick it counts as a retry). "Xem
 * đáp án" shows the right option and counts as not done (decision G9).
 */
export function ChoiceEntry({options, rightId, onReport}: ChoiceEntryProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set());
  const [finished, setFinished] = useState<'right' | 'shown' | null>(null);
  /** The one hint of a choice (PR 11 G3): a wrong option taken away. */
  const [removed, setRemoved] = useState<string | null>(null);
  const support: LessonSupportLevel = removed ? 'hint_1' : 'none';
  const canEliminate =
    removed === null &&
    options.filter(o => o.id !== rightId && !wrong.has(o.id)).length > 1;

  const choose = (id: string) => {
    if (finished) return;
    if (id === rightId) {
      setFinished('right');
      onReport(wrong.size === 0 ? 'first_try' : 'after_retry', support);
    } else {
      setWrong(previous => new Set(previous).add(id));
    }
  };

  const optionState = (id: string): QuizOptionState => {
    if (finished && id === rightId) return 'correct';
    return wrong.has(id) || removed === id ? 'wrong' : 'default';
  };

  return (
    <View style={themedStyles.container}>
      {options.map((option, index) => {
        const key = OPTION_KEYS[index] ?? String(index + 1);
        return (
          <QuizOption
            accessibilityHint={t('lessonFlow.option_hint')}
            accessibilityLabel={t('lessonFlow.option_a11y', {
              key,
              text: option.text,
            })}
            disabled={
              finished !== null || wrong.has(option.id) || removed === option.id
            }
            key={option.id}
            label={option.text}
            onPress={() => choose(option.id)}
            optionKey={key}
            state={optionState(option.id)}
            testID={`lesson-flow-option-${index}`}
          />
        );
      })}
      {finished === 'right' ? (
        <View style={[themedStyles.banner, themedStyles.bannerRight]}>
          <AppText
            style={themedStyles.bannerRightText}
            testID="lesson-flow-feedback-right"
            variant="label"
          >
            {t('lessonFlow.feedback_right')}
          </AppText>
        </View>
      ) : null}
      {finished === null && wrong.size > 0 ? (
        <View style={[themedStyles.banner, themedStyles.bannerWrong]}>
          <AppText
            style={themedStyles.bannerWrongText}
            testID="lesson-flow-feedback-wrong"
            variant="label"
          >
            {t('lessonFlow.feedback_wrong_choice')}
          </AppText>
        </View>
      ) : null}
      {finished === null ? (
        <View style={themedStyles.helpRow}>
          {canEliminate ? (
            <HelpChip
              accessibilityHint={t('lessonFlow.hint_eliminate_hint')}
              icon="lightbulb"
              label={t('lessonFlow.hint_eliminate_short')}
              onPress={() =>
                setRemoved(
                  options.find(o => o.id !== rightId && !wrong.has(o.id))?.id ??
                    null,
                )
              }
              testID="lesson-flow-hint-eliminate"
              tone="sky"
            />
          ) : null}
          <HelpChip
            accessibilityHint={t('lessonFlow.show_answer_hint')}
            icon="visibility"
            label={t('lessonFlow.show_answer')}
            onPress={() => {
              setFinished('shown');
              onReport('not_yet', support);
            }}
            testID="lesson-flow-show-answer"
            tone="sun"
          />
        </View>
      ) : null}
    </View>
  );
}

/** A small help button under the options: sky for a hint, sun for the answer. */
function HelpChip({
  label,
  icon,
  tone,
  onPress,
  accessibilityHint,
  testID,
}: {
  label: string;
  icon: HandoffIconName;
  tone: 'sky' | 'sun';
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const sky = tone === 'sky';
  const ink = sky ? HERO_PALETTE.skyInk : theme.colors.onTertiaryContainer;
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        themedStyles.help,
        sky ? themedStyles.helpSky : themedStyles.helpSun,
        pressed ? themedStyles.helpPressed : null,
      ]}
      testID={testID}
    >
      <MaterialIcon color={ink} name={icon} size={16} />
      <AppText style={[themedStyles.helpText, {color: ink}]}>{label}</AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
    },
    banner: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bannerRight: {
      backgroundColor: colors.accentSoft,
    },
    bannerRightText: {
      color: colors.primary,
    },
    bannerWrong: {
      backgroundColor: colors.secondarySoft,
    },
    bannerWrongText: {
      color: colors.secondary,
    },
    help: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 13,
    },
    helpPressed: {
      transform: [{translateY: 2}],
    },
    helpRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
    },
    helpSky: {
      backgroundColor: HERO_PALETTE.skySoft,
      ...getStickerEdge(3, HERO_PALETTE.skyShelf),
    },
    helpSun: {
      backgroundColor: solidOver(colors.tertiarySoft, colors.surface),
      ...getStickerEdge(3, colors.tertiaryBorder),
    },
    helpText: {
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}
