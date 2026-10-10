import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {getTextLengthBucket, trackEvent} from '@features/analytics';
import {startLessonFromConfirmedText} from '@features/lesson/player';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {Chip} from '@ui/components/Chip';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import {
  getDraftTextState,
  MAX_LESSON_V2_WORDS,
  validateConfirmedText,
} from '@core/utils/textValidation';

import type {CreateFlowParamList} from './navigationTypes';
type Props = NativeStackScreenProps<CreateFlowParamList, 'PasteText'>;

export type PasteTextScreenProps = Props;

type ScreenState = {type: 'input'} | {type: 'error'; message: string};

export function PasteTextScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const [text, setText] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>({type: 'input'});
  const [creating, setCreating] = useState(false);
  const draft = useMemo(() => getDraftTextState(text), [text]);
  const hasText = text.trim().length > 0;
  const floatingClearance = useFloatingTabBarClearance();

  // Lỗi phân tích được màn "Đang phân tích" trả về qua param khi quay lại đây.
  const analyzeError = route?.params?.analyzeError;
  useEffect(() => {
    if (analyzeError) {
      setScreenState({type: 'error', message: analyzeError});
      navigation.setParams({analyzeError: undefined});
    }
  }, [analyzeError, navigation]);

  // Trùng giới hạn ở server (startLessonFromConfirmedText): không cho bấm khi vượt.
  const canSubmit = hasText && !draft.overWordLimit && !creating;

  async function handleAnalyze() {
    if (creating) return;
    const validation = validateConfirmedText(text);
    if (!validation.valid) {
      setScreenState({type: 'error', message: validation.message});
      return;
    }

    trackEvent('text_entered', {
      text_length_bucket: getTextLengthBucket(validation.value.length),
    });
    trackEvent('text_confirmed', {
      source_type: 'paste_text',
      text_length_bucket: getTextLengthBucket(validation.value.length),
      edited_after_ocr: false,
    });

    setCreating(true);
    setScreenState({type: 'input'});

    const result = await startLessonFromConfirmedText({
      confirmedText: validation.value,
      sourceType: 'paste_text',
      origin: 'PasteText',
      navigate: (_screen, params) =>
        appNavigation.startCreate({
          kind: params.initialSource,
          text: params.initialText,
          submissionId: params.submissionId,
        }),
    });

    if (!result.ok) {
      setScreenState({type: 'error', message: result.message});
    }
    setCreating(false);
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('paste.title')}
      />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: floatingClearance,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText color="secondary" variant="body">
          {t('paste.intro')}
        </AppText>

        <TextField
          multiline
          onChangeText={value => {
            setText(value);
            if (screenState.type === 'error') {
              setScreenState({type: 'input'});
            }
          }}
          placeholder={t('paste.placeholder')}
          style={{
            borderColor: theme.colors.accentSoft,
            borderRadius: 20,
            borderWidth: 2,
            minHeight: 150,
            textAlignVertical: 'top',
          }}
          value={text}
        />

        <Pressable
          accessibilityLabel={t('paste.clear_a11y')}
          accessibilityRole="button"
          accessibilityState={{disabled: !hasText}}
          disabled={!hasText}
          onPress={() => {
            setText('');
            setScreenState({type: 'input'});
          }}
          style={({pressed}) => ({
            alignItems: 'center',
            alignSelf: 'flex-end',
            flexDirection: 'row',
            gap: 6,
            minHeight: 44,
            opacity: !hasText
              ? theme.states.disabledOpacity
              : pressed
              ? theme.states.pressedOpacity
              : 1,
            paddingHorizontal: theme.spacing.sm,
          })}
        >
          <MaterialIcon
            color={!hasText ? theme.colors.text.muted : theme.colors.primary}
            name="delete"
            size={20}
          />
          <AppText
            style={{
              color: !hasText ? theme.colors.text.muted : theme.colors.primary,
              fontWeight: '600',
            }}
          >
            {t('paste.clear')}
          </AppText>
        </Pressable>

        <View style={styles.tagsRow} testID="paste-counters">
          <Chip
            label={t('paste.words_progress', {
              count: draft.words,
              max: MAX_LESSON_V2_WORDS,
            })}
            tone={draft.overWordLimit ? 'coralSoft' : 'neutral'}
          />
          <Chip
            label={t('paste.chars_count', {count: text.trim().length})}
            tone="neutral"
          />
        </View>

        {!hasText ? (
          <AppText color="secondary" variant="body">
            {t('paste.need_word')}
          </AppText>
        ) : null}

        {draft.overWordLimit ? (
          <ErrorCard
            message={t('errors.text_over_word_limit', {
              max: MAX_LESSON_V2_WORDS,
            })}
          />
        ) : null}

        {screenState.type === 'error' ? (
          <ErrorCard
            message={screenState.message}
            onRetry={() => {
              handleAnalyze();
            }}
            retryLabel={t('common.retry')}
          />
        ) : null}
      </ScrollView>

      <BottomActionBar
        style={{
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outlineVariant,
          paddingBottom: floatingClearance,
        }}
      >
        <PrimaryActionButton
          accessibilityLabel={t('paste.submit_a11y')}
          disabled={!canSubmit}
          onPress={() => {
            handleAnalyze();
          }}
          label={creating ? t('paste.submitting') : t('paste.submit')}
        />
      </BottomActionBar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tagsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
