import {createContext, useContext} from 'react';

import {speak} from './ttsService';

export type SpeakText = (text: string, rate?: number) => void;

/**
 * Lets a screen hand its `useSpeak().speak` to the activities inside it, so a
 * failed playback shows in the screen's notice instead of being dropped.
 */
export const SpeakContext = createContext<SpeakText | null>(null);

/** Without a screen above it, speech still plays; a failure stays silent. */
const speakWithoutNotice: SpeakText = (text, rate) => {
  speak(text, undefined, rate).catch(() => undefined);
};

export function useScreenSpeak(): SpeakText {
  return useContext(SpeakContext) ?? speakWithoutNotice;
}
