# Android Release → Google Play CI

Workflow file: `.github/workflows/android-release.yml`

Manual-dispatch only (`workflow_dispatch`). Inputs:

- `env`: `staging` or `production`. Selects the GitHub Environment (and therefore its secrets), the env file `.env.<env>` and the Fastlane lane `fastlane android <env>` (see `fastlane/Fastfile`).
- `track`: Google Play track (`internal`, `alpha`, `beta`, `production`).

Give the `production` GitHub Environment required reviewers so a production build always needs approval.

## Required GitHub secrets (per environment: `staging`, `production`)

| Secret                       | Used for                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `APP_ENV_FILE`               | Full content of `.env.staging` / `.env.production` (app config for the build)    |
| `ANDROID_KEYSTORE_BASE64`    | Base64-encoded upload keystore (`.jks`)                                          |
| `ANDROID_KEYSTORE_PASSWORD`  | Upload keystore password                                                         |
| `ANDROID_KEY_ALIAS`          | Upload key alias                                                                 |
| `ANDROID_KEY_PASSWORD`       | Upload key password                                                              |
| `PLAY_STORE_JSON_KEY_BASE64` | Base64-encoded Google Play service account JSON                                  |

Optional repository/environment **variable**: `ANDROID_VERSION_CODE_OFFSET` (default `0`).

`APP_ENV_FILE` is bundled into the app by `react-native-config`, so it must never contain signing passwords or other credentials. Signing values come from `.env.android-build.local` and stay in their own secrets.

## Setting / updating the secrets

```sh
# App config: re-run whenever .env.staging / .env.production changes
yarn env:push:staging
yarn env:push:production

# Signing values (only the three keys; the *_FILE paths are local-only)
grep -E '^(ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_ALIAS|ANDROID_KEY_PASSWORD)=' .env.android-build.local > /tmp/signing.env
gh secret set -f /tmp/signing.env --env staging
gh secret set -f /tmp/signing.env --env production
rm /tmp/signing.env

# Binary files (on macOS use `base64 -i <file>`)
for e in staging production; do
  base64 -w0 android/app/lingobites-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 --env $e
  base64 -w0 android/app/play-service-account.json | gh secret set PLAY_STORE_JSON_KEY_BASE64 --env $e
done
```

## Version code

The workflow overwrites `ANDROID_APP_VERSION_CODE` with `github.run_number + ANDROID_VERSION_CODE_OFFSET`, so every upload is unique. If a build was already uploaded with a higher version code (for example a manual first upload), set `ANDROID_VERSION_CODE_OFFSET` above it. `ANDROID_APP_VERSION_NAME` comes from `APP_ENV_FILE`.

## Prerequisites on Google Play

- The app exists in Play Console with package name = `ANDROID_BUNDLE_ID`, and the first AAB was uploaded manually (Play rejects API uploads before that).
- Play App Signing is enabled; the keystore above is the upload key.
- The service account is invited in Play Console → Users and permissions with release permissions for each app.

## How to run it

Actions → **Android Release Google Play** → Run workflow, or:

```sh
gh workflow run android-release.yml -f env=staging -f track=internal
```

The built AAB is also attached to the run as an artifact for 14 days.
