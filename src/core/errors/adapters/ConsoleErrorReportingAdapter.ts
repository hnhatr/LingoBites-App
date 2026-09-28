import type {ErrorReportContext, ErrorReportingAdapter} from '../types';

const FORBIDDEN_CONTEXT_KEYS = new Set([
  'text',
  'confirmed_text',
  'original_text',
  'extracted_text',
  'ocr_raw_text',
  'image',
  'ai_output',
]);

function sanitizeContext(
  context: ErrorReportContext = {},
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(key)) {
      continue;
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

export function createConsoleErrorReportingAdapter(): ErrorReportingAdapter {
  return {
    reportError(error: unknown, context?: ErrorReportContext) {
      const message = error instanceof Error ? error.message : String(error);
      const payload = sanitizeContext(context);
      if (__DEV__) {
        console.warn('[error-report]', message, payload);
      }
    },
  };
}
