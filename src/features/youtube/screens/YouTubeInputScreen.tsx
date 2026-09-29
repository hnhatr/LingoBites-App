import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
  type KeyboardEvent,
} from 'react-native';
import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {CreateStackParamList} from '@features/input';
import type {RootStackParamList, RootTabParamList} from '@features/home';
import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Banner} from '@ui/components/Banner';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {
  YOUTUBE_MAX_DURATION_SECONDS,
  YOUTUBE_MAX_SEGMENTS,
} from '@core/schemas/youtube-transcript-v1';
import {parseYouTubeVideoId} from '../logic/api/youtubeApi';
import {parseManualTranscript} from '../logic/transcript/parser';
import {ensureYouTubeDisclosureAcknowledged} from '../logic/utils/youtubeDisclosure';
import {useTranslation} from 'react-i18next';
import {useAppTheme} from '@ui/theme';

// SETE-316 (Option A2): typed URLs flicker valid→invalid→valid while the
// 11-char video ID is being entered, so the Step 2 reveal waits for a
// typing pause. Clipboard pastes arrive complete and open Step 2 at once.
const STEP_TWO_TYPING_DEBOUNCE_MS = 400;
const STEP_TWO_OPEN_ANIMATION_MS = 230;

if (
  Platform.OS === 'android' &&
  typeof UIManager.setLayoutAnimationEnabledExperimental === 'function'
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<CreateStackParamList, 'YouTubeInput'>;

export type YouTubeInputScreenProps = Props;

export function YouTubeInputScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();

  // SETE-316: transcript-error recovery arrives via merged params
  // (Processing navigates back to this existing instance). The URL is
  // pre-filled and Step 2 starts pre-opened — no open animation, and the
  // URL-change trigger below stays disabled for this entry.
  const transcriptRequired = route.params?.transcriptRequired;
  const isRecovery = transcriptRequired != null && transcriptRequired !== '';

  const [url, setUrl] = useState(route.params?.url ?? '');
  const [transcript, setTranscript] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [stepTwoOpen, setStepTwoOpen] = useState(isRecovery);
  const [submitting, setSubmitting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // SETE-319: keyboard-avoidance state. The transcript field used to sit
  // under the open keyboard with no way to scroll it into view; the CTA
  // moves into a sticky BottomActionBar and the focused field is scrolled
  // above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [transcriptFocused, setTranscriptFocused] = useState(false);
  const [viewportH, setViewportH] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fire-once per distinct videoId: set when Step 2 opens for an ID so
  // re-renders and repeat validations of the same link never re-trigger.
  const lastFiredVideoIdRef = useRef<string | null>(
    isRecovery ? parseYouTubeVideoId(route.params?.url ?? '') : null,
  );
  const stepTwoYRef = useRef<number | null>(null);
  const stepTwoHRef = useRef<number | null>(null);
  const scrollYRef = useRef<number | null>(null);
  const viewportHRef = useRef<number | null>(null);
  const reduceMotionRef = useRef(false);
  const recoveryHandledRef = useRef(false);
  const transcriptFocusedRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    try {
      const request = AccessibilityInfo.isReduceMotionEnabled?.();
      if (request && typeof request.then === 'function') {
        let mounted = true;
        request.then(enabled => {
          if (mounted) {
            setReduceMotion(enabled);
          }
        });
        return () => {
          mounted = false;
        };
      }
    } catch {
      // Reduce-motion is an enhancement — a lookup failure keeps animation.
    }
    return undefined;
  }, []);

  // SETE-283 (HVB-04): same entry-from-Home contract as YouTubeHistory —
  // Back returns to Home, never to CreateMain.
  // SETE-287: reset (not popToTop) so a depth-1 direct entry from Home
  // leaves no stale nested state behind.
  const exitToHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{name: 'CreateMain'}],
    });
    navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('Home');
  }, [navigation]);

  const goBack = useCallback(() => {
    if (route.params?.fromHome === true) {
      exitToHome();
      return;
    }
    // SETE-310: when this screen is the only route in the Create stack
    // (e.g. restored state), goBack() is a no-op that strands the user
    // with no path back to the composer — fall back to CreateMain.
    if (navigation.canGoBack?.() ?? true) {
      navigation.goBack();
      return;
    }
    navigation.navigate('CreateMain');
  }, [navigation, route.params, exitToHome]);

  // SETE-289: the header Back button is not the only way out. The iOS
  // swipe gesture is disabled for this screen (see AppNavigator), but the
  // Android system Back and any other native pop bypass onBack and would
  // land on CreateMain, dropping the fromHome contract. Intercept those
  // pops so every exit honors it. Non-POP removals (e.g. our own reset)
  // and non-fromHome entries pass through untouched.
  useEffect(() => {
    if (route.params?.fromHome !== true) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', e => {
      if (e.data.action.type !== 'POP') {
        return;
      }
      e.preventDefault();
      exitToHome();
    });
  }, [navigation, route.params, exitToHome]);

  const scrollStepTwoIntoView = useCallback(() => {
    const targetY = stepTwoYRef.current;
    if (targetY == null) {
      return;
    }
    const top = Math.max(0, targetY - theme.spacing.lg);
    // Skip the scroll when Step 2 is already fully visible — account for
    // the open keyboard, which covers the bottom of the viewport when
    // the trigger came from typing in the URL field.
    const scrolled = scrollYRef.current;
    const layoutH = viewportHRef.current;
    if (scrolled != null && layoutH != null) {
      const keyboardH =
        typeof Keyboard.metrics === 'function'
          ? Keyboard.metrics()?.height ?? 0
          : 0;
      const visibleTop = scrolled;
      const visibleBottom = scrolled + layoutH - keyboardH;
      const stepH = stepTwoHRef.current ?? 0;
      if (top >= visibleTop && top + stepH <= visibleBottom) {
        return;
      }
    }
    scrollRef.current?.scrollTo({
      y: top,
      animated: !reduceMotionRef.current,
    });
  }, [theme.spacing.lg]);

  // SETE-319: re-run the Step 2 visibility correction when the keyboard
  // appears or changes height (autocorrect bar, language switch, emoji)
  // while the transcript field is focused. The recovery entry auto-focuses
  // the transcript field, so this also repairs the initial race between
  // autoFocus and the keyboard animation.
  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
      if (transcriptFocusedRef.current) {
        setTimeout(() => scrollStepTwoIntoView(), 50);
      }
    };
    const onChange = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
      if (transcriptFocusedRef.current) {
        setTimeout(() => scrollStepTwoIntoView(), 50);
      }
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const changeSub = Keyboard.addListener('keyboardDidChangeFrame', onChange);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, [scrollStepTwoIntoView]);

  const handleTranscriptFocus = useCallback(() => {
    transcriptFocusedRef.current = true;
    setTranscriptFocused(true);
    // Let the keyboard start opening, then bring the field above it.
    setTimeout(() => scrollStepTwoIntoView(), 50);
  }, [scrollStepTwoIntoView]);

  const handleTranscriptBlur = useCallback(() => {
    transcriptFocusedRef.current = false;
    setTranscriptFocused(false);
  }, []);

  // Cách A: clear the transcript without a confirm dialog (PasteTextScreen
  // convention — the user can paste again from the clipboard) and without
  // touching focus, so clearing leads straight back into typing/pasting.
  const handleClearTranscript = useCallback(() => {
    setTranscript('');
    setTranscriptError(null);
  }, []);

  // SETE-319: cap the growing transcript field against the visible
  // viewport so typing never pushes the field back under the keyboard.
  const visibleViewportH =
    viewportH != null && keyboardHeight > 0
      ? Math.max(0, viewportH - keyboardHeight)
      : viewportH;
  const transcriptMaxHeight =
    visibleViewportH != null && keyboardHeight > 0
      ? // Cách A: reserve the action row (44pt + 8pt gap) below the field
        // so a full-height field never pushes the row under the keyboard.
        Math.min(280, Math.max(120, visibleViewportH * 0.4 - 52))
      : 280;

  // Hướng B: the tab bar is hidden on this screen (IMMERSIVE_STACK_ROUTES),
  // so there is no tab clearance to reserve. The CTA lives inline in the
  // scroll content at rest and only pins to a BottomActionBar while the
  // keyboard is open — no sticky "white plank" and no dead gap otherwise.
  // AppScreen already applies the bottom safe-area, and the open keyboard
  // covers the home indicator, so the pinned bar needs only a gutter.
  const keyboardOpen = keyboardHeight > 0;
  const isUrlValid = parseYouTubeVideoId(url) != null;

  const fireStepTwo = useCallback(
    (videoId: string) => {
      lastFiredVideoIdRef.current = videoId;
      if (reduceMotionRef.current) {
        setStepTwoOpen(true);
        if (typeof AccessibilityInfo.announceForAccessibility === 'function') {
          AccessibilityInfo.announceForAccessibility(
            t('youtube.input_step2_announce'),
          );
        }
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setStepTwoOpen(true);
      }
      // Scroll only after the expand animation lands — scrolling to a
      // still-expanding element computes the wrong offset.
      setTimeout(
        () => scrollStepTwoIntoView(),
        reduceMotionRef.current ? 0 : STEP_TWO_OPEN_ANIMATION_MS,
      );
    },
    [scrollStepTwoIntoView, t],
  );

  // SETE-316: typing trigger — debounced, fire-once per distinct videoId,
  // never auto-collapses (there is no close path by design). Disabled for
  // transcript-error recovery entries, which pre-open Step 2 instead.
  useEffect(() => {
    if (isRecovery) {
      return undefined;
    }
    const videoId = parseYouTubeVideoId(url);
    if (!videoId || videoId === lastFiredVideoIdRef.current) {
      return undefined;
    }
    debounceTimerRef.current = setTimeout(() => {
      // Re-check at fire time: the user may have kept typing past a
      // transiently valid ID (e.g. the 12th character invalidates it).
      if (parseYouTubeVideoId(url) === videoId) {
        fireStepTwo(videoId);
      }
    }, STEP_TWO_TYPING_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [url, isRecovery, fireStepTwo]);

  // SETE-316: recovery entry — pre-opened Step 2, no open animation, a
  // separate scroll-to-Step-2; the transcript field takes focus (via
  // autoFocus on its remounted instance) because pasting a transcript is
  // the only remaining action here.
  useEffect(() => {
    if (!isRecovery || recoveryHandledRef.current) {
      return undefined;
    }
    recoveryHandledRef.current = true;
    if (!url) {
      const prefill = route.params?.url;
      if (prefill) {
        setUrl(prefill);
      }
    }
    const currentId = parseYouTubeVideoId(route.params?.url ?? url);
    if (currentId) {
      lastFiredVideoIdRef.current = currentId;
    }
    setStepTwoOpen(true);
    const timer = setTimeout(
      () => scrollStepTwoIntoView(),
      reduceMotionRef.current ? 0 : STEP_TWO_OPEN_ANIMATION_MS,
    );
    return () => clearTimeout(timer);
    // One-shot per recovery entry; url/params are read at arrival time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecovery]);

  // SETE-283 (HVB-08a): the first submit requires explicit privacy
  // consent — the transcript leaves the device for translation/IPA.
  // Later submits skip the disclosure. Single call site for both the
  // automatic-transcript and manual-transcript submit paths.
  const submit = async () => {
    if (!parseYouTubeVideoId(url)) {
      setUrlError(t('errors.youtube_invalid_url'));
      return;
    }
    const trimmedTranscript = transcript.trim();
    let manualCues:
      | import('@core/schemas/youtube-transcript-v1').RawCue[]
      | undefined;
    if (trimmedTranscript) {
      try {
        manualCues = parseManualTranscript(transcript);
      } catch {
        setTranscriptError(t('errors.transcript_unparsable'));
        return;
      }
    }
    setSubmitting(true);
    try {
      const acknowledged = await ensureYouTubeDisclosureAcknowledged({
        title: t('youtube.disclosure_title'),
        body: t('youtube.disclosure_body'),
        confirmLabel: t('youtube.disclosure_confirm'),
        cancelLabel: t('youtube.disclosure_cancel'),
      });
      if (!acknowledged) {
        return;
      }
      // A consumed recovery flag must not linger: without this, going
      // back to this instance later would show a stale recovery banner.
      if (isRecovery) {
        navigation.setParams({transcriptRequired: undefined});
      }
      const trimmedUrl = url.trim();
      navigation.navigate(
        'YouTubeProcessing',
        manualCues ? {url: trimmedUrl, manualCues} : {url: trimmedUrl},
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pasteFromClipboard = useCallback(async () => {
    // Lazy-load the clipboard module: the native RNCClipboard TurboModule is
    // absent in binaries built before `pod install`, and a top-level import
    // crashes the whole bundle at startup. Loading it here keeps the screen
    // usable and degrades only the paste action when native linking is
    // missing.
    let clipboardText: string | null = null;
    try {
      const ClipboardModule = require('@react-native-clipboard/clipboard');
      const getString =
        ClipboardModule?.default?.getString ?? ClipboardModule?.getString;
      if (typeof getString !== 'function') {
        throw new Error('clipboard unavailable');
      }
      clipboardText = await getString();
    } catch {
      setUrlError(t('youtube.input_paste_unavailable'));
      return;
    }
    const value = (clipboardText ?? '').trim();
    if (!value) {
      setUrlError(t('youtube.input_paste_empty'));
      return;
    }
    setUrl(value);
    setUrlError(null);
    // Pastes arrive complete — no partial-typed string to wait out, so
    // reveal Step 2 immediately instead of riding the typing debounce.
    // (The URL watcher stays quiet for this ID via lastFiredVideoIdRef,
    // so this fires exactly once.)
    if (!isRecovery) {
      const pastedId = parseYouTubeVideoId(value);
      if (pastedId && pastedId !== lastFiredVideoIdRef.current) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        fireStepTwo(pastedId);
      }
    }
  }, [t, isRecovery, fireStepTwo]);

  const openHistory = useCallback(() => {
    // SETE-289: History is a RootStack route above the tabs —
    // reach it through the tab parent so the stack-id lookup
    // stays type-safe (screen nav props carry no navigator id).
    navigation
      .getParent<NavigationProp<RootTabParamList>>()
      ?.getParent<NavigationProp<RootStackParamList>>('RootStack')
      ?.navigate('YouTubeHistory');
  }, [navigation]);

  // Shared between the inline (at rest) and pinned (keyboard open)
  // placements so both keep the same testID and press behavior.
  const submitButton = (
    <AppButton
      disabled={!isUrlValid}
      loading={submitting}
      onPress={submit}
      testID="youtube-submit"
      title={t('youtube.start')}
    />
  );

  return (
    <AppScreen>
      <ScreenHeader
        onBack={goBack}
        title={t('youtube.input_title')}
        rightAction={
          <AppButton
            onPress={openHistory}
            testID="youtube-open-history"
            title={t('youtube.open_history_short')}
            variant="ghost"
          />
        }
      />
      {/* SETE-319: KeyboardAvoidingView shrinks the scroll area on iOS so
          the focused transcript field can scroll above the keyboard.
          Android already resizes via adjustResize in the manifest, so the
          behavior stays undefined there to avoid double compensation.
          offset is 0: the custom header is in normal flow inside the
          SafeAreaView, not a native-stack header above the view. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={{flex: 1}}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingTop: theme.spacing.lg,
            paddingHorizontal: theme.gutter,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.lg,
          }}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            viewportHRef.current = height;
            setViewportH(height);
          }}
          onScroll={event => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          style={{flex: 1}}
        >
          {isRecovery ? (
            <Banner
              variant="info"
              message={t('youtube.input_transcript_recovery')}
            />
          ) : null}
          <AppText variant="bodyLg">{t('youtube.input_description')}</AppText>
          <TextField
            autoCapitalize="none"
            hasError={!!urlError}
            errorMessage={urlError ?? undefined}
            editable={!submitting}
            keyboardType="url"
            label={t('youtube.input_step1_label')}
            onChangeText={value => {
              setUrl(value);
              setUrlError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            testID="youtube-url-input"
            value={url}
          />
          <AppButton
            iconLeft="content_paste"
            onPress={() => {
              pasteFromClipboard();
            }}
            style={styles.minHeight44}
            testID="youtube-paste-url"
            title={t('youtube.input_paste')}
            variant="ghost"
          />
          <AppText
            color="secondary"
            testID="youtube-input-meta"
            variant="caption"
          >
            {t('youtube.input_meta', {
              maxMinutes: Math.floor(YOUTUBE_MAX_DURATION_SECONDS / 60),
              maxSegments: YOUTUBE_MAX_SEGMENTS,
            })}
          </AppText>
          {stepTwoOpen ? (
            <View
              accessibilityLiveRegion="polite"
              onLayout={event => {
                stepTwoYRef.current = event.nativeEvent.layout.y;
                stepTwoHRef.current = event.nativeEvent.layout.height;
              }}
              style={{gap: theme.spacing.sm}}
              testID="youtube-step2"
            >
              <AppText variant="label">
                {t('youtube.input_step2_title')}
              </AppText>
              <AppText color="secondary" variant="caption">
                {t('youtube.input_step2_optional')}
              </AppText>
              <TextField
                accessibilityHint={t('youtube.input_transcript_help')}
                // Recovery remounts this field so autoFocus fires even
                // though the screen itself never remounts (Processing
                // merges params into this existing instance). The
                // auto-open trigger path must never steal focus — focus
                // stays on the URL field there — so autoFocus is set only
                // for recovery entries.
                key={isRecovery ? 'transcript-recovery' : 'transcript'}
                autoFocus={isRecovery}
                multiline
                label={t('youtube.transcript_label')}
                value={transcript}
                onChangeText={value => {
                  setTranscript(value);
                  setTranscriptError(null);
                }}
                onFocus={handleTranscriptFocus}
                onBlur={handleTranscriptBlur}
                placeholder={'0:00 Hello there\n0:04 How are you?'}
                hasError={!!transcriptError}
                errorMessage={transcriptError ?? undefined}
                editable={!submitting}
                testID="youtube-transcript-input"
                style={{
                  minHeight: 96,
                  maxHeight: transcriptMaxHeight,
                  textAlignVertical: 'top',
                }}
              />
              {/* Cách A: action row directly under the field — Done (moved
                  out of the bottom bar) next to Clear all. Visible while
                  focused or non-empty so the keyboard always has a visible
                  dismiss path; Clear stays disabled on an empty field,
                  mirroring PasteTextScreen. */}
              {transcriptFocused || transcript.length > 0 ? (
                <View
                  style={[styles.rowEnd, {gap: theme.spacing.sm}]}
                  testID="youtube-transcript-actions"
                >
                  <AppButton
                    disabled={transcript.length === 0}
                    iconLeft="delete"
                    onPress={handleClearTranscript}
                    style={styles.minHeight44}
                    testID="youtube-transcript-clear"
                    title={t('common.clear_all')}
                    variant="ghost"
                  />
                  <AppButton
                    onPress={() => Keyboard.dismiss()}
                    style={styles.minHeight44}
                    testID="youtube-transcript-done"
                    title={t('common.done')}
                    variant="ghost"
                  />
                </View>
              ) : null}
              {transcript ? (
                <AppText
                  color="secondary"
                  testID="youtube-step2-confirm"
                  variant="caption"
                >
                  {t('youtube.input_step2_confirm')}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {/* Hướng B: at rest the CTA sits in the content flow, directly
              under the meta line — no sticky bar, no dead gap. */}
          {keyboardOpen ? null : submitButton}
        </ScrollView>
        {/* Hướng B: pinned CTA exists only while the keyboard is open, so
            the field and the action stay reachable above it. Same
            background/outlineVariant treatment as PasteTextScreen so the
            bar blends with the cream background instead of reading as a
            white plank. */}
        {keyboardOpen ? (
          <BottomActionBar
            style={{
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: theme.spacing.md,
            }}
          >
            {submitButton}
          </BottomActionBar>
        ) : null}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  minHeight44: {
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  rowEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
