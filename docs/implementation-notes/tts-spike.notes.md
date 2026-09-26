## Native TTS spike (SETE-161 / AC20)

This is a disposable validation path, not the reusable `ttsService`.

### Setup

- Dependency: `react-native-tts@4.1.1`.
- React Native: `0.85.3`.
- New Architecture: `newArchEnabled=true`.
- Native installation: Yarn dependency installation plus CocoaPods integration; no manual Android package registration or patch was required because RN autolinking discovers the package.
- Demo path: Profile → Demo native TTS → Speak sentence.
- Sentence: “The quick brown fox jumps over the lazy dog.”

### Required evidence

Record the exact device/simulator, commands, voice inventory, missing-voice behavior, and offline playback result here after platform smoke runs.

| Platform | Device / OS                                        | Commands                                                       | Native setup / patch                                         | `en-US` voices            | Playback                                            | Offline                    |
| -------- | -------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- | --------------------------------------------------- | -------------------------- |
| iOS      | iPhone 17 Pro simulator, iOS 26.5                  | `yarn ios:dev`                                                 | No patch; CocoaPods autolinked `TextToSpeech (4.1.1)`        | Pending manual UI readout | App built and launched; tap/audio assertion pending | Pending manual audio check |
| Android  | No emulator/device available (`adb devices` empty) | `./gradlew app:assembleDevelopmentDebug --no-daemon` attempted | No patch; RN config reports autolinked `TextToSpeechPackage` | Pending                   | Not run                                             | Pending                    |

### API observations

- The demo calls `Tts.getInitStatus()`, `Tts.voices()`, `Tts.setDefaultLanguage('en-US')`, `Tts.speak()`, and `Tts.stop()`.
- `Tts.voices()` is displayed in the demo, including whether a voice declares `networkConnectionRequired`.
- Missing `en-US` voices are displayed explicitly; the speak attempt still runs so the device fallback or native error can be recorded rather than hidden.

### Commands and current results

- `yarn add react-native-tts@4.1.1` — passed.
- `./node_modules/.bin/react-native config` — passed; reports iOS podspec and Android `TextToSpeechPackage` autolinking.
- `bundle exec pod install --project-directory=ios` — passed; `TextToSpeech (4.1.1)` installed and New Architecture configured.
- `yarn ios:dev` — passed build and launch on the iPhone 17 Pro simulator.
- `./gradlew app:assembleDevelopmentDebug --no-daemon` — not runnable in this environment: Java runtime is unavailable.
- `adb devices` — no Android device/emulator listed.

Playback, voice inventory, missing-voice behavior, and offline behavior remain manual evidence items because this terminal session has no UI/audio assertion channel and no Android runtime.
