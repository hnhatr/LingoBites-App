# LingoBites Environment Setup Design

Date: 2026-06-05

## Scope

This design defines the Phase 0 environment model for LingoBites across mobile and API surfaces. It covers local development, staging, and production configuration for M2 onward, with the same security boundary already required by the BA docs: mobile receives only safe configuration, while AI/OCR provider secrets live only on the backend.

This spec does not implement the environment files, deployment scripts, hosting setup, Firebase setup, OCR provider setup, analytics, crash reporting, authentication, payment, or post-P0 module flags.

## Canonical Inputs

- `docs/01-ba/DECISIONS.md` D-007: Phase 0 real AI provider is `gemini` by default with model `gemini-2.0-flash`; `openai` remains available.
- `docs/01-ba/02-technical/milestones/M2-brief.md`: M2 requires backend real AI, mobile API client, and `USE_MOCK_AI`.
- `docs/01-ba/02-technical/12-api-backend-development-rules.md` (LingoBites-Server repo): backend env, secret, test, and logging rules.
- `docs/01-ba/02-technical/01-technical-implementation-spec.md` section 11: build/provider env flags.
- `docs/01-ba/07-release/04-public-app-setup-checklist.md` sections 8 and 13: local/staging/production model and mobile env safety.

## Environment Model

Use three environments:

| Env          | Mobile build                          | API URL                                      | Provider keys                             | Purpose            |
| ------------ | ------------------------------------- | -------------------------------------------- | ----------------------------------------- | ------------------ |
| `local`      | Debug build                           | `http://localhost:3000` or local machine URL | none by default; optional limited dev key | daily development  |
| `staging`    | TestFlight / Android internal testing | team-owned staging HTTPS API domain          | staging AI/OCR keys with low quota        | QA and closed beta |
| `production` | Store / public beta                   | team-owned production HTTPS API domain       | production AI/OCR keys with budget alert  | real users         |

Do not create a separate shared cloud `development` environment for Phase 0. It adds deploy and secret management surface before the core loop is complete. Local development plus staging is sufficient until team size or QA flow proves otherwise.

## Mobile Configuration

Mobile configuration must remain public-safe. It may include:

```text
APP_ENV=local|staging|production
APP_NAME=LingoBites
API_BASE_URL=https://configured-api-origin
USE_MOCK_AI=true|false
AI_SCHEMA_VERSION=ai-output-v1

IOS_BUNDLE_ID=com.yourcompany.lingobites
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIcon

ANDROID_BUNDLE_ID=com.yourcompany.lingobites
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1

LAUNCH_SCREEN_NAME=LaunchScreen
```

Mobile configuration must not include:

```text
AI_API_KEY
OCR_API_KEY
FIREBASE_SERVICE_ACCOUNT
APPLE_API_KEY
GOOGLE_PLAY_SERVICE_ACCOUNT
```

Recommended local files:

| File               | Commit? | Purpose                 |
| ------------------ | ------- | ----------------------- |
| `.env.example`     | yes     | safe template only      |
| `.env.development` | no      | local debug config      |
| `.env.staging`     | no      | staging build config    |
| `.env.production`  | no      | production build config |

### Version Control And `.gitignore`

The repo `.gitignore` must be updated as part of environment setup. Real env files must never be committed.

Add at minimum:

```gitignore
# Mobile env (real values never committed)
.env
.env.*
!.env.example

# API local env
LingoBites-Server/.env
!LingoBites-Server/.env.example

# react-native-config iOS codegen
ios/tmp.xcconfig
```

Implementation must commit only `.env.example` templates. Do not commit `.env.development`, `.env.staging`, `.env.production`, or any file containing team-specific URLs, bundle IDs, or keys.

Use `APP_ENV`; do not introduce a separate `ENV` variable. `ENV` is too generic and can conflict with shell, CI, or third-party tool conventions.

Local mobile defaults should keep `USE_MOCK_AI=true` so M1 mock lesson rendering remains available. For M2 real-AI testing, set `USE_MOCK_AI=false` and point `API_BASE_URL` at a running backend.

### Build-Time Native Values

These values configure the generated iOS/Android app binary and should be consumed by native build settings:

| Variable                   | iOS                                  | Android            | Runtime JS needs it? |
| -------------------------- | ------------------------------------ | ------------------ | -------------------- |
| `APP_NAME`                 | `CFBundleDisplayName`                | `@string/app_name` | optional             |
| `IOS_BUNDLE_ID`            | `PRODUCT_BUNDLE_IDENTIFIER`          | no                 | no                   |
| `IOS_APP_VERSION_NAME`     | `MARKETING_VERSION`                  | no                 | no                   |
| `IOS_APP_VERSION_CODE`     | `CURRENT_PROJECT_VERSION`            | no                 | no                   |
| `IOS_APP_ICON_NAME`        | `ASSETCATALOG_COMPILER_APPICON_NAME` | no                 | no                   |
| `LAUNCH_SCREEN_NAME`       | `UILaunchStoryboardName`             | no                 | no                   |
| `ANDROID_BUNDLE_ID`        | no                                   | `applicationId`    | no                   |
| `ANDROID_APP_VERSION_NAME` | no                                   | `versionName`      | optional             |
| `ANDROID_APP_VERSION_CODE` | no                                   | `versionCode`      | no                   |

These values are build-time native config. Do not rely on JavaScript to decide bundle IDs, version codes, app icon names, or launch screen names.

### Runtime Values

These values may be read by the TypeScript app through a single wrapper such as `getAppConfig()`:

| Variable            | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `APP_ENV`           | app environment label for diagnostics and conditional safe behavior |
| `API_BASE_URL`      | backend origin for `/v1/*` routes                                   |
| `USE_MOCK_AI`       | switches M1 fixture path vs M2 API path                             |
| `AI_SCHEMA_VERSION` | expected AI schema version label                                    |

### CodePush (Deferred — Not Phase 0)

CodePush (`react-native-code-push`) is **not** in Phase 0 scope. The repo does not include this dependency today.

During M2 environment setup, do **not**:

- add `react-native-code-push` or related native wiring
- add `IOS_CODE_PUSH_KEY` / `ANDROID_CODE_PUSH_KEY` to env templates or examples
- add Android `resValue` entries for CodePush keys
- add CodePush assertions to the testing checklist

When CodePush is added in a post-P0 milestone, document separate staging and production deployment keys then. Those keys are public in the app binary but must remain environment-specific.

### Env File Examples

`.env.development`:

```text
APP_ENV=local
APP_NAME=LingoBites Dev
API_BASE_URL=http://localhost:3000
USE_MOCK_AI=true
AI_SCHEMA_VERSION=ai-output-v1

IOS_BUNDLE_ID=com.yourcompany.lingobites.dev
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIconDev

ANDROID_BUNDLE_ID=com.yourcompany.lingobites.dev
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1

LAUNCH_SCREEN_NAME=LaunchScreen
```

`.env.staging`:

```text
APP_ENV=staging
APP_NAME=LingoBites Staging
API_BASE_URL=https://team-owned-staging-api-domain
USE_MOCK_AI=false
AI_SCHEMA_VERSION=ai-output-v1

IOS_BUNDLE_ID=com.yourcompany.lingobites.staging
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIconStaging

ANDROID_BUNDLE_ID=com.yourcompany.lingobites.staging
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1

LAUNCH_SCREEN_NAME=LaunchScreen
```

`.env.production`:

```text
APP_ENV=production
APP_NAME=LingoBites
API_BASE_URL=https://team-owned-production-api-domain
USE_MOCK_AI=false
AI_SCHEMA_VERSION=ai-output-v1

IOS_BUNDLE_ID=com.yourcompany.lingobites
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIcon

ANDROID_BUNDLE_ID=com.yourcompany.lingobites
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1

LAUNCH_SCREEN_NAME=LaunchScreen
```

Development and staging should use visibly different app names and icons from production so testers can identify the installed app quickly.

## iOS Native Build Design

iOS should use separate schemes and build configurations per environment. The repo already has scripts that expect this shape:

```text
yarn ios:dev        -> scheme Development, mode DebugDev, ENVFILE=.env.development
yarn ios:staging    -> scheme Staging, mode DebugStag, ENVFILE=.env.staging
yarn ios:production -> scheme Production, mode DebugProd, ENVFILE=.env.production
```

Required schemes:

| Scheme        | Run configuration | Archive configuration | Env file           |
| ------------- | ----------------- | --------------------- | ------------------ |
| `Development` | `DebugDev`        | `ReleaseDev`          | `.env.development` |
| `Staging`     | `DebugStag`       | `ReleaseStag`         | `.env.staging`     |
| `Production`  | `DebugProd`       | `ReleaseProd`         | `.env.production`  |

The Archive action must use the matching release configuration. Do not archive staging with a production configuration, and do not archive production with a staging configuration.

Required iOS build setting mapping:

| Xcode setting / Info.plist key       | Value                     |
| ------------------------------------ | ------------------------- |
| `PRODUCT_BUNDLE_IDENTIFIER`          | `$(IOS_BUNDLE_ID)`        |
| `MARKETING_VERSION`                  | `$(IOS_APP_VERSION_NAME)` |
| `CURRENT_PROJECT_VERSION`            | `$(IOS_APP_VERSION_CODE)` |
| `ASSETCATALOG_COMPILER_APPICON_NAME` | `$(IOS_APP_ICON_NAME)`    |
| `CFBundleDisplayName`                | `$(APP_NAME)`             |
| `UILaunchStoryboardName`             | `$(LAUNCH_SCREEN_NAME)`   |

### `react-native-config` iOS Wiring

Env files alone do not populate Xcode build settings. Implementation must wire `react-native-config` so the substitutions above resolve at build time.

Required steps:

1. Create `ios/Config.xcconfig`:

   ```text
   #include? "tmp.xcconfig"
   ```

2. For each build configuration (`DebugDev`, `ReleaseDev`, `DebugStag`, `ReleaseStag`, `DebugProd`, `ReleaseProd`), set **Based on Configuration File** to `Config.xcconfig` (or a per-env xcconfig that includes it).

3. Add a **Scheme Pre-action** per scheme under _Edit Scheme → Build → Pre-actions_. Set **Provide build settings from** to the app target so `$SRCROOT` and `$PROJECT_DIR` are available. Each scheme must select its env file before the build:

   ```bash
   cp "${PROJECT_DIR}/../.env.development" "${PROJECT_DIR}/../.env"
   ```

   Use `.env.staging` for `Staging` and `.env.production` for `Production`. The repo's `yarn ios:*` scripts already export `ENVFILE`; the Pre-action copy (or equivalent `ENVFILE` wiring via Podfile `post_install`) must still run **before** `BuildXCConfig.rb`.

4. In the same Pre-action (after the env file is selected), regenerate `ios/tmp.xcconfig`:

   ```bash
   "${SRCROOT}/../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" "${SRCROOT}/.." "${SRCROOT}/tmp.xcconfig"
   ```

5. Map env keys to native build settings in `Config.xcconfig` (or per-configuration overrides). `BuildXCConfig.rb` exports env keys into `tmp.xcconfig`, but Xcode still needs explicit mapping for standard settings:

   ```text
   PRODUCT_BUNDLE_IDENTIFIER = $(IOS_BUNDLE_ID)
   MARKETING_VERSION = $(IOS_APP_VERSION_NAME)
   CURRENT_PROJECT_VERSION = $(IOS_APP_VERSION_CODE)
   ASSETCATALOG_COMPILER_APPICON_NAME = $(IOS_APP_ICON_NAME)
   ```

   `APP_NAME` and `LAUNCH_SCREEN_NAME` are available from `tmp.xcconfig` for Info.plist substitution.

6. Add `ios/tmp.xcconfig` to `.gitignore` (see Version Control section).

Alternative: set `ENVFILE` per build configuration in the Podfile `post_install` hook for the `react-native-config` pod (see `react-native-config` README, iOS multi-scheme). Either Pre-action copy or Podfile `ENVFILE` mapping is acceptable; do not rely on both without verifying the last writer wins correctly.

`Info.plist` should use build setting substitution instead of hard-coded values:

```xml
<key>CFBundleDisplayName</key>
<string>$(APP_NAME)</string>
<key>CFBundleIdentifier</key>
<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleShortVersionString</key>
<string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key>
<string>$(CURRENT_PROJECT_VERSION)</string>
<key>UILaunchStoryboardName</key>
<string>$(LAUNCH_SCREEN_NAME)</string>
```

Prefer `.xcconfig` files for stable native configuration if build settings become hard to maintain in Xcode UI. Each environment/configuration must include the generated `tmp.xcconfig` via `Config.xcconfig` and then set the build settings above. If using Xcode UI directly, the same values must still be present per build configuration.

Implementation must verify that Xcode resolves `$(IOS_BUNDLE_ID)`, `$(IOS_APP_VERSION_NAME)`, `$(IOS_APP_VERSION_CODE)`, `$(IOS_APP_ICON_NAME)`, `$(APP_NAME)`, and `$(LAUNCH_SCREEN_NAME)` for every build configuration. If these values do not appear in `xcodebuild -showBuildSettings`, the iOS `react-native-config` integration is incomplete — do not assume env files alone are sufficient.

Staging and production must use different bundle identifiers so both apps can be installed on the same device.

## Android Native Build Design

Android should use product flavors for environment-specific application IDs, versions, app names, and runtime resource values. The repo currently has `android:staging` using `--mode stagingDebug`; implementation should make that variant real through flavors.

Required flavors:

| Flavor        | Build variants                           | Env file           |
| ------------- | ---------------------------------------- | ------------------ |
| `development` | `developmentDebug`, `developmentRelease` | `.env.development` |
| `staging`     | `stagingDebug`, `stagingRelease`         | `.env.staging`     |
| `production`  | `productionDebug`, `productionRelease`   | `.env.production`  |

Required `react-native-config` Gradle mapping:

```gradle
project.ext.envConfigFiles = [
    developmentdebug: ".env.development",
    developmentrelease: ".env.development",
    stagingdebug: ".env.staging",
    stagingrelease: ".env.staging",
    productiondebug: ".env.production",
    productionrelease: ".env.production",
]

apply from: project(":react-native-config").projectDir.getPath() + "/dotenv.gradle"
```

The `envConfigFiles` keys must match lowercase Gradle variant names. If a variant is renamed, update this map in the same change.

Required Android flavor mapping:

```gradle
flavorDimensions "env"

productFlavors {
    development {
        dimension "env"
        applicationId project.env.get("ANDROID_BUNDLE_ID")
        versionName project.env.get("ANDROID_APP_VERSION_NAME")
        versionCode project.env.get("ANDROID_APP_VERSION_CODE").toInteger()
        resValue "string", "app_name", project.env.get("APP_NAME")
        manifestPlaceholders = [usesCleartextTraffic: "true"]
    }
    staging {
        dimension "env"
        applicationId project.env.get("ANDROID_BUNDLE_ID")
        versionName project.env.get("ANDROID_APP_VERSION_NAME")
        versionCode project.env.get("ANDROID_APP_VERSION_CODE").toInteger()
        resValue "string", "app_name", project.env.get("APP_NAME")
        manifestPlaceholders = [usesCleartextTraffic: "false"]
    }
    production {
        dimension "env"
        applicationId project.env.get("ANDROID_BUNDLE_ID")
        versionName project.env.get("ANDROID_APP_VERSION_NAME")
        versionCode project.env.get("ANDROID_APP_VERSION_CODE").toInteger()
        resValue "string", "app_name", project.env.get("APP_NAME")
        manifestPlaceholders = [usesCleartextTraffic: "false"]
    }
}
```

### Android Cleartext Traffic (Local HTTP)

`AndroidManifest.xml` already references `android:usesCleartextTraffic="${usesCleartextTraffic}"`. Each flavor must set `manifestPlaceholders` as shown above:

| Flavor        | `usesCleartextTraffic` | Reason                                 |
| ------------- | ---------------------- | -------------------------------------- |
| `development` | `true`                 | local API uses `http://localhost:3000` |
| `staging`     | `false`                | HTTPS-only API                         |
| `production`  | `false`                | HTTPS-only API                         |

Without the development placeholder, local HTTP calls fail silently or at runtime even when `API_BASE_URL` is correct. Do not hard-code cleartext in the manifest; keep the placeholder so flavor config controls it.

`AndroidManifest.xml` should continue to use resources, not hard-coded labels:

```xml
<application
    android:label="@string/app_name"
    ...>
</application>
```

Android app icons can be handled by flavor source sets if environment-specific icons are needed:

```text
android/app/src/development/res/mipmap-*/...
android/app/src/staging/res/mipmap-*/...
android/app/src/production/res/mipmap-*/...
```

Do not try to switch Android launcher icons from JavaScript runtime config. Launcher icons are native resources selected at build time.

Required Android scripts:

```text
yarn android:dev        -> developmentDebug
yarn android:staging    -> stagingDebug
yarn android:production -> productionDebug
```

Release/upload scripts must use release variants:

```text
yarn android:build:staging    -> stagingRelease
yarn android:build:production -> productionRelease
```

Do not leave `android:production` pointing at the generic `debug` variant after flavors are added. That would build with default config instead of production env config.

## Backend Configuration

Backend configuration owns provider selection and secrets:

```text
APP_ENV=local|staging|production
NODE_ENV=development|production
PORT=3000
HOST=0.0.0.0
AI_PROVIDER=mock|gemini|openai
AI_API_KEY=backend-secret-value
AI_MODEL=provider-model-name
OCR_PROVIDER=mock|google-vision|apple-vision
OCR_API_KEY=backend-secret-value
MAX_TEXT_LENGTH=3000
MAX_IMAGE_BYTES=5242880
LOG_SENSITIVE_CONTENT=false
LOG_LEVEL=info
AI_SCHEMA_VERSION=ai-output-v1
```

Recommended local files and hosting secrets:

| Location                                 | Commit? | Purpose                   |
| ---------------------------------------- | ------- | ------------------------- |
| `LingoBites-Server/.env.example`         | yes     | safe template only        |
| `LingoBites-Server/.env`                 | no      | local backend config      |
| hosting secret store, staging service    | no      | staging runtime config    |
| hosting secret store, production service | no      | production runtime config |

For Phase 0 local development, backend should default to `AI_PROVIDER=mock`. For real-AI testing, use `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.0-flash`, and a limited non-production `AI_API_KEY`.

## Data Flow

1. Mobile reads safe env values through `react-native-config`.
2. If `USE_MOCK_AI=true`, mobile uses the M1 fixture path.
3. If `USE_MOCK_AI=false`, mobile sends confirmed text to `${API_BASE_URL}/v1/ai/analyze`.
4. Backend reads provider settings and secrets from its runtime env.
5. Backend calls the selected AI provider, validates output with `validateAIOutput()`, and returns the canonical envelope.
6. Mobile renders only validated API output or a safe error state.

Mobile never calls AI/OCR provider domains directly.

## Environment Behavior

### Local

- Mobile: `APP_ENV=local`, `API_BASE_URL=http://localhost:3000`, `USE_MOCK_AI=true` by default.
- iOS: `Development` scheme with development bundle ID, development app name, and development app icon.
- Android: `development` flavor with development application ID, development app name, and development app icon resources if provided.
- API: `APP_ENV=local`, `NODE_ENV=development`, `AI_PROVIDER=mock` by default.
- Real AI is opt-in by setting `USE_MOCK_AI=false` on mobile and real backend AI env values.

### Staging

- Mobile: `APP_ENV=staging`, `API_BASE_URL=https://team-owned-staging-api-domain`, `USE_MOCK_AI=false`.
- iOS: `Staging` scheme with staging bundle ID, staging app name, and staging app icon.
- Android: `staging` flavor with staging application ID, staging app name, and staging app icon resources if provided.
- API: `APP_ENV=staging`, `NODE_ENV=production`, staging provider keys, `LOG_SENSITIVE_CONTENT=false`.
- Staging keys must have low quota or budget alerts.

### Production

- Mobile: `APP_ENV=production`, `API_BASE_URL=https://team-owned-production-api-domain`, `USE_MOCK_AI=false`.
- iOS: `Production` scheme with production bundle ID, production app name, and production app icon.
- Android: `production` flavor with production application ID, production app name, and production app icon resources.
- API: `APP_ENV=production`, `NODE_ENV=production`, production provider keys, `LOG_SENSITIVE_CONTENT=false`.
- Production must not point to staging API or use staging provider keys.

## Error Handling And Safety

- Missing or invalid `API_BASE_URL` should fail visibly during development and be caught before release.
- Missing `APP_NAME`, bundle ID, app version, or version code values should fail the native build rather than silently falling back to production values.
- Missing backend `AI_API_KEY` with a real provider should return `AI_PROVIDER_ERROR` through the canonical API envelope.
- Sensitive values and raw user content must not be logged.
- `.env` files with real values must remain uncommitted.
- Store, TestFlight, and Play builds must use HTTPS API URLs.
- Production builds must not allow `USE_MOCK_AI=true`.

## Testing

Minimum checks before considering environment setup complete:

- Mobile mock path still works with `USE_MOCK_AI=true`.
- Mobile real path calls `/v1/ai/analyze` with `USE_MOCK_AI=false`.
- API tests pass with mock provider.
- API returns `AI_PROVIDER_ERROR` when `AI_PROVIDER=gemini` has no `AI_API_KEY`.
- Staging build points only to the configured staging HTTPS API domain.
- Production build points only to the configured production HTTPS API domain.
- Mobile env files contain no `AI_API_KEY` or `OCR_API_KEY`.
- `yarn ios:dev` uses `Development` scheme, `DebugDev`, and `.env.development`.
- `yarn ios:staging` uses `Staging` scheme, `DebugStag`, and `.env.staging`.
- `yarn ios:production` uses `Production` scheme, `DebugProd`, and `.env.production`.
- iOS archives use matching release configs: `ReleaseDev`, `ReleaseStag`, `ReleaseProd`.
- Android `developmentDebug`, `stagingDebug`, and `productionDebug` read their matching env files.
- Android release builds use matching env files: `developmentRelease`, `stagingRelease`, `productionRelease`.
- `./gradlew :app:assembleStagingDebug` resolves the staging application ID, app name, version, and API base URL.
- `./gradlew :app:assembleProductionRelease` resolves the production application ID, app name, version, and API base URL.
- `./gradlew :app:assembleDevelopmentDebug` sets `usesCleartextTraffic=true` (verify merged manifest).
- `./gradlew :app:assembleStagingRelease` sets `usesCleartextTraffic=false` (verify merged manifest).
- `xcodebuild -showBuildSettings -scheme Staging -configuration DebugStag` shows staging values for bundle ID, app name, app icon, version name, and version code.
- `xcodebuild -showBuildSettings -scheme Production -configuration ReleaseProd` shows production values for bundle ID, app name, app icon, version name, and version code.
- Staging and production install side by side on iOS and Android because bundle IDs/application IDs differ.
- Production build has production app name, production icon, production API URL, and `USE_MOCK_AI=false`.
- `.gitignore` excludes real mobile/API env files but allows `.env.example` templates.
- `ios/tmp.xcconfig` is gitignored and regenerated on build.

## Implementation Notes

The repo already has mobile scripts for `.env.development`, `.env.staging`, and `.env.production`, plus Fastlane local build scripts for staging and production. The iOS scripts already expect `Development`, `Staging`, and `Production` schemes with `DebugDev`, `DebugStag`, and `DebugProd` modes. Android scripts already expect at least `stagingDebug`; implementation should complete the flavor matrix rather than add a parallel mechanism.

**Fastlane alignment (done in scaffold cleanup):** `fastlane/Fastfile` no longer hard-codes identifiers from the previous project. It now:

| Setting                   | Source                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| iOS bundle ID             | `IOS_BUNDLE_ID` from `.env.staging` / `.env.production` at lane runtime         |
| Android package name      | `ANDROID_BUNDLE_ID` from matching env files                                     |
| Xcode project / workspace | `ios/ScanLearnEnglish.xcodeproj`, `ios/ScanLearnEnglish.xcworkspace`            |
| IPA output name           | `LingoBites-{Scheme}.ipa`                                                       |
| Android release variants  | `stagingRelease`, `productionRelease` (requires product flavors from this spec) |
| Apple development team    | `IOS_DEVELOPMENT_TEAM` in `.env.ios-build.local` (not committed)                |

Before any TestFlight or Play upload, ensure `.env.staging` / `.env.production` exist with real bundle IDs, Android flavors are implemented, and store credentials (`APP_STORE_CONNECT_*`, `PLAY_STORE_JSON_KEY_FILE`, provisioning profiles) are filled in locally.

The API currently has a single `.env.example` and typed config for provider values. Implementation should align these existing pieces instead of introducing a new environment framework.

If implementation adds or formalizes `APP_ENV`, it should be added consistently to typed API config, mobile app config, examples, and tests.

Before implementation, verify whether the existing uncommitted mobile native changes already created any of these schemes, configurations, Fastlane lanes, or Android flavors. Preserve unrelated user changes and fill only the missing pieces.
