/**
 * A stand-in for `@features/audio` in screen tests. Screens and activities
 * reach speech through `useSpeak` or `useScreenSpeak`; both end in the given
 * `speak` mock with the same arguments `ttsService.speak` would get.
 *
 *   jest.mock('@features/audio', () =>
 *     require('@test/support/audioModuleMock').audioModuleMock(mockSpeak),
 *   );
 */
export function audioModuleMock(
  speak: (text: string, ...options: unknown[]) => unknown,
) {
  // Required here: jest.mock factories run before the test file's imports.
  const {createContext, useContext} =
    require('react') as typeof import('react');
  const say = (text: string, rate?: number) => {
    const call =
      rate === undefined ? speak(text) : speak(text, undefined, rate);
    Promise.resolve(call).catch(() => undefined);
  };
  const SpeakContext = createContext<typeof say | null>(null);
  return {
    speak,
    stop: () => Promise.resolve({ok: true}),
    useSpeak: () => ({speak: say, notice: null}),
    SpeakContext,
    useScreenSpeak: () => useContext(SpeakContext) ?? say,
    SpeechNotice: () => null,
  };
}
