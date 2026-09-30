/**
 * Unified generation progress screen: job-only UI for AI lesson creation.
 *
 * Polls `GET /api/v1/lesson-jobs/:id` via `useLessonGenerationJob` and
 * renders progress only — never lesson content. On a materialized
 * `lessonId` it replaces itself with the canonical
 * `CurriculumLesson({lessonId})` route. A failed job offers retry,
 * which creates a fresh job (new idempotency key) and swaps the route
 * to the new job ID; the failed job row stays untouched for the server
 * to expire per BR-003.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';

import {trackEvent} from '@features/analytics';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  createLessonGenerationJob,
  type LessonGenerationJob,
  type LessonGenerationPartTarget,
  listRetryableJobParts,
  type RetryableLessonGenerationPart,
} from '../logic/lessonJobClient';
import {
  type LessonGenerationState,
  useLessonGenerationJob,
} from '../logic/useLessonGenerationJob';
import type {UnifiedLessonGenerationRouteParams} from './navigationTypes';

export interface UnifiedLessonGenerationScreenProps {
  navigation: {
    replace: ((
      screen: 'CurriculumLesson',
      params: {lessonId: string},
    ) => void) &
      ((
        screen: 'UnifiedLessonGeneration',
        params: UnifiedLessonGenerationRouteParams,
      ) => void);
    goBack: () => void;
  };
  route: {
    params: UnifiedLessonGenerationRouteParams;
  };
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    center: {
      alignItems: 'center',
      flex: 1,
      gap: theme.spacing.md,
      justifyContent: 'center',
      padding: theme.gutter,
    },
    title: {
      textAlign: 'center',
    },
    message: {
      textAlign: 'center',
    },
    retry: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
    },
    retryText: {
      color: theme.colors.text.inverse,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.medium,
    },
    partRow: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    back: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.lg,
    },
  });
}

export type UnifiedLessonGenerationViewProps = {
  generation: LessonGenerationState;
  canRetry: boolean;
  retrying: boolean;
  notice: string | null;
  onRetry: () => void;
  onBack: () => void;
  parts: RetryableLessonGenerationPart[];
  retryingPart: LessonGenerationPartTarget | null;
  onRetryPart: (target: LessonGenerationPartTarget) => void;
};

const UNIT_PART_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  ipa_resolve: 'Pronunciation',
  practice: 'Practice',
};

export function partLabel(part: RetryableLessonGenerationPart): string {
  if (part.kind === 'unit') {
    return UNIT_PART_LABELS[part.unit.key] ?? part.unit.key;
  }
  return `Section ${part.chunk.id}`;
}

export function partTargetOf(
  part: RetryableLessonGenerationPart,
): LessonGenerationPartTarget {
  return part.kind === 'chunk'
    ? {kind: 'chunk', id: part.chunk.id}
    : {kind: 'unit', key: part.unit.key};
}

function targetKey(target: LessonGenerationPartTarget): string {
  return target.kind === 'chunk' ? `chunk:${target.id}` : `unit:${target.key}`;
}

function isRetryingTarget(
  part: RetryableLessonGenerationPart,
  retryingPart: LessonGenerationPartTarget | null,
): boolean {
  if (!retryingPart) return false;
  return targetKey(partTargetOf(part)) === targetKey(retryingPart);
}

function countReadyParts(job: LessonGenerationJob): {
  ready: number;
  total: number;
} {
  const chunks = job.chunks ?? [];
  const units = job.units ?? [];
  const ready =
    chunks.filter(chunk => chunk.status === 'ready').length +
    units.filter(unit => unit.status === 'ready').length;
  return {ready, total: chunks.length + units.length};
}

function PartsProgress({job}: {job: LessonGenerationJob}) {
  const {ready, total} = countReadyParts(job);
  if (total === 0) return null;
  return (
    <AppText
      variant="caption"
      color="secondary"
      testID="unified-generation-parts-progress"
    >
      {`${ready} of ${total} parts ready.`}
    </AppText>
  );
}

function FailedPartsSection({
  styles,
  parts,
  retryingPart,
  onRetryPart,
}: {
  styles: ReturnType<typeof createStyles>;
  parts: RetryableLessonGenerationPart[];
  retryingPart: LessonGenerationPartTarget | null;
  onRetryPart: (target: LessonGenerationPartTarget) => void;
}) {
  if (parts.length === 0) return null;
  return (
    <View testID="unified-generation-failed-parts">
      {parts.map(part => {
        const target = partTargetOf(part);
        const label = partLabel(part);
        const busy = isRetryingTarget(part, retryingPart);
        const testID =
          part.kind === 'chunk'
            ? `unified-generation-retry-chunk-${part.chunk.id}`
            : `unified-generation-retry-unit-${part.unit.key}`;
        return (
          <View key={testID} style={styles.partRow}>
            <AppText
              variant="label"
              color="secondary"
              testID={`${testID}-label`}
            >
              {`${label} needs retry.`}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry ${label}`}
              accessibilityState={{disabled: busy || retryingPart !== null}}
              disabled={busy || retryingPart !== null}
              onPress={() => onRetryPart(target)}
              testID={testID}
              style={styles.retry}
            >
              <AppText style={styles.retryText}>
                {busy ? 'Retrying…' : `Retry ${label}`}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function UnifiedLessonGenerationView({
  generation,
  canRetry,
  retrying,
  notice,
  onRetry,
  onBack,
  parts,
  retryingPart,
  onRetryPart,
}: UnifiedLessonGenerationViewProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (generation.status === 'succeeded') {
    return (
      <View style={styles.center} testID="unified-generation-opening">
        <ActivityIndicator color={theme.colors.primary} />
        <AppText variant="label" color="secondary">
          Opening your lesson…
        </AppText>
      </View>
    );
  }

  if (generation.status === 'failed') {
    return (
      <View style={styles.center} testID="unified-generation-failed">
        <AppText variant="h3" style={styles.title}>
          Lesson generation failed.
        </AppText>
        <AppText
          variant="label"
          color="secondary"
          style={styles.message}
          testID="unified-generation-error"
        >
          {generation.error.message}
        </AppText>
        {generation.job?.warnings?.length ? (
          <AppText
            variant="caption"
            color="secondary"
            testID="unified-generation-warnings"
          >
            {`${generation.job.warnings.length} warning(s) reported.`}
          </AppText>
        ) : null}
        {generation.job ? <PartsProgress job={generation.job} /> : null}
        <FailedPartsSection
          styles={styles}
          parts={parts}
          retryingPart={retryingPart}
          onRetryPart={onRetryPart}
        />
        {canRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry lesson generation"
            accessibilityState={{disabled: retrying}}
            disabled={retrying}
            onPress={onRetry}
            testID="unified-generation-retry"
            style={styles.retry}
          >
            <AppText style={styles.retryText}>
              {retrying ? 'Retrying…' : 'Try again'}
            </AppText>
          </Pressable>
        ) : null}
        {notice ? (
          <AppText
            variant="label"
            color="secondary"
            style={styles.message}
            testID="unified-generation-notice"
          >
            {notice}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          testID="unified-generation-back"
          style={styles.back}
        >
          <AppText variant="label">Go back</AppText>
        </Pressable>
      </View>
    );
  }

  const statusLabel =
    generation.job?.status === 'partially_ready'
      ? 'Building your lesson…'
      : 'Starting generation…';
  return (
    <View style={styles.center} testID="unified-generation-progress">
      <ActivityIndicator color={theme.colors.primary} />
      <AppText variant="h3" style={styles.title}>
        {statusLabel}
      </AppText>
      <AppText variant="label" color="secondary" style={styles.message}>
        This usually takes under a minute. You can wait here.
      </AppText>
      {generation.job ? <PartsProgress job={generation.job} /> : null}
      <FailedPartsSection
        styles={styles}
        parts={parts}
        retryingPart={retryingPart}
        onRetryPart={onRetryPart}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        testID="unified-generation-cancel"
        style={styles.back}
      >
        <AppText variant="label">Go back</AppText>
      </Pressable>
    </View>
  );
}

export function UnifiedLessonGenerationScreen({
  navigation,
  route,
}: UnifiedLessonGenerationScreenProps) {
  const {jobId, confirmedText, level} = route.params;
  const {
    generation,
    retrying: retryingPart,
    retryPart,
  } = useLessonGenerationJob({jobId});
  const parts = useMemo(
    () => (generation.job ? listRetryableJobParts(generation.job) : []),
    [generation],
  );
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const openedRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent('unified_generation_started', {job_id: jobId});
    }
  }, [jobId]);

  useEffect(() => {
    if (generation.status === 'succeeded') {
      if (!completedRef.current) {
        completedRef.current = true;
        trackEvent('unified_generation_completed', {
          job_id: jobId,
          lesson_id: generation.lessonId,
          outcome: 'materialized',
        });
      }
      if (openedRef.current !== generation.lessonId) {
        openedRef.current = generation.lessonId;
        navigation.replace('CurriculumLesson', {lessonId: generation.lessonId});
      }
    } else if (generation.status === 'failed' && !completedRef.current) {
      completedRef.current = true;
      trackEvent('unified_generation_completed', {
        job_id: jobId,
        outcome: 'failed',
      });
    }
  }, [generation, navigation, jobId]);

  const handleRetry = useCallback(async () => {
    if (retrying || !confirmedText) return;
    setRetrying(true);
    setNotice(null);
    try {
      const result = await createLessonGenerationJob({confirmedText, level});
      if (result.ok) {
        openedRef.current = null;
        navigation.replace('UnifiedLessonGeneration', {
          jobId: result.job.id,
          confirmedText,
          level,
        });
      } else if (!result.cancelled) {
        setNotice(result.message);
      }
    } finally {
      setRetrying(false);
    }
  }, [retrying, confirmedText, level, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRetryPart = useCallback(
    async (target: LessonGenerationPartTarget) => {
      setNotice(null);
      trackEvent('unified_generation_part_retry', {
        job_id: jobId,
        target_kind: target.kind,
        target_id: target.kind === 'chunk' ? target.id : target.key,
        outcome: 'started',
      });
      const outcome = await retryPart(target);
      if (outcome.ok) {
        trackEvent('unified_generation_part_retry', {
          job_id: jobId,
          target_kind: target.kind,
          target_id: target.kind === 'chunk' ? target.id : target.key,
          outcome: 'accepted',
        });
        return;
      }
      trackEvent('unified_generation_part_retry', {
        job_id: jobId,
        target_kind: target.kind,
        target_id: target.kind === 'chunk' ? target.id : target.key,
        outcome: outcome.conflicted ? 'conflict' : 'failed',
      });
      setNotice(
        outcome.conflicted
          ? 'The lesson changed while retrying. Showing the latest status.'
          : outcome.error.message,
      );
    },
    [jobId, retryPart],
  );

  return (
    <AppScreen>
      <UnifiedLessonGenerationView
        generation={generation}
        canRetry={confirmedText != null && confirmedText.length > 0}
        retrying={retrying}
        notice={notice}
        onRetry={() => {
          handleRetry();
        }}
        onBack={handleBack}
        parts={parts}
        retryingPart={retryingPart}
        onRetryPart={(target: LessonGenerationPartTarget) =>
          void handleRetryPart(target)
        }
      />
    </AppScreen>
  );
}
