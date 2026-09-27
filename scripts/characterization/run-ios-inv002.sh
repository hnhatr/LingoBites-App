#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${CHAR_PORT:-41293}"
METRO_PORT="${CHAR_METRO_PORT:-8081}"
LOG_FILE="${CHAR_LOG:-./ios-inv002-characterization.log}"
ENV_FILE=".env.characterization"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ENV_BACKUP_DIR=""
RESTORE_SNAPSHOT=0
SERVER_PID=""
METRO_PID=""
IOS_PID=""
LOG_PID=""
IOS_EXIT_CODE=""

port_in_use() {
  lsof -ti "tcp:$1" >/dev/null 2>&1
}

restore_env_snapshot() {
  if [[ "$RESTORE_SNAPSHOT" != 1 || -z "$ENV_BACKUP_DIR" || ! -d "$ENV_BACKUP_DIR" ]]; then
    return 0
  fi
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
  if [[ -f "$ENV_BACKUP_DIR/ios.tmp.xcconfig" ]]; then
    mv -f "$ENV_BACKUP_DIR/ios.tmp.xcconfig" ios/tmp.xcconfig
  elif [[ -f "$ENV_BACKUP_DIR/.ios.tmp.xcconfig.absent" ]]; then
    rm -f ios/tmp.xcconfig
  fi
  rm -rf "$ENV_BACKUP_DIR"
  RESTORE_SNAPSHOT=0
}

stop_owned_pid() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

cleanup() {
  stop_owned_pid "$LOG_PID"
  stop_owned_pid "$IOS_PID"
  stop_owned_pid "$METRO_PID"
  stop_owned_pid "$SERVER_PID"
  restore_env_snapshot
}

validate_inv002_marker_line() {
  local result_line="$1"
  node "${SCRIPT_DIR}/validate-inv002-marker.mjs" "$result_line"
}

take_env_snapshot() {
  ENV_BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ling93-inv002-env.XXXXXX")"
  if [[ -f .env ]]; then
    cp .env "$ENV_BACKUP_DIR/.env"
  fi
  if [[ -f .env.development ]]; then
    cp .env.development "$ENV_BACKUP_DIR/.env.development"
  fi
  if [[ -f ios/tmp.xcconfig ]]; then
    cp ios/tmp.xcconfig "$ENV_BACKUP_DIR/ios.tmp.xcconfig"
  else
    touch "$ENV_BACKUP_DIR/.ios.tmp.xcconfig.absent"
  fi
  RESTORE_SNAPSHOT=1
  trap cleanup EXIT
}

# --- Port checks before any snapshot or EXIT trap (CR-004) ---
if port_in_use "$PORT"; then
  echo "Port ${PORT} is already in use (CHAR_PORT). Stop the other process or choose another port." >&2
  exit 1
fi
if port_in_use "$METRO_PORT"; then
  echo "Port ${METRO_PORT} is already in use (CHAR_METRO_PORT). Stop Metro on that port or set CHAR_METRO_PORT." >&2
  exit 1
fi

take_env_snapshot

if [[ "${CHAR_SELFTEST:-}" == "restore-check" ]]; then
  echo "mutated-for-selftest" > .env
  exit 0
fi

: >"$LOG_FILE"
RUN_ID="ling93-$(date +%s)-$$"

node scripts/characterization/inv002-http-server.mjs "$PORT" >>"$LOG_FILE" 2>&1 &
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

if [[ "${CHAR_SELFTEST:-}" == "fail-marker" ]]; then
  echo "[LING93_INV002] {\"status\":\"fail\",\"runId\":\"${RUN_ID}\"}" >>"$LOG_FILE"
  result_line=$(grep '\[LING93_INV002\]' "$LOG_FILE" | tail -1)
  if validate_inv002_marker_line "$result_line"; then
    echo "fail-marker selftest: expected non-pass validation" >&2
    exit 2
  fi
  exit 1
fi

if [[ "${CHAR_SELFTEST:-}" == "missing-marker" ]]; then
  echo "selftest: missing marker (${RUN_ID})" >>"$LOG_FILE"
  echo "Timed out waiting for [LING93_INV002] in $LOG_FILE" >&2
  exit 1
fi

if [[ -n "${CHAR_SELFTEST:-}" ]]; then
  echo "Unknown CHAR_SELFTEST=${CHAR_SELFTEST}" >&2
  exit 2
fi

echo "Starting iOS characterization (simulator iPhone 17 Pro, APP_CHARACTERIZATION via ${ENV_FILE})"

export ENVFILE="$ENV_FILE"
export RN_CHARACTERIZATION=1
export CI=true

npx react-native start --port "$METRO_PORT" --reset-cache >>"$LOG_FILE" 2>&1 &
METRO_PID=$!
sleep 5

npx react-native run-ios \
  --scheme Development \
  --mode DebugDev \
  --simulator "iPhone 17 Pro" \
  --port "$METRO_PORT" \
  --no-packager \
  >>"$LOG_FILE" 2>&1 &

IOS_PID=$!

npx react-native log-ios >>"$LOG_FILE" 2>&1 &
LOG_PID=$!

deadline=$((SECONDS + 600))
while (( SECONDS < deadline )); do
  if [[ -n "$IOS_PID" ]] && ! kill -0 "$IOS_PID" 2>/dev/null; then
    IOS_EXIT_CODE=0
    wait "$IOS_PID" || IOS_EXIT_CODE=$?
    IOS_PID=""
    if [[ "$IOS_EXIT_CODE" != "0" ]]; then
      echo "react-native run-ios exited with code ${IOS_EXIT_CODE}" >&2
      tail -60 "$LOG_FILE" >&2
      exit 1
    fi
  fi

  if grep -q '\[LING93_INV002\]' "$LOG_FILE"; then
    result_line=$(grep '\[LING93_INV002\]' "$LOG_FILE" | tail -1)
    echo "$result_line"
    validate_inv002_marker_line "$result_line"
    if [[ -n "$IOS_PID" ]]; then
      if kill -0 "$IOS_PID" 2>/dev/null; then
        wait "$IOS_PID" || {
          echo "react-native run-ios failed after INV-002 marker" >&2
          exit 1
        }
      else
        wait "$IOS_PID" || {
          echo "react-native run-ios failed after INV-002 marker" >&2
          exit 1
        }
      fi
    fi
    exit 0
  fi
  sleep 3
done

echo "Timed out waiting for [LING93_INV002] in $LOG_FILE" >&2
tail -60 "$LOG_FILE" >&2
exit 1
