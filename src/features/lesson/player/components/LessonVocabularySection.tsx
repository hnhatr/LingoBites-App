import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {cardColors} from '@ui/components/ToneCard';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LessonSentence} from '@core/schemas/lesson';

import type {
  LessonItemRole,
  LessonVocabularyEntry,
} from '../logic/lessonHubContent';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {
  BookmarkToggle,
  PillTabs,
  SpeakSquare,
  studyCardStyle,
  StudyLabel,
  StudyNavButton,
  StudyNavRow,
  StudyPage,
  StudyProgress,
} from './StudyControls';
import {SwipeCard} from './SwipeCard';

const CARD_HEIGHT = 340;
/** How far each card behind the top one peeks out. */
const PEEK = 10;

export type LessonVocabularySectionProps = {
  entries: LessonVocabularyEntry[];
  /** The lesson's sentences, to show each word in context on the back. */
  sentences?: LessonSentence[];
  /** Speaks a word (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Lưu thẻ" per word; omitted = no save buttons. */
  saveControl?: VocabularySaveControl;
  /** "Xong" after the last word; omitted = no button there. */
  onFinish?: () => void;
};

/**
 * "Từ & cụm": the lesson's words as flashcards, one at a time. The front
 * shows the word and its IPA, a tap flips it to the meaning, and a swipe
 * moves to the next or previous word. Catalog lessons split the words into
 * "Cần nhớ" and "Mở rộng" tabs.
 */
export function LessonVocabularySection({
  entries,
  sentences = [],
  onSpeakText,
  saveControl,
  onFinish,
}: LessonVocabularySectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const groups = useMemo(
    () =>
      (['required', 'extended'] as const)
        .map(role => ({
          role,
          entries: entries.filter(entry => (entry.role ?? 'required') === role),
        }))
        .filter(group => group.entries.length > 0),
    [entries],
  );
  const grouped = entries.some(entry => entry.role !== null);
  const [role, setRole] = useState<LessonItemRole>('required');
  const [index, setIndex] = useState(0);

  if (entries.length === 0) {
    return (
      <View testID="lesson-vocabulary-empty" style={styles.empty}>
        <AppText color="secondary">
          {t('lessonPlayer.vocabulary_empty')}
        </AppText>
      </View>
    );
  }

  const group =
    grouped && groups.length > 1
      ? (groups.find(candidate => candidate.role === role) ?? groups[0]!)
      : null;
  const list = group ? group.entries : entries;
  const total = list.length;
  const at = Math.min(index, total - 1);
  const entry = list[at]!;
  const last = at >= total - 1;
  const goTo = (next: number) =>
    setIndex(Math.min(Math.max(next, 0), total - 1));

  const footer = (
    <StudyNavRow>
      <StudyNavButton
        disabled={at === 0}
        icon="chevron_left"
        label={t('lessonPlayer.study_prev_word')}
        onPress={() => goTo(at - 1)}
        testID="lesson-vocabulary-prev"
        tone="ghost"
      />
      {last ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.study_done_hint')}
          disabled={!onFinish}
          icon="check_circle"
          label={t('lessonPlayer.study_done')}
          onPress={() => onFinish?.()}
          testID="lesson-vocabulary-done"
          tone="coral"
        />
      ) : (
        <StudyNavButton
          icon="chevron_right"
          iconSide="right"
          label={t('lessonPlayer.study_next_word')}
          onPress={() => goTo(at + 1)}
          testID="lesson-vocabulary-next"
          tone="coral"
        />
      )}
    </StudyNavRow>
  );

  const behind = Math.min(total - 1 - at, 2);

  return (
    <StudyPage
      footer={footer}
      pageKey={`${group?.role ?? 'all'}-${at}`}
      testID="lesson-vocabulary-section"
    >
      {group ? (
        <PillTabs
          onChange={next => {
            setRole(next);
            setIndex(0);
          }}
          tabs={groups.map(candidate => ({
            id: candidate.role,
            label: t(`lessonPlayer.vocabulary_group_${candidate.role}`),
            count: candidate.entries.length,
          }))}
          testID="lesson-vocabulary-group"
          value={group.role}
        />
      ) : null}
      <StudyProgress
        index={at}
        label={t('lessonPlayer.study_position', {index: at + 1, total})}
        onSelect={goTo}
        testID="lesson-vocabulary-progress"
        total={total}
      />
      <View style={[styles.deck, {height: CARD_HEIGHT + behind * PEEK}]}>
        {Array.from({length: behind}, (_, k) => behind - k).map(depth => (
          <View
            key={depth}
            style={[
              styles.behind,
              {
                opacity: 1 - depth * 0.25,
                transform: [
                  {translateY: depth * PEEK},
                  {scale: 1 - depth * 0.05},
                ],
              },
            ]}
          />
        ))}
        <SwipeCard
          canNext={!last}
          canPrevious={at > 0}
          onNext={() => goTo(at + 1)}
          onPrevious={() => goTo(at - 1)}
          style={styles.top}
          testID="lesson-vocabulary-swipe"
        >
          <Flashcard
            entry={entry}
            key={entry.key}
            onSpeakText={onSpeakText}
            saveControl={saveControl}
            sentence={sentenceWith(sentences, entry.word)}
          />
        </SwipeCard>
      </View>
      <AppText color="muted" style={styles.hint}>
        {t('lessonPlayer.flashcard_swipe_hint')}
      </AppText>
    </StudyPage>
  );
}

/** The first lesson sentence that uses the word (as a whole word), if any. */
function sentenceWith(
  sentences: LessonSentence[],
  word: string,
): string | null {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return null;
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  return (
    [...sentences]
      .sort((a, b) => a.position - b.position)
      .find(sentence => pattern.test(sentence.text_en))?.text_en ?? null
  );
}

function Flashcard({
  entry,
  sentence,
  onSpeakText,
  saveControl,
}: {
  entry: LessonVocabularyEntry;
  sentence: string | null;
  onSpeakText?: (text: string) => void;
  saveControl?: VocabularySaveControl;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const back = cardColors(theme, 'accent');
  const testID = `lesson-vocabulary-${entry.key}`;

  useEffect(() => {
    if (reduceMotion) {
      turn.setValue(flipped ? 1 : 0);
      return;
    }
    Animated.timing(turn, {
      toValue: flipped ? 1 : 0,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [flipped, reduceMotion, turn]);

  const face = (from: string, to: string, visibleFirst: boolean) => ({
    opacity: turn.interpolate({
      inputRange: [0, 0.5, 0.501, 1],
      outputRange: visibleFirst ? [1, 1, 0, 0] : [0, 0, 1, 1],
    }),
    transform: [
      {perspective: 1200},
      {
        rotateY: turn.interpolate({
          inputRange: [0, 1],
          outputRange: [from, to],
        }),
      },
    ],
  });

  const actions = (side: 'front' | 'back') => {
    const suffix = side === 'back' ? '-back' : '';
    return (
      <View style={styles.actions}>
        {onSpeakText ? (
          <SpeakSquare
            accessibilityHint={t('lessonPlayer.speak_word_hint')}
            accessibilityLabel={t('lessonPlayer.speak_word', {
              word: entry.word,
            })}
            onPress={() => onSpeakText(entry.word)}
            onTint={side === 'back'}
            testID={`lesson-vocabulary-speak-${entry.key}${suffix}`}
          />
        ) : null}
        {saveControl ? (
          <BookmarkToggle
            accessibilityHint={t('lessonPlayer.save_card_hint')}
            label={t('lessonPlayer.save_card')}
            onPress={() => saveControl.onToggle({...entry, id: entry.key})}
            onTint={side === 'back'}
            saved={saveControl.isSaved(entry.key)}
            savedLabel={t('lessonPlayer.saved')}
            testID={`lesson-vocabulary-save-${entry.key}${suffix}`}
          />
        ) : null}
      </View>
    );
  };

  const tags = [
    entry.pos,
    entry.introduction
      ? t(`lessonPlayer.item_intro_${entry.introduction}`)
      : null,
  ].filter((tag): tag is string => Boolean(tag));

  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        accessibilityHint={t('lessonPlayer.flashcard_flip_a11y')}
        accessibilityLabel={
          flipped
            ? t('lessonPlayer.flashcard_a11y_back', {
                word: entry.word,
                meaning: entry.meaning,
              })
            : t('lessonPlayer.flashcard_a11y_front', {
                word: entry.word,
                ipa: entry.ipa ? formatIpa(entry.ipa) : '',
              })
        }
        accessibilityRole="button"
        onPress={() => setFlipped(value => !value)}
        style={StyleSheet.absoluteFill}
        testID={`${testID}-flip`}
      />
      <Animated.View
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
        pointerEvents={flipped ? 'none' : 'box-none'}
        style={[styles.face, styles.front, face('0deg', '180deg', true)]}
        testID={`${testID}-front`}
      >
        <View pointerEvents="box-none" style={styles.bar}>
          <StudyLabel>{t('lessonPlayer.flashcard_front')}</StudyLabel>
          {actions('front')}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.frontBody}
        >
          <AppText style={styles.word}>{entry.word}</AppText>
          {entry.ipa ? (
            <AppText color="muted" style={styles.ipa}>
              {formatIpa(entry.ipa)}
            </AppText>
          ) : null}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.tapHint}
        >
          <MaterialIcon
            color={theme.colors.text.muted}
            name="chevron_right"
            size={16}
          />
          <AppText color="muted" style={styles.tapText}>
            {t('lessonPlayer.flashcard_flip_hint')}
          </AppText>
        </View>
      </Animated.View>
      <Animated.View
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
        pointerEvents={flipped ? 'box-none' : 'none'}
        style={[
          styles.face,
          {backgroundColor: back.face, ...getStickerEdge(6, back.shelf)},
          face('180deg', '360deg', false),
        ]}
        testID={`${testID}-back`}
      >
        <View pointerEvents="box-none" style={styles.bar}>
          <StudyLabel color={back.ink}>
            {t('lessonPlayer.flashcard_back')}
          </StudyLabel>
          {actions('back')}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.backBody}
        >
          <View style={styles.backWordLine}>
            <AppText style={[styles.backWord, {color: back.ink}]}>
              {entry.word}
            </AppText>
            {entry.ipa ? (
              <AppText color="muted" variant="caption">
                {formatIpa(entry.ipa)}
              </AppText>
            ) : null}
          </View>
          <AppText style={styles.meaning} testID={`${testID}-meaning`}>
            {entry.meaning}
          </AppText>
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <AppText style={[styles.tagText, {color: back.ink}]}>
                    {tag}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {sentence ? (
          <View pointerEvents="none" style={styles.example}>
            <StudyLabel color={back.ink}>
              {t('lessonPlayer.flashcard_in_lesson')}
            </StudyLabel>
            <AppText style={styles.exampleText}>{sentence}</AppText>
          </View>
        ) : null}
      </Animated.View>
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
    deck: {
      position: 'relative',
    },
    behind: {
      ...studyCardStyle(theme),
      borderRadius: 28,
      height: CARD_HEIGHT,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transformOrigin: 'bottom',
    },
    top: {
      height: CARD_HEIGHT,
    },
    card: {
      flex: 1,
    },
    face: {
      ...studyCardStyle(theme),
      backfaceVisibility: 'hidden',
      borderRadius: 28,
      bottom: 0,
      left: 0,
      padding: 16,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    front: {
      alignItems: 'center',
    },
    bar: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
    },
    frontBody: {
      alignItems: 'center',
      flex: 1,
      gap: 8,
      justifyContent: 'center',
    },
    word: {
      color: theme.colors.text.primary,
      fontSize: 36,
      fontWeight: '800',
      lineHeight: 42,
      textAlign: 'center',
    },
    ipa: {
      fontSize: 17,
    },
    tapHint: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    tapText: {
      fontSize: 12.5,
      fontWeight: '700',
    },
    backBody: {
      flex: 1,
      gap: 10,
      paddingTop: 14,
    },
    backWordLine: {
      alignItems: 'baseline',
      columnGap: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    backWord: {
      fontSize: 19,
      fontWeight: '800',
    },
    meaning: {
      color: theme.colors.text.primary,
      fontSize: 27,
      fontWeight: '800',
      lineHeight: 33,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '700',
    },
    example: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    exampleText: {
      color: theme.colors.text.primary,
      fontSize: 14.5,
      lineHeight: 20,
    },
    hint: {
      fontSize: 12.5,
      textAlign: 'center',
    },
  });
}
