#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -d "$HOME/.nvm/versions/node/v22.13.1/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v22.13.1/bin:$PATH"
fi

echo "== Mobile unit tests =="
yarn test --passWithNoTests

echo "== Android assemble variants =="
(cd android && ./gradlew :app:assembleDevelopmentDebug :app:assembleStagingDebug :app:assembleProductionRelease --console=plain)

echo "== Android cleartext manifest =="
(cd android && ./gradlew :app:processDevelopmentDebugMainManifest :app:processStagingReleaseMainManifest --console=plain)

echo "== iOS build settings (requires .env.staging/.env.production locally) =="
(cd ios && ENVFILE=.env.staging ../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb .. tmp.xcconfig >/dev/null)
(cd ios && xcodebuild -workspace LingoBites.xcworkspace -scheme Staging -configuration DebugStag -showBuildSettings 2>/dev/null | grep PRODUCT_BUNDLE_IDENTIFIER)
(cd ios && ENVFILE=.env.development ../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb .. tmp.xcconfig >/dev/null)
(cd ios && xcodebuild -workspace LingoBites.xcworkspace -scheme LingoBites -configuration DebugDev -showBuildSettings 2>/dev/null | grep 'PRODUCT_BUNDLE_IDENTIFIER = com.lingobites.dev')

echo "== Env file secret scan =="
if grep -R -E '^(AI_API_KEY|OCR_API_KEY)=' .env.example .env.development .env.staging .env.production 2>/dev/null; then
  echo "FAIL: provider secrets found in mobile env files" >&2
  exit 1
fi

if grep -E '^USE_MOCK_AI=true$' .env.production >/dev/null 2>&1; then
  echo "FAIL: production env must not enable mock AI" >&2
  exit 1
fi

echo "PASS: environment setup verification complete"
