import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {getTextLengthBucket, trackEvent} from '@features/analytics';
import type {CreateFlowParamList} from '@features/input';
import {startLessonFromConfirmedText} from '@features/lesson/player';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {Chip} from '@ui/components/Chip';
import {ErrorCard} from '@ui/components/ErrorCard';
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

import {extractText} from '../logic/OCRService';
type Props = NativeStackScreenProps<CreateFlowParamList, 'OCRReview'>;

export type OCRReviewScreenProps = Props;

type ScreenState = {type: 'input'} | {type: 'error'; message: string};

export function OCRReviewScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const {
    imageUri,
    fileName,
    mimeType,
    width,
    height,
    sourceType,
    extractedText,
    warnings = [],
    analyzeError,
  } = route.params;

  const [text, setText] = useState(extractedText ?? '');
  const [screenState, setScreenState] = useState<ScreenState>({type: 'input'});
  const [isRetryingOcr, setIsRetryingOcr] = useState(false);
  const [creating, setCreating] = useState(false);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const ocrRequestIdRef = useRef(0);
  const initialExtractedText = extractedText ?? '';
  const draft = useMemo(() => getDraftTextState(text), [text]);

  useEffect(() => {
    return () => {
      ocrAbortRef.current?.abort();
    };
  }, []);

  // Lỗi phân tích được màn "Đang phân tích" trả về qua param khi quay lại đây.
  useEffect(() => {
    if (analyzeError) {
      setScreenState({type: 'error', message: analyzeError});
      navigation.setParams({analyzeError: undefined});
    }
  }, [analyzeError, navigation]);

  const advisoryMessages = useMemo(() => {
    const messages: string[] = [];
    if (warnings.includes('low_confidence_image')) {
      messages.push(t('errors.ocr_low_confidence'));
    }
    if (warnings.includes('may_not_be_english')) {
      messages.push(t('errors.ocr_not_english'));
    }
    if (warnings.includes('text_exceeds_max_length')) {
      messages.push(t('errors.ocr_text_over_limit'));
    }
    return messages;
  }, [warnings, t]);

  async function handleAnalyze() {
    if (creating) return;
    const validation = validateConfirmedText(text);
    if (!validation.valid) {
      setScreenState({type: 'error', message: validation.message});
      return;
    }

    trackEvent('text_confirmed', {
      source_type: sourceType,
      text_length_bucket: getTextLengthBucket(validation.value.length),
      edited_after_ocr: validation.value.trim() !== initialExtractedText.trim(),
    });

    setScreenState({type: 'input'});
    setCreating(true);

    const result = await startLessonFromConfirmedText({
      confirmedText: validation.value,
      sourceType,
      origin: 'OCRReview',
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

  async function handleRetryOcr() {
    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    const requestId = ++ocrRequestIdRef.current;

    setIsRetryingOcr(true);
    setScreenState({type: 'input'});

    const result = await extractText(
      {
        uri: imageUri,
        fileName,
        type: mimeType,
        width,
        height,
        sourceType,
      },
      controller.signal,
    );

    if (requestId !== ocrRequestIdRef.current) {
      return;
    }

    setIsRetryingOcr(false);

    if (!result.ok) {
      if (result.cancelled) {
        return;
      }

      setScreenState({type: 'error', message: result.message});
      return;
    }

    setText(result.extractedText);
  }

  const busy = isRetryingOcr;
  const canSubmit = !busy && !creating && !draft.overWordLimit;

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={t('ocr.title')} />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surfaceLow,
            borderColor: theme.colors.accentSoft,
            borderRadius: 20,
            borderWidth: 2,
            overflow: 'hidden',
          }}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{uri: imageUri}}
            style={styles.previewImage}
          />
        </View>

        <AppText color="secondary" variant="body">
          {t('ocr.review_intro')}
        </AppText>

        <TextField
          multiline
          onChangeText={value => {
            setText(value);
            if (screenState.type === 'error') {
              setScreenState({type: 'input'});
            }
          }}
          placeholder={t('ocr.placeholder')}
          style={{
            borderColor: theme.colors.accentSoft,
            borderRadius: 20,
            borderWidth: 2,
            minHeight: 180,
            textAlignVertical: 'top',
          }}
          value={text}
        />

        <View style={styles.tagsRow}>
          <Chip label={t('ocr.chip_source')} tone="accentSoft" />
          <Chip
            label={t('ocr.words_progress', {
              count: draft.words,
              max: MAX_LESSON_V2_WORDS,
            })}
            tone={draft.overWordLimit ? 'coralSoft' : 'neutral'}
          />
        </View>

        {advisoryMessages.map(message => (
          <AppText key={message} style={{color: theme.colors.secondary}}>
            {message}
          </AppText>
        ))}

        {screenState.type === 'error' ? (
          <ErrorCard
            message={screenState.message}
            onRetry={() => {
              handleAnalyze();
            }}
            retryLabel={t('common.retry')}
          />
        ) : null}

        <Pressable
          accessibilityLabel={t('ocr.retry')}
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            handleRetryOcr();
          }}
          style={({pressed}) => [
            {
              alignItems: 'center',
              alignSelf: 'center',
              flexDirection: 'row',
              gap: 6,
              opacity: busy || pressed ? theme.states.pressedOpacity : 1,
              paddingVertical: theme.spacing.sm,
            },
          ]}
        >
          <MaterialIcon
            color={theme.colors.primary}
            name="document_scanner"
            size={20}
          />
          <AppText style={{color: theme.colors.primary, fontWeight: '600'}}>
            {isRetryingOcr ? t('ocr.retrying') : t('ocr.retry')}
          </AppText>
        </Pressable>
      </ScrollView>

      <BottomActionBar
        style={{
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.outlineVariant,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <PrimaryActionButton
          accessibilityLabel="Phân tích & học ngay"
          disabled={!canSubmit}
          onPress={() => {
            handleAnalyze();
          }}
          label={creating ? t('ocr.submitting') : t('ocr.submit')}
        />
      </BottomActionBar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  previewImage: {
    height: 180,
    width: '100%',
  },
  tagsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btnText: {
    fontWeight: '600',
  },
});
