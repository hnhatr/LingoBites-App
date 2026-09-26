import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Image, Pressable, ScrollView, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {CreateStackParamList} from '@/app/navigation/types';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {BottomActionBar} from '@components/BottomActionBar';
import {Chip} from '@components/Chip';
import {ErrorCard} from '@components/ErrorCard';
import {MaterialIcon} from '@components/MaterialIcon';
import {PrimaryActionButton} from '@components/PrimaryActionButton';
import {ScreenHeader} from '@components/ScreenHeader';
import {TextField} from '@components/TextField';
import {useTranslation} from 'react-i18next';
import {useAppTheme} from '@theme';
import {getTextLengthBucket, trackEvent} from '../analytics';
import {
  MAX_INPUT_TEXT_LENGTH,
  validateConfirmedText,
} from '@shared/utils/textValidation';
import {extractText} from './OCRService';
import type {NavigationProp} from '@react-navigation/native';
import type {RootTabParamList} from '@/app/navigation/types';
import {startLessonFromConfirmedText} from '@shared/lesson/startLessonFromConfirmedText';
import {createLessonGenerationJob} from '@modules/curriculumLesson';

type Props = NativeStackScreenProps<CreateStackParamList, 'OCRReview'>;

type ScreenState = {type: 'input'} | {type: 'error'; message: string};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function OCRReviewScreen({navigation, route}: Props) {
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
  const wordCount = useMemo(() => countWords(text), [text]);

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
      navigate: (screen, params) => {
        if (screen === 'UnifiedLessonGeneration' && 'jobId' in params) {
          const {jobId, confirmedText, level} = params;
          navigation
            .getParent<NavigationProp<RootTabParamList>>()
            ?.navigate('Lessons', {
              screen: 'UnifiedLessonGeneration',
              params: {jobId, confirmedText, level},
            });
        }
      },
      createGenerationJob: createLessonGenerationJob,
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

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Kiểm tra text" />
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
            style={{height: 180, width: '100%'}}
          />
        </View>

        <AppText color="secondary" variant="body">
          Kiểm tra và chỉnh sửa trước khi phân tích. App chỉ gửi text bạn xác
          nhận cho AI.
        </AppText>

        <TextField
          multiline
          onChangeText={value => {
            setText(value);
            if (screenState.type === 'error') {
              setScreenState({type: 'input'});
            }
          }}
          placeholder="Chỉnh sửa đoạn tiếng Anh..."
          style={{
            borderColor: theme.colors.accentSoft,
            borderRadius: 20,
            borderWidth: 2,
            minHeight: 180,
            textAlignVertical: 'top',
          }}
          value={text}
        />

        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Chip label="Text từ ảnh" tone="accentSoft" />
          <Chip label={`${wordCount} từ`} tone="neutral" />
          <Chip
            label={`${text.trim().length}/${MAX_INPUT_TEXT_LENGTH}`}
            tone="neutral"
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
            onRetry={() => void handleAnalyze()}
            retryLabel={t('common.retry')}
          />
        ) : null}

        <Pressable
          accessibilityLabel="Thử OCR lại"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void handleRetryOcr()}
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
            {isRetryingOcr ? 'Đang nhận diện lại...' : 'Thử OCR lại'}
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
          disabled={busy || creating}
          onPress={() => void handleAnalyze()}
          label={creating ? 'Đang khởi tạo bài học…' : 'Phân tích & học ngay'}
        />
      </BottomActionBar>
    </AppScreen>
  );
}
