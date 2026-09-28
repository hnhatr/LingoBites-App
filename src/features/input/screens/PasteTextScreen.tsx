import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {CreateStackParamList} from './navigationTypes';
import type {RootTabParamList} from '@features/home';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {Chip} from '@ui/components/Chip';
import {ErrorCard} from '@ui/components/ErrorCard';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {useTranslation} from 'react-i18next';
import {useAppTheme} from '@ui/theme/index';
import {getTextLengthBucket, trackEvent} from '@features/analytics';
import {validateConfirmedText} from '@core/utils/textValidation';
import {startLessonFromConfirmedText} from '@features/lesson/player';
import {createLessonGenerationJob} from '@features/lesson/player';
import {useFloatingTabBarClearance} from '@ui/components/layout/index';
type Props = NativeStackScreenProps<CreateStackParamList, 'PasteText'>;

export type PasteTextScreenProps = Props;

type ScreenState = {type: 'input'} | {type: 'error'; message: string};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function PasteTextScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const [text, setText] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>({type: 'input'});
  const [creating, setCreating] = useState(false);
  const wordCount = useMemo(() => countWords(text), [text]);
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

  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Dán text" />
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
          Dán hoặc nhập đoạn tiếng Anh — bài viết, thực đơn, tin nhắn — app sẽ
          biến thành bài học.
        </AppText>

        <TextField
          multiline
          onChangeText={value => {
            setText(value);
            if (screenState.type === 'error') {
              setScreenState({type: 'input'});
            }
          }}
          placeholder="Dán đoạn text của bạn vào đây…"
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
          accessibilityLabel="Xóa văn bản"
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
            Xóa văn bản
          </AppText>
        </Pressable>

        <View style={styles.tagsRow}>
          {hasText ? (
            <Chip label="Phát hiện: Tiếng Anh" tone="accentSoft" />
          ) : null}
          <Chip label={`${wordCount} từ`} tone="neutral" />
          <Chip label={`${text.trim().length} ký tự`} tone="neutral" />
        </View>

        {!hasText ? (
          <AppText color="secondary" variant="body">
            Cần ít nhất 1 từ để trích xuất từ vựng.
          </AppText>
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
          accessibilityLabel="Trích xuất từ vựng"
          disabled={creating || !hasText}
          onPress={() => {
            handleAnalyze();
          }}
          label={creating ? 'Đang khởi tạo bài học…' : 'Trích xuất từ vựng'}
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
