/**
 * Test helpers for the content package importer (SETE-107 / M2).
 *
 * Builds in-memory ZIP archives using the `Stored` compression method (no
 * deflate needed) so tests can produce a known-good or known-corrupt package
 * without pulling in a compression library. The same writer is used by every
 * importer test fixture, so the produced bytes round-trip through the real
 * `extractZipSync` path.
 */

import {createHash} from 'crypto';

/** Build a single stored-method ZIP entry (no central directory yet). */
function buildStoredEntry(
  name: string,
  data: Uint8Array,
): {
  local: Uint8Array;
  central: {
    name: Uint8Array;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
  };
} {
  const nameBytes = new TextEncoder().encode(name);
  const crc = crc32(data);
  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const dv = new DataView(local.buffer);
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true); // version needed
  dv.setUint16(6, 0, true); // flags
  dv.setUint16(8, 0, true); // method = stored
  dv.setUint16(10, 0, true); // mod time
  dv.setUint16(12, 0, true); // mod date
  dv.setUint32(14, crc, true);
  dv.setUint32(18, data.length, true); // compressed size
  dv.setUint32(22, data.length, true); // uncompressed size
  dv.setUint16(26, nameBytes.length, true);
  dv.setUint16(28, 0, true); // extra len
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);
  return {
    local,
    central: {
      name: nameBytes,
      crc32: crc,
      compressedSize: data.length,
      uncompressedSize: data.length,
      localHeaderOffset: 0,
    },
  };
}

// Precomputed CRC-32 table.
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = (CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build a stored-method ZIP archive from a list of (name, bytes) entries.
 * Single-disk, no encryption, no Zip64 — the same shape the content-lint
 * tool's exporter produces.
 */
export function buildStoredZip(
  entries: ReadonlyArray<readonly [name: string, data: Uint8Array]>,
): Uint8Array {
  const builtEntries = entries.map(([name, data]) =>
    buildStoredEntry(name, data),
  );
  let localOffset = 0;
  const localChunks: Uint8Array[] = [];
  for (let i = 0; i < builtEntries.length; i += 1) {
    const e = builtEntries[i]!;
    e.central.localHeaderOffset = localOffset;
    localChunks.push(e.local);
    localOffset += e.local.length;
  }
  let cdSize = 0;
  for (const e of builtEntries) {
    cdSize += 46 + e.central.name.length;
  }
  const local = concatBytes(localChunks);
  const cd = new Uint8Array(cdSize);
  const cdDv = new DataView(cd.buffer);
  let cdOffset = 0;
  for (const e of builtEntries) {
    cdDv.setUint32(cdOffset + 0, 0x02014b50, true);
    cdDv.setUint16(cdOffset + 4, 20, true); // version made by
    cdDv.setUint16(cdOffset + 6, 20, true); // version needed
    cdDv.setUint16(cdOffset + 8, 0, true); // flags
    cdDv.setUint16(cdOffset + 10, 0, true); // method
    cdDv.setUint16(cdOffset + 12, 0, true); // mod time
    cdDv.setUint16(cdOffset + 14, 0, true); // mod date
    cdDv.setUint32(cdOffset + 16, e.central.crc32, true);
    cdDv.setUint32(cdOffset + 20, e.central.compressedSize, true);
    cdDv.setUint32(cdOffset + 24, e.central.uncompressedSize, true);
    cdDv.setUint16(cdOffset + 28, e.central.name.length, true);
    cdDv.setUint16(cdOffset + 30, 0, true);
    cdDv.setUint16(cdOffset + 32, 0, true);
    cdDv.setUint16(cdOffset + 34, 0, true);
    cdDv.setUint16(cdOffset + 36, 0, true);
    cdDv.setUint32(cdOffset + 38, 0, true);
    cdDv.setUint32(cdOffset + 42, e.central.localHeaderOffset, true);
    cd.set(e.central.name, cdOffset + 46);
    cdOffset += 46 + e.central.name.length;
  }
  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocdDv.setUint32(0, 0x06054b50, true);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, builtEntries.length, true);
  eocdDv.setUint16(10, builtEntries.length, true);
  eocdDv.setUint32(12, cdSize, true);
  eocdDv.setUint32(16, local.length, true);
  eocdDv.setUint16(20, 0, true);
  return concatBytes([local, cd, eocd]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** SHA-256 hex of bytes (uses node crypto; only used in test setup). */
export function sha256HexTest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
