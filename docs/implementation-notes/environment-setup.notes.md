# Implementation Notes: Environment Setup

## Task Summary

Wire Phase 0 local, staging, and production environment configuration across mobile and API while keeping real env values out of commits.

## Assumptions

- The user-provided environment setup plan is the task-specific scope for native iOS/Android environment wiring even though it exceeds the M2 milestone allowlist.
- Existing unrelated modified files are user changes and must be preserved.
- Local env files may be created for verification but must not be staged or committed.

## Decisions

- Work in the current checkout because the user explicitly requested executing the plan at this path.
- Preserve the existing `LingoBites-Server/.env` rather than overwriting it because it already existed locally and may contain developer-specific values.
- Android uses hoisted repo-root `node_modules`, so Gradle paths were made explicit rather than assuming app-local `node_modules`.
- iOS uses hoisted repo-root `node_modules`, so scheme pre-actions invoke `react-native-config` from `${SRCROOT}/../../../node_modules/...`.

## Changes from Spec

- The planned focused Jest command used `-v`, which this Jest version rejects. Verification used `npx jest src/shared/api/__tests__/appConfig.test.ts` instead.
- iOS target configs use wrapper xcconfig files that include CocoaPods generated configs first, then shared `Config.xcconfig`; this avoids CocoaPods base-configuration warnings while keeping one shared env-driven config.
- The verification script pins the known working Node 22 path when present because the shell default Node 26/x64 caused an esbuild architecture mismatch in this workspace.
- Review follow-up changed the generic mobile `ios`/`android` scripts to development variants and updated the legacy `ScanLearnEnglish` iOS scheme to regenerate development env settings.

## Tradeoffs / Risks

- `.env` was tracked and modified at baseline; review follow-up removed it from the git index while preserving the local file.
- iOS project file edits are high risk and require verification with Xcode tooling.
- Android release manifest processing triggers a JS/Hermes bundle task in this Gradle setup; verification depends on a correct hoisted Hermes compiler path.
- `bundle install` was needed locally for CocoaPods execution and installed gems under `vendor/bundle`, but the generated Bundler lockfile churn was removed because it was not part of the environment setup.

## Files Changed

| File                                                                              | Change                                                                                                                                       | Reason                                                                                  |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/implementation-notes/environment-setup.notes.md`                            | Created implementation notes                                                                                                                 | Required by `rules/impl-notes.md`                                                       |
| `.gitignore`                                                                      | Added real mobile/API env and iOS tmp xcconfig ignores                                                                                       | Prevent committing env values and generated react-native-config files                   |
| `.env.example`                                                                    | Added `APP_ENV`, local API port 3000, schema, preserved safe feature flags, and native build vars                                            | Provide safe committed mobile env template                                              |
| `LingoBites-Server/.env.example`                                                  | Added `APP_ENV=local`                                                                                                                        | Align API env template with typed environment config                                    |
| `LingoBites-Server/test/envConfig.test.ts`                                        | Added tests for default and staging `APP_ENV` plus schema version                                                                            | Verify API env parsing                                                                  |
| `LingoBites-Server/src/config/env.ts`                                             | Added typed `appEnv`, `ocrApiKey`, `logLevel`, and `aiSchemaVersion`                                                                         | Align backend env config with Phase 0 plan                                              |
| `package.json`                                                                    | Added `cross-env` devDependency and changed Android run scripts to flavor modes                                                              | Make mobile scripts resolve env-specific native variants                                |
| `package-lock.json`                                                               | Added `cross-env` package metadata                                                                                                           | Keep npm workspace lockfile consistent                                                  |
| `yarn.lock`                                                                       | Added `cross-env` package metadata                                                                                                           | Keep existing yarn lockfile consistent                                                  |
| `android/app/build.gradle`                                                        | Added env file map, react-native-config dotenv apply, explicit hoisted RN paths, Hermes path, debuggable variants, and three product flavors | Support env-specific Android bundle IDs/names/cleartext flags                           |
| `android/settings.gradle`                                                         | Pointed React Native Gradle plugin includeBuild at repo-root `node_modules`                                                                  | Required because dependencies are hoisted in this workspace                             |
| `.env.development`                                                                | Created ignored local development env                                                                                                        | Required for native env verification                                                    |
| `.env.staging`                                                                    | Created ignored local staging env with placeholder HTTPS API URL                                                                             | Required for native env verification                                                    |
| `.env.production`                                                                 | Created ignored local production env with placeholder HTTPS API URL                                                                          | Required for native env verification                                                    |
| `src/shared/api/__tests__/appConfig.test.ts`                                      | Added coverage for `APP_ENV`, schema version, URL normalization, and safety guards                                                           | Verify mobile runtime config behavior                                                   |
| `src/shared/api/appConfig.ts`                                                     | Added `APP_ENV`, `aiSchemaVersion`, port 3000 default, HTTPS guard, and production mock-AI guard                                             | Align mobile config with Phase 0 env plan                                               |
| `jest.setup.js`                                                                   | Extended `react-native-config` mock and local API port 3000                                                                                  | Keep tests aligned with runtime env                                                     |
| `src/shared/api/__tests__/analyzeClient.test.ts`                                  | Updated expected local API URL from 3001 to 3000                                                                                             | Match canonical local API port                                                          |
| `src/shared/api/__tests__/ocrClient.test.ts`                                      | Updated expected local API URL from 3001 to 3000                                                                                             | Match canonical local API port                                                          |
| `ios/Config.xcconfig`                                                             | Added shared env-driven iOS build settings                                                                                                   | Let schemes provide bundle ID, app name, version, and icon from env files               |
| `ios/Config-*.xcconfig`                                                           | Added per-configuration wrappers around CocoaPods configs and shared `Config.xcconfig`                                                       | Preserve CocoaPods settings with custom project configurations                          |
| `ios/ScanLearnEnglish/Info.plist`                                                 | Switched display name and launch storyboard to build settings                                                                                | Support env-specific iOS branding values                                                |
| `ios/Podfile`                                                                     | Added custom Debug/Release config mapping for Dev/Staging/Prod                                                                               | Let CocoaPods generate env-specific support files                                       |
| `ios/Podfile.lock`                                                                | Updated after `pod install` with custom configurations                                                                                       | Keep CocoaPods lockfile consistent                                                      |
| `ios/ScanLearnEnglish.xcodeproj/project.pbxproj`                                  | Added custom iOS configurations and base xcconfigs                                                                                           | Support Development, Staging, and Production schemes                                    |
| `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/*.xcscheme`                | Added shared Development, Staging, and Production schemes                                                                                    | Provide explicit iOS build/run entry points per environment                             |
| `scripts/verify-env-setup.sh`                                                     | Added repeatable environment verification script                                                                                             | Run mobile/API tests, Android builds/manifests, iOS build settings, and env secret scan |
| `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/ScanLearnEnglish.xcscheme` | Updated legacy default scheme to use development configs and regenerate development env                                                      | Prevent default Xcode scheme from using stale `tmp.xcconfig` values                     |

## Tests / Verification

- Baseline `git status --short` showed existing modified files: `.env`, `SavedLessonDetailScreen.test.tsx`, and `src/shared/api/types.ts`.
- `npx jest src/shared/api/__tests__/appConfig.test.ts -v` failed before running tests because `-v` is not recognized by this Jest CLI.
- `npx jest src/shared/api/__tests__/appConfig.test.ts` passed: 5 tests.
- `npm run mobile:test` initially failed due stale `3001` URL expectations in API client tests.
- `npm run mobile:test` passed after updating stale expected local API URLs: 28 suites, 86 tests.
- `npm run api:test -- --test-name-pattern loadEnv` first failed under sandbox because `tsx` could not create an IPC pipe.
- Escalated `npm run api:test -- --test-name-pattern loadEnv` failed as expected before implementation: missing `appEnv`.
- Escalated `npm run api:test` passed after implementation: 33 tests.
- `npm install --save-dev cross-env@^7.0.3` failed under sandbox with DNS `ENOTFOUND`.
- Escalated `npm install --save-dev cross-env@^7.0.3` succeeded with 0 vulnerabilities.
- Non-escalated `cd android && ./gradlew :app:assembleStagingDebug --console=plain` failed because Gradle could not write `~/.gradle` wrapper lock under sandbox.
- Escalated `./gradlew :app:assembleStagingDebug --console=plain` initially failed on hoisted `node_modules` paths; after Gradle path fixes it passed: `BUILD SUCCESSFUL in 6m 13s`.
- Escalated `./gradlew :app:processDevelopmentDebugMainManifest --console=plain` passed.
- Escalated `./gradlew :app:processStagingReleaseMainManifest --console=plain` initially failed on Hermes command path; after absolute hoisted Hermes path it passed.
- `rg usesCleartextTraffic android/app/build/intermediates/merged_manifest/developmentDebug` found `android:usesCleartextTraffic="true"`.
- `rg usesCleartextTraffic android/app/build/intermediates/merged_manifest/stagingRelease` found `android:usesCleartextTraffic="false"`.
- Escalated `bundle install` in `this repo` installed CocoaPods gems locally; `arch -arm64 bundle exec pod install` passed after matching the platform architecture.
- `xcodebuild -workspace ios/ScanLearnEnglish.xcworkspace -scheme Staging -configuration DebugStag -showBuildSettings` passed and showed `PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.lingobites.staging`, `APP_NAME = LingoBites Staging`, and `ASSETCATALOG_COMPILER_APPICON_NAME = AppIconStaging`.
- `ENVFILE=.env.production ... BuildXCConfig.rb` plus `xcodebuild -workspace ios/ScanLearnEnglish.xcworkspace -scheme Production -configuration ReleaseProd -showBuildSettings` passed and showed `PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.lingobites`, `APP_NAME = LingoBites`, and `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`.
- `xcodebuild -list -workspace ios/ScanLearnEnglish.xcworkspace` showed the `Development`, `Staging`, and `Production` schemes.
- Escalated `./scripts/verify-env-setup.sh` passed end to end:
  - mobile Jest: 28 suites, 86 tests
  - API Vitest: 33 tests
  - Android assemble: development debug, staging debug, production release
  - Android manifest checks: development cleartext true, staging release cleartext false
  - iOS staging build settings: staging bundle ID detected
  - env secret scan: no committed template/local env key names matched the blocked secret pattern
- Review follow-up verification added:
  - production mock-AI env guard in mobile config and verifier
  - legacy `ScanLearnEnglish` scheme development bundle ID check
  - `git rm --cached .env` to keep local env ignored and unstaged
- After review fixes, escalated `./scripts/verify-env-setup.sh` passed end to end:
  - mobile Jest: 29 suites, 97 tests
  - API Node tests: 33 tests
  - Android assemble: development debug, staging debug, production release
  - Android manifest checks: development cleartext true, staging release cleartext false
  - iOS build settings: staging bundle ID and legacy development bundle ID detected
  - env secret scan and production mock-AI scan passed

## Review Notes

- Pay close attention to native build configuration names and real env files accidentally entering git.
- `.env` should appear as deleted from the index for the next commit, while the local file remains on disk and ignored after commit.
