import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SoftActionButton} from '@ui/components/SoftActionButton';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {readClipboardText} from '../logic/clipboardText';
import type {LessonCreationState} from '../logic/useLessonCreation';
import {creationErrorDisplay} from '../logic/youtubeCreationError';
import {parseYouTubeVideoId} from '../logic/youtubeUrl';
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
          style={styles.stepTitle}
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
  const [urlFocused, setUrlFocused] = useState(false);
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

  const videoId = parseYouTubeVideoId(url);

  const renderLinkField = (editable: boolean) => (
    <View style={styles.urlFieldBlock}>
      <AppText style={styles.urlLabel} variant="label">
        {t('youtube.url_label')}
      </AppText>
      <View
        style={[
          themedStyles.urlCard,
          urlFocused ? themedStyles.urlCardFocused : null,
          videoId ? themedStyles.urlCardValid : null,
        ]}
      >
        <MaterialIcon color={theme.colors.text.muted} name="share" size={18} />
        <TextInput
          testID="lesson-creation-url-input"
          accessibilityLabel={t('lessonPlayer.create_url_label')}
          accessibilityHint={t('lessonPlayer.create_url_hint')}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable && !processing}
          keyboardType="url"
          onBlur={() => setUrlFocused(false)}
          onChangeText={setUrl}
          onFocus={() => setUrlFocused(true)}
          placeholder={t('lessonPlayer.create_url_placeholder')}
          placeholderTextColor={theme.colors.text.muted}
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
        {editable ? (
          <SoftActionButton
            accessibilityLabel={t('youtube.create.paste_link')}
            icon="content_paste"
            label={t('youtube.create.paste_short')}
            onPress={() => {
              handlePaste().catch(() => {});
            }}
            testID="lesson-creation-paste"
          />
        ) : null}
      </View>
      {editable && videoId ? (
        <View style={themedStyles.linkOk} testID="lesson-creation-link-ok">
          <View style={themedStyles.linkOkThumb}>
            <MaterialIcon
              color={HERO_PALETTE.white}
              name="play_arrow"
              size={18}
            />
          </View>
          <View style={styles.linkCardText}>
            <AppText style={themedStyles.linkOkTitle} variant="label">
              {t('youtube.create.link_ok')}
            </AppText>
            <AppText
              numberOfLines={1}
              style={themedStyles.linkOkSub}
              variant="caption"
            >
              {`youtu.be/${videoId}`}
            </AppText>
          </View>
          <MaterialIcon
            color={theme.colors.primary}
            name="check_circle"
            size={20}
          />
        </View>
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
              <AppText variant="h1">{t('youtube.create.headline')}</AppText>
              <AppText color="secondary" variant="body">
                {t('youtube.create.subhead')}
              </AppText>
            </View>
            {renderLinkField(true)}
            <View style={themedStyles.infoCard}>
              <View style={styles.infoListRow}>
                <View style={[themedStyles.infoIcon, themedStyles.infoIconSky]}>
                  <MaterialIcon
                    color={HERO_PALETTE.skyInk}
                    name="subtitles"
                    size={17}
                  />
                </View>
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="label"
                >
                  {t('youtube.create.info_subtitles')}
                </AppText>
              </View>
              <View style={[styles.infoListRow, themedStyles.infoDivider]}>
                <View style={themedStyles.infoIcon}>
                  <MaterialIcon
                    color={theme.colors.primary}
                    name="shield"
                    size={17}
                  />
                </View>
                <AppText
                  color="secondary"
                  style={styles.infoText}
                  variant="label"
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
              name="schedule"
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

      <StickerFooter bottomInset={floatingClearance}>
        {succeeded ? (
          <StickerButton
            accessibilityLabel={t('lessonPlayer.create_open')}
            icon="play_arrow"
            label={t('lessonPlayer.create_open')}
            onPress={() => onOpenLesson(state.lessonId)}
            testID="lesson-creation-open"
          />
        ) : (
          <StickerButton
            accessibilityLabel={t('lessonPlayer.create_submit')}
            disabled={!body || processing || timedOut || waiting}
            icon="auto_stories"
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
      </StickerFooter>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
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
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    infoDivider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    infoIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 11,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    infoIconSky: {
      backgroundColor: HERO_PALETTE.skySoft,
    },
    linkOk: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      padding: 9,
      paddingRight: 12,
    },
    linkOkThumb: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.faceFrom,
      borderRadius: 9,
      height: 40,
      justifyContent: 'center',
      width: 64,
    },
    linkOkTitle: {
      color: theme.colors.accentInk,
    },
    linkOkSub: {
      color: theme.colors.accentInk,
      opacity: 0.8,
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
    urlCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 6,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    urlCardFocused: {
      borderColor: theme.colors.accent,
    },
    urlCardValid: {
      borderColor: theme.colors.primary,
    },
    urlInput: {
      color: theme.colors.text.primary,
      flex: 1,
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: 15,
      fontWeight: '600',
      minHeight: 44,
      minWidth: 0,
      paddingVertical: 0,
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
  infoListRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
  stepsBlock: {
    gap: 4,
  },
  timeoutBlock: {
    alignItems: 'center',
  },
  urlFieldBlock: {
    gap: 10,
  },
  urlLabel: {
    paddingHorizontal: 4,
  },
});
