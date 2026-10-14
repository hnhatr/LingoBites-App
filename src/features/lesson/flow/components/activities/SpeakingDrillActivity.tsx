import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {parseFrame} from '@core/learning';
import type {SpeakingDrillContent} from '@core/schemas/activityContent';
import type {LessonTask} from '@core/schemas/lesson';

import type {EntryReport} from '../../logic/activityOutcome';
import {comboSentence, type FlowItems} from '../../logic/flowContent';
import {hintLadder} from '../../logic/hints';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type SpeakingDrillActivityProps = {
  content: SpeakingDrillContent;
  items: FlowItems;
  task: LessonTask | null;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * Say the pattern with each combination of slot values; the model sentence
 * (the frame filled in) stays hidden until the learner asks for it.
 * Redesign: one card per combination: the values to say next to a badge,
 * the frame with its slots blank, and every combination as a token (done,
 * current, next).
 */
export function SpeakingDrillActivity({
  content,
  items,
  task,
  onComplete,
}: SpeakingDrillActivityProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const frame = items.get(content.patternItemId)?.text;
  const parts = useMemo(() => {
    if (!frame) return [];
    const parsed = parseFrame(frame);
    return parsed.ok
      ? parsed.segments.map(segment =>
          segment.type === 'text'
            ? {text: segment.value, blank: false}
            : {text: BLANK, blank: true},
        )
      : [{text: frame, blank: false}];
  }, [frame]);
  return (
    <EntrySequence
      count={content.combos.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const combo = content.combos[index]!;
        const values = Object.values(combo.values);
        const model = comboSentence(items, content.patternItemId, combo.values);
        return (
          <View style={themedStyles.entry}>
            <View style={themedStyles.card}>
              <View style={themedStyles.who}>
                <View style={themedStyles.badge}>
                  <AppText variant="h1">
                    {(values[0] ?? '?').charAt(0).toUpperCase()}
                  </AppText>
                </View>
                <View style={themedStyles.flex}>
                  <AppText color="secondary" variant="caption">
                    {t('lessonFlow.drill_say_with')}
                  </AppText>
                  <AppText testID="lesson-flow-drill-values" variant="h1">
                    {values.join(' · ')}
                  </AppText>
                </View>
              </View>
              {parts.length > 0 ? (
                <View style={themedStyles.frame}>
                  <AppText
                    style={themedStyles.center}
                    testID="lesson-flow-drill-frame"
                    variant="h3"
                  >
                    {parts.map((part, position) =>
                      part.blank ? (
                        <AppText
                          key={position}
                          style={themedStyles.blank}
                          variant="h3"
                        >
                          {part.text}
                        </AppText>
                      ) : (
                        part.text
                      ),
                    )}
                  </AppText>
                </View>
              ) : null}
              {content.combos.length > 1 ? (
                <View style={themedStyles.tokens}>
                  {content.combos.map((entry, position) => (
                    <View
                      key={position}
                      style={[
                        themedStyles.token,
                        position === index
                          ? themedStyles.tokenCurrent
                          : position < index
                          ? themedStyles.tokenDone
                          : null,
                      ]}
                    >
                      <AppText
                        color={position === index ? 'primary' : 'muted'}
                        variant="label"
                      >
                        {Object.values(entry.values).join(' · ')}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <SpeakSelfCheck
              hints={hintLadder({task, model, frame})}
              model={model}
              onReport={report}
            />
          </View>
        );
      }}
    />
  );
}

/** What a slot shows in the frame: a blank to fill by speaking. */
const BLANK = '\u00a0_____\u00a0';

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      backgroundColor: colors.tertiaryFixed,
      borderRadius: 22,
      height: 64,
      justifyContent: 'center',
      width: 64,
      ...getStickerFace(theme, 0),
    },
    blank: {
      backgroundColor: colors.tertiaryFixed,
      color: colors.onTertiaryContainer,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      ...getStickerFace(theme, 5),
    },
    center: {
      textAlign: 'center',
    },
    entry: {
      gap: theme.spacing.md,
    },
    flex: {
      flex: 1,
    },
    frame: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
    },
    token: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    tokenCurrent: {
      backgroundColor: colors.tertiaryFixed,
      ...getStickerFace(theme, 0),
    },
    tokenDone: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentSoft,
    },
    tokens: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      justifyContent: 'center',
    },
    who: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
  });
}
