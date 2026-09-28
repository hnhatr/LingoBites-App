/**
 * Tests for the pure-JS SHA-256 helper used by the content package importer
 * (SETE-107 / M2). Values pinned to known FIPS-180-4 / RFC6234 test vectors
 * so any regression in the implementation is caught immediately.
 */

import {constantTimeEqualHex, sha256Hex} from '../packageChecksum';

describe('sha256Hex', () => {
  it('matches the empty-string SHA-256 digest', () => {
    // FIPS 180-4 Appendix B.1 — the empty string digest
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the "abc" SHA-256 digest', () => {
    // NIST CAVP — the canonical "abc" test vector.
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches a 448-bit (56-byte) input digest', () => {
    // NIST CAVP — 56-byte "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    const input = new TextEncoder().encode(
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    );
    expect(input.length).toBe(56);
    expect(sha256Hex(input)).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('matches a 1024-byte input digest', () => {
    // NIST CAVP — 1024-byte input of repeating "a".
    const input = new Uint8Array(1024).fill(0x61);
    expect(sha256Hex(input)).toBe(
      '2edc986847e209b4016e141a6dc8716d3207350f416969382d431539bf292e4a',
    );
  });

  it('accepts a string input by encoding it as UTF-8', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('constantTimeEqualHex', () => {
  it('returns true for identical strings', () => {
    expect(
      constantTimeEqualHex(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      ),
    ).toBe(true);
  });

  it('returns false for strings of different length', () => {
    expect(constantTimeEqualHex('ab', 'abc')).toBe(false);
  });

  it('returns false for strings of the same length but different content', () => {
    expect(constantTimeEqualHex('ab', 'cd')).toBe(false);
  });
});
