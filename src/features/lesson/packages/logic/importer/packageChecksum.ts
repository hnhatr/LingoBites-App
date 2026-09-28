/**
 * SHA-256 helper for the content package importer (SETE-107 / M2).
 *
 * Pure-JS, no `node:crypto`, no `crypto.subtle`, no third-party dependency.
 * Used to:
 *   - verify the package ZIP against the sha256 in the manifest, and
 *   - compute the on-disk SHA-256 we store on the `content_packages` row so
 *     later rollbacks and audits can prove the bytes have not changed.
 *
 * Performance is plenty for content packages (a few MB at most). The
 * reference implementation here matches FIPS 180-4 step-by-step so a future
 * migration to a native crypto implementation is a drop-in replacement.
 *
 * Public surface is intentionally tiny: `sha256Hex(bytes)` returns a 64-char
 * lowercase hex string. No streaming API — we always hash the full package
 * bytes, which keeps the contract simple and the rollback path auditable.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function utf8Bytes(input: Uint8Array): Uint8Array {
  return input;
}

function toHex(n: number): string {
  return n.toString(16).padStart(8, '0');
}

export function sha256Hex(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string'
      ? utf8Bytes(new TextEncoder().encode(input))
      : input;

  // Initial hash values (FIPS 180-4 §5.3.3)
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  // Append 64-bit big-endian length. JS numbers are 53-bit safe so we split.
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  const lenStart = paddedLength - 8;
  padded[lenStart] = (high >>> 24) & 0xff;
  padded[lenStart + 1] = (high >>> 16) & 0xff;
  padded[lenStart + 2] = (high >>> 8) & 0xff;
  padded[lenStart + 3] = high & 0xff;
  padded[lenStart + 4] = (low >>> 24) & 0xff;
  padded[lenStart + 5] = (low >>> 16) & 0xff;
  padded[lenStart + 6] = (low >>> 8) & 0xff;
  padded[lenStart + 7] = low & 0xff;

  const w = new Uint32Array(64);
  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    for (let i = 0; i < 16; i += 1) {
      const o = chunk + i * 4;
      w[i] =
        ((padded[o] ?? 0) << 24) |
        ((padded[o + 1] ?? 0) << 16) |
        ((padded[o + 2] ?? 0) << 8) |
        (padded[o + 3] ?? 0);
      w[i] = w[i]! >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 =
        rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

/** Compare two hex strings in constant time. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
