/**
 * Reads plain text from the system clipboard (FR-001, EC-004).
 * Lazy-loads the native module so Jest runtimes without RNCClipboard degrade safely.
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    const ClipboardModule = require('@react-native-clipboard/clipboard');
    const clipboard = ClipboardModule?.default ?? ClipboardModule;
    const getString = clipboard?.getString;
    if (typeof getString !== 'function') {
      return null;
    }
    const raw: unknown = await getString();
    if (typeof raw !== 'string') {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
