import {Buffer} from 'buffer';

export function decodeUtf8(bytes: Uint8Array): string {
  const decoder = globalThis.TextDecoder;
  if (typeof decoder === 'function') {
    return new decoder('utf-8').decode(bytes);
  }
  return Buffer.from(bytes).toString('utf8');
}
