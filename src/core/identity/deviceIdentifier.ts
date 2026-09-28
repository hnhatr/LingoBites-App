import {createRequestId} from '../api/requestId';

/**
 * Device-identifier kinds accepted by `POST /v1/auth/bootstrap` (SETE-303 /
 * T6). The frozen backend contract (api-server `src/auth/deviceIdentity.ts`)
 * canonicalizes `android_id` as 16 lowercase hex and `ios_ifv` /
 * `random_fallback` as lowercase RFC-4122 UUIDs; the mobile adapter mirrors
 * those rules so a malformed native value never reaches the server as-is.
 */
export const IDENTIFIER_KINDS = [
  'android_id',
  'ios_ifv',
  'random_fallback',
] as const;

export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];

export type DeviceIdentifier = {
  kind: IdentifierKind;
  /** Canonical value: lowercase hex (android) or lowercase UUID (iOS/fallback). */
  value: string;
};

const ANDROID_ID_RE = /^[0-9a-f]{16}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isIdentifierKind(value: unknown): value is IdentifierKind {
  return (
    typeof value === 'string' &&
    (IDENTIFIER_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Canonicalizes a raw platform identifier the same way the backend does:
 * trims, lowercases, then enforces the per-kind shape. Returns null when the
 * value is missing or malformed so callers take the UUID fallback path.
 */
export function canonicalizeIdentifier(
  kind: IdentifierKind,
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return null;
  }
  const canonical = trimmed.toLowerCase();
  if (kind === 'android_id') {
    return ANDROID_ID_RE.test(canonical) ? canonical : null;
  }
  return UUID_RE.test(canonical) ? canonical : null;
}

/** Validates an already-canonical identifier value for its kind. */
export function isValidIdentifierValue(
  kind: IdentifierKind,
  value: string,
): boolean {
  if (kind === 'android_id') {
    return ANDROID_ID_RE.test(value);
  }
  return UUID_RE.test(value);
}

export type RawPlatformIdentifiers = {
  androidId: unknown;
  identifierForVendor: unknown;
};

export type ResolveDeviceIdentifierDeps = {
  randomUuid?: () => string;
};

/**
 * Resolves the device identifier to bootstrap with (SETE-303 / T6):
 *
 * - Android: validated `ANDROID_ID` when well-formed, else a validated UUID
 *   fallback shaped like an iOS identifier (`random_fallback`).
 * - iOS: validated `identifierForVendor` when present, else the same UUID
 *   fallback.
 *
 * A `random_fallback` value is always freshly generated and validated before
 * use, so the backend can never receive a malformed `identifier_value` from
 * this path. `fromFallback` tells the bootstrap orchestrator the value is
 * not a stable platform identifier (fresh installs must clear persisted
 * Keychain sessions before creating a fallback account).
 */
export function resolveDeviceIdentifier(
  platform: 'android' | 'ios',
  raw: RawPlatformIdentifiers,
  deps: ResolveDeviceIdentifierDeps = {},
): {identifier: DeviceIdentifier; fromFallback: boolean} {
  const randomUuid = deps.randomUuid ?? createRequestId;
  if (platform === 'android') {
    const canonical = canonicalizeIdentifier('android_id', raw.androidId);
    if (canonical) {
      return {
        identifier: {kind: 'android_id', value: canonical},
        fromFallback: false,
      };
    }
  } else {
    const canonical = canonicalizeIdentifier(
      'ios_ifv',
      raw.identifierForVendor,
    );
    if (canonical) {
      return {
        identifier: {kind: 'ios_ifv', value: canonical},
        fromFallback: false,
      };
    }
  }
  const fallback = randomUuid().trim().toLowerCase();
  if (!UUID_RE.test(fallback)) {
    throw new Error('random UUID fallback must be a valid UUID');
  }
  return {
    identifier: {kind: 'random_fallback', value: fallback},
    fromFallback: true,
  };
}
