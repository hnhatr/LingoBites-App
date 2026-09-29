/**
 * Tests for the tiny ZIP reader used by the content package importer
 * (SETE-107 / M2). All tests use stored-method ZIPs built by the in-test
 * `buildStoredZip` helper so the round-trip stays in pure JS — no deflate
 * dependency is needed.
 */

import {extractZipSync, ZipReadError} from '../zipReader';
import {buildStoredZip} from '../_fixtures/testZip';

function decode(s: Uint8Array): string {
  return new TextDecoder('utf-8').decode(s);
}

describe('zipReader (sync / stored)', () => {
  it('extracts entries from a stored-method ZIP', () => {
    const zip = buildStoredZip([
      ['manifest.json', new TextEncoder().encode('{"hello":"world"}')],
      ['lessons/one.json', new TextEncoder().encode('{"id":"one"}')],
    ]);
    const {entries} = extractZipSync(zip);
    expect(entries).toHaveLength(2);
    const byName = new Map(entries.map(e => [e.name, e]));
    expect(decode(byName.get('manifest.json')!.bytes)).toBe(
      '{"hello":"world"}',
    );
    expect(decode(byName.get('lessons/one.json')!.bytes)).toBe('{"id":"one"}');
    expect(byName.get('manifest.json')!.method).toBe(0);
  });

  it('preserves the uncompressed size on each entry', () => {
    const payload = new TextEncoder().encode('hello there friend');
    const zip = buildStoredZip([['a.txt', payload]]);
    const {entries} = extractZipSync(zip);
    expect(entries[0]!.size).toBe(payload.length);
    expect(entries[0]!.compressedSize).toBe(payload.length);
  });

  it('rejects a buffer that is too short to contain an EOCD', () => {
    expect(() => extractZipSync(new Uint8Array(5))).toThrow(ZipReadError);
  });

  it('rejects a buffer without the EOCD signature', () => {
    const buf = new Uint8Array(64).fill(0xab);
    expect(() => extractZipSync(buf)).toThrow(/end-of-central-directory/);
  });

  it('ignores duplicate entry names (keeps the first one)', () => {
    const zip = buildStoredZip([
      ['manifest.json', new TextEncoder().encode('{"a":1}')],
      ['manifest.json', new TextEncoder().encode('{"a":2}')],
    ]);
    const {entries} = extractZipSync(zip);
    expect(entries).toHaveLength(1);
    expect(decode(entries[0]!.bytes)).toBe('{"a":1}');
  });

  it('round-trips UTF-8 filenames', () => {
    const name = 'tiếng-việt/đứng-họp.json';
    const zip = buildStoredZip([[name, new TextEncoder().encode('{}')]]);
    const {entries} = extractZipSync(zip);
    expect(entries[0]!.name).toBe(name);
  });
});
