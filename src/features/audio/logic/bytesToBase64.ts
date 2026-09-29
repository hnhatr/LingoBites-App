const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encodes raw bytes as a base64 string. React Native/Hermes has no `btoa` or
 * `Buffer`, so the device file store uses this small encoder to persist a
 * downloaded audio payload via the native file system's base64 write.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;

    output += BASE64_ALPHABET[(triple >> 18) & 63];
    output += BASE64_ALPHABET[(triple >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '=';
  }
  return output;
}
