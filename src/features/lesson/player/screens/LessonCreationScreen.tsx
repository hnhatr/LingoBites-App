import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import type {LessonsStackParamList} from '@features/lesson/library';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {useLessonCreation} from '../logic/useLessonCreation';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonCreation'>;

function creationStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {gap: theme.spacing.md, padding: theme.spacing.lg},
    tabRow: {flexDirection: 'row', gap: theme.spacing.sm},
    tab: {
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      padding: theme.spacing.sm,
    },
    tabSelected: {borderColor: theme.colors.primary, borderWidth: 2},
    input: {
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      color: theme.colors.text.primary,
      minHeight: 120,
      padding: theme.spacing.md,
    },
    submit: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      minHeight: 44,
      justifyContent: 'center',
    },
  });
}

/**
 * Learner creation screen (FR-005, AC-001 S2/AC-002 S2/AC-003 S2..S5):
 * text, OCR-confirmed text and YouTube URL submit through the same async
 * pipeline with the persisted idempotency key. Processing, terminal failure
 * (with explicit retry), and success states all render here; the success
 * state opens the new lesson in the common player.
 */
export function LessonCreationScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const styles = creationStyles(theme);
  const {submissionId, initialSource, initialText} = route.params;
  const [source, setSource] = useState<'text' | 'ocr' | 'youtube'>(
    initialSource ?? 'text',
  );
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

  return (
    <AppScreen>
      <ScreenHeader title="Create lesson" onBack={() => navigation.goBack()} />
      <View testID="lesson-creation-screen" style={styles.container}>
        <View testID="lesson-creation-source-tabs" style={styles.tabRow}>
          {(['text', 'ocr', 'youtube'] as const).map(option => (
            <Pressable
              accessibilityRole="button"
              key={option}
              testID={`lesson-creation-source-${option}`}
              style={[
                styles.tab,
                source === option ? styles.tabSelected : null,
              ]}
              onPress={() => setSource(option)}
            >
              <AppText>{option}</AppText>
            </Pressable>
          ))}
        </View>
        {source === 'youtube' ? (
          <TextInput
            testID="lesson-creation-url-input"
            accessibilityLabel="YouTube URL"
            accessibilityHint="Video link the lesson is created from"
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="YouTube URL"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <TextInput
            testID="lesson-creation-text-input"
            accessibilityLabel="Lesson text"
            accessibilityHint="Text the lesson is created from"
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={source === 'ocr' ? 'Confirmed OCR text' : 'Paste text'}
            multiline
          />
        )}
        {processing ? (
          <ActivityIndicator testID="lesson-creation-processing" />
        ) : (
          <Pressable
            accessibilityRole="button"
            testID="lesson-creation-submit"
            style={styles.submit}
            disabled={!body}
            onPress={() => {
              if (body) submit(body);
            }}
          >
            <AppText>Create</AppText>
          </Pressable>
        )}
        {state.status === 'processing' ? (
          <AppText testID="lesson-creation-processing-text">
            Creating your lesson…
          </AppText>
        ) : null}
        {state.status === 'timedOut' ? (
          <View testID="lesson-creation-timeout">
            <AppText>
              Creation is taking longer than expected. You can check again or go
              back and return later.
            </AppText>
            <Pressable
              accessibilityRole="button"
              testID="lesson-creation-check-again"
              onPress={() => {
                checkAgain();
              }}
            >
              <AppText>Check again</AppText>
            </Pressable>
          </View>
        ) : null}
        {state.status === 'failed' ? (
          <View testID="lesson-creation-error">
            <AppText>{`Creation failed (${state.code}).`}</AppText>
            {state.retryable ? (
              <Pressable
                accessibilityRole="button"
                testID="lesson-creation-retry"
                onPress={async () => {
                  await retryWithFreshKey();
                }}
              >
                <AppText>Thử lại</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {state.status === 'error' ? (
          <View testID="lesson-creation-error">
            <AppText>{state.error.message}</AppText>
            <Pressable
              accessibilityRole="button"
              testID="lesson-creation-retry"
              onPress={() => body && submit(body)}
            >
              <AppText>Retry</AppText>
            </Pressable>
          </View>
        ) : null}
        {state.status === 'succeeded' ? (
          <View testID="lesson-creation-success">
            <AppText>Lesson is ready.</AppText>
            <Pressable
              accessibilityRole="button"
              testID="lesson-creation-open"
              onPress={() =>
                navigation.navigate('CanonicalLessonPlayer', {
                  lessonId: state.lessonId,
                })
              }
            >
              <AppText>Open lesson</AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}
