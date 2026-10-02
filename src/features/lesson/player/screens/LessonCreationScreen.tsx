import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, ScrollView, StyleSheet, View} from 'react-native';

import type {LessonsStackParamList} from '@features/lesson/library';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {openLesson} from '../logic/lessonNavigation';
import {useLessonCreation} from '../logic/useLessonCreation';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonCreation'>;

type CreationSource = 'text' | 'ocr' | 'youtube';

const SOURCES: readonly CreationSource[] = ['text', 'ocr', 'youtube'];

const SOURCE_LABEL_KEYS: Record<CreationSource, string> = {
  text: 'lessonPlayer.create_source_text',
  ocr: 'lessonPlayer.create_source_ocr',
  youtube: 'lessonPlayer.create_source_youtube',
};

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Learner creation screen (FR-005, AC-001 S2/AC-002 S2/AC-003 S2..S5):
 * text, OCR-confirmed text and YouTube URL submit through the same async
 * pipeline with the persisted idempotency key. Processing, terminal failure
 * (with explicit retry), and success states all render here; the success
 * state opens the new lesson in the common player. Laid out like the
 * Paste-text / Analyzing screens: source chips, rounded input, a progress
 * card, and one primary action at the bottom.
 */
export function LessonCreationScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const {submissionId, initialSource, initialText} = route.params;
  const [source, setSource] = useState<CreationSource>(initialSource ?? 'text');
  const [text, setText] = useState(initialText ?? '');
  const [url, setUrl] = useState('');
  const {state, submit, checkAgain, retryWithFreshKey} =
    useLessonCreation(submissionId);

  const body = useMemo<LearnerLessonCreationRequestBody | null>(() => {
    if (source === 'youtube') {
      return url.trim().length > 0
        ? {source: 'youtube', url: url.trim()}
        : null;
    }
    return text.trim().length > 0 ? {source, text: text.trim()} : null;
  }, [source, text, url]);

  const processing =
    state.status === 'submitting' || state.status === 'processing';
  const succeeded = state.status === 'succeeded';

  return (
    <AppScreen>
      <ScreenHeader
        title={t('lessonPlayer.create_title')}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        testID="lesson-creation-screen"
        contentContainerStyle={themedStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText color="secondary" variant="body">
          {t('lessonPlayer.create_intro')}
        </AppText>

        <View testID="lesson-creation-source-tabs" style={styles.chipRow}>
          {SOURCES.map(option => (
            <Chip
              accessibilityHint={t('lessonPlayer.create_source_hint')}
              key={option}
              label={t(SOURCE_LABEL_KEYS[option])}
              onPress={() => setSource(option)}
              selected={source === option}
              testID={`lesson-creation-source-${option}`}
              tone={source === option ? 'accent' : 'neutral'}
            />
          ))}
        </View>

        {source === 'youtube' ? (
          <TextField
            testID="lesson-creation-url-input"
            accessibilityLabel={t('lessonPlayer.create_url_label')}
            accessibilityHint={t('lessonPlayer.create_url_hint')}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!processing}
            keyboardType="url"
            onChangeText={setUrl}
            placeholder={t('lessonPlayer.create_url_placeholder')}
            style={themedStyles.urlInput}
            value={url}
          />
        ) : (
          <TextField
            testID="lesson-creation-text-input"
            accessibilityLabel={t('lessonPlayer.create_text_label')}
            accessibilityHint={t('lessonPlayer.create_text_hint')}
            editable={!processing}
            multiline
            onChangeText={setText}
            placeholder={
              source === 'ocr'
                ? t('lessonPlayer.create_ocr_placeholder')
                : t('lessonPlayer.create_text_placeholder')
            }
            style={themedStyles.textInput}
            value={text}
          />
        )}

        {source !== 'youtube' ? (
          <View style={styles.chipRow}>
            <Chip
              label={t('lessonPlayer.create_word_count', {
                count: countWords(text),
              })}
              tone="neutral"
            />
            <Chip
              label={t('lessonPlayer.create_char_count', {
                count: text.trim().length,
              })}
              tone="neutral"
            />
          </View>
        ) : null}

        {processing ? (
          <AppCard>
            <View style={styles.cardBody}>
              <View style={styles.rowCenter}>
                <ActivityIndicator
                  color={theme.colors.primary}
                  testID="lesson-creation-processing"
                />
                <AppText
                  testID={
                    state.status === 'processing'
                      ? 'lesson-creation-processing-text'
                      : undefined
                  }
                  variant="h3"
                >
                  {t('lessonPlayer.create_progress_title')}
                </AppText>
              </View>
              <ProgressStep
                done={state.status === 'processing'}
                active={state.status === 'submitting'}
                label={t('lessonPlayer.create_step_send')}
                theme={theme}
              />
              <ProgressStep
                done={false}
                active={state.status === 'processing'}
                label={t('lessonPlayer.create_step_generate')}
                theme={theme}
              />
              <ProgressStep
                done={false}
                active={false}
                label={t('lessonPlayer.create_step_ready')}
                theme={theme}
              />
            </View>
          </AppCard>
        ) : null}

        {state.status === 'timedOut' ? (
          <View testID="lesson-creation-timeout" style={themedStyles.notice}>
            <AppText color="secondary">
              {t('lessonPlayer.create_timeout')}
            </AppText>
            <AppButton
              accessibilityHint={t('lessonPlayer.create_check_again_hint')}
              onPress={() => {
                checkAgain();
              }}
              testID="lesson-creation-check-again"
              title={t('lessonPlayer.create_check_again')}
              variant="secondary"
            />
          </View>
        ) : null}

        {state.status === 'failed' ? (
          <View testID="lesson-creation-error" style={themedStyles.errorBox}>
            <AppText color="danger">
              {t('lessonPlayer.create_failed', {code: state.code})}
            </AppText>
            {state.retryable ? (
              <AppButton
                accessibilityHint={t('lessonPlayer.create_submit_hint')}
                onPress={async () => {
                  await retryWithFreshKey();
                }}
                testID="lesson-creation-retry"
                title={t('common.retry')}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}

        {state.status === 'error' ? (
          <View testID="lesson-creation-error" style={themedStyles.errorBox}>
            <AppText color="danger">{state.error.message}</AppText>
            <AppButton
              accessibilityHint={t('lessonPlayer.create_submit_hint')}
              onPress={() => body && submit(body)}
              testID="lesson-creation-retry"
              title={t('common.retry')}
              variant="secondary"
            />
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
        {state.status === 'succeeded' ? (
          <PrimaryActionButton
            accessibilityHint={t('lessonPlayer.create_open_hint')}
            accessibilityLabel={t('lessonPlayer.create_open')}
            label={t('lessonPlayer.create_open')}
            onPress={() => openLesson(navigation, state.lessonId)}
            testID="lesson-creation-open"
          />
        ) : (
          <PrimaryActionButton
            accessibilityHint={t('lessonPlayer.create_submit_hint')}
            accessibilityLabel={t('lessonPlayer.create_submit')}
            disabled={!body || processing}
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

function ProgressStep({
  done,
  active,
  label,
  theme,
}: {
  done: boolean;
  active: boolean;
  label: string;
  theme: AppTheme;
}) {
  return (
    <View style={styles.rowCenter}>
      <MaterialIcon
        color={done || active ? theme.colors.primary : theme.colors.text.muted}
        name={done ? 'check_circle' : 'circle'}
        size={20}
      />
      <AppText color={done || active ? 'primary' : 'muted'}>{label}</AppText>
    </View>
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
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    notice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
    success: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.lg,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    textInput: {
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.xl,
      borderWidth: 2,
      minHeight: 150,
      textAlignVertical: 'top',
    },
    urlInput: {
      borderColor: theme.colors.accentSoft,
      borderRadius: theme.radius.xl,
      borderWidth: 2,
    },
  });
}

const styles = StyleSheet.create({
  cardBody: {
    gap: 10,
  },
  chipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  rowCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
