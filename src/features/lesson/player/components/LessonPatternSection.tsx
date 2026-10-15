import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonPatternEntry} from '../logic/lessonHubContent';
import type {PatternSaveControl} from '../logic/useLessonSavedItems';
import {
  BookmarkToggle,
  SpeakSquare,
  studyCardStyle,
  StudyLabel,
  StudyNavButton,
  StudyNavRow,
  StudyPage,
  StudyProgress,
} from './StudyControls';
import {SwipeCard} from './SwipeCard';

export type LessonPatternSectionProps = {
  entries: LessonPatternEntry[];
  /** Speaks a sentence (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per pattern; omitted = no save buttons. */
  saveControl?: PatternSaveControl;
  /** "Xong" after the last pattern; omitted = no button there. */
  onFinish?: () => void;
};

/**
 * "Mẫu câu": one sentence pattern of a curriculum lesson at a time. The
 * slots of the frame are yellow; tapping one lists its values underneath
 * and picking a value rebuilds the sentence. Common errors, other ways to
 * say it and examples fold away under the card. The chosen values live in
 * the card only and are never stored.
 */
export function LessonPatternSection({
  entries,
  onSpeakText,
  saveControl,
  onFinish,
}: LessonPatternSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  if (entries.length === 0) {
    return (
      <View testID="lesson-patterns-empty" style={styles.empty}>
        <AppText color="secondary">{t('lessonPlayer.patterns_empty')}</AppText>
      </View>
    );
  }
  const total = entries.length;
  const at = Math.min(index, total - 1);
  const entry = entries[at]!;
  const last = at >= total - 1;
  const goTo = (next: number) =>
    setIndex(Math.min(Math.max(next, 0), total - 1));

  const footer = (
    <StudyNavRow>
      <StudyNavButton
        disabled={at === 0}
        icon="chevron_left"
        label={t('lessonPlayer.study_prev_pattern')}
        onPress={() => goTo(at - 1)}
        testID="lesson-pattern-prev"
        tone="ghost"
      />
      {last ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.study_done_hint')}
          disabled={!onFinish}
          icon="check_circle"
          label={t('lessonPlayer.study_done')}
          onPress={() => onFinish?.()}
          testID="lesson-pattern-done"
          tone="coral"
        />
      ) : (
        <StudyNavButton
          icon="chevron_right"
          iconSide="right"
          label={t('lessonPlayer.study_next_pattern')}
          onPress={() => goTo(at + 1)}
          testID="lesson-pattern-next"
          tone="coral"
        />
      )}
    </StudyNavRow>
  );

  return (
    <StudyPage footer={footer} pageKey={at} testID="lesson-pattern-section">
      {total > 1 ? (
        <StudyProgress
          index={at}
          label={t('lessonPlayer.study_position', {index: at + 1, total})}
          onSelect={goTo}
          testID="lesson-pattern-progress"
          total={total}
        />
      ) : null}
      <PatternPage
        canNext={!last}
        canPrevious={at > 0}
        entry={entry}
        key={entry.key}
        onNext={() => goTo(at + 1)}
        onPrevious={() => goTo(at - 1)}
        onSpeakText={onSpeakText}
        saveControl={saveControl}
      />
    </StudyPage>
  );
}

function PatternPage({
  entry,
  onSpeakText,
  saveControl,
  canNext,
  canPrevious,
  onNext,
  onPrevious,
}: {
  entry: LessonPatternEntry;
  onSpeakText?: (text: string) => void;
  saveControl?: PatternSaveControl;
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [choiceIndexes, setChoiceIndexes] = useState<Record<string, number>>(
    {},
  );
  const [openSlot, setOpenSlot] = useState<string | null>(
    entry.slots[0]?.name ?? null,
  );

  const valueOf = (name: string): string => {
    const slot = entry.slots.find(candidate => candidate.name === name);
    if (!slot) return '';
    return slot.choices[(choiceIndexes[name] ?? 0) % slot.choices.length]!;
  };
  const sentence = entry.segments
    .map(segment =>
      segment.type === 'text' ? segment.value : valueOf(segment.name),
    )
    .join('');
  const open = entry.slots.find(slot => slot.name === openSlot) ?? null;
  const testID = `lesson-pattern-${entry.key}`;

  return (
    <>
      <SwipeCard
        canNext={canNext}
        canPrevious={canPrevious}
        onNext={onNext}
        onPrevious={onPrevious}
        testID="lesson-pattern-swipe"
      >
        <View style={styles.card} testID={testID}>
          <View style={styles.cardTop}>
            <View style={styles.flex}>
              <StudyLabel color={styles.kicker.color}>
                {t('lessonPlayer.pattern_kicker')}
              </StudyLabel>
            </View>
            {saveControl ? (
              <BookmarkToggle
                accessibilityHint={t('lessonPlayer.save_card_hint')}
                label={t('lessonPlayer.save_card')}
                onPress={() => saveControl.onToggle(entry)}
                saved={saveControl.isSaved(entry.key)}
                savedLabel={t('lessonPlayer.saved')}
                testID={`${testID}-save`}
              />
            ) : null}
          </View>

          <View style={styles.frame}>
            {entry.segments.map((segment, index) => {
              if (segment.type === 'text') {
                return (
                  <AppText key={`t${index}`} style={styles.frameText}>
                    {segment.value}
                  </AppText>
                );
              }
              const slot = entry.slots.find(
                candidate => candidate.name === segment.name,
              )!;
              const value = valueOf(segment.name);
              const on = openSlot === segment.name;
              return (
                <Pressable
                  key={`s${segment.name}`}
                  accessibilityHint={t('lessonPlayer.pattern_slot_hint')}
                  accessibilityLabel={t('lessonPlayer.pattern_slot_a11y', {
                    label: slot.labelVi,
                    value,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{selected: on}}
                  onPress={() => setOpenSlot(segment.name)}
                  style={[styles.slot, on ? styles.slotOn : null]}
                  testID={`${testID}-slot-${segment.name}`}
                >
                  <AppText style={styles.slotValue}>{value}</AppText>
                  <AppText style={styles.slotLabel}>{slot.labelVi}</AppText>
                </Pressable>
              );
            })}
          </View>

          {open ? (
            <View style={styles.choices} testID={`${testID}-choices`}>
              {open.choices.map((choice, index) => {
                const selected = valueOf(open.name) === choice;
                return (
                  <Pressable
                    key={choice}
                    accessibilityHint={t('lessonPlayer.pattern_choice_hint')}
                    accessibilityLabel={choice}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    onPress={() =>
                      setChoiceIndexes(previous => ({
                        ...previous,
                        [open.name]: index,
                      }))
                    }
                    style={[styles.choice, selected ? styles.choiceOn : null]}
                    testID={`${testID}-choice-${open.name}-${index}`}
                  >
                    <AppText
                      style={[
                        styles.choiceText,
                        selected ? styles.choiceTextOn : null,
                      ]}
                    >
                      {choice}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.built}>
            <View style={styles.flex}>
              <AppText style={styles.builtText} testID={`${testID}-sentence`}>
                {sentence}
              </AppText>
              <AppText style={styles.builtMeaning} testID={`${testID}-meaning`}>
                {entry.meaningVi}
              </AppText>
            </View>
            {onSpeakText ? (
              <SpeakSquare
                accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
                accessibilityLabel={t('lessonPlayer.pattern_speak', {
                  text: sentence,
                })}
                onPress={() => onSpeakText(sentence)}
                onTint
                testID={`${testID}-speak`}
              />
            ) : null}
          </View>
          {entry.noteVi ? (
            <AppText color="muted">{entry.noteVi}</AppText>
          ) : null}
        </View>
      </SwipeCard>

      {entry.errors.length > 0 ? (
        <Fold
          count={entry.errors.length}
          icon="flag"
          initiallyOpen
          testID={`${testID}-errors`}
          title={t('lessonPlayer.pattern_errors')}
          tone="coral"
        >
          {entry.errors.map(error => (
            <View
              key={error.code}
              style={styles.inset}
              testID={`${testID}-error-${error.code}`}
            >
              <View style={styles.errorTitle}>
                <AppText style={[styles.flex, styles.insetTitle]}>
                  {error.descriptionVi}
                </AppText>
                {error.tolerated ? (
                  <View style={styles.tolerated}>
                    <AppText style={styles.toleratedText}>
                      {t('lessonPlayer.pattern_error_tolerated')}
                    </AppText>
                  </View>
                ) : null}
              </View>
              {error.wrongExample ? (
                <AppText
                  style={styles.wrong}
                  testID={`${testID}-error-${error.code}-wrong`}
                >
                  {`✗ ${error.wrongExample}`}
                </AppText>
              ) : null}
              {error.rightExample ? (
                <AppText style={styles.right}>
                  {`✓ ${error.rightExample}`}
                </AppText>
              ) : null}
              <AppText color="secondary">{error.feedbackVi}</AppText>
            </View>
          ))}
        </Fold>
      ) : null}

      {entry.variants.length > 0 ? (
        <Fold
          count={entry.variants.length}
          icon="format_quote"
          testID={`${testID}-variants`}
          title={t('lessonPlayer.pattern_variants')}
          tone="accent"
        >
          {entry.variants.map(variant => (
            <View key={variant.text} style={styles.inset}>
              <AppText variant="bodyLg">{variant.text}</AppText>
              {variant.noteVi ? (
                <AppText color="secondary">{variant.noteVi}</AppText>
              ) : null}
            </View>
          ))}
        </Fold>
      ) : null}

      {entry.examples.length > 0 ? (
        <Fold
          count={entry.examples.length}
          icon="menu_book"
          testID={`${testID}-examples`}
          title={t('lessonPlayer.pattern_examples')}
          tone="sun"
        >
          {entry.examples.map((example, index) => (
            <View key={`${index}-${example.en}`} style={styles.exampleRow}>
              <View style={[styles.inset, styles.flex]}>
                <AppText variant="bodyLg">{example.en}</AppText>
                <AppText color="secondary">{example.vi}</AppText>
              </View>
              {onSpeakText ? (
                <SpeakSquare
                  accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
                  accessibilityLabel={t('lessonPlayer.pattern_speak', {
                    text: example.en,
                  })}
                  onPress={() => onSpeakText(example.en)}
                  testID={`${testID}-example-speak-${index}`}
                />
              ) : null}
            </View>
          ))}
        </Fold>
      ) : null}
    </>
  );
}

/** A row that opens to show its items, like the lesson page's rows. */
function Fold({
  title,
  count,
  icon,
  tone,
  initiallyOpen = false,
  testID,
  children,
}: {
  title: string;
  count: number;
  icon: HandoffIconName;
  tone: 'coral' | 'accent' | 'sun';
  initiallyOpen?: boolean;
  testID: string;
  children: React.ReactNode;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(initiallyOpen);
  const medal =
    tone === 'coral'
      ? {face: HERO_PALETTE.coralRing, ink: HERO_PALETTE.coralShelf}
      : tone === 'sun'
        ? {
            face: theme.colors.tertiarySoft,
            ink: theme.colors.onTertiaryContainer,
          }
        : {face: theme.colors.accentSoft, ink: theme.colors.primary};
  return (
    <View style={styles.fold} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{expanded: open}}
        onPress={() => setOpen(value => !value)}
        style={styles.foldHead}
        testID={`${testID}-toggle`}
      >
        <View style={[styles.medal, {backgroundColor: medal.face}]}>
          <MaterialIcon color={medal.ink} name={icon} size={17} />
        </View>
        <AppText style={styles.foldTitle}>{title}</AppText>
        <View style={styles.count}>
          <AppText style={styles.countText}>{count}</AppText>
        </View>
        <View style={styles.chevron}>
          <MaterialIcon
            color={theme.colors.text.muted}
            name={open ? 'chevron_left' : 'chevron_right'}
            size={18}
          />
        </View>
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    flex: {
      flex: 1,
    },
    card: {
      ...studyCardStyle(theme),
      borderRadius: 26,
      gap: 12,
      padding: 16,
    },
    cardTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    kicker: {
      color: theme.colors.onTertiaryContainer,
    },
    frame: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    frameText: {
      color: theme.colors.text.primary,
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 28,
    },
    slot: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderColor: HERO_PALETTE.sun,
      borderRadius: 12,
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    slotOn: {
      backgroundColor: HERO_PALETTE.sun,
      borderColor: HERO_PALETTE.sunShelf,
    },
    slotValue: {
      color: HERO_PALETTE.ink,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 24,
    },
    slotLabel: {
      color: theme.colors.onTertiaryContainer,
      fontSize: 10.5,
      fontWeight: '700',
    },
    choices: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    choice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 12,
    },
    choiceOn: {
      backgroundColor: theme.colors.text.primary,
    },
    choiceText: {
      color: theme.colors.text.secondary,
      fontSize: 13.5,
      fontWeight: '700',
    },
    choiceTextOn: {
      color: theme.colors.surface,
    },
    built: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    builtText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    builtMeaning: {
      color: theme.colors.primary,
      fontSize: 13,
      opacity: 0.85,
    },
    fold: {
      ...studyCardStyle(theme),
      borderRadius: 18,
      overflow: 'hidden',
    },
    foldHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 54,
      paddingHorizontal: 12,
    },
    medal: {
      alignItems: 'center',
      borderRadius: 11,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    foldTitle: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 14.5,
      fontWeight: '800',
    },
    count: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    countText: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '800',
    },
    chevron: {
      transform: [{rotate: '90deg'}],
    },
    foldBody: {
      gap: 8,
      paddingBottom: 12,
      paddingHorizontal: 12,
    },
    inset: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    insetTitle: {
      color: theme.colors.text.primary,
      fontWeight: '700',
    },
    errorTitle: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    tolerated: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    toleratedText: {
      color: theme.colors.primary,
      fontSize: 11.5,
      fontWeight: '700',
    },
    wrong: {
      color: theme.colors.danger,
      textDecorationLine: 'line-through',
    },
    right: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    exampleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
  });
}
