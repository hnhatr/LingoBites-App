# iOS Staging → TestFlight CI

Workflow file: `.github/workflows/ios-staging.yml`

Manual-dispatch only (`workflow_dispatch`). It always builds the `Staging` scheme /
`ReleaseStag` configuration via the existing Fastlane lane `fastlane ios staging`
(see `fastlane/Fastfile`) and uploads to TestFlight. There is no input parameter
and no trigger that can reach the `production` lane/scheme/bundle id.

## Required GitHub secrets

Set these as repository (or environment) **secrets** — never commit values, never echo them in a step:

| Secret                                  | Used for                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `IOS_APP_STORE_CONNECT_KEY_ID`          | App Store Connect API key id                                                    |
| `IOS_APP_STORE_CONNECT_ISSUER_ID`       | App Store Connect API key issuer id                                             |
| `IOS_APP_STORE_CONNECT_API_KEY`         | Base64-encoded `.p8` App Store Connect API key content                          |
| `IOS_DEVELOPMENT_TEAM`                  | Apple Developer Team ID used for code signing                                   |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`   | Base64-encoded Apple Distribution `.p12` containing its private key             |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Password used when the Apple Distribution `.p12` was exported                   |
| `IOS_PROVISIONING_PROFILE_BASE64`       | Base64-encoded App Store Connect `.mobileprovision` for the staging bundle id   |
| `IOS_APPLE_ID`                          | Optional. Apple ID, only needed if fastlane falls back to it                    |
| `IOS_APP_STORE_CONNECT_TEAM_ID`         | Optional. App Store Connect team id, only needed for accounts on multiple teams |

Create the Base64 values on macOS without printing them to the terminal:

```sh
base64 < "LingoBites-Apple-Distribution.p12" | pbcopy
base64 < "LingoBites-Staging-AppStore.mobileprovision" | pbcopy
```

Paste each clipboard value into the corresponding secret in the GitHub
`staging` environment. The workflow decodes both files under `$RUNNER_TEMP`,
imports the certificate into Fastlane's temporary keychain, installs the
provisioning profile, and removes the materialized files during cleanup.

## Required GitHub variables

Set these as repository (or environment) **variables** (`vars.*`, not secrets — see the
"Materialize .env.staging" step comment in the workflow for why these are not treated
as secret):

| Variable                | Used for                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STAGING_API_BASE_URL`  | Staging backend base URL, written into `.env.staging`                                                                                                 |
| `STAGING_IOS_BUNDLE_ID` | Staging iOS bundle id (e.g. `com.lingobites.staging`), written into `.env.staging` and asserted against the resolved Xcode bundle id before archiving |

`.env.staging` itself is gitignored and never committed. The workflow rebuilds it
each run from the committed `.env.example` template with only the staging-specific
keys above overridden, so its structure can't drift from what
`react-native-config` expects.

## How to run it

Via the Actions tab: open **Actions → iOS Staging TestFlight → Run workflow** on
the branch you want to build, no inputs to fill in.

Via the CLI:

```sh
gh workflow run ios-staging.yml
```

## How to verify a run succeeded

- The job's "Build and upload to TestFlight" step logs the fastlane summary,
  including the archived build number (derived from `IOS_APP_BUILD_NUMBER` /
  `BUILD_NUMBER` if set, otherwise a UTC timestamp, so it's always unique) and
  the IPA name `LingoBites-Staging.ipa`.
- App Store Connect → TestFlight → the Staging app shows the new build once
  Apple finishes processing it (the job does not wait for processing —
  `skip_waiting_for_build_processing: true`).

## Recovery if a run fails partway

Re-dispatching the workflow is always safe: the build number is derived fresh
on every run (see above), so a retry never collides with a previous attempt.
No manual cleanup is required between attempts — the job's cleanup step runs
`if: always()` and removes the locally materialized `.env.staging`, Xcode
config, certificate, provisioning profile, and temporary keychain regardless
of how the job ended.
