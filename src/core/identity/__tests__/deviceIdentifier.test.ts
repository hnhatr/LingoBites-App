import {
  canonicalizeIdentifier,
  isValidIdentifierValue,
  resolveDeviceIdentifier,
} from '../deviceIdentifier';

const ANDROID_ID = 'a1b2c3d4e5f60718';
const IFV = '550e8400-e29b-41d4-a716-446655440000';
const FALLBACK_UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('deviceIdentifier canonicalization (SETE-303 / T6)', () => {
  it('accepts a well-formed ANDROID_ID as-is', () => {
    expect(canonicalizeIdentifier('android_id', ANDROID_ID)).toBe(ANDROID_ID);
  });

  it('folds uppercase/whitespace android variants, rejects malformed ones', () => {
    expect(
      canonicalizeIdentifier('android_id', `  ${ANDROID_ID.toUpperCase()}  `),
    ).toBe(ANDROID_ID);
    expect(canonicalizeIdentifier('android_id', 'short')).toBeNull();
    expect(canonicalizeIdentifier('android_id', 'g1b2c3d4e5f60718')).toBeNull();
    expect(canonicalizeIdentifier('android_id', '')).toBeNull();
    expect(canonicalizeIdentifier('android_id', null)).toBeNull();
    expect(canonicalizeIdentifier('android_id', 'x'.repeat(129))).toBeNull();
  });

  it('accepts UUIDs for ios_ifv and random_fallback, folded to lowercase', () => {
    expect(canonicalizeIdentifier('ios_ifv', IFV.toUpperCase())).toBe(IFV);
    expect(
      canonicalizeIdentifier('random_fallback', ` ${FALLBACK_UUID} `),
    ).toBe(FALLBACK_UUID);
    expect(canonicalizeIdentifier('ios_ifv', 'not-a-uuid')).toBeNull();
    expect(canonicalizeIdentifier('ios_ifv', ANDROID_ID)).toBeNull();
    expect(canonicalizeIdentifier('random_fallback', 42)).toBeNull();
  });

  it('validates already-canonical values per kind', () => {
    expect(isValidIdentifierValue('android_id', ANDROID_ID)).toBe(true);
    expect(isValidIdentifierValue('android_id', IFV)).toBe(false);
    expect(isValidIdentifierValue('ios_ifv', IFV)).toBe(true);
    expect(isValidIdentifierValue('random_fallback', FALLBACK_UUID)).toBe(true);
    expect(isValidIdentifierValue('random_fallback', ANDROID_ID)).toBe(false);
  });
});

describe('resolveDeviceIdentifier (SETE-303 / T6)', () => {
  const randomUuid = () => FALLBACK_UUID;

  it('prefers a valid ANDROID_ID on android', () => {
    expect(
      resolveDeviceIdentifier(
        'android',
        {androidId: ANDROID_ID, identifierForVendor: null},
        {randomUuid},
      ),
    ).toEqual({
      identifier: {kind: 'android_id', value: ANDROID_ID},
      fromFallback: false,
    });
  });

  it('falls back to a validated UUID when ANDROID_ID is missing or malformed', () => {
    for (const androidId of [null, '', 'bogus-id', 123]) {
      expect(
        resolveDeviceIdentifier(
          'android',
          {androidId, identifierForVendor: null},
          {randomUuid},
        ),
      ).toEqual({
        identifier: {kind: 'random_fallback', value: FALLBACK_UUID},
        fromFallback: true,
      });
    }
  });

  it('prefers a valid IFV on ios, falls back otherwise', () => {
    expect(
      resolveDeviceIdentifier(
        'ios',
        {androidId: null, identifierForVendor: IFV},
        {randomUuid},
      ),
    ).toEqual({
      identifier: {kind: 'ios_ifv', value: IFV},
      fromFallback: false,
    });
    expect(
      resolveDeviceIdentifier(
        'ios',
        {androidId: ANDROID_ID, identifierForVendor: null},
        {randomUuid},
      ),
    ).toEqual({
      identifier: {kind: 'random_fallback', value: FALLBACK_UUID},
      fromFallback: true,
    });
  });

  it('rejects a fallback generator that does not produce a valid UUID', () => {
    expect(() =>
      resolveDeviceIdentifier(
        'ios',
        {androidId: null, identifierForVendor: null},
        {randomUuid: () => 'mock-uuid'},
      ),
    ).toThrow('random UUID fallback must be a valid UUID');
  });
});
