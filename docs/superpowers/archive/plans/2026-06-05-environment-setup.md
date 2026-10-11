# Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Phase 0 local/staging/production environment configuration across mobile (iOS schemes, Android flavors, `react-native-config`) and API (`loadEnv`), with safe committed templates, gitignored real env files, and verification that mock vs real AI paths and native bundle IDs resolve per environment.

**Architecture:** Mobile reads only public-safe vars via `getAppConfig()`; native bundle IDs, app names, icons, and versions come from build-time `react-native-config` wiring (iOS `Config.xcconfig` + scheme pre-actions; Android product flavors + `envConfigFiles`). Backend keeps AI/OCR secrets in `LingoBites-Server/.env` or hosting secret stores. Three environments only: `local`, `staging`, `production` — no shared cloud `development` env.

**Tech Stack:** React Native 0.85 CLI, `react-native-config` 1.6, Fastify API (`dotenv`), Xcode schemes/xcconfig, Gradle product flavors, Jest (mobile), Node test runner (API).

**Source spec:** `docs/superpowers/specs/2026-06-05-environment-setup-design.md`

**Current repo gaps (baseline — verify before each task):**

- Root `.gitignore` does not exclude real env files or `ios/tmp.xcconfig`
- `.env.example` missing `APP_ENV`, native build vars; default port is `3001` (spec/API use `3000`)
- `package.json` references `Development`/`Staging`/`Production` schemes and `stagingDebug`, but iOS has only `ScanLearnEnglish` scheme + `Debug`/`Release`; Android has no flavors
- `cross-env` used in `ios:*` scripts but not listed in `this repo` dependencies
- `src/shared/api/appConfig.ts` has no `APP_ENV`, `AI_SCHEMA_VERSION`, or production safety guards
- `LingoBites-Server/src/config/env.ts` has no `APP_ENV` or `aiSchemaVersion`
- iOS `Info.plist` hard-codes `CFBundleDisplayName` and `UILaunchStoryboardName`
- Android `build.gradle` has no `react-native-config` or flavors; `android:production` points at generic `debug`

**Preserve (do not remove):** Existing safe runtime vars already used by the app — `USE_MOCK_OCR`, `SUPPORT_EMAIL`, `ANALYTICS_PROVIDER`. The spec's template is the minimum; these stay in `.env.example` with comments.

**Explicitly out of scope:** CodePush keys/deps, Firebase/analytics hosting setup, deployment to staging/production hosting, store credential setup, flavor-specific icon binaries (document placeholders only unless assets already exist).

---

## File Structure

**Create:**

- `ios/Config.xcconfig` — includes generated `tmp.xcconfig`, maps env keys to Xcode settings
- `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Development.xcscheme`
- `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Staging.xcscheme`
- `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Production.xcscheme`
- `src/shared/api/__tests__/appConfig.test.ts`
- `LingoBites-Server/test/envConfig.test.ts`
- `scripts/verify-env-setup.sh` — runs automated checks from spec Testing section

**Modify:**

- `.gitignore`
- `.env.example`
- `LingoBites-Server/.env.example`
- `package.json` — `cross-env` devDep + fix `android:*` scripts
- `jest.setup.js` — extend `react-native-config` mock
- `src/shared/api/appConfig.ts`
- `android/app/build.gradle`
- `android/build.gradle` (if `react-native-config` root apply needed)
- `ios/Podfile` — map custom build configurations for CocoaPods
- `ios/ScanLearnEnglish/Info.plist`
- `ios/ScanLearnEnglish.xcodeproj/project.pbxproj` — 6 target + 6 project build configs
- `LingoBites-Server/src/config/env.ts`

**Do not commit (developer creates locally from `.env.example`):**

- `.env.development`, `.env.staging`, `.env.production`
- `LingoBites-Server/.env`

---

## Conventions

- Commands from repo root unless noted; mobile-native steps use `cd .`.
- Mobile unit tests: `npm run mobile:test -- --testPathPattern=<file> -v`
- API tests: `npm run api:test`
- After iOS `pbxproj`/Podfile changes: `cd ios && bundle exec pod install`
- Use `APP_ENV` (not `ENV`) everywhere
- Local mobile `APP_ENV=local` (not `development`)

---

## Task 1: Gitignore and env templates

**Files:**

- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `LingoBites-Server/.env.example`

- [ ] **Step 1: Update root `.gitignore`**

Append to `.gitignore`:

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

- [ ] **Step 2: Replace `.env.example`**

```text
# Runtime (JS via react-native-config)
APP_ENV=local
API_BASE_URL=http://localhost:3000
USE_MOCK_AI=true
AI_SCHEMA_VERSION=ai-output-v1

# Existing app features (safe — no provider secrets)
USE_MOCK_OCR=true
SUPPORT_EMAIL=support@lingobites.app
ANALYTICS_PROVIDER=console

# Build-time native (iOS/Android — consumed by native build, not JS)
APP_NAME=LingoBites Dev
IOS_BUNDLE_ID=com.yourcompany.lingobites.dev
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIcon

ANDROID_BUNDLE_ID=com.yourcompany.lingobites.dev
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1

LAUNCH_SCREEN_NAME=LaunchScreen
```

- [ ] **Step 3: Update `LingoBites-Server/.env.example`**

Add `APP_ENV` at the top (keep existing keys):

```text
APP_ENV=local
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# AI (M2) — mock | openai | gemini
AI_PROVIDER=mock
AI_API_KEY=
AI_MODEL=

# OCR (M3) — mock | google-vision | apple-vision
OCR_PROVIDER=mock
OCR_API_KEY=

MAX_TEXT_LENGTH=3000
MAX_IMAGE_BYTES=5242880

LOG_SENSITIVE_CONTENT=false
LOG_LEVEL=info
AI_SCHEMA_VERSION=ai-output-v1
```

- [ ] **Step 4: Create local env files (not committed)**

Run from `this repo`:

```bash
cp .env.example .env.development
```

Edit `.env.development` to match spec (key values):

```text
APP_ENV=local
APP_NAME=LingoBites Dev
API_BASE_URL=http://localhost:3000
USE_MOCK_AI=true
AI_SCHEMA_VERSION=ai-output-v1
USE_MOCK_OCR=true
SUPPORT_EMAIL=support@lingobites.app
ANALYTICS_PROVIDER=console
IOS_BUNDLE_ID=com.yourcompany.lingobites.dev
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIcon
ANDROID_BUNDLE_ID=com.yourcompany.lingobites.dev
ANDROID_APP_VERSION_NAME=1.0.0
ANDROID_APP_VERSION_CODE=1
LAUNCH_SCREEN_NAME=LaunchScreen
```

Similarly create `.env.staging` and `.env.production` from spec §Env File Examples (use placeholder HTTPS domains). These files stay local.

Run from `LingoBites-Server`:

```bash
cp .env.example .env
```

- [ ] **Step 5: Commit templates only**

```bash
git add .gitignore .env.example LingoBites-Server/.env.example
git commit -m "chore: gitignore real env files and expand env templates"
```

---

## Task 2: Mobile `getAppConfig()` — types, guards, tests

**Files:**

- Modify: `src/shared/api/appConfig.ts`
- Create: `src/shared/api/__tests__/appConfig.test.ts`
- Modify: `jest.setup.js`

- [ ] **Step 1: Write failing tests**

Create `src/shared/api/__tests__/appConfig.test.ts`:

```typescript
import Config from 'react-native-config';
import {getAppConfig} from '../appConfig';

const mockedConfig = Config as jest.Mocked<typeof Config>;

describe('getAppConfig', () => {
  beforeEach(() => {
    mockedConfig.API_BASE_URL = 'http://localhost:3000';
    mockedConfig.USE_MOCK_AI = 'true';
    mockedConfig.USE_MOCK_OCR = 'true';
    mockedConfig.APP_ENV = 'local';
    mockedConfig.AI_SCHEMA_VERSION = 'ai-output-v1';
    mockedConfig.SUPPORT_EMAIL = 'support@lingobites.app';
  });

  it('parses local defaults with mock AI', () => {
    const config = getAppConfig();
    expect(config.appEnv).toBe('local');
    expect(config.apiBaseUrl).toBe('http://localhost:3000');
    expect(config.useMockAi).toBe(true);
    expect(config.aiSchemaVersion).toBe('ai-output-v1');
  });

  it('strips trailing slashes from API_BASE_URL', () => {
    mockedConfig.API_BASE_URL = 'http://localhost:3000/';
    expect(getAppConfig().apiBaseUrl).toBe('http://localhost:3000');
  });

  it('throws in __DEV__ when API_BASE_URL is missing', () => {
    mockedConfig.API_BASE_URL = '';
    expect(() => getAppConfig()).toThrow(/API_BASE_URL/);
  });

  it('throws in __DEV__ when production uses mock AI', () => {
    mockedConfig.APP_ENV = 'production';
    mockedConfig.USE_MOCK_AI = 'true';
    mockedConfig.API_BASE_URL = 'https://api.example.com';
    expect(() => getAppConfig()).toThrow(/USE_MOCK_AI/);
  });

  it('requires HTTPS API_BASE_URL for staging', () => {
    mockedConfig.APP_ENV = 'staging';
    mockedConfig.API_BASE_URL = 'http://insecure.example.com';
    mockedConfig.USE_MOCK_AI = 'false';
    expect(() => getAppConfig()).toThrow(/HTTPS/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest src/shared/api/__tests__/appConfig.test.ts -v`

Expected: FAIL — `appEnv` / `aiSchemaVersion` missing, guards not implemented.

- [ ] **Step 3: Implement `appConfig.ts`**

Replace `src/shared/api/appConfig.ts`:

```typescript
import Config from 'react-native-config';
import {DEFAULT_SUPPORT_EMAIL} from '../appMetadata';

export type AppEnvLabel = 'local' | 'staging' | 'production';

export type AppConfig = {
  appEnv: AppEnvLabel;
  apiBaseUrl: string;
  useMockAi: boolean;
  useMockOcr: boolean;
  aiSchemaVersion: string;
  supportEmail: string;
};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value.trim().toLowerCase() === 'true';
}

function parseAppEnv(value: string | undefined): AppEnvLabel {
  if (value === 'staging' || value === 'production') {
    return value;
  }
  return 'local';
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveApiBaseUrl(appEnv: AppEnvLabel): string {
  const raw = Config.API_BASE_URL?.trim() ?? '';
  if (__DEV__ && !raw) {
    throw new Error(
      'API_BASE_URL is required. Copy .env.example to .env.development.',
    );
  }
  const normalized = normalizeBaseUrl(raw || 'http://localhost:3000');
  if (__DEV__ && appEnv !== 'local' && !normalized.startsWith('https://')) {
    throw new Error(`APP_ENV=${appEnv} requires HTTPS API_BASE_URL`);
  }
  return normalized;
}

function assertProductionSafety(appEnv: AppEnvLabel, useMockAi: boolean): void {
  if (__DEV__ && appEnv === 'production' && useMockAi) {
    throw new Error('USE_MOCK_AI must be false when APP_ENV=production');
  }
}

export function getAppConfig(): AppConfig {
  const appEnv = parseAppEnv(Config.APP_ENV);
  const useMockAi = parseBool(Config.USE_MOCK_AI, true);
  assertProductionSafety(appEnv, useMockAi);

  return {
    appEnv,
    apiBaseUrl: resolveApiBaseUrl(appEnv),
    useMockAi,
    useMockOcr: parseBool(Config.USE_MOCK_OCR, true),
    aiSchemaVersion: Config.AI_SCHEMA_VERSION?.trim() || 'ai-output-v1',
    supportEmail: Config.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
  };
}

export function getSupportEmail(): string {
  return getAppConfig().supportEmail;
}
```

- [ ] **Step 4: Extend `jest.setup.js` mock**

Update the `react-native-config` mock block:

```javascript
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    APP_ENV: 'local',
    API_BASE_URL: 'http://localhost:3000',
    USE_MOCK_AI: 'true',
    USE_MOCK_OCR: 'true',
    AI_SCHEMA_VERSION: 'ai-output-v1',
    SUPPORT_EMAIL: 'support@lingobites.app',
  },
}));
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx jest src/shared/api/__tests__/appConfig.test.ts -v`

Expected: PASS (5 tests).

Run full mobile suite: `npm run mobile:test`

Expected: all existing tests still pass (mocks unchanged for other modules).

- [ ] **Step 6: Commit**

```bash
git add src/shared/api/appConfig.ts \
  src/shared/api/__tests__/appConfig.test.ts \
  jest.setup.js
git commit -m "feat(mobile): add APP_ENV-aware app config with dev safety guards"
```

---

## Task 3: API `loadEnv()` — `APP_ENV` and schema version

**Files:**

- Modify: `LingoBites-Server/src/config/env.ts`
- Create: `LingoBites-Server/test/envConfig.test.ts`

- [ ] **Step 1: Write failing API env test**

Create `LingoBites-Server/test/envConfig.test.ts`:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEnv} from '../src/config/env.js';

test('loadEnv defaults APP_ENV to local and aiSchemaVersion to ai-output-v1', () => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    AI_SCHEMA_VERSION: process.env.AI_SCHEMA_VERSION,
  };

  delete process.env.APP_ENV;
  delete process.env.AI_SCHEMA_VERSION;

  const env = loadEnv();
  assert.equal(env.appEnv, 'local');
  assert.equal(env.aiSchemaVersion, 'ai-output-v1');

  if (previous.APP_ENV === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previous.APP_ENV;
  if (previous.AI_SCHEMA_VERSION === undefined)
    delete process.env.AI_SCHEMA_VERSION;
  else process.env.AI_SCHEMA_VERSION = previous.AI_SCHEMA_VERSION;
});

test('loadEnv parses staging APP_ENV', () => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = 'staging';
  assert.equal(loadEnv().appEnv, 'staging');
  if (previous === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = previous;
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run api:test -- --test-name-pattern "loadEnv"`

Expected: FAIL — `appEnv` / `aiSchemaVersion` not on `AppEnv`.

- [ ] **Step 3: Extend `LingoBites-Server/src/config/env.ts`**

```typescript
export type AppEnv = {
  appEnv: 'local' | 'staging' | 'production';
  nodeEnv: string;
  host: string;
  port: number;
  aiProvider: 'mock' | 'openai' | 'gemini';
  aiApiKey: string;
  aiModel: string;
  ocrProvider: 'mock' | 'google-vision' | 'apple-vision';
  ocrApiKey: string;
  maxTextLength: number;
  maxImageBytes: number;
  logSensitiveContent: boolean;
  logLevel: string;
  aiSchemaVersion: string;
};

function parseAppEnv(value: string | undefined): AppEnv['appEnv'] {
  if (value === 'staging' || value === 'production') {
    return value;
  }
  return 'local';
}

export function loadEnv(): AppEnv {
  const aiProvider = parseAIProvider(process.env.AI_PROVIDER);

  return {
    appEnv: parseAppEnv(process.env.APP_ENV),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    aiProvider,
    aiApiKey: process.env.AI_API_KEY?.trim() ?? '',
    aiModel:
      process.env.AI_MODEL?.trim() || defaultModelForProvider(aiProvider),
    ocrProvider: parseOCRProvider(process.env.OCR_PROVIDER),
    ocrApiKey: process.env.OCR_API_KEY?.trim() ?? '',
    maxTextLength: Number(process.env.MAX_TEXT_LENGTH ?? 3000),
    maxImageBytes: Number(process.env.MAX_IMAGE_BYTES ?? 5_242_880),
    logSensitiveContent: process.env.LOG_SENSITIVE_CONTENT === 'true',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    aiSchemaVersion: process.env.AI_SCHEMA_VERSION?.trim() || 'ai-output-v1',
  };
}
```

Keep existing `parseAIProvider`, `parseOCRProvider`, `defaultModelForProvider` unchanged below.

- [ ] **Step 4: Run API tests — expect PASS**

Run: `npm run api:test`

Expected: all tests PASS including new `envConfig.test.ts` and existing `aiAnalysisProviderConfig.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add LingoBites-Server/src/config/env.ts LingoBites-Server/test/envConfig.test.ts
git commit -m "feat(api): add APP_ENV and aiSchemaVersion to typed env config"
```

---

## Task 4: Mobile package scripts and `cross-env`

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add `cross-env` devDependency**

Run from `this repo`:

```bash
npm install --save-dev cross-env@^7.0.3
```

- [ ] **Step 2: Fix Android scripts**

Update `scripts` in `package.json`:

```json
"android:dev": "react-native run-android --mode developmentDebug",
"android:staging": "react-native run-android --mode stagingDebug",
"android:production": "react-native run-android --mode productionDebug",
```

Keep existing `ios:*` and `android:build:*` scripts unchanged.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(mobile): add cross-env and wire android scripts to flavor variants"
```

> Note: `android:*` scripts will fail until Task 5 adds flavors — expected until then.

---

## Task 5: Android product flavors + `react-native-config`

**Files:**

- Modify: `android/app/build.gradle`

- [ ] **Step 1: Add `envConfigFiles` and `dotenv.gradle` at top of `build.gradle`**

Insert immediately after the `apply plugin` lines (before the `react {` block):

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

- [ ] **Step 2: Enable debuggable flavor variants in `react` block**

Uncomment and set inside `react { ... }`:

```gradle
debuggableVariants = ["developmentDebug", "stagingDebug", "productionDebug"]
```

- [ ] **Step 3: Replace `android { defaultConfig ... }` block with flavors**

Replace the `android { ... }` section (keep `ndkVersion`, `signingConfigs`, `buildTypes`, `dependencies`):

```gradle
android {
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion

    namespace "com.scanlearnenglish"

    defaultConfig {
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        // applicationId/version come from productFlavors via react-native-config
    }

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

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

- [ ] **Step 4: Verify Gradle resolves staging values**

Ensure `.env.staging` exists locally, then run:

```bash
cd android
./gradlew :app:assembleStagingDebug --console=plain 2>&1 | tail -20
```

Expected: BUILD SUCCESSFUL.

Verify merged manifest cleartext for development:

```bash
./gradlew :app:processDevelopmentDebugMainManifest --console=plain
grep -r "usesCleartextTraffic" app/build/intermediates/merged_manifest/developmentDebug/
```

Expected: `android:usesCleartextTraffic="true"` for developmentDebug.

```bash
./gradlew :app:processStagingReleaseMainManifest --console=plain
grep -r "usesCleartextTraffic" app/build/intermediates/merged_manifest/stagingRelease/
```

Expected: `android:usesCleartextTraffic="false"` for stagingRelease.

- [ ] **Step 5: Commit**

```bash
git add android/app/build.gradle
git commit -m "feat(android): add env product flavors with react-native-config mapping"
```

---

## Task 6: iOS `Config.xcconfig` and `Info.plist`

**Files:**

- Create: `ios/Config.xcconfig`
- Modify: `ios/ScanLearnEnglish/Info.plist`

- [ ] **Step 1: Create `ios/Config.xcconfig`**

```text
#include? "tmp.xcconfig"

PRODUCT_BUNDLE_IDENTIFIER = $(IOS_BUNDLE_ID)
MARKETING_VERSION = $(IOS_APP_VERSION_NAME)
CURRENT_PROJECT_VERSION = $(IOS_APP_VERSION_CODE)
ASSETCATALOG_COMPILER_APPICON_NAME = $(IOS_APP_ICON_NAME)
```

- [ ] **Step 2: Update `Info.plist` substitutions**

In `ios/ScanLearnEnglish/Info.plist`, change:

```xml
<key>CFBundleDisplayName</key>
<string>$(APP_NAME)</string>
```

and:

```xml
<key>UILaunchStoryboardName</key>
<string>$(LAUNCH_SCREEN_NAME)</string>
```

Remove hard-coded `ScanLearnEnglish` display name and hard-coded `LaunchScreen` if still literal.

- [ ] **Step 3: Commit**

```bash
git add ios/Config.xcconfig ios/ScanLearnEnglish/Info.plist
git commit -m "feat(ios): add Config.xcconfig and plist env substitutions"
```

---

## Task 7: iOS build configurations in `project.pbxproj` + Podfile

**Files:**

- Modify: `ios/ScanLearnEnglish.xcodeproj/project.pbxproj`
- Modify: `ios/Podfile`

This task duplicates the existing `Debug`/`Release` target and project configurations into six environment-specific names and points the **target** configs at `Config.xcconfig`.

- [ ] **Step 1: Add `Config.xcconfig` file reference to pbxproj**

In Xcode (recommended) or by editing `project.pbxproj`:

1. Add `Config.xcconfig` to the project navigator under `ios/`
2. Duplicate target build configurations:
   - `Debug` → `DebugDev`, `DebugStag`, `DebugProd`
   - `Release` → `ReleaseDev`, `ReleaseStag`, `ReleaseProd`
3. Duplicate project-level configurations with the same six names
4. For each **target** configuration (`DebugDev` … `ReleaseProd`):
   - Set **Based on Configuration File** → `Config.xcconfig`
   - Remove hard-coded `PRODUCT_BUNDLE_IDENTIFIER`, `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`, `ASSETCATALOG_COMPILER_APPICON_NAME` from `buildSettings` (xcconfig owns them)
5. Update both `XCConfigurationList` sections to list all six configurations; set default to `DebugDev` for target list

Naming must match scripts exactly: `DebugDev`, `ReleaseDev`, `DebugStag`, `ReleaseStag`, `DebugProd`, `ReleaseProd`.

- [ ] **Step 2: Map custom configurations in `Podfile`**

Add before `target 'ScanLearnEnglish' do`:

```ruby
project 'ScanLearnEnglish',
  'DebugDev' => :debug,
  'ReleaseDev' => :release,
  'DebugStag' => :debug,
  'ReleaseStag' => :release,
  'DebugProd' => :debug,
  'ReleaseProd' => :release
```

- [ ] **Step 3: Reinstall pods**

```bash
cd ios && bundle exec pod install
```

Expected: Pod generates `Pods-ScanLearnEnglish.debugdev.xcconfig` (and siblings) without errors.

- [ ] **Step 4: Commit**

```bash
git add ios/Podfile \
  ios/ScanLearnEnglish.xcodeproj/project.pbxproj \
  ios/Podfile.lock
git commit -m "feat(ios): add per-env Xcode build configurations for react-native-config"
```

---

## Task 8: iOS schemes with pre-actions

**Files:**

- Create: `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Development.xcscheme`
- Create: `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Staging.xcscheme`
- Create: `ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/Production.xcscheme`

Use `ScanLearnEnglish.xcscheme` as template. For each scheme, set:

| Scheme        | Run/Test/Analyze config | Archive config | Env copy source    |
| ------------- | ----------------------- | -------------- | ------------------ |
| `Development` | `DebugDev`              | `ReleaseDev`   | `.env.development` |
| `Staging`     | `DebugStag`             | `ReleaseStag`  | `.env.staging`     |
| `Production`  | `DebugProd`             | `ReleaseProd`  | `.env.production`  |

- [ ] **Step 1: Add Build Pre-action to each scheme**

In _Edit Scheme → Build → Pre-actions_ (shell script, provide build settings from target `ScanLearnEnglish`):

**Development example:**

```bash
set -e
ENV_SOURCE="${PROJECT_DIR}/../.env.development"
cp "${ENV_SOURCE}" "${PROJECT_DIR}/../.env"
"${SRCROOT}/../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" "${SRCROOT}/.." "${SRCROOT}/tmp.xcconfig"
```

Swap `.env.development` → `.env.staging` / `.env.production` for other schemes.

- [ ] **Step 2: Verify `xcodebuild` resolves staging build settings**

Ensure `.env.staging` exists locally, then:

```bash
cd ios
xcodebuild -workspace ScanLearnEnglish.xcworkspace -scheme Staging -configuration DebugStag -showBuildSettings 2>/dev/null | egrep 'PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION|CURRENT_PROJECT_VERSION|ASSETCATALOG_COMPILER_APPICON_NAME|INFOPLIST_KEY_CFBundleDisplayName'
```

Expected: values match `.env.staging` (`IOS_BUNDLE_ID`, version fields, icon name). If empty or default `org.reactjs.native.example`, pre-action or `Config.xcconfig` wiring is incomplete — fix before proceeding.

Repeat for Production:

```bash
xcodebuild -workspace ScanLearnEnglish.xcworkspace -scheme Production -configuration ReleaseProd -showBuildSettings 2>/dev/null | egrep 'PRODUCT_BUNDLE_IDENTIFIER|MARKETING_VERSION'
```

- [ ] **Step 3: Commit schemes**

```bash
git add ios/ScanLearnEnglish.xcodeproj/xcshareddata/xcschemes/
git commit -m "feat(ios): add Development/Staging/Production schemes with env pre-actions"
```

---

## Task 9: Environment verification script

**Files:**

- Create: `scripts/verify-env-setup.sh`

- [ ] **Step 1: Create verification script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Mobile unit tests =="
npm test -- --passWithNoTests 2>/dev/null || npx jest -v

echo "== API tests =="
(cd ../.. && npm run api:test)

echo "== Android assemble variants =="
(cd android && ./gradlew :app:assembleDevelopmentDebug :app:assembleStagingDebug :app:assembleProductionRelease --console=plain)

echo "== Android cleartext manifest =="
(cd android && ./gradlew :app:processDevelopmentDebugMainManifest :app:processStagingReleaseMainManifest --console=plain)

echo "== iOS build settings (requires .env.staging/.env.production locally) =="
(cd ios && xcodebuild -workspace ScanLearnEnglish.xcworkspace -scheme Staging -configuration DebugStag -showBuildSettings 2>/dev/null | grep PRODUCT_BUNDLE_IDENTIFIER || true)

echo "== Env file secret scan =="
if grep -R -E '^(AI_API_KEY|OCR_API_KEY)=' .env.example .env.development .env.staging .env.production 2>/dev/null; then
  echo "FAIL: provider secrets found in mobile env files" >&2
  exit 1
fi

echo "PASS: environment setup verification complete"
```

```bash
chmod +x scripts/verify-env-setup.sh
```

- [ ] **Step 2: Run verification**

```bash
./scripts/verify-env-setup.sh
```

Expected: ends with `PASS: environment setup verification complete`.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-env-setup.sh
git commit -m "chore(mobile): add environment setup verification script"
```

---

## Task 10: Final integration checks (spec Testing section)

Manual/automated checklist — all must pass before marking environment setup done.

- [ ] **Mobile mock path:** `USE_MOCK_AI=true` in `.env.development` → `npm run mobile:test` includes `AIAnalysisService` mock-path test PASS.

- [ ] **Mobile real path:** Set `USE_MOCK_AI=false` in `.env.development`, run API with `AI_PROVIDER=mock`, confirm `analyzeText` hits API (existing `AIAnalysisService.test.ts` API-path case; optional manual paste flow).

- [ ] **API mock provider:** `npm run api:test` PASS.

- [ ] **API gemini no key:** `aiAnalysisProviderConfig.test.ts` returns `AI_PROVIDER_ERROR` — already covered.

- [ ] **Script wiring:**

  - `yarn ios:dev` → scheme `Development`, mode `DebugDev`
  - `yarn ios:staging` → scheme `Staging`, mode `DebugStag`
  - `yarn android:dev` → `developmentDebug`
  - `yarn android:staging` → `stagingDebug`
  - `yarn android:production` → `productionDebug`

- [ ] **Side-by-side installs:** Staging + production bundle IDs differ per `.env.staging` / `.env.production` (`IOS_BUNDLE_ID`, `ANDROID_BUNDLE_ID`).

- [ ] **Git safety:** `git status` shows no `.env`, `.env.development`, `.env.staging`, `.env.production`, or `ios/tmp.xcconfig` staged.

- [ ] **Production safety:** `APP_ENV=production` + `USE_MOCK_AI=true` throws in `getAppConfig()` during `__DEV__`.

---

## Self-Review (spec coverage)

| Spec section                                  | Task(s)                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Three environments, no cloud dev              | Task 1, architecture header                                                          |
| Mobile safe vs forbidden vars                 | Task 1, 2, 10                                                                        |
| `.gitignore` rules                            | Task 1                                                                               |
| `APP_ENV` not `ENV`                           | Tasks 1–3                                                                            |
| Build-time native values (iOS/Android tables) | Tasks 5–8                                                                            |
| Runtime values via `getAppConfig()`           | Task 2                                                                               |
| CodePush deferred                             | Out of scope note                                                                    |
| Env file examples                             | Task 1 Step 4                                                                        |
| iOS schemes + xcconfig + pre-actions          | Tasks 6–8                                                                            |
| Android flavors + cleartext placeholder       | Task 5                                                                               |
| Backend config + `APP_ENV`                    | Task 3                                                                               |
| Data flow (mock vs API)                       | Tasks 2, 10                                                                          |
| Error handling / production `USE_MOCK_AI`     | Task 2                                                                               |
| Testing checklist                             | Tasks 9–10                                                                           |
| Fastlane alignment (read env at lane runtime) | No change — already uses `IOS_BUNDLE_ID` / `ANDROID_BUNDLE_ID`; depends on Tasks 5–8 |
| Preserve unrelated user changes               | Verify `git diff` before each commit; do not revert M5 analytics/privacy work        |

**Placeholder scan:** No TBD steps. All code blocks are complete.

---

## Execution notes for implementer

1. **Order matters:** Tasks 1 → 3 can run in parallel after Task 1; Task 4 before 5; Task 5 and Tasks 6–8 can parallelize only after Task 1 local env files exist; Task 9 last.
2. **iOS `pbxproj` editing** is the highest-risk step — prefer Xcode UI duplication, then verify with `xcodebuild -showBuildSettings`. Do not assume env files alone populate native settings.
3. **Do not commit** `.env.development`, `.env.staging`, `.env.production`, or `LingoBites-Server/.env`.
4. **Port alignment:** Use `3000` everywhere for local API (mobile `.env.example`, jest mocks, API `PORT`).
5. If `cross-env` is already hoisted from root `node_modules`, still add it to `devDependencies` so workspace scripts resolve reliably.
