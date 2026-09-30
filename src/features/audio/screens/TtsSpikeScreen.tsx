import React, {useEffect, useMemo, useState} from 'react';
import {Platform, ScrollView, StyleSheet, View} from 'react-native';
import Tts, {type Voice} from 'react-native-tts';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

const SENTENCE = 'The quick brown fox jumps over the lazy dog.';
const LOCALE = 'en-US';

export function TtsSpikeScreen() {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [status, setStatus] = useState('Initializing native TTS…');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const englishVoices = voices.filter(
    voice => voice.language.toLowerCase() === LOCALE.toLowerCase(),
  );

  useEffect(() => {
    let mounted = true;

    const loadNativeTts = async () => {
      try {
        await Tts.getInitStatus();
        const availableVoices = await Tts.voices();
        if (mounted) {
          setVoices(availableVoices);
          setStatus(
            availableVoices.some(
              voice => voice.language.toLowerCase() === LOCALE.toLowerCase(),
            )
              ? `Ready — found ${LOCALE} voice(s).`
              : `Ready — no ${LOCALE} voice reported by the device.`,
          );
        }
      } catch (error) {
        if (mounted) {
          setStatus(`Initialization failed: ${formatError(error)}`);
        }
      }

      return undefined;
    };

    void loadNativeTts();

    const onStart = () => mounted && setIsSpeaking(true);
    const onFinish = () => mounted && setIsSpeaking(false);
    const onCancel = () => mounted && setIsSpeaking(false);
    const onError = () => {
      if (mounted) {
        setIsSpeaking(false);
        setStatus('Playback error event received from native TTS.');
      }
    };

    Tts.addEventListener('tts-start', onStart);
    Tts.addEventListener('tts-finish', onFinish);
    Tts.addEventListener('tts-cancel', onCancel);
    if (Platform.OS === 'android') {
      Tts.addEventListener('tts-error', onError);
    }

    return () => {
      mounted = false;
      Tts.removeEventListener('tts-start', onStart);
      Tts.removeEventListener('tts-finish', onFinish);
      Tts.removeEventListener('tts-cancel', onCancel);
      if (Platform.OS === 'android') {
        Tts.removeEventListener('tts-error', onError);
      }
      void Tts.stop();
    };
  }, []);

  async function handleSpeak() {
    try {
      await Tts.setDefaultLanguage(LOCALE);
      Tts.speak(SENTENCE);
      setStatus(`Speaking ${LOCALE} sentence on ${Platform.OS}.`);
    } catch (error) {
      setIsSpeaking(false);
      setStatus(`Language setup failed: ${formatError(error)}`);
    }
  }

  async function handleStop() {
    await Tts.stop();
    setIsSpeaking(false);
    setStatus('Stopped.');
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={themedStyles.content}>
        <AppText variant="h2">Native TTS spike</AppText>
        <AppText color="secondary">
          RN 0.85.3 · New Architecture · {Platform.OS}
        </AppText>

        <AppCard style={themedStyles.card}>
          <AppText variant="h3">Sentence</AppText>
          <AppText>{SENTENCE}</AppText>
          <View style={themedStyles.actions}>
            <AppButton
              title="Speak sentence"
              onPress={() => {
                handleSpeak();
              }}
              disabled={isSpeaking}
              testID="tts-speak"
            />
            <AppButton
              title="Stop"
              variant="secondary"
              onPress={() => {
                handleStop();
              }}
              disabled={!isSpeaking}
              testID="tts-stop"
            />
          </View>
          <AppText color="secondary" accessibilityLiveRegion="polite">
            {status}
          </AppText>
        </AppCard>

        <AppCard style={themedStyles.card}>
          <AppText variant="h3">Voice inventory</AppText>
          <AppText color="secondary">
            Tts.voices() returned {voices.length} voice(s);{' '}
            {englishVoices.length} matched {LOCALE}.
          </AppText>
          {englishVoices.length === 0 ? (
            <AppText color="danger">
              No installed {LOCALE} voice was reported. The speak attempt above
              records the device fallback or native error.
            </AppText>
          ) : (
            englishVoices.slice(0, 8).map(voice => (
              <AppText key={voice.id} variant="caption">
                {voice.name || voice.id} · {voice.language} ·{' '}
                {voice.networkConnectionRequired ? 'network' : 'offline'}
              </AppText>
            ))
          )}
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actions: {
      gap: theme.spacing.sm,
    },
    card: {
      gap: theme.spacing.sm,
    },
    content: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
  });
}
