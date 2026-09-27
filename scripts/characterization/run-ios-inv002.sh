#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${CHAR_PORT:-41293}"
METRO_PORT="${CHAR_METRO_PORT:-8081}"
LOG_FILE="${CHAR_LOG:-./ios-inv002-characterization.log}"
ENV_FILE=".env.characterization"
ENV_BACKUP_DIR=".ling93-env-backup"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${METRO_PID:-}" ]]; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  if [[ -n "${LOG_PID:-}" ]]; then
    kill "$LOG_PID" 2>/dev/null || true
  fi
  if [[ -d "$ENV_BACKUP_DIR" ]]; then
    if [[ -f "$ENV_BACKUP_DIR/.env" ]]; then
      mv -f "$ENV_BACKUP_DIR/.env" .env
    else
      rm -f .env
    fi
    if [[ -f "$ENV_BACKUP_DIR/.env.development" ]]; then
      mv -f "$ENV_BACKUP_DIR/.env.development" .env.development
    else
      rm -f .env.development
    fi
    rmdir "$ENV_BACKUP_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT

port_in_use() {
  lsof -ti "tcp:$1" >/dev/null 2>&1
}

if port_in_use "$PORT"; then
  echo "Port ${PORT} is already in use (CHAR_PORT). Stop the other process or choose another port." >&2
  exit 1
fi
if port_in_use "$METRO_PORT"; then
  echo "Port ${METRO_PORT} is already in use (CHAR_METRO_PORT). Stop Metro on that port or set CHAR_METRO_PORT." >&2
  exit 1
fi

mkdir -p "$ENV_BACKUP_DIR"
if [[ -f .env ]]; then
  cp .env "$ENV_BACKUP_DIR/.env"
else
  rm -f "$ENV_BACKUP_DIR/.env"
fi
if [[ -f .env.development ]]; then
  cp .env.development "$ENV_BACKUP_DIR/.env.development"
else
  rm -f "$ENV_BACKUP_DIR/.env.development"
fi

: >"$LOG_FILE"

node scripts/characterization/inv002-http-server.mjs "$PORT" 2>&1 | tee -a "$LOG_FILE" &
SERVER_PID=$!
sleep 0.5

cat >"$ENV_FILE" <<EOF
APP_ENV=local
APP_CHARACTERIZATION=true
API_BASE_URL=http://127.0.0.1:${PORT}
USE_MOCK_AI=true
USE_MOCK_OCR=true
AI_SCHEMA_VERSION=ai-output-v1
SUPPORT_EMAIL=support@lingobites.app
APP_NAME=LingoBites Dev
IOS_BUNDLE_ID=com.yourcompany.lingobites.dev
IOS_APP_VERSION_NAME=1.0.0
IOS_APP_VERSION_CODE=1
IOS_APP_ICON_NAME=AppIcon
LAUNCH_SCREEN_NAME=LaunchScreen
EOF

cp "$ENV_FILE" .env.development
cp "$ENV_FILE" .env
ruby "${ROOT}/node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" \
  "${ROOT}" "${ROOT}/ios/tmp.xcconfig"

echo "Starting iOS characterization (simulator iPhone 17 Pro, APP_CHARACTERIZATION via ${ENV_FILE})"

export ENVFILE="$ENV_FILE"
export RN_CHARACTERIZATION=1
export CI=true

npx react-native start --port "$METRO_PORT" --reset-cache 2>&1 | tee -a "$LOG_FILE" &
METRO_PID=$!
sleep 5

npx react-native run-ios \
  --scheme Development \
  --mode DebugDev \
  --simulator "iPhone 17 Pro" \
  --port "$METRO_PORT" \
  --no-packager \
  2>&1 | tee -a "$LOG_FILE" &

IOS_PID=$!

npx react-native log-ios 2>&1 | tee -a "$LOG_FILE" &
LOG_PID=$!

deadline=$((SECONDS + 600))
while (( SECONDS < deadline )); do
  if grep -q '\[LING93_INV002\]' "$LOG_FILE"; then
    result_line=$(grep '\[LING93_INV002\]' "$LOG_FILE" | tail -1)
    echo "$result_line"
    node -e "
      const line = process.argv[1];
      const jsonText = line.replace(/^.*\\[LING93_INV002\\] /, '');
      const result = JSON.parse(jsonText);
      if (result.status !== 'pass') {
        console.error('Characterization result status is not pass:', jsonText.slice(0, 500));
        process.exit(1);
      }
    " "$result_line"
    exit 0
  fi
  sleep 3
done

echo "Timed out waiting for [LING93_INV002] in $LOG_FILE" >&2
tail -60 "$LOG_FILE" >&2
exit 1
