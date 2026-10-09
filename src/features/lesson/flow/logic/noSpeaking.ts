import {useCallback, useEffect, useState} from 'react';

import {getDatabase} from '@core/db/database';

/**
 * PR 14 (decision A13 / H8): "Không nói được lúc này". For 15 minutes the
 * speaking activities of steps 3–4 can be skipped (no attempt is recorded,
 * so the practice is not complete until the learner speaks) and a speaking
 * step-5 task is answered in writing, graded as "written instead of
 * spoken", which does not pass the lesson.
 */
export const NO_SPEAKING_UNTIL_KEY = 'lesson.no_speaking_until';
export const NO_SPEAKING_MS = 15 * 60 * 1000;

/** Activities that need the learner to speak. */
const SPEAKING_KINDS: ReadonlySet<string> = new Set([
  'listen_and_repeat',
  'speaking_drill',
  'role_play',
]);

export function isSpeakingActivity(kind: string): boolean {
  return SPEAKING_KINDS.has(kind);
}

function readUntil(): number {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      NO_SPEAKING_UNTIL_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  const until = Date.parse(row?.value ?? '');
  return Number.isFinite(until) ? until : 0;
}

function writeUntil(until: Date): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [NO_SPEAKING_UNTIL_KEY, until.toISOString(), new Date().toISOString()],
  );
}

export function noSpeakingActive(now: number = Date.now()): boolean {
  return readUntil() > now;
}

export function startNoSpeaking(now: number = Date.now()): void {
  writeUntil(new Date(now + NO_SPEAKING_MS));
}

export function stopNoSpeaking(): void {
  writeUntil(new Date(0));
}

/** The switch on screen; it turns itself off when the 15 minutes are over. */
export function useNoSpeaking(): {
  active: boolean;
  start: () => void;
  stop: () => void;
} {
  const [active, setActive] = useState(() => noSpeakingActive());

  useEffect(() => {
    if (!active) return;
    const left = readUntil() - Date.now();
    const timer = setTimeout(() => setActive(noSpeakingActive()), left + 50);
    return () => clearTimeout(timer);
  }, [active]);

  const start = useCallback(() => {
    startNoSpeaking();
    setActive(true);
  }, []);
  const stop = useCallback(() => {
    stopNoSpeaking();
    setActive(false);
  }, []);
  return {active, start, stop};
}
