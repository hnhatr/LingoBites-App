/** Returns true when a context sentence only quotes back the headline phrase. */
export function isRedundantContextSentence(
  contextSentence: string,
  phrase: string,
): boolean {
  const normalizedPhrase = normalizePhrase(phrase);
  if (!normalizedPhrase) {
    return false;
  }

  const stripped = contextSentence
    .trim()
    .replace(/^in our daily work:\s*/i, '')
    .replace(/^trong công việc hàng ngày:\s*/i, '')
    .trim();

  const quoted = stripped.match(/"([^"]+)"/)?.[1] ?? stripped;

  return normalizePhrase(quoted) === normalizedPhrase;
}

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\?+/g, '?');
}
