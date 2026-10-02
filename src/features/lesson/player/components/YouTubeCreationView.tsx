import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {IconButton} from '@ui/components/IconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {readClipboardText} from '../logic/clipboardText';
import type {LessonCreationState} from '../logic/useLessonCreation';
import {creationErrorDisplay} from '../logic/youtubeCreationError';
import {IndeterminateProgressBar} from './IndeterminateProgressBar';

export type YouTubeCreationViewProps = {
  state: LessonCreationState;
  url: string;
  setUrl: (value: string) => void;
  body: LearnerLessonCreationRequestBody | null;
  submit: (body: LearnerLessonCreationRequestBody) => void;
  checkAgain: () => void;
  retryWithFreshKey: () => Promise<void>;
  onBack: () => void;
  onOpenLesson: (lessonId: string) => void;
};

type StepPhase = 'inactive' | 'active' | 'done';

function stepPhase(
  step: 1 | 2 | 3,
  status: LessonCreationState['status'],
): StepPhase {
  if (status === 'succeeded') {
    return step <= 3 ? 'done' : 'inactive';
  }
  if (status === 'submitting') {
    if (step === 1) return 'active';
    return 'inactive';
  }
  if (status === 'processing') {
    if (step === 1) return 'done';
    if (step === 2) return 'active';
    return 'inactive';
  }
  return 'inactive';
}

function CreationStepRow({
  step,
  phase,
  titleKey,
  subtitleKey,
  theme,
  t,
}: {
  step: 1 | 2 | 3;
  phase: StepPhase;
  titleKey: string;
  subtitleKey: string;
  theme: AppTheme;
  t: (key: string) => string;
}) {
  const active = phase === 'active';
  const done = phase === 'done';
  const iconName = done ? 'check_circle' : step === 3 ? 'school' : 'circle';
  const iconColor =
    done || active ? theme.colors.primary : theme.colors.text.muted;

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepMarkerColumn}>
        {active && step === 2 ? (
          <View
            style={[
              styles.stepSpinnerWrap,
              {backgroundColor: theme.colors.accentSoft},
            ]}
          >
            <ActivityIndicator color={theme.colors.primary} size="small" />
          </View>
        ) : (
          <MaterialIcon color={iconColor} name={iconName} size={28} />
        )}
        {step < 3 ? (
          <View
            style={[
              styles.stepConnector,
              {
                backgroundColor: done
                  ? theme.colors.primary
                  : theme.colors.outlineVariant,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.stepTextColumn}>
        <AppText
          color={active || done ? 'primary' : 'muted'}
          testID={`lesson-creation-step-${step}`}
          variant="body"
          style={active ? styles.stepTitleActive : styles.stepTitle}
        >
          {t(titleKey)}
        </AppText>
        <AppText color="muted" variant="caption">
          {t(subtitleKey)}
        </AppText>
      </View>
    </View>
  );
}

export function YouTubeCreationView({
  state,
  url,
  setUrl,
  body,
  submit,
  checkAgain,
  retryWithFreshKey,
  onBack,
  onOpenLesson,
}: YouTubeCreationViewProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const [pasteNotice, setPasteNotice] = useState(false);
  const [submittedUrl, setSubmittedUrl] = useState('');

  const waiting = state.status === 'waiting_transcript';
  const waitingPolling = waiting && state.polling;
  const processing =
    state.status === 'submitting' || state.status === 'processing';
  const succeeded = state.status === 'succeeded';
  const timedOut = state.status === 'timedOut';
  const terminalError = state.status === 'failed' || state.status === 'error';
  const errorDisplay = terminalError ? creationErrorDisplay(state) : null;

  useEffect(() => {
    if (state.status === 'submitting') {
      const trimmed = url.trim();
      if (trimmed.length > 0) {
        setSubmittedUrl(trimmed);
      }
    }
  }, [state.status, url]);

  const displayUrl = submittedUrl || url.trim();
  const showIdleInput = !processing && !succeeded && !timedOut && !waiting;

  const handlePaste = async () => {
    const text = await readClipboardText();
    if (text) {
      setUrl(text);
      setPasteNotice(false);
      return;
    }
    setPasteNotice(true);
  };

  const renderLinkField = (editable: boolean) => (
    <View style={styles.urlFieldBlock}>
      <AppText variant="label">{t('youtube.url_label')}</AppText>
      <View style={styles.urlRow}>
        <TextField
          testID="lesson-creation-url-input"
          accessibilityLabel={t('lessonPlayer.create_url_label')}
          accessibilityHint={t('lessonPlayer.create_url_hint')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable && !processing}
          keyboardType="url"
          onChangeText={setUrl}
          placeholder={t('lessonPlayer.create_url_placeholder')}
          style={themedStyles.urlInput}
          value={url}
        />
        {editable && url.trim().length > 0 ? (
          <IconButton
            accessibilityLabel={t('youtube.create.clear_link_a11y')}
            icon="close"
            onPress={() => setUrl('')}
            testID="lesson-creation-clear"
            tone="bare"
          />
        ) : null}
      </View>
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('youtube.create.paste_link')}
          onPress={() => {
            handlePaste().catch(() => {});
          }}
          style={({pressed}) => [
            themedStyles.pasteButton,
            pressed && styles.pastePressed,
          ]}
          testID="lesson-creation-paste"
        >
          <MaterialIcon
            color={theme.colors.primary}
            name="content_paste"
            size={18}
          />
          <AppText color="primary" variant="label">
            {t('youtube.create.paste_link')}
          </AppText>
        </Pressable>
      ) : null}
      {pasteNotice ? (
        <AppText color="muted" variant="caption">
          {t('youtube.create.paste_empty')}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <AppScreen>
      <ScreenHeader title={t('youtube.input_title')} onBack={onBack} />
      <ScrollView
        testID="lesson-creation-screen"
        contentContainerStyle={themedStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        {showIdleInput ? (
          <>
            <View style={styles.headlineBlock}>
              <AppText variant="h2">{t('youtube.create.headline')}</AppText>
              <AppText color="secondary" variant="body">
                {t('youtube.create.subhead')}
              </AppText>
            </View>
            {renderLinkField(true)}
            <View style={styles.infoBlock}>
              <View style={styles.infoRow}>
                <MaterialIcon
                  color={theme.colors.text.muted}
                  name="subtitles"
                  size={20}
                />
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="body"
                >
                  {t('youtube.create.info_subtitles')}
                </AppText>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcon
                  color={theme.colors.text.muted}
                  name="shield"
                  size={20}
                />
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="body"
                >
                  {t('youtube.create.info_privacy')}
                </AppText>
              </View>
            </View>
          </>
        ) : null}

        {processing || timedOut || waiting ? (
          <AppCard>
            <View style={styles.linkCardRow}>
              <View
                style={[
                  styles.linkThumb,
                  {backgroundColor: theme.colors.text.primary},
                ]}
              >
                <MaterialIcon
                  color={theme.colors.text.inverse}
                  name="play_arrow"
                  size={22}
                />
              </View>
              <View style={styles.linkCardText}>
                <AppText variant="label">
                  {t('youtube.create.link_card_title')}
                </AppText>
                <AppText color="muted" numberOfLines={1} variant="caption">
                  {displayUrl}
                </AppText>
              </View>
            </View>
          </AppCard>
        ) : null}

        {processing ? (
          <View style={styles.processingBlock}>
            <AppText testID="lesson-creation-processing-text" variant="h2">
              {t('youtube.processing_title')}
            </AppText>
            <AppText color="secondary" variant="body">
              {t('youtube.create.processing_hint')}
            </AppText>
            <IndeterminateProgressBar testID="lesson-creation-processing" />
            <View style={styles.stepsBlock}>
              <CreationStepRow
                phase={stepPhase(1, state.status)}
                step={1}
                subtitleKey="youtube.create.step1_sub"
                theme={theme}
                titleKey="youtube.create.step1_title"
                t={t}
              />
              <CreationStepRow
                phase={stepPhase(2, state.status)}
                step={2}
                subtitleKey="youtube.create.step2_sub"
                theme={theme}
                titleKey="youtube.create.step2_title"
                t={t}
              />
              <CreationStepRow
                phase={stepPhase(3, state.status)}
                step={3}
                subtitleKey="youtube.create.step3_sub"
                theme={theme}
                titleKey="youtube.create.step3_title"
                t={t}
              />
            </View>
            <AppButton
              onPress={onBack}
              testID="lesson-creation-back-processing"
              title={t('youtube.create.back_while_processing')}
              variant="secondary"
            />
          </View>
        ) : null}

        {waiting ? (
          <View
            testID="lesson-creation-waiting-transcript"
            style={[styles.timeoutBlock, {gap: theme.spacing.md}]}
          >
            <MaterialIcon
              color={theme.colors.tertiary}
              name="hourglass_top"
              size={48}
            />
            <AppText testID="lesson-creation-waiting-text" variant="h2">
              {t('youtube.create.waiting_transcript_title')}
            </AppText>
            <AppText color="secondary" style={styles.centerText} variant="body">
              {t('youtube.create.waiting_transcript_body')}
            </AppText>
            {waitingPolling ? (
              <View style={styles.rowCenter}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <AppText color="secondary" variant="body">
                  {t('youtube.create.waiting_transcript_polling')}
                </AppText>
              </View>
            ) : (
              <AppButton
                accessibilityHint={t('lessonPlayer.create_check_again_hint')}
                onPress={checkAgain}
                testID="lesson-creation-check-again"
                title={t('lessonPlayer.create_check_again')}
                variant="primary"
              />
            )}
            <AppButton
              onPress={onBack}
              testID="lesson-creation-back-waiting"
              title={t('youtube.create.waiting_transcript_back')}
              variant="secondary"
            />
          </View>
        ) : null}

        {timedOut ? (
          <View
            testID="lesson-creation-timeout"
            style={[styles.timeoutBlock, {gap: theme.spacing.md}]}
          >
            <MaterialIcon
              color={theme.colors.tertiary}
              name="schedule"
              size={48}
            />
            <AppText variant="h2">{t('youtube.create.timeout_title')}</AppText>
            <AppText color="secondary" style={styles.centerText} variant="body">
              {t('youtube.create.timeout_body')}
            </AppText>
            <AppText color="secondary" variant="body">
              {t('youtube.create.timeout_tip')}
            </AppText>
            <AppButton
              accessibilityHint={t('lessonPlayer.create_check_again_hint')}
              onPress={checkAgain}
              testID="lesson-creation-check-again"
              title={t('lessonPlayer.create_check_again')}
              variant="primary"
            />
            <AppButton
              onPress={onBack}
              testID="lesson-creation-back-later"
              title={t('youtube.create.back_later')}
              variant="secondary"
            />
          </View>
        ) : null}

        {terminalError && errorDisplay ? (
          <View testID="lesson-creation-error" style={themedStyles.errorBox}>
            <MaterialIcon
              color={theme.colors.danger}
              name="warning"
              size={40}
            />
            <AppText variant="h2">
              {t('youtube.processing_failed_title')}
            </AppText>
            <AppText color="secondary" style={styles.centerText} variant="body">
              {t(errorDisplay.messageKey)}
            </AppText>
            <AppText
              color="muted"
              testID="lesson-creation-error-code"
              variant="caption"
            >
              {t('youtube.create.error_code', {code: errorDisplay.code})}
            </AppText>
            <View style={themedStyles.tipsCard}>
              <AppText variant="label">
                {t('youtube.create.tips_title')}
              </AppText>
              <View style={styles.infoRow}>
                <MaterialIcon
                  color={theme.colors.primary}
                  name="subtitles"
                  size={20}
                />
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="body"
                >
                  {t('youtube.create.tip_cc')}
                </AppText>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcon
                  color={theme.colors.primary}
                  name="visibility"
                  size={20}
                />
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="body"
                >
                  {t('youtube.create.tip_public')}
                </AppText>
              </View>
            </View>
            {renderLinkField(true)}
            {state.status === 'failed' && state.retryable ? (
              <AppButton
                accessibilityHint={t('youtube.create.retry_video_hint')}
                onPress={() => {
                  retryWithFreshKey().catch(() => {});
                }}
                testID="lesson-creation-retry"
                title={t('youtube.create.retry_video')}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}

        {succeeded ? (
          <View testID="lesson-creation-success" style={themedStyles.success}>
            <MaterialIcon
              color={theme.colors.primary}
              name="check_circle"
              size={24}
            />
            <AppText style={styles.flex1} variant="h3">
              {t('lessonPlayer.create_ready')}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <BottomActionBar
        style={[themedStyles.actionBar, {paddingBottom: floatingClearance}]}
      >
        {succeeded ? (
          <PrimaryActionButton
            accessibilityLabel={t('lessonPlayer.create_open')}
            label={t('lessonPlayer.create_open')}
            onPress={() => onOpenLesson(state.lessonId)}
            testID="lesson-creation-open"
          />
        ) : (
          <PrimaryActionButton
            accessibilityLabel={t('lessonPlayer.create_submit')}
            disabled={!body || processing || timedOut || waiting}
            label={
              processing
                ? t('lessonPlayer.create_submitting')
                : t('lessonPlayer.create_submit')
            }
            onPress={() => {
              if (body) submit(body);
            }}
            testID="lesson-creation-submit"
          />
        )}
      </BottomActionBar>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actionBar: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    errorBox: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    pasteButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    success: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    tipsCard: {
      alignSelf: 'stretch',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      width: '100%',
    },
    urlInput: {
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.xl,
      borderWidth: 2,
      flex: 1,
    },
  });
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  flex1: {
    flex: 1,
  },
  headlineBlock: {
    gap: 6,
  },
  infoBlock: {
    gap: 10,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  infoText: {
    flex: 1,
  },
  linkCardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  linkCardText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  linkThumb: {
    alignItems: 'center',
    borderRadius: 10,
    height: 54,
    justifyContent: 'center',
    width: 96,
  },
  pastePressed: {
    opacity: 0.85,
  },
  processingBlock: {
    gap: 16,
  },
  rowCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepConnector: {
    flex: 1,
    minHeight: 24,
    width: 2,
  },
  stepMarkerColumn: {
    alignItems: 'center',
    width: 32,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepSpinnerWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepTextColumn: {
    flex: 1,
    gap: 2,
    paddingTop: 4,
  },
  stepTitle: {
    fontWeight: '600',
  },
  stepTitleActive: {
    fontWeight: '600',
  },
  stepsBlock: {
    gap: 4,
  },
  timeoutBlock: {
    alignItems: 'center',
  },
  urlFieldBlock: {
    gap: 8,
  },
  urlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});
