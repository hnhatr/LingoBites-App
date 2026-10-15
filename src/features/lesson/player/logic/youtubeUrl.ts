// Plain regexes on purpose: React Native's `URL` does not implement
// `searchParams` on every version the app supports.
const SHORT_LINK =
  /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([\w-]{11})(?:[?#&/]|$)/i;
const LONG_LINK =
  /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)([\w-]{11})(?:[?#&/]|$)/i;

/**
 * The 11-character video id of a YouTube link (watch, youtu.be, shorts,
 * embed or live), or null when the text is not one. Only used to confirm the
 * link on screen; the server still validates what is submitted.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  const match = SHORT_LINK.exec(trimmed) ?? LONG_LINK.exec(trimmed);
  return match ? match[1] : null;
}
