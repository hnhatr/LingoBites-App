import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSnapshot} from '@core/schemas/lesson';

import {COMPOSE_PICK_MAX} from '../logic/composeClient';
import {
  COMPOSE_STAGES,
  composeFailureCopy,
  composeRefusalKey,
  composeStageIndex,
} from '../logic/composePick';
import {markComposeSeen, setFocusedCompose} from '../logic/composeTracker';
import {useComposePick} from '../logic/useComposePick';
import {YouTubeSheet} from './YouTubeSheet';

export type ComposeSheetProps = {
  visible: boolean;
  snapshot: LessonSnapshot;
  /** No connection: the learner can look but not send (J4). */
  offline?: boolean;
  onClose: () => void;
  onOpenLesson: (lessonId: string) => void;
  onSpeakText: (text: string) => void;
};

/**
 * S4.3 "Học theo 6 bước": pick 2–8 sentences of this lesson, send them, and
 * follow the request (wait design §3). Closing the sheet never stops the
 * request: the compose tracker keeps following it and the lesson arrives in
 * the library either way.
 */
export function ComposeSheet({visible, ...props}: ComposeSheetProps) {
  const {t} = useTranslation();
  return (
    <YouTubeSheet
      accessibilityLabel={t('compose.pick_title')}
      onClose={props.onClose}
      testID="compose-sheet"
      title={t('compose.pick_title')}
      visible={visible}
    >
      {/* Mounted only while open, so the quota is read when it is shown. */}
      {visible ? <ComposeSheetBody {...props} /> : null}
    </YouTubeSheet>
  );
}

function ComposeSheetBody({
  snapshot,
  offline,
  onClose,
  onOpenLesson,
  onSpeakText,
}: Omit<ComposeSheetProps, 'visible'>) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pick = useComposePick(snapshot);
  const {phase, entry} = pick;
  const [previewOpen, setPreviewOpen] = useState(false);

  // The learner is looking at this request: no banner for it elsewhere.
  const finished = entry !== null && entry.status !== 'running';
  const entryId = entry?.requestId ?? null;
  useEffect(() => {
    setFocusedCompose(entryId);
    return () => setFocusedCompose(null);
  }, [entryId]);
  useEffect(() => {
    if (finished && entryId) markComposeSeen(entryId);
  }, [entryId, finished]);

  const openLesson = (lessonId: string) => {
    onClose();
    onOpenLesson(lessonId);
  };

  if (phase.kind === 'cached') {
    return (
      <View style={styles.body} testID="compose-cached">
        <AppText variant="body">{t('compose.cached')}</AppText>
        <AppButton
          onPress={() => openLesson(phase.lessonId)}
          testID="compose-open-cached"
          title={t('compose.open')}
        />
      </View>
    );
  }

  if (phase.kind === 'following' && entry) {
    if (entry.status === 'succeeded' && entry.lessonId) {
      const dropped = entry.progress?.dropped_sentence_ids.length ?? 0;
      return (
        <View style={styles.body} testID="compose-ready">
          <AppText variant="h3">{t('compose.ready_title')}</AppText>
          {dropped > 0 ? (
            <AppText color="secondary" testID="compose-dropped" variant="body">
              {t('compose.dropped', {count: dropped})}
            </AppText>
          ) : null}
          <AppButton
            onPress={() => openLesson(entry.lessonId!)}
            testID="compose-start"
            title={t('compose.start')}
          />
        </View>
      );
    }
    if (entry.status === 'failed' && entry.error) {
      const copy = composeFailureCopy(entry.error, entry.progress);
      const message =
        entry.error.code === 'COMPOSE_NOT_SUITABLE' && copy.reasonVi
          ? [copy.reasonVi, copy.suggestionVi].filter(Boolean).join(' ')
          : t(copy.messageKey, copy.values);
      return (
        <View style={styles.body} testID="compose-failed">
          <View accessibilityRole="alert" style={styles.errorBox}>
            <AppText color="danger" testID="compose-failed-message">
              {message}
            </AppText>
            {copy.chargedKey ? (
              <AppText
                color="secondary"
                testID="compose-charged"
                variant="label"
              >
                {t(copy.chargedKey)}
              </AppText>
            ) : null}
          </View>
          <View style={styles.actions}>
            {copy.repick ? (
              <AppButton
                onPress={pick.repick}
                testID="compose-repick"
                title={t('compose.repick')}
                variant="secondary"
              />
            ) : null}
            {copy.retry ? (
              <AppButton
                disabled={offline}
                onPress={pick.retry}
                testID="compose-retry"
                title={t('compose.retry')}
              />
            ) : null}
          </View>
        </View>
      );
    }
    const progress = entry.progress;
    const current = composeStageIndex(progress?.stage);
    const slow =
      progress !== null && progress.elapsed_ms > progress.expected_ms * 2;
    return (
      <View
        accessibilityLiveRegion="polite"
        style={styles.body}
        testID="compose-progress"
      >
        <AppText variant="h3">{t('compose.progress_title')}</AppText>
        <View style={styles.stages}>
          {COMPOSE_STAGES.map((stage, index) => (
            <AppText
              key={stage}
              color={index > current ? 'muted' : 'secondary'}
              testID={`compose-stage-${stage}`}
              variant="body"
            >
              {index < current ? '✓ ' : index === current ? '… ' : '  '}
              {t(`compose.stage_${stage}`)}
            </AppText>
          ))}
        </View>
        {progress ? (
          <AppText color="secondary" testID="compose-waited" variant="label">
            {t('compose.waited', {
              seconds: Math.round(progress.elapsed_ms / 1000),
              expected: Math.round(progress.expected_ms / 1000),
            })}
          </AppText>
        ) : null}
        {slow ? (
          <AppText color="secondary" testID="compose-slow" variant="label">
            {t('compose.slow')}
          </AppText>
        ) : null}
        {entry.waitingNetwork ? (
          <AppText
            color="secondary"
            testID="compose-waiting-network"
            variant="label"
          >
            {t('compose.waiting_network')}
          </AppText>
        ) : null}
        <AppButton
          accessibilityHint={t('compose.preview_hint')}
          iconLeft="volume_up"
          onPress={() => setPreviewOpen(value => !value)}
          testID="compose-preview"
          title={t('compose.preview')}
          variant="secondary"
        />
        {previewOpen
          ? pick.pickedSentences.map(sentence => (
              // Warm-up only: hearing a sentence records no attempt.
              <Pressable
                key={sentence.id}
                accessibilityRole="button"
                onPress={() => onSpeakText(sentence.text_en)}
                style={styles.previewRow}
                testID={`compose-preview-${sentence.id}`}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="volume_up"
                  size={20}
                />
                <View style={styles.previewText}>
                  <AppText variant="body">{sentence.text_en}</AppText>
                  <AppText color="muted" variant="label">
                    {sentence.text_vi}
                  </AppText>
                </View>
              </Pressable>
            ))
          : null}
        <AppButton
          onPress={onClose}
          testID="compose-keep-learning"
          title={t('compose.keep_learning')}
          variant="ghost"
        />
      </View>
    );
  }

  const sentences = [...snapshot.sentences].sort(
    (a, b) => a.position - b.position,
  );
  const issueKey =
    pick.picked.length === 0
      ? null
      : pick.issue === 'too_few'
      ? 'compose.too_few'
      : pick.issue === 'too_thin'
      ? 'compose.too_thin'
      : pick.issue === 'too_long'
      ? 'compose.error_too_long'
      : null;
  const refusal =
    phase.kind === 'refused'
      ? t(composeRefusalKey(phase.code), {
          limit: phase.details?.limit ?? pick.quota?.limit ?? 0,
        })
      : phase.kind === 'network'
      ? t('compose.error_network')
      : null;

  return (
    <View style={styles.body} testID="compose-pick">
      <AppText color="secondary" variant="body">
        {t('compose.pick_hint')}
      </AppText>
      {pick.quota ? (
        <AppText
          color={pick.outOfQuota ? 'danger' : 'secondary'}
          testID="compose-quota"
          variant="label"
        >
          {pick.outOfQuota
            ? t('compose.quota_none')
            : t('compose.quota_left', {count: pick.quota.remaining})}
        </AppText>
      ) : null}
      {sentences.map((sentence, index) => {
        const checked = pick.picked.includes(sentence.id);
        return (
          <Pressable
            key={sentence.id}
            accessibilityHint={t('compose.select_hint')}
            accessibilityLabel={t('compose.select_a11y', {index: index + 1})}
            accessibilityRole="checkbox"
            accessibilityState={{checked}}
            onPress={() => pick.toggle(sentence.id)}
            style={[styles.row, checked ? styles.rowChecked : null]}
            testID={`compose-sentence-${sentence.id}`}
          >
            <MaterialIcon
              color={checked ? theme.colors.primary : theme.colors.border}
              name={checked ? 'check_circle' : 'circle'}
              size={22}
            />
            <View style={styles.previewText}>
              <AppText variant="body">{sentence.text_en}</AppText>
              <AppText color="muted" variant="label">
                {sentence.text_vi}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      <AppText testID="compose-picked-count" variant="label">
        {t('compose.picked_count', {
          count: pick.picked.length,
          max: COMPOSE_PICK_MAX,
        })}
      </AppText>
      {issueKey ? (
        <AppText color="secondary" testID="compose-issue" variant="label">
          {t(issueKey)}
        </AppText>
      ) : pick.farApart ? (
        <AppText color="secondary" testID="compose-far-apart" variant="label">
          {t('compose.far_apart')}
        </AppText>
      ) : null}
      {offline ? (
        <AppText color="secondary" testID="compose-offline" variant="label">
          {t('compose.offline')}
        </AppText>
      ) : null}
      {refusal ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <AppText color="danger" testID="compose-refused">
            {refusal}
          </AppText>
        </View>
      ) : null}
      <AppButton
        accessibilityHint={t('compose.submit_hint')}
        disabled={!pick.canSubmit || offline}
        loading={phase.kind === 'sending'}
        onPress={() => {
          pick.submit().catch(() => {});
        }}
        testID="compose-submit"
        title={
          phase.kind === 'sending' ? t('compose.sending') : t('compose.submit')
        }
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    body: {
      gap: theme.spacing.md,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
    },
    previewRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    previewText: {
      flex: 1,
      gap: 2,
    },
    row: {
      alignItems: 'center',
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
    },
    rowChecked: {
      backgroundColor: theme.colors.accentSoft,
      borderColor: theme.colors.primary,
    },
    stages: {
      gap: theme.spacing.xs,
    },
  });
}
