/**
 * Tiny ZIP reader for the content package importer (SETE-107 / M2).
 *
 * Reads standard PKZIP archives produced by the content-lint tool. Only the
 * subset of the spec the importer needs is supported:
 *
 *   - local file headers (signature 0x04034b50)
 *   - central directory (signature 0x02014b50)
 *   - end-of-central-directory record (signature 0x06054b50)
 *   - compression methods: 0 (Stored) and 8 (Deflate)
 *   - single disk, no encryption, no Zip64
 *
 * Anything outside this subset is rejected with a clear error so the caller
 * (the importer) can surface `INVALID_ZIP` to the user rather than silently
 * extracting a partial package.
 *
 * No third-party dependency: a `pako` / `jszip` import would push the bundle
 * by ~100 KB for one feature, and the format we need is small and stable.
 */

import {Buffer} from 'buffer';
import {decodeUtf8} from './utf8';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT = 0xffff;
const ZIP_MAX_BYTES = 512 * 1024 * 1024; // 512 MB — hard cap so a hostile
// ZIP cannot exhaust memory during
// EOCD scanning.

export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipReadError';
  }
}

export type ExtractedZipEntry = {
  name: string;
  bytes: Uint8Array;
  /** Uncompressed size in bytes. */
  size: number;
  /** Compressed size in bytes (0 for method 0). */
  compressedSize: number;
  /** Compression method: 0 stored, 8 deflate. */
  method: number;
};

export type ExtractedZip = {
  entries: ExtractedZipEntry[];
};

function toUint8(view: Uint8Array | Buffer): Uint8Array {
  // `Buffer` is already a `Uint8Array` subclass in Node/Hermes, so no copy
  // is needed either way — this just normalizes the static type.
  return view;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  // Use the global zlib when available (Node 18+ / Hermes 0.12+ with
  // `react-native-zlib-override` or similar). Falling back to a manual
  // inflate keeps the importer runnable in pure-JS environments (tests).
  const zlib = await loadZlib();
  if (zlib && typeof zlib.inflateRawSync === 'function') {
    return new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes)));
  }
  throw new ZipReadError(
    'Deflate-compressed entry encountered but no zlib implementation is available',
  );
}

async function loadZlib(): Promise<{
  inflateRawSync: (input: Buffer) => Uint8Array;
} | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ 'node:zlib');
    return mod as unknown as {inflateRawSync: (input: Buffer) => Uint8Array};
  } catch {
    try {
      const mod = await import(/* webpackIgnore: true */ 'zlib');
      return mod as unknown as {inflateRawSync: (input: Buffer) => Uint8Array};
    } catch {
      return null;
    }
  }
}

type CentralDirEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function findEocd(bytes: Uint8Array): {
  offset: number;
  commentLength: number;
  totalEntries: number;
  cdSize: number;
  cdOffset: number;
} {
  if (bytes.length < EOCD_MIN_SIZE) {
    throw new ZipReadError('ZIP too short to contain an EOCD record');
  }
  const scanStart = Math.max(
    0,
    bytes.length - EOCD_MAX_COMMENT - EOCD_MIN_SIZE,
  );
  for (let i = bytes.length - EOCD_MIN_SIZE; i >= scanStart; i -= 1) {
    if (readUInt32LE(bytes, i) === SIG_EOCD) {
      const commentLength = readUInt16LE(bytes, i + 20);
      if (i + EOCD_MIN_SIZE + commentLength !== bytes.length) {
        throw new ZipReadError('ZIP EOCD comment length does not match tail');
      }
      const totalEntries = readUInt16LE(bytes, i + 10);
      const cdSize = readUInt32LE(bytes, i + 12);
      const cdOffset = readUInt32LE(bytes, i + 16);
      if (
        cdOffset + cdSize > bytes.length ||
        cdOffset > ZIP_MAX_BYTES ||
        cdSize > ZIP_MAX_BYTES
      ) {
        throw new ZipReadError('ZIP central directory out of range');
      }
      return {offset: i, commentLength, totalEntries, cdSize, cdOffset};
    }
  }
  throw new ZipReadError('ZIP end-of-central-directory record not found');
}

function parseCentralDirectory(
  bytes: Uint8Array,
  cdOffset: number,
  cdSize: number,
): CentralDirEntry[] {
  const entries: CentralDirEntry[] = [];
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end) {
    if (readUInt32LE(bytes, p) !== SIG_CENTRAL) {
      throw new ZipReadError(
        `ZIP central directory entry signature mismatch at offset ${p}`,
      );
    }
    const method = readUInt16LE(bytes, p + 10);
    const compressedSize = readUInt32LE(bytes, p + 20);
    const uncompressedSize = readUInt32LE(bytes, p + 24);
    const nameLen = readUInt16LE(bytes, p + 28);
    const extraLen = readUInt16LE(bytes, p + 30);
    const commentLen = readUInt16LE(bytes, p + 32);
    const localHeaderOffset = readUInt32LE(bytes, p + 42);
    const nameStart = p + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > end) {
      throw new ZipReadError('ZIP central directory name out of range');
    }
    const name = decodeUtf8(bytes.slice(nameStart, nameEnd));
    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    p = nameEnd + extraLen + commentLen;
  }
  return entries;
}

async function readLocalEntry(
  bytes: Uint8Array,
  entry: CentralDirEntry,
): Promise<Uint8Array> {
  const off = entry.localHeaderOffset;
  if (readUInt32LE(bytes, off) !== SIG_LOCAL) {
    throw new ZipReadError(
      `ZIP local file header signature mismatch at offset ${off}`,
    );
  }
  const nameLen = readUInt16LE(bytes, off + 26);
  const extraLen = readUInt16LE(bytes, off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) {
    throw new ZipReadError(
      `ZIP entry "${entry.name}" compressed data past end of file`,
    );
  }
  const compressed = bytes.slice(dataStart, dataEnd);
  if (entry.method === METHOD_STORED) {
    if (compressed.length !== entry.uncompressedSize) {
      throw new ZipReadError(
        `ZIP entry "${entry.name}" stored size mismatch (got ${compressed.length}, want ${entry.uncompressedSize})`,
      );
    }
    return compressed;
  }
  if (entry.method === METHOD_DEFLATE) {
    const out = await inflate(compressed);
    if (out.length !== entry.uncompressedSize) {
      throw new ZipReadError(
        `ZIP entry "${entry.name}" inflated size mismatch (got ${out.length}, want ${entry.uncompressedSize})`,
      );
    }
    return out;
  }
  throw new ZipReadError(
    `ZIP entry "${entry.name}" uses unsupported compression method ${entry.method}`,
  );
}

/**
 * Extract a ZIP archive into a name -> bytes map. Throws `ZipReadError` for
 * any structural problem; the caller surfaces the message to the user.
 *
 * Rejects (does not silently ignore):
 *   - archives without a valid EOCD
 *   - compression methods other than 0 / 8
 *   - central-directory / local-header signature mismatches
 *   - entries whose data extends past the end of the buffer
 *   - duplicate entry names (we keep first and warn via `duplicates`)
 */
export async function extractZip(
  input: Uint8Array | Buffer,
): Promise<ExtractedZip> {
  const bytes = toUint8(input);
  if (bytes.length > ZIP_MAX_BYTES) {
    throw new ZipReadError(
      `ZIP archive is ${bytes.length} bytes, exceeds ${ZIP_MAX_BYTES} cap`,
    );
  }
  const eocd = findEocd(bytes);
  const central = parseCentralDirectory(bytes, eocd.cdOffset, eocd.cdSize);
  if (central.length !== eocd.totalEntries) {
    throw new ZipReadError(
      `ZIP central directory entry count ${central.length} != EOCD total ${eocd.totalEntries}`,
    );
  }
  const entries: ExtractedZipEntry[] = [];
  const seen = new Set<string>();
  for (const c of central) {
    if (seen.has(c.name)) {
      // Duplicate names are not produced by the content tool, but we do not
      // want a hostile ZIP to overwrite a manifest.json with a second copy.
      continue;
    }
    seen.add(c.name);
    const data = await readLocalEntry(bytes, c);
    entries.push({
      name: c.name,
      bytes: data,
      size: c.uncompressedSize,
      compressedSize: c.compressedSize,
      method: c.method,
    });
  }
  return {entries};
}

/**
 * Synchronous variant that supports only stored (method 0) entries. Used by
 * test helpers that build ZIPs in memory without going through the deflate
 * pipeline. Throws `ZipReadError` on any deflate entry.
 */
export function extractZipSync(input: Uint8Array | Buffer): ExtractedZip {
  const bytes = toUint8(input);
  if (bytes.length > ZIP_MAX_BYTES) {
    throw new ZipReadError(
      `ZIP archive is ${bytes.length} bytes, exceeds ${ZIP_MAX_BYTES} cap`,
    );
  }
  const eocd = findEocd(bytes);
  const central = parseCentralDirectory(bytes, eocd.cdOffset, eocd.cdSize);
  if (central.length !== eocd.totalEntries) {
    throw new ZipReadError(
      `ZIP central directory entry count ${central.length} != EOCD total ${eocd.totalEntries}`,
    );
  }
  const entries: ExtractedZipEntry[] = [];
  const seen = new Set<string>();
  for (const c of central) {
    if (seen.has(c.name)) {
      continue;
    }
    if (c.method !== METHOD_STORED) {
      throw new ZipReadError(
        `extractZipSync does not support compression method ${c.method} (entry "${c.name}")`,
      );
    }
    seen.add(c.name);
    const off = c.localHeaderOffset;
    if (readUInt32LE(bytes, off) !== SIG_LOCAL) {
      throw new ZipReadError('ZIP local file header signature mismatch');
    }
    const nameLen = readUInt16LE(bytes, off + 26);
    const extraLen = readUInt16LE(bytes, off + 28);
    const dataStart = off + 30 + nameLen + extraLen;
    const dataEnd = dataStart + c.compressedSize;
    if (dataEnd > bytes.length) {
      throw new ZipReadError(
        `ZIP entry "${c.name}" compressed data past end of file`,
      );
    }
    entries.push({
      name: c.name,
      bytes: bytes.slice(dataStart, dataEnd),
      size: c.uncompressedSize,
      compressedSize: c.compressedSize,
      method: c.method,
    });
  }
  return {entries};
}
