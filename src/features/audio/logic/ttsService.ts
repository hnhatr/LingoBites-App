import {Platform} from 'react-native';
import type {Voice} from 'react-native-tts';

export const TTS_LOCALE = 'en-US';
export const DEFAULT_TTS_RATE = 0.5;

/**
 * Failure codes only. The UI turns them into localized text, so this module
 * stays free of user-facing copy.
 */
export type TtsErrorCode = 'VOICE_UNAVAILABLE' | 'UNAVAILABLE';

export type TtsVoiceAvailabilityResult =
  {ok: true; available: boolean} | {ok: false; errorCode: 'UNAVAILABLE'};

export type TtsSpeakResult = {ok: true} | {ok: false; errorCode: TtsErrorCode};

export type TtsStopResult = {ok: true} | {ok: false; errorCode: 'UNAVAILABLE'};

type TtsModule = typeof import('react-native-tts').default;

let nativeTts: TtsModule | null | undefined;

/** Loads the native adapter defensively so an unlinked build remains usable. */
function getNativeTts(): TtsModule | null {
  if (nativeTts !== undefined) {
    return nativeTts;
  }

  try {
    const mod = require('react-native-tts');
    nativeTts = (mod.default ?? mod) as TtsModule;
  } catch {
    nativeTts = null;
  }
  return nativeTts;
}

function hasEnglishUsVoice(voices: Voice[]): boolean {
  return voices.some(
    voice => voice.language.toLowerCase() === TTS_LOCALE.toLowerCase(),
  );
}

/** Checks whether the device exposes an installed en-US voice. */
export async function isEnUsVoiceAvailable(): Promise<TtsVoiceAvailabilityResult> {
  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  try {
    await tts.getInitStatus();
    const voices = await tts.voices();
    return {ok: true, available: hasEnglishUsVoice(voices)};
  } catch {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }
}

function normalizeRate(rate: number): number {
  if (rate >= 1.0 || rate <= 0) {
    return DEFAULT_TTS_RATE;
  }
  return rate;
}

/**
 * Speaks confirmed English text using the device's en-US TTS voice. Any
 * speech already playing is stopped first, so rapid taps never overlap.
 */
export async function speak(
  text: string,
  locale: string = TTS_LOCALE,
  rate: number = DEFAULT_TTS_RATE,
): Promise<TtsSpeakResult> {
  if (locale.toLowerCase() !== TTS_LOCALE.toLowerCase()) {
    return {ok: false, errorCode: 'VOICE_UNAVAILABLE'};
  }

  const availability = await isEnUsVoiceAvailable();
  if (!availability.ok) {
    return availability;
  }
  if (!availability.available) {
    return {ok: false, errorCode: 'VOICE_UNAVAILABLE'};
  }

  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  try {
    if (
      Platform.OS === 'ios' &&
      typeof tts.setIgnoreSilentSwitch === 'function'
    ) {
      try {
        await tts.setIgnoreSilentSwitch('ignore');
      } catch {
        // Safe to ignore if unsupported
      }
    }
    await tts.setDefaultLanguage(TTS_LOCALE);
    try {
      await tts.setDefaultRate(normalizeRate(rate));
    } catch {
      // If setting rate fails, continue speaking with default rate
    }
    try {
      await tts.stop();
    } catch {
      // Nothing was playing, or the adapter cannot stop; speak anyway.
    }
    tts.speak(text);
    return {ok: true};
  } catch {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }
}

/** Stops current speech; stopping an idle or unavailable adapter is safe. */
export async function stop(): Promise<TtsStopResult> {
  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  try {
    await tts.stop();
    return {ok: true};
  } catch {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }
}
