/**
 * Display-name and phone validation (SETE-303 / T6). Mirrors the frozen T1
 * server rules (api-server `src/auth/userValidation.ts`) so invalid input
 * is rejected on the device before any request is sent:
 *
 * - Display name: Unicode NFC, outer whitespace trimmed, 1–80 Unicode code
 *   points, no control characters (Cc + DEL). Required during onboarding.
 * - Phone: optional E.164 with country code (`+` + 7–15 digits); formatting
 *   separators (spaces, dashes, dots, slashes, parentheses) are stripped
 *   before validation. Blank means "not set".
 */

export const DISPLAY_NAME_MIN_CODE_POINTS = 1;
export const DISPLAY_NAME_MAX_CODE_POINTS = 80;

// eslint-disable-next-line no-control-regex -- matching control characters is the point of this check
const CONTROL_RE = /[\u0000-\u001F\u007F]/;

export type DisplayNameValidation =
  | {ok: true; normalized: string}
  | {ok: false; errorCode: 'REQUIRED' | 'TOO_LONG' | 'INVALID_CHARACTERS'};

export function validateDisplayName(value: string): DisplayNameValidation {
  const normalized = value.normalize('NFC').trim();
  const codePoints = [...normalized].length;
  if (codePoints < DISPLAY_NAME_MIN_CODE_POINTS) {
    return {ok: false, errorCode: 'REQUIRED'};
  }
  if (codePoints > DISPLAY_NAME_MAX_CODE_POINTS) {
    return {ok: false, errorCode: 'TOO_LONG'};
  }
  if (CONTROL_RE.test(normalized)) {
    return {ok: false, errorCode: 'INVALID_CHARACTERS'};
  }
  return {ok: true, normalized};
}

const E164_RE = /^\+[1-9]\d{6,14}$/;

export type PhoneValidation =
  | {ok: true; e164: string | null}
  | {ok: false; errorCode: 'INVALID_PHONE'};

/** Validates optional phone input; blank input means "not set" (null). */
export function validatePhone(value: string): PhoneValidation {
  const stripped = value.replace(/[\s\-()./]/g, '');
  if (stripped === '') {
    return {ok: true, e164: null};
  }
  if (!E164_RE.test(stripped)) {
    return {ok: false, errorCode: 'INVALID_PHONE'};
  }
  return {ok: true, e164: stripped};
}
