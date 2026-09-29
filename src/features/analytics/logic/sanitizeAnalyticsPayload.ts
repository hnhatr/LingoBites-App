const FORBIDDEN_KEYS = new Set([
  'text',
  'confirmed_text',
  'original_text',
  'extracted_text',
  'ocr_raw_text',
  'image',
  'image_uri',
  'ai_output',
  'lesson_json',
  'payload',
]);

const FORBIDDEN_VALUE_PATTERNS = [
  /^We are offering/i,
  /^Please visit our store/i,
];

export function sanitizeAnalyticsPayload(
  properties: Record<string, unknown> = {},
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Analytics payload must not include "${key}"`);
    }

    if (
      typeof value === 'string' &&
      value.length > 120 &&
      FORBIDDEN_VALUE_PATTERNS.some(pattern => pattern.test(value))
    ) {
      throw new Error('Analytics payload must not include raw user text');
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
