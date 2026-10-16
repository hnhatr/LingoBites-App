import {Platform} from 'react-native';
import type {Voice} from 'react-native-tts';

import {
  readPreferredVoiceId,
  savePreferredVoiceId,
} from './voicePreferenceStorage';

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

function isEnUsVoice(voice: Voice): boolean {
  return voice.language.toLowerCase() === TTS_LOCALE.toLowerCase();
}

/**
 * iOS ships novelty voices (Eloquence, "Bad News", "Bubbles", ...) under
 * en-US. They are never a sensible pronunciation model for a learner.
 */
function isNoveltyVoice(voice: Voice): boolean {
  const id = voice.id.toLowerCase();
  return id.includes('eloquence') || id.includes('speech.synthesis.voice');
}

/**
 * Android reports 100-500. The iOS bridge reports 500 for enhanced voices and
 * 300 for everything else, so premium voices are recognized by identifier.
 */
function voiceQualityScore(voice: Voice): number {
  const premium = voice.id.toLowerCase().includes('.premium.') ? 1000 : 0;
  return premium + (voice.quality ?? 0);
}

function isUsableVoice(voice: Voice): boolean {
  return isEnUsVoice(voice) && !voice.notInstalled && !isNoveltyVoice(voice);
}

/**
 * Installed en-US voices a learner can pick, most natural first: offline
 * voices before network ones (playback keeps working without a network),
 * then the highest quality. Ties keep the device's own ordering.
 */
export function rankEnUsVoices(voices: Voice[]): Voice[] {
  return voices
    .filter(isUsableVoice)
    .map((voice, index) => ({voice, index}))
    .sort((a, b) => {
      const offlineA = a.voice.networkConnectionRequired ? 0 : 1;
      const offlineB = b.voice.networkConnectionRequired ? 0 : 1;
      if (offlineA !== offlineB) {
        return offlineB - offlineA;
      }
      const quality = voiceQualityScore(b.voice) - voiceQualityScore(a.voice);
      return quality !== 0 ? quality : a.index - b.index;
    })
    .map(entry => entry.voice);
}

/**
 * Picks the most natural installed en-US voice instead of leaving the choice
 * to the device default, which is often a low-quality "compact" voice.
 */
export function pickBestEnUsVoice(voices: Voice[]): Voice | null {
  return rankEnUsVoices(voices)[0] ?? null;
}

export type TtsVoiceTier = 'premium' | 'enhanced' | 'standard';

export type TtsVoiceOption = {
  id: string;
  name: string;
  tier: TtsVoiceTier;
  networkRequired: boolean;
};

export type TtsVoiceListResult =
  | {ok: true; voices: TtsVoiceOption[]; recommendedId: string | null}
  | {ok: false; errorCode: 'UNAVAILABLE'};

function voiceTier(voice: Voice): TtsVoiceTier {
  if (voice.id.toLowerCase().includes('.premium.')) {
    return 'premium';
  }
  // iOS: 500 = enhanced. Android: QUALITY_HIGH (400) and up.
  return (voice.quality ?? 0) >= 400 ? 'enhanced' : 'standard';
}

function toVoiceOption(voice: Voice): TtsVoiceOption {
  return {
    id: voice.id,
    name: voice.name || voice.id,
    tier: voiceTier(voice),
    networkRequired: Boolean(voice.networkConnectionRequired),
  };
}

let preferredVoiceId: string | null | undefined;

async function getPreferredVoiceIdCached(): Promise<string | null> {
  if (preferredVoiceId === undefined) {
    preferredVoiceId = await readPreferredVoiceId();
  }
  return preferredVoiceId;
}

/** The voice the learner chose in settings; `null` means automatic. */
export function getPreferredVoiceId(): Promise<string | null> {
  return getPreferredVoiceIdCached();
}

/** Saves the learner's voice choice; `null` returns to automatic. */
export async function setPreferredVoiceId(id: string | null): Promise<void> {
  preferredVoiceId = id;
  await savePreferredVoiceId(id);
}

/**
 * The learner's chosen voice while it is still installed, otherwise the best
 * installed voice (a removed voice silently falls back to automatic).
 */
function resolveVoice(voices: Voice[], preferredId: string | null) {
  const ranked = rankEnUsVoices(voices);
  return ranked.find(voice => voice.id === preferredId) ?? ranked[0] ?? null;
}

async function loadEnUsVoices(
  tts: TtsModule,
): Promise<
  {ok: true; voices: Voice[]} | {ok: false; errorCode: 'UNAVAILABLE'}
> {
  try {
    await tts.getInitStatus();
    const voices = await tts.voices();
    return {ok: true, voices: voices.filter(isEnUsVoice)};
  } catch {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }
}

/** Lists the voices offered in settings, most natural first. */
export async function listEnUsVoices(): Promise<TtsVoiceListResult> {
  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  const loaded = await loadEnUsVoices(tts);
  if (!loaded.ok) {
    return loaded;
  }
  const ranked = rankEnUsVoices(loaded.voices);
  return {
    ok: true,
    voices: ranked.map(toVoiceOption),
    recommendedId: ranked[0]?.id ?? null,
  };
}

/** Checks whether the device exposes an installed en-US voice. */
export async function isEnUsVoiceAvailable(): Promise<TtsVoiceAvailabilityResult> {
  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  const loaded = await loadEnUsVoices(tts);
  if (!loaded.ok) {
    return loaded;
  }
  return {ok: true, available: loaded.voices.length > 0};
}

function normalizeRate(rate: number): number {
  if (rate >= 1.0 || rate <= 0) {
    return DEFAULT_TTS_RATE;
  }
  return rate;
}

/**
 * Speaks confirmed English text using the learner's chosen en-US voice, or the
 * best installed one. Any speech already playing is stopped first, so rapid
 * taps never overlap.
 */
export async function speak(
  text: string,
  locale: string = TTS_LOCALE,
  rate: number = DEFAULT_TTS_RATE,
): Promise<TtsSpeakResult> {
  if (locale.toLowerCase() !== TTS_LOCALE.toLowerCase()) {
    return {ok: false, errorCode: 'VOICE_UNAVAILABLE'};
  }
  return speakWithVoice(text, rate, await getPreferredVoiceIdCached());
}

/** Plays `text` with one specific voice so the learner can hear it first. */
export function previewVoice(
  voiceId: string,
  text: string,
): Promise<TtsSpeakResult> {
  return speakWithVoice(text, DEFAULT_TTS_RATE, voiceId);
}

async function speakWithVoice(
  text: string,
  rate: number,
  voiceId: string | null,
): Promise<TtsSpeakResult> {
  const tts = getNativeTts();
  if (!tts) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }

  const loaded = await loadEnUsVoices(tts);
  if (!loaded.ok) {
    return loaded;
  }
  if (loaded.voices.length === 0) {
    return {ok: false, errorCode: 'VOICE_UNAVAILABLE'};
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
    // Set after the language: setDefaultLanguage resets the native voice.
    const voice = resolveVoice(loaded.voices, voiceId);
    if (voice) {
      try {
        await tts.setDefaultVoice(voice.id);
      } catch {
        // Keep the language default voice if this one cannot be selected.
      }
    }
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
