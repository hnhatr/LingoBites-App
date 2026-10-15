import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';

import {getTextLengthBucket, trackEvent} from '@features/analytics';
import {
  readClipboardText,
  startLessonFromConfirmedText,
} from '@features/lesson/player';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SoftActionButton} from '@ui/components/SoftActionButton';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useAppNavigation} from '@core/navigation';
import {
  getDraftTextState,
  MAX_LESSON_V2_WORDS,
  validateConfirmedText,
} from '@core/utils/textValidation';

import {PASTE_EXAMPLES, type PasteExample} from '../logic/pasteExamples';
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
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const [pasteNotice, setPasteNotice] = useState(false);

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

  async function handlePaste() {
    const pasted = await readClipboardText();
    if (!pasted) {
      setPasteNotice(true);
      return;
    }
    setPasteNotice(false);
    updateText(pasted);
  }

  function updateText(value: string) {
    setText(value);
    if (screenState.type === 'error') {
      setScreenState({type: 'input'});
    }
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('paste.title')}
      />
      <ScrollView
        contentContainerStyle={themedStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <AppText variant="h1">{t('paste.headline')}</AppText>
          <AppText color="secondary" variant="body">
            {t('paste.intro')}
          </AppText>
        </View>

        <View
          style={[themedStyles.editor, focused ? themedStyles.focused : null]}
          testID="paste-editor"
        >
          <TextInput
            accessibilityLabel={t('paste.title')}
            multiline
            onBlur={() => setFocused(false)}
            onChangeText={updateText}
            onFocus={() => setFocused(true)}
            placeholder={t('paste.placeholder')}
            placeholderTextColor={theme.colors.text.muted}
            style={themedStyles.input}
            value={text}
          />
          <View style={styles.editorBar}>
            <AppText
              color={draft.overWordLimit ? 'danger' : 'muted'}
              style={styles.counter}
              testID="paste-counters"
              variant="caption"
            >
              {t('paste.counter', {
                words: draft.words,
                max: MAX_LESSON_V2_WORDS,
                chars: text.trim().length,
              })}
            </AppText>
            <SoftActionButton
              accessibilityHint={t('paste.clear_hint')}
              accessibilityLabel={t('paste.clear_a11y')}
              disabled={!hasText}
              icon="close"
              label={t('paste.clear_short')}
              onPress={() => {
                setText('');
                setScreenState({type: 'input'});
              }}
              testID="paste-clear"
              tone="plain"
            />
            <SoftActionButton
              accessibilityHint={t('paste.paste_hint')}
              accessibilityLabel={t('paste.paste_a11y')}
              icon="content_paste"
              label={t('paste.paste')}
              onPress={() => {
                handlePaste().catch(() => {});
              }}
              testID="paste-from-clipboard"
            />
          </View>
        </View>

        {pasteNotice ? (
          <AppText color="muted" variant="caption">
            {t('paste.paste_empty')}
          </AppText>
        ) : null}

        {!hasText ? (
          <View style={styles.examples} testID="paste-examples">
            <AppText variant="h3">{t('paste.examples_title')}</AppText>
            <View style={styles.exampleRow}>
              {PASTE_EXAMPLES.map(example => (
                <Pressable
                  accessibilityHint={t('paste.example_hint')}
                  accessibilityLabel={t(example.labelKey)}
                  accessibilityRole="button"
                  key={example.id}
                  onPress={() => updateText(example.text)}
                  style={({pressed}) => [
                    themedStyles.example,
                    pressed ? themedStyles.examplePressed : null,
                  ]}
                  testID={`paste-example-${example.id}`}
                >
                  <View
                    style={[
                      themedStyles.exampleIcon,
                      {backgroundColor: EXAMPLE_TONES[example.id].face},
                    ]}
                  >
                    <MaterialIcon
                      color={EXAMPLE_TONES[example.id].ink}
                      name={EXAMPLE_TONES[example.id].icon}
                      size={15}
                    />
                  </View>
                  <AppText style={themedStyles.exampleText}>
                    {t(example.labelKey)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
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

      <StickerFooter
        bottomInset={floatingClearance}
        note={!hasText ? t('paste.need_word') : null}
      >
        <StickerButton
          accessibilityHint={t('paste.submit_hint')}
          accessibilityLabel={t('paste.submit_a11y')}
          disabled={!canSubmit}
          icon="auto_stories"
          label={creating ? t('paste.submitting') : t('paste.submit')}
          onPress={() => {
            handleAnalyze();
          }}
          testID="paste-submit"
        />
      </StickerFooter>
    </AppScreen>
  );
}

/** Icon and colours of each example button (sticker accent tints). */
const EXAMPLE_TONES: Record<
  PasteExample['id'],
  {icon: HandoffIconName; face: string; ink: string}
> = {
  menu: {
    icon: 'restaurant_menu',
    face: HERO_PALETTE.coralRing,
    ink: HERO_PALETTE.coralShelf,
  },
  message: {
    icon: 'smartphone',
    face: HERO_PALETTE.skySoft,
    ink: HERO_PALETTE.skyInk,
  },
  email: {
    icon: 'article',
    face: HERO_PALETTE.track,
    ink: HERO_PALETTE.teal,
  },
};

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    editor: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      ...getStickerEdge(5, theme.colors.surfaceHigh),
    },
    focused: {
      borderColor: theme.colors.accent,
    },
    input: {
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
      minHeight: 128,
      paddingBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      textAlignVertical: 'top',
    },
    example: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      minHeight: 44,
      paddingLeft: 8,
      paddingRight: 12,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    examplePressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(1, theme.colors.surfaceHigh),
    },
    exampleIcon: {
      alignItems: 'center',
      borderRadius: 10,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    exampleText: {
      color: theme.colors.text.secondary,
      fontSize: 13.5,
      fontWeight: '700',
    },
  });
}

const styles = StyleSheet.create({
  intro: {
    gap: 6,
  },
  editorBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 8,
  },
  counter: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  examples: {
    gap: 10,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
