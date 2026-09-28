import {validateDisplayName, validatePhone} from '../profileValidation';

describe('profileValidation display names (SETE-303 / T6)', () => {
  it('accepts ordinary and Unicode names, trimming outer whitespace', () => {
    expect(validateDisplayName('An')).toEqual({ok: true, normalized: 'An'});
    expect(validateDisplayName('  Nguyễn Văn Bình  ')).toEqual({
      ok: true,
      normalized: 'Nguyễn Văn Bình',
    });
    // Combining mark + precomposed form normalize to the same value (NFC).
    expect(validateDisplayName('é')).toEqual(validateDisplayName('é'));
  });

  it('requires a non-blank name', () => {
    expect(validateDisplayName('')).toEqual({ok: false, errorCode: 'REQUIRED'});
    expect(validateDisplayName('   ')).toEqual({
      ok: false,
      errorCode: 'REQUIRED',
    });
  });

  it('enforces 1–80 Unicode code points (emoji count as one each)', () => {
    expect(validateDisplayName('a'.repeat(80))).toMatchObject({ok: true});
    expect(validateDisplayName('a'.repeat(81))).toEqual({
      ok: false,
      errorCode: 'TOO_LONG',
    });
    expect(validateDisplayName('👩‍👩‍👧')).toMatchObject({ok: true});
  });

  it('rejects control characters', () => {
    expect(validateDisplayName('An\nBình')).toEqual({
      ok: false,
      errorCode: 'INVALID_CHARACTERS',
    });
    expect(validateDisplayName('An\tBình')).toEqual({
      ok: false,
      errorCode: 'INVALID_CHARACTERS',
    });
  });
});

describe('profileValidation phones (SETE-303 / T6)', () => {
  it('treats blank input as not set', () => {
    expect(validatePhone('')).toEqual({ok: true, e164: null});
    expect(validatePhone('   ')).toEqual({ok: true, e164: null});
  });

  it('accepts E.164 with country code and strips separators', () => {
    expect(validatePhone('+84901234567')).toEqual({
      ok: true,
      e164: '+84901234567',
    });
    expect(validatePhone('+84 901-234-567')).toEqual({
      ok: true,
      e164: '+84901234567',
    });
  });

  it('rejects local numbers without a country code', () => {
    expect(validatePhone('0901234567')).toEqual({
      ok: false,
      errorCode: 'INVALID_PHONE',
    });
    expect(validatePhone('+84')).toEqual({
      ok: false,
      errorCode: 'INVALID_PHONE',
    });
    expect(validatePhone('not-a-phone')).toEqual({
      ok: false,
      errorCode: 'INVALID_PHONE',
    });
  });
});
