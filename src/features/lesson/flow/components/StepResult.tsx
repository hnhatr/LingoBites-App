import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ProgressRing} from '@ui/components/ProgressRing';
import {cardColors, type CardTone} from '@ui/components/ToneCard';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LessonSnapshot} from '@core/schemas/lesson';
import type {LessonActivityAttemptRow} from '@core/sync/activityAttempts';

import {
  studyCardStyle,
  StudyNavButton,
} from '../../player/components/StudyControls';
import {flowActivity} from '../logic/flowContent';
import {useLessonOutcome} from '../logic/lessonOutcome';
import type {FlowStep} from '../logic/practiceCompletion';
import {latestOutcomes} from './StepView';

export type StepResultProps = {
  snapshot: LessonSnapshot;
  attempts: readonly LessonActivityAttemptRow[];
  practiceDone: boolean;
  practiceRemaining: number;
  onOpenStep: (step: FlowStep) => void;
  onClose: () => void;
  /** A unit lesson: open the unit's next lesson in place of this one. */
  onNextLesson?: () => void;
  /** A unit lesson: close the lesson and show its unit's lessons. */
  onBackToUnit?: () => void;
  /** Current streak in days, shown as a stat when known and above 0. */
  streakDays?: number | null;
};

/**
 * Step 6: the newest result of every activity of steps 2–5, whether the
 * practice part is done, whether the lesson is passed (PR 16), and a way
 * back to what is not passed yet.
 */
export function StepResult({
  snapshot,
  attempts,
  practiceDone,
  practiceRemaining,
  onOpenStep,
  onClose,
  onNextLesson,
  onBackToUnit,
  streakDays,
}: StepResultProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const latest = useMemo(() => latestOutcomes(attempts), [attempts]);
  /** Support level of the newest attempt per block (newest first). */
  const support = useMemo(() => {
    const map = new Map<string, string>();
    for (const attempt of attempts) {
      if (!map.has(attempt.blockId)) {
        map.set(attempt.blockId, attempt.supportLevel);
      }
    }
    return map;
  }, [attempts]);
  const rows = useMemo(
    () =>
      snapshot.blocks
        .filter(
          block => block.step != null && block.step >= 2 && block.step <= 5,
        )
        .sort(
          (a, b) => (a.step ?? 0) - (b.step ?? 0) || a.position - b.position,
        )
        .flatMap(block => {
          const activity = flowActivity(block);
          return activity ? [{block, activity}] : [];
        }),
    [snapshot],
  );
  const firstOpen = rows.find(({block}) => {
    const outcome = latest.get(block.id);
    return outcome === undefined || outcome === 'fail';
  });
  const lessonOutcome = useLessonOutcome(snapshot, attempts);
  const hasIndependent = rows.some(({block}) => block.step === 5);
  const passedCount = rows.filter(({block}) =>
    isPass(latest.get(block.id)),
  ).length;
  const failedCount = rows.filter(
    ({block}) => latest.get(block.id) === 'fail',
  ).length;
  const heroKey =
    lessonOutcome.label === 'passed'
      ? 'lessonFlow.result_hero_passed'
      : practiceDone
        ? 'lessonFlow.result_hero_practice_done'
        : 'lessonFlow.result_hero_in_progress';

  const stepLabel = (step: number | null | undefined) =>
    step ? t(`lessonFlow.step_${step}`) : '';
  const primary =
    firstOpen?.block.step != null
      ? {
          label: t('lessonFlow.open_unfinished_named', {
            name: titleOf(firstOpen.activity),
          }),
          hint: t('lessonFlow.open_unfinished_hint'),
          onPress: () => onOpenStep(firstOpen.block.step as FlowStep),
          testID: 'lesson-flow-open-unfinished',
        }
      : onNextLesson
        ? {
            label: t('lessonFlow.next_lesson'),
            hint: t('lessonFlow.next_lesson_hint'),
            onPress: onNextLesson,
            testID: 'lesson-flow-next-lesson',
          }
        : {
            label: t('lessonFlow.back_to_lesson'),
            hint: t('lessonFlow.back_to_lesson_hint'),
            onPress: onClose,
            testID: 'lesson-flow-back-to-lesson',
          };

  return (
    <View style={themedStyles.container} testID="lesson-flow-result">
      <View style={themedStyles.hero} testID="lesson-flow-result-hero">
        <ProgressRing
          progress={rows.length > 0 ? passedCount / rows.length : 0}
          size={64}
          strokeWidth={8}
          value={`${passedCount}/${rows.length}`}
        />
        <View style={themedStyles.heroText}>
          <AppText testID="lesson-flow-result-title" variant="h3">
            {t(heroKey)}
          </AppText>
          <AppText color="secondary" testID="lesson-flow-practice-status">
            {practiceDone
              ? t('lessonFlow.practice_done')
              : t('lessonFlow.practice_remaining', {count: practiceRemaining})}
          </AppText>
          {lessonOutcome.label === 'in_progress' ? null : (
            <AppText
              color="secondary"
              testID="lesson-flow-lesson-outcome"
              variant="label"
            >
              {t(`lessonFlow.lesson_outcome_${lessonOutcome.label}`)}
            </AppText>
          )}
          {lessonOutcome.label === 'passed' && !lessonOutcome.confirmed ? (
            <AppText
              color="muted"
              testID="lesson-flow-lesson-outcome-unconfirmed"
              variant="caption"
            >
              {t('lessonFlow.lesson_outcome_unconfirmed')}
            </AppText>
          ) : null}
        </View>
      </View>
      {rows.length > 0 ? (
        <View style={themedStyles.stats} testID="lesson-flow-result-stats">
          <StatTile
            label={t('lessonFlow.result_stat_passed')}
            tone="accent"
            value={`${passedCount}/${rows.length}`}
          />
          <StatTile
            label={t('lessonFlow.result_stat_review')}
            tone="tertiary"
            value={String(failedCount)}
          />
          {streakDays ? (
            <StatTile
              label={t('lessonFlow.result_stat_streak')}
              tone="secondary"
              value={String(streakDays)}
            />
          ) : null}
        </View>
      ) : null}
      {(
        [
          ['practice', rows.filter(({block}) => (block.step ?? 0) < 5)],
          ['independent', rows.filter(({block}) => block.step === 5)],
        ] as const
      ).map(([part, partRows]) =>
        partRows.length === 0 ? null : (
          <View
            key={part}
            style={themedStyles.part}
            testID={`lesson-flow-result-${part}`}
          >
            <AppText variant="h3">{t(`lessonFlow.result_${part}`)}</AppText>
            <View style={themedStyles.list}>
              {partRows.map(({block, activity}, position) => {
                const outcome = latest.get(block.id);
                const level = support.get(block.id);
                const status = statusOf(outcome);
                return (
                  <Pressable
                    accessibilityHint={t('lessonFlow.step_chip_hint')}
                    accessibilityRole="button"
                    disabled={block.step == null}
                    key={block.id}
                    onPress={() => onOpenStep(block.step as FlowStep)}
                    style={({pressed}) => [
                      themedStyles.row,
                      position > 0 ? themedStyles.rowLine : null,
                      pressed ? themedStyles.pressed : null,
                    ]}
                    testID={`lesson-flow-result-${block.id}`}
                  >
                    <View
                      style={[
                        themedStyles.badge,
                        {backgroundColor: toneFace(theme, status)},
                      ]}
                    >
                      <MaterialIcon
                        color={toneInk(theme, status)}
                        name={
                          block.step === 5
                            ? 'auto_awesome'
                            : (KIND_ICONS[activity.kind] ?? 'check_circle')
                        }
                        size={18}
                      />
                    </View>
                    <View style={themedStyles.flex}>
                      <AppText numberOfLines={2} style={themedStyles.rowTitle}>
                        {titleOf(activity)}
                      </AppText>
                      <AppText color="muted" variant="caption">
                        {stepLabel(block.step)}
                      </AppText>
                    </View>
                    <View
                      style={[
                        themedStyles.pill,
                        {backgroundColor: toneFace(theme, status)},
                      ]}
                    >
                      <AppText
                        style={[
                          themedStyles.pillText,
                          {color: toneInk(theme, status)},
                        ]}
                      >
                        {outcome
                          ? t(`lessonFlow.outcome_${outcome}`)
                          : t('lessonFlow.outcome_none')}
                        {level && level !== 'none'
                          ? ` · ${t(`lessonFlow.support_${level}`)}`
                          : ''}
                      </AppText>
                    </View>
                    <MaterialIcon
                      color={theme.colors.text.muted}
                      name="chevron_right"
                      size={18}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ),
      )}
      <View style={themedStyles.actions}>
        <StudyNavButton
          accessibilityHint={primary.hint}
          icon="chevron_right"
          iconSide="right"
          label={primary.label}
          onPress={primary.onPress}
          testID={primary.testID}
          tone="coral"
        />
        {lessonOutcome.label === 'practice_done' &&
        hasIndependent &&
        firstOpen?.block.step !== 5 ? (
          <StudyNavButton
            accessibilityHint={t('lessonFlow.redo_independent_hint')}
            label={t('lessonFlow.redo_independent')}
            onPress={() => onOpenStep(5)}
            testID="lesson-flow-redo-independent"
            tone="ghost"
          />
        ) : null}
        <View style={themedStyles.actionRow}>
          {onNextLesson && primary.testID !== 'lesson-flow-next-lesson' ? (
            <StudyNavButton
              accessibilityHint={t('lessonFlow.next_lesson_hint')}
              label={t('lessonFlow.next_lesson')}
              onPress={onNextLesson}
              testID="lesson-flow-next-lesson"
              tone="ghost"
            />
          ) : null}
          {onBackToUnit ? (
            <StudyNavButton
              accessibilityHint={t('lessonFlow.back_to_unit_hint')}
              label={t('lessonFlow.back_to_unit')}
              onPress={onBackToUnit}
              testID="lesson-flow-back-to-unit"
              tone="ghost"
            />
          ) : null}
          {primary.testID !== 'lesson-flow-back-to-lesson' ? (
            <StudyNavButton
              accessibilityHint={t('lessonFlow.back_to_lesson_hint')}
              label={t('lessonFlow.back_to_lesson')}
              onPress={onClose}
              testID="lesson-flow-back-to-lesson"
              tone="ghost"
            />
          ) : null}
        </View>
      </View>
    </View>
  );

  function titleOf(activity: {titleVi: string | null; kind: string}) {
    return activity.titleVi || t(`lessonFlow.kind_${activity.kind}`);
  }
}

type Status = 'pass' | 'support' | 'fail' | 'none';

function statusOf(outcome: string | undefined): Status {
  if (outcome === 'pass_independent') return 'pass';
  if (outcome === 'pass_with_support') return 'support';
  if (outcome === 'fail') return 'fail';
  return 'none';
}

function toneFace(theme: AppTheme, status: Status): string {
  const {colors} = theme;
  switch (status) {
    case 'pass':
      return colors.accentSoft;
    case 'support':
      return colors.tertiarySoft;
    case 'fail':
      return colors.secondarySoft;
    default:
      return colors.surfaceMuted;
  }
}

function toneInk(theme: AppTheme, status: Status): string {
  const {colors} = theme;
  switch (status) {
    case 'pass':
      return colors.primary;
    case 'support':
      return colors.onTertiaryContainer;
    case 'fail':
      return colors.secondary;
    default:
      return colors.text.muted;
  }
}

const KIND_ICONS: Record<string, HandoffIconName> = {
  listen_and_repeat: 'mic',
  speaking_drill: 'mic',
  role_play: 'record_voice_over',
  multiple_choice: 'check_circle',
  fill_blank: 'edit',
  translation: 'edit',
};

/** A coloured number tile: activities passed, sentences to review, streak. */
function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: CardTone;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const colors = cardColors(theme, tone);
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[
        themedStyles.stat,
        {backgroundColor: colors.face, ...getStickerEdge(4, colors.shelf)},
      ]}
    >
      <AppText style={[themedStyles.statValue, {color: colors.ink}]}>
        {value}
      </AppText>
      <AppText
        style={[themedStyles.statLabel, {color: colors.ink}]}
        variant="caption"
      >
        {label}
      </AppText>
    </View>
  );
}

function isPass(outcome: string | undefined): boolean {
  return outcome === 'pass_independent' || outcome === 'pass_with_support';
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actions: {
      gap: 10,
      marginTop: theme.spacing.sm,
    },
    badge: {
      alignItems: 'center',
      borderRadius: 11,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    container: {
      gap: theme.spacing.md,
    },
    flex: {
      flex: 1,
    },
    hero: {
      ...studyCardStyle(theme),
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      padding: 14,
    },
    heroText: {
      flex: 1,
      gap: 2,
    },
    list: {
      ...studyCardStyle(theme),
      overflow: 'hidden',
    },
    part: {
      gap: theme.spacing.sm,
    },
    pill: {
      borderRadius: theme.radius.pill,
      maxWidth: 130,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    pillText: {
      fontSize: 11.5,
      fontWeight: '700',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: 11,
    },
    rowLine: {
      borderTopColor: colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    stat: {
      alignItems: 'center',
      borderRadius: 18,
      flexBasis: 90,
      flexGrow: 1,
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    statLabel: {
      fontWeight: '700',
      textAlign: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
    },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
  });
}
