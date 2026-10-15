import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonListeningEntry} from '../logic/lessonHubContent';
import {
  studyCardStyle,
  StudyLabel,
  StudyNavButton,
  StudyNavRow,
  StudyPage,
  StudyProgress,
} from './StudyControls';
import {SwipeCard} from './SwipeCard';

/** Bar heights of the decorative wave under the play button. */
const WAVE = [8, 14, 22, 12, 26, 18, 30, 16, 10, 24, 20, 28, 12, 18, 8, 22];

export type LessonListeningSectionProps = {
  entries: LessonListeningEntry[];
  /** Speaks the listening text (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
  /** "Xong" after the last question; omitted = no button there. */
  onFinish?: () => void;
};

/**
 * "Nghe hiểu": one question at a time. Listen (TTS until item audio ships),
 * read the question, then reveal the answer and the transcript from the
 * bottom button, which then moves on. Not scored.
 */
export function LessonListeningSection({
  entries,
  onSpeakText,
  onFinish,
}: LessonListeningSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, true>>({});
  if (entries.length === 0) {
    return (
      <View testID="lesson-listening-empty" style={styles.empty}>
        <AppText color="secondary">{t('lessonPlayer.listening_empty')}</AppText>
      </View>
    );
  }
  const total = entries.length;
  const at = Math.min(index, total - 1);
  const entry = entries[at]!;
  const last = at >= total - 1;
  const shown = revealed[entry.key] === true;
  const testID = `lesson-listening-${entry.key}`;
  const goTo = (next: number) =>
    setIndex(Math.min(Math.max(next, 0), total - 1));

  const footer = (
    <StudyNavRow>
      <StudyNavButton
        disabled={at === 0}
        icon="chevron_left"
        label={t('lessonPlayer.study_prev_question')}
        onPress={() => goTo(at - 1)}
        testID="lesson-listening-prev"
        tone="ghost"
      />
      {!shown ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.listening_reveal_hint')}
          icon="visibility"
          label={t('lessonPlayer.listening_reveal')}
          onPress={() =>
            setRevealed(previous => ({...previous, [entry.key]: true}))
          }
          testID={`${testID}-reveal`}
          tone="coral"
        />
      ) : last ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.study_done_hint')}
          disabled={!onFinish}
          icon="check_circle"
          label={t('lessonPlayer.study_done')}
          onPress={() => onFinish?.()}
          testID="lesson-listening-done"
          tone="coral"
        />
      ) : (
        <StudyNavButton
          icon="chevron_right"
          iconSide="right"
          label={t('lessonPlayer.study_next_question')}
          onPress={() => goTo(at + 1)}
          testID="lesson-listening-next"
          tone="coral"
        />
      )}
    </StudyNavRow>
  );

  return (
    <StudyPage footer={footer} pageKey={at} testID="lesson-listening-section">
      {total > 1 ? (
        <StudyProgress
          index={at}
          label={t('lessonPlayer.study_position', {index: at + 1, total})}
          onSelect={goTo}
          testID="lesson-listening-progress"
          total={total}
        />
      ) : null}
      <SwipeCard
        canNext={!last}
        canPrevious={at > 0}
        onNext={() => goTo(at + 1)}
        onPrevious={() => goTo(at - 1)}
        style={styles.stack}
        testID="lesson-listening-swipe"
      >
        <View style={styles.listen} testID={testID}>
          <View pointerEvents="none" style={styles.blob} />
          {onSpeakText ? (
            <Pressable
              accessibilityHint={t('lessonPlayer.listening_play_hint')}
              accessibilityLabel={t('lessonPlayer.listening_play')}
              accessibilityRole="button"
              onPress={() => onSpeakText(entry.text)}
              style={({pressed}) => [
                styles.play,
                pressed ? styles.pressed : null,
              ]}
              testID={`${testID}-play`}
            >
              <MaterialIcon
                color={HERO_PALETTE.white}
                name="play_arrow"
                size={38}
              />
            </Pressable>
          ) : null}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.wave}
          >
            {WAVE.map((height, k) => (
              <View key={k} style={[styles.bar, {height}]} />
            ))}
          </View>
          <AppText style={styles.listenHint}>
            {t('lessonPlayer.listening_hint')}
          </AppText>
        </View>
        <View style={styles.question}>
          <StudyLabel>{t('lessonPlayer.listening_question')}</StudyLabel>
          <AppText style={styles.questionText}>{entry.questionEn}</AppText>
          {entry.questionVi ? (
            <AppText color="muted">{entry.questionVi}</AppText>
          ) : null}
        </View>
      </SwipeCard>
      {shown ? (
        <View style={styles.answer} testID={`${testID}-answer`}>
          <StudyLabel color={theme.colors.primary}>
            {t('lessonPlayer.listening_answer')}
          </StudyLabel>
          <AppText style={styles.answerText}>{entry.answer}</AppText>
          <StudyLabel color={theme.colors.primary}>
            {t('lessonPlayer.listening_transcript')}
          </StudyLabel>
          <AppText variant="bodyLg">{entry.text}</AppText>
          <AppText color="secondary">{entry.meaningVi}</AppText>
        </View>
      ) : null}
    </StudyPage>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    stack: {
      gap: theme.spacing.md,
    },
    listen: {
      alignItems: 'center',
      backgroundColor: solidOver(
        theme.colors.secondarySoft,
        theme.colors.surface,
      ),
      borderRadius: 26,
      gap: 12,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingVertical: 22,
      ...getStickerEdge(5, HERO_PALETTE.coralRing),
    },
    blob: {
      backgroundColor: HERO_PALETTE.coralRing,
      borderRadius: 90,
      bottom: -70,
      height: 180,
      left: -50,
      position: 'absolute',
      width: 180,
    },
    play: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderColor: HERO_PALETTE.coralRing,
      borderRadius: 42,
      borderWidth: 6,
      height: 84,
      justifyContent: 'center',
      width: 84,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    wave: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 3,
      height: 30,
    },
    bar: {
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: 2,
      opacity: 0.55,
      width: 4,
    },
    listenHint: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    question: {
      ...studyCardStyle(theme),
      gap: 4,
      padding: 16,
    },
    questionText: {
      color: theme.colors.text.primary,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 26,
    },
    answer: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 22,
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    answerText: {
      color: theme.colors.primary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
  });
}
