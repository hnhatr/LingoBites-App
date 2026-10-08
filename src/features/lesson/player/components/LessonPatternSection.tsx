import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonPatternEntry} from '../logic/lessonHubContent';
import type {PatternSaveControl} from '../logic/useLessonSavedItems';
import {SaveItemButton} from './SaveItemButton';

export type LessonPatternSectionProps = {
  entries: LessonPatternEntry[];
  /** Speaks a sentence (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per pattern; omitted = no save buttons. */
  saveControl?: PatternSaveControl;
};

/**
 * "Mẫu câu": one card per sentence pattern of a curriculum lesson. The frame
 * shows its slots as chips; tapping a chip moves to the slot's next value and
 * pressing and holding it lists every value. The chosen values live in the
 * card only and are never stored.
 */
export function LessonPatternSection({
  entries,
  onSpeakText,
  saveControl,
}: LessonPatternSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (entries.length === 0) {
    return (
      <View testID="lesson-patterns-empty" style={themedStyles.empty}>
        <AppText color="secondary">{t('lessonPlayer.patterns_empty')}</AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-pattern-section" style={styles.list}>
      {entries.map(entry => (
        <PatternCard
          key={entry.key}
          entry={entry}
          onSpeakText={onSpeakText}
          saveControl={saveControl}
        />
      ))}
    </View>
  );
}

function PatternCard({
  entry,
  onSpeakText,
  saveControl,
}: {
  entry: LessonPatternEntry;
  onSpeakText?: (text: string) => void;
  saveControl?: PatternSaveControl;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [choiceIndexes, setChoiceIndexes] = useState<Record<string, number>>(
    {},
  );
  const [openSlot, setOpenSlot] = useState<string | null>(null);

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
  const cycle = (name: string, count: number) =>
    setChoiceIndexes(previous => ({
      ...previous,
      [name]: ((previous[name] ?? 0) + 1) % count,
    }));
  const choose = (name: string, index: number) => {
    setChoiceIndexes(previous => ({...previous, [name]: index}));
    setOpenSlot(null);
  };
  const open = entry.slots.find(slot => slot.name === openSlot) ?? null;
  const testID = `lesson-pattern-${entry.key}`;

  return (
    <AppCard testID={testID}>
      <View style={styles.card}>
        <View style={styles.chips}>
          <Chip label={t('lessonPlayer.pattern_chip')} tone="gold" />
          <Chip
            label={t(`lessonPlayer.item_role_${entry.role}`)}
            tone={entry.role === 'required' ? 'accentSoft' : 'neutral'}
          />
          <Chip
            label={t(`lessonPlayer.item_intro_${entry.introduction}`)}
            tone="neutral"
          />
        </View>

        <View style={styles.frame}>
          {entry.segments.map((segment, index) => {
            if (segment.type === 'text') {
              return (
                <AppText key={`t${index}`} variant="h3">
                  {segment.value}
                </AppText>
              );
            }
            const slot = entry.slots.find(
              candidate => candidate.name === segment.name,
            )!;
            const value = valueOf(segment.name);
            return (
              <Pressable
                key={`s${segment.name}`}
                accessibilityHint={t('lessonPlayer.pattern_slot_hint')}
                accessibilityLabel={t('lessonPlayer.pattern_slot_a11y', {
                  label: slot.labelVi,
                  value,
                })}
                accessibilityRole="button"
                onLongPress={() => setOpenSlot(segment.name)}
                onPress={() => cycle(segment.name, slot.choices.length)}
                style={themedStyles.slot}
                testID={`${testID}-slot-${segment.name}`}
              >
                <AppText style={themedStyles.slotValue} variant="h3">
                  {value}
                </AppText>
                <AppText color="muted" variant="caption">
                  {slot.labelVi}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {open ? (
          <View style={styles.chips} testID={`${testID}-choices`}>
            {open.choices.map((choice, index) => (
              <Chip
                key={choice}
                accessibilityHint={t('lessonPlayer.pattern_choice_hint')}
                label={choice}
                onPress={() => choose(open.name, index)}
                selected={valueOf(open.name) === choice}
                testID={`${testID}-choice-${open.name}-${index}`}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.sentenceRow}>
          <AppText
            color="secondary"
            style={styles.flex}
            testID={`${testID}-meaning`}
          >
            {entry.meaningVi}
          </AppText>
          {onSpeakText ? (
            <IconButton
              accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
              accessibilityLabel={t('lessonPlayer.pattern_speak', {
                text: sentence,
              })}
              icon="volume_up"
              onPress={() => onSpeakText(sentence)}
              testID={`${testID}-speak`}
              tone="accent"
            />
          ) : null}
        </View>
        {entry.noteVi ? <AppText color="muted">{entry.noteVi}</AppText> : null}

        {entry.variants.length > 0 ? (
          <View style={styles.block}>
            <AppText color="muted" style={styles.label} variant="label">
              {t('lessonPlayer.pattern_variants')}
            </AppText>
            {entry.variants.map(variant => (
              <View key={variant.text} style={styles.example}>
                <AppText variant="bodyLg">{variant.text}</AppText>
                {variant.noteVi ? (
                  <AppText color="secondary">{variant.noteVi}</AppText>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {entry.errors.length > 0 ? (
          <View style={styles.block}>
            <AppText color="muted" style={styles.label} variant="label">
              {t('lessonPlayer.pattern_errors')}
            </AppText>
            {entry.errors.map(error => (
              <View
                key={error.code}
                style={themedStyles.error}
                testID={`${testID}-error-${error.code}`}
              >
                <View style={styles.errorTitle}>
                  <AppText style={styles.flex} variant="bodyLg">
                    {error.descriptionVi}
                  </AppText>
                  {error.tolerated ? (
                    <Chip
                      label={t('lessonPlayer.pattern_error_tolerated')}
                      tone="accentSoft"
                    />
                  ) : null}
                </View>
                {error.wrongExample ? (
                  <AppText
                    color="muted"
                    style={styles.wrong}
                    testID={`${testID}-error-${error.code}-wrong`}
                  >
                    {error.wrongExample}
                  </AppText>
                ) : null}
                {error.rightExample ? (
                  <AppText style={themedStyles.right}>
                    {`→ ${error.rightExample}`}
                  </AppText>
                ) : null}
                <AppText color="secondary">{error.feedbackVi}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {entry.examples.length > 0 ? (
          <View style={styles.block}>
            <AppText color="muted" style={styles.label} variant="label">
              {t('lessonPlayer.pattern_examples')}
            </AppText>
            {entry.examples.map((example, index) => (
              <View key={`${index}-${example.en}`} style={styles.sentenceRow}>
                <View style={[styles.example, styles.flex]}>
                  <AppText variant="bodyLg">{example.en}</AppText>
                  <AppText color="secondary">{example.vi}</AppText>
                </View>
                {onSpeakText ? (
                  <IconButton
                    accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
                    accessibilityLabel={t('lessonPlayer.pattern_speak', {
                      text: example.en,
                    })}
                    icon="volume_up"
                    onPress={() => onSpeakText(example.en)}
                    testID={`${testID}-example-speak-${index}`}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {saveControl ? (
          <SaveItemButton
            accessibilityHint={t('lessonPlayer.save_card_hint')}
            label={t('lessonPlayer.save_card')}
            onPress={() => saveControl.onToggle(entry)}
            saved={saveControl.isSaved(entry.key)}
            savedLabel={t('lessonPlayer.saved')}
            testID={`${testID}-save`}
          />
        ) : null}
      </View>
    </AppCard>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    error: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    right: {
      color: theme.colors.primary,
      fontWeight: theme.typography.weight.medium,
    },
    slot: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm,
    },
    slotValue: {
      color: theme.colors.primary,
    },
  });
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  card: {
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  errorTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  example: {
    gap: 2,
  },
  flex: {
    flex: 1,
  },
  frame: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
  sentenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  wrong: {
    textDecorationLine: 'line-through',
  },
});
