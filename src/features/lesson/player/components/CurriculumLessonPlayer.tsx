import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useAppTheme, type AppTheme} from '@ui/theme';
import {blockBaseStyles} from '../logic/blockStyles';
import {CurriculumLessonBlockSlot} from './CurriculumLessonBlockView';
import type {CurriculumLessonSoundFactory} from '../logic/curriculumLessonAudio';
import type {CurriculumLessonCheckFn} from './ExerciseBlockView';
import type {CurriculumLesson} from '../logic/curriculumLessonSchema';
import {
  completeLessonProgress,
  markVocabularySeen,
} from '../logic/api/learningProgressClient';

function fireAndForget(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

export type CurriculumLessonPlayerProps = {
  /** Parsed lesson snapshot. Treated as immutable; never written to. */
  lesson: CurriculumLesson;
  /** Server-side exercise check supplied by the host screen (TASK-008). */
  onCheckExercise: CurriculumLessonCheckFn;
  /** Injectable audio factory forwarded to media blocks (fakes in tests). */
  createSound?: CurriculumLessonSoundFactory;
  /** Safe exit from the lesson (empty state and Complete UI). */
  onExit?: () => void;
  /** Retry entry, shown on the empty-lesson placeholder. */
  onRetry?: () => void;
};

function extraStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      gap: theme.spacing.md,
    },
    header: {
      gap: theme.spacing.xs,
    },
    navRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    navButton: {
      flex: 1,
    },
    progress: {
      color: theme.colors.text.muted,
      fontSize: theme.typography.size.sm,
    },
  });
}

/**
 * Step-based lesson player: one block at a time, Previous/Next navigation in
 * ascending `position` order, Complete UI after advancing past the last
 * block. Minimal state — `lesson` snapshot, `currentBlockIndex`, per-exercise
 * local UI state (inside `ExerciseBlockView`), and the `complete` flag.
 * Nothing is persisted (BR-003); dispatch is solely on `block.type`.
 */
export function CurriculumLessonPlayer({
  lesson,
  onCheckExercise,
  createSound,
  onExit,
  onRetry,
}: CurriculumLessonPlayerProps) {
  const {theme} = useAppTheme();
  const styles = blockBaseStyles(theme);
  const extra = extraStyles(theme);

  const orderedBlocks = useMemo(
    () =>
      [...lesson.blocks].sort(
        (a, b) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) -
          (b.position ?? Number.MAX_SAFE_INTEGER),
      ),
    [lesson],
  );

  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const seenVocabRef = useRef<Set<string>>(new Set());
  const completedRef = useRef(false);

  useEffect(() => {
    const currentBlock = orderedBlocks[currentBlockIndex];
    if (currentBlock && currentBlock.type === 'vocabulary') {
      currentBlock.items.forEach(item => {
        if (!seenVocabRef.current.has(item.id)) {
          seenVocabRef.current.add(item.id);
          fireAndForget(markVocabularySeen(item.id));
        }
      });
    }
  }, [currentBlockIndex, orderedBlocks]);

  useEffect(() => {
    if (complete && !completedRef.current) {
      completedRef.current = true;
      fireAndForget(completeLessonProgress(lesson.id));
    }
  }, [complete, lesson.id]);

  if (orderedBlocks.length === 0) {
    return (
      <View
        testID="player-empty"
        accessibilityRole="text"
        accessibilityLabel="This lesson has no content yet"
        accessibilityHint="Empty lesson message with retry and exit actions"
      >
        <View style={styles.fallbackBox}>
          <Text testID="player-empty-message" style={styles.fallbackText}>
            This lesson has no content yet. Please try again later or go back.
          </Text>
          <View style={extra.navRow}>
            {onRetry ? (
              <Pressable
                testID="player-retry"
                accessibilityRole="button"
                accessibilityLabel="Retry loading lesson"
                accessibilityHint="Tries loading the lesson again"
                onPress={onRetry}
                style={[styles.secondaryButton, extra.navButton]}
              >
                <Text style={styles.secondaryButtonText}>Retry</Text>
              </Pressable>
            ) : null}
            {onExit ? (
              <Pressable
                testID="player-exit"
                accessibilityRole="button"
                accessibilityLabel="Exit lesson"
                accessibilityHint="Leaves the lesson"
                onPress={onExit}
                style={[styles.secondaryButton, extra.navButton]}
              >
                <Text style={styles.secondaryButtonText}>Exit</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  if (complete) {
    return (
      <View
        testID="player-complete"
        accessibilityRole="text"
        accessibilityLabel="Lesson complete"
        accessibilityHint="Lesson completion message with review and finish actions"
      >
        <Text testID="player-complete-message" style={styles.title}>
          Lesson complete!
        </Text>
        <Text style={styles.secondary}>
          You have reached the end of “{lesson.title}”.
        </Text>
        <View style={extra.navRow}>
          <Pressable
            testID="player-complete-back"
            accessibilityRole="button"
            accessibilityLabel="Review last part"
            accessibilityHint="Goes back to the last part of the lesson"
            onPress={() => setComplete(false)}
            style={[styles.secondaryButton, extra.navButton]}
          >
            <Text style={styles.secondaryButtonText}>Review</Text>
          </Pressable>
          {onExit ? (
            <Pressable
              testID="player-complete-exit"
              accessibilityRole="button"
              accessibilityLabel="Finish lesson"
              accessibilityHint="Leaves the lesson"
              onPress={onExit}
              style={[styles.button, extra.navButton]}
            >
              <Text style={styles.buttonText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const currentBlock = orderedBlocks[currentBlockIndex];
  const isFirst = currentBlockIndex === 0;
  const isLast = currentBlockIndex === orderedBlocks.length - 1;

  return (
    <View testID="lesson-player" style={extra.root}>
      <View style={extra.header}>
        <Text testID="player-title" style={styles.title}>
          {lesson.title}
        </Text>
        <Text testID="player-progress" style={extra.progress}>
          Part {currentBlockIndex + 1} of {orderedBlocks.length}
        </Text>
      </View>
      <CurriculumLessonBlockSlot
        key={
          currentBlock.type === 'unsupported'
            ? `unsupported-${currentBlockIndex}`
            : currentBlock.id
        }
        block={currentBlock}
        onCheckExercise={onCheckExercise}
        createSound={createSound}
      />
      <View style={extra.navRow}>
        <Pressable
          testID="player-prev"
          accessibilityRole="button"
          accessibilityLabel="Previous part"
          accessibilityHint="Goes to the previous part of the lesson"
          accessibilityState={{disabled: isFirst}}
          disabled={isFirst}
          onPress={() => setCurrentBlockIndex(index => Math.max(0, index - 1))}
          style={[
            styles.secondaryButton,
            extra.navButton,
            isFirst ? styles.buttonDisabled : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Previous</Text>
        </Pressable>
        <Pressable
          testID="player-next"
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Finish lesson' : 'Next part'}
          accessibilityHint={
            isLast
              ? 'Shows the lesson completion screen'
              : 'Goes to the next part of the lesson'
          }
          onPress={() => {
            if (isLast) {
              setComplete(true);
            } else {
              setCurrentBlockIndex(index =>
                Math.min(orderedBlocks.length - 1, index + 1),
              );
            }
          }}
          style={[styles.button, extra.navButton]}
        >
          <Text style={styles.buttonText}>{isLast ? 'Finish' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
