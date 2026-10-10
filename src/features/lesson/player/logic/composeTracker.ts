import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

import type {
  LessonComposeProgress,
  LessonCreationError,
} from '@core/schemas/lesson';

import {
  getLessonDownload,
  saveLessonSnapshotBody,
} from './canonicalDownloadRepository';
import {
  fetchLessonCreationStatus,
  fetchLessonSnapshot,
} from './canonicalLessonClient';
import {fetchActiveComposes} from './composeClient';

/**
 * S4.3 / wait design §3: the learner's "Học theo 6 bước" requests, wherever
 * they are in the App. A request outlives the screen that sent it: the sheet
 * can be closed, the App reopened, and the lesson still arrives. Entries are
 * kept in AsyncStorage (no SQLite change) and merged with the Server's list
 * of running composes on start, so another device's request shows too.
 */

export type ComposeEntryStatus =
  | 'running'
  | 'awaiting'
  | 'succeeded'
  | 'failed';

export type ComposeEntry = {
  requestId: string;
  /** `moment` entries come from "Kể tình huống" and have no source lesson (`''`). */
  kind?: 'compose' | 'moment';
  sourceLessonId: string;
  sourceTitle: string | null;
  sentenceIds: string[];
  createdAt: number;
  status: ComposeEntryStatus;
  progress: LessonComposeProgress | null;
  lessonId: string | null;
  error: LessonCreationError | null;
  /** The learner has seen the result (sheet, banner or the lesson). */
  seen: boolean;
  /** The last poll could not reach the Server ("Đang chờ mạng…"). */
  waitingNetwork: boolean;
};

const STORAGE_KEY = 'lesson-compose-requests:v1';
/** Finished entries nobody looked at are dropped after a day. */
const FINISHED_TTL_MS = 24 * 60 * 60 * 1000;

type ComposeTrackerState = {
  entries: ComposeEntry[];
  hydrated: boolean;
  /** The request an open sheet shows; no banner for it (memory only). */
  focusedRequestId: string | null;
  /** A card asked this lesson's screen to open its compose sheet. */
  sheetLessonId: string | null;
};

export const useComposeTracker = create<ComposeTrackerState>()(() => ({
  entries: [],
  hydrated: false,
  focusedRequestId: null,
  sheetLessonId: null,
}));

/** "Đang tạo bài" card → the source lesson opens with its sheet showing. */
export function requestComposeSheet(lessonId: string | null): void {
  useComposeTracker.setState({sheetLessonId: lessonId});
}

export function setFocusedCompose(requestId: string | null): void {
  useComposeTracker.setState({focusedRequestId: requestId});
}

function storageOrNull(): typeof AsyncStorage | null {
  try {
    return AsyncStorage ?? null;
  } catch {
    return null;
  }
}

function persist(entries: ComposeEntry[]): void {
  const storage = storageOrNull();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
}

function setEntries(update: (entries: ComposeEntry[]) => ComposeEntry[]) {
  const next = update(useComposeTracker.getState().entries);
  useComposeTracker.setState({entries: next});
  persist(next);
}

function isEntry(value: unknown): value is ComposeEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<ComposeEntry>;
  return (
    typeof entry.requestId === 'string' &&
    typeof entry.sourceLessonId === 'string' &&
    Array.isArray(entry.sentenceIds) &&
    (entry.status === 'running' ||
      entry.status === 'succeeded' ||
      entry.status === 'failed')
  );
}

export function getComposeEntry(requestId: string): ComposeEntry | null {
  return (
    useComposeTracker
      .getState()
      .entries.find(entry => entry.requestId === requestId) ?? null
  );
}

/** The running compose of a source lesson, if any (W2: one at a time). */
export function runningComposeFor(sourceLessonId?: string) {
  return (
    useComposeTracker
      .getState()
      .entries.find(
        entry =>
          entry.status === 'running' &&
          (sourceLessonId === undefined ||
            entry.sourceLessonId === sourceLessonId),
      ) ?? null
  );
}

/** Start following a request the Server just accepted. */
export function trackCompose(input: {
  requestId: string;
  sourceLessonId: string;
  sourceTitle: string | null;
  sentenceIds: readonly string[];
  now?: number;
}): void {
  setEntries(entries => {
    if (entries.some(entry => entry.requestId === input.requestId)) {
      return entries;
    }
    return [
      ...entries,
      {
        requestId: input.requestId,
        sourceLessonId: input.sourceLessonId,
        sourceTitle: input.sourceTitle,
        sentenceIds: [...input.sentenceIds],
        createdAt: input.now ?? Date.now(),
        status: 'running',
        progress: null,
        lessonId: null,
        error: null,
        seen: false,
        waitingNetwork: false,
      },
    ];
  });
}

/**
 * E3 (deferred to E6): a "moment" request keeps running after the learner
 * leaves the screen. It shows as a card until its lesson is ready, or until
 * the learner has to confirm the situation (`awaiting`).
 */
export function trackMoment(input: {
  requestId: string;
  situationVi: string | null;
}): void {
  setEntries(entries => {
    if (entries.some(entry => entry.requestId === input.requestId)) {
      return entries;
    }
    return [
      ...entries,
      {
        requestId: input.requestId,
        kind: 'moment',
        sourceLessonId: '',
        sourceTitle: input.situationVi,
        sentenceIds: [],
        createdAt: Date.now(),
        status: 'running',
        progress: null,
        lessonId: null,
        error: null,
        seen: false,
        waitingNetwork: false,
      },
    ];
  });
}

/** The learner confirmed a situation: the moment runs again and is polled. */
export function resumeTrackedMoment(requestId: string): void {
  setEntries(entries =>
    entries.map(entry =>
      entry.requestId === requestId && entry.status === 'awaiting'
        ? {...entry, status: 'running'}
        : entry,
    ),
  );
}

export function markComposeSeen(requestId: string): void {
  setEntries(entries =>
    entries.map(entry =>
      entry.requestId === requestId ? {...entry, seen: true} : entry,
    ),
  );
}

/** Opening a composed lesson counts as seeing that it is ready. */
export function markComposedLessonSeen(lessonId: string): void {
  if (
    !useComposeTracker
      .getState()
      .entries.some(entry => entry.lessonId === lessonId && !entry.seen)
  ) {
    return;
  }
  setEntries(entries =>
    entries.map(entry =>
      entry.lessonId === lessonId ? {...entry, seen: true} : entry,
    ),
  );
}

/** Forget a finished request (the learner closed its card or banner). */
export function dismissCompose(requestId: string): void {
  setEntries(entries =>
    entries.filter(
      entry => entry.requestId !== requestId || entry.status === 'running',
    ),
  );
}

/**
 * Read the stored requests once, then add the Server's running composes this
 * App does not know yet (another device, or storage cleared).
 */
export async function hydrateComposeTracker(
  now: number = Date.now(),
): Promise<void> {
  if (!useComposeTracker.getState().hydrated) {
    let stored: ComposeEntry[] = [];
    const storage = storageOrNull();
    try {
      const raw = storage ? await storage.getItem(STORAGE_KEY) : null;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      stored = Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
      stored = [];
    }
    const known = new Set(
      useComposeTracker.getState().entries.map(entry => entry.requestId),
    );
    const kept = stored.filter(
      entry =>
        !known.has(entry.requestId) &&
        (entry.status === 'running' || now - entry.createdAt < FINISHED_TTL_MS),
    );
    useComposeTracker.setState(state => ({
      hydrated: true,
      entries: [...kept, ...state.entries],
    }));
  }
  const active = await fetchActiveComposes();
  if (!active.ok) return;
  setEntries(entries => {
    const known = new Set(entries.map(entry => entry.requestId));
    const added: ComposeEntry[] = active.value
      .filter(request => !known.has(request.id))
      .map(request => ({
        requestId: request.id,
        sourceLessonId: request.source_lesson_id,
        sourceTitle: request.source_lesson_title,
        sentenceIds: request.sentence_ids,
        createdAt: now - request.compose.elapsed_ms,
        status: 'running',
        progress: request.compose,
        lessonId: null,
        error: null,
        seen: false,
        waitingNetwork: false,
      }));
    return added.length > 0 ? [...entries, ...added] : entries;
  });
}

/**
 * J3: a lesson that is ready lands in "Bài học của tôi" without being opened
 * first. Media are fetched when the learner opens it, like any download.
 */
async function downloadComposedLesson(lessonId: string): Promise<void> {
  try {
    if (getLessonDownload(lessonId)) return;
    const fetched = await fetchLessonSnapshot(lessonId);
    if (fetched.ok) saveLessonSnapshotBody({body: fetched.value.rawBody});
  } catch {
    // Opening the lesson downloads it again; nothing is lost.
  }
}

/** Poll one running request and fold the answer into its entry. */
export async function pollCompose(requestId: string): Promise<void> {
  const entry = getComposeEntry(requestId);
  if (!entry || entry.status !== 'running') return;
  const polled = await fetchLessonCreationStatus(requestId);
  if (!polled.ok) {
    if (polled.kind === 'not-found') {
      // Gone on the Server (another account signed in): stop following it.
      setEntries(entries =>
        entries.filter(item => item.requestId !== requestId),
      );
      return;
    }
    if (polled.kind === 'network-error' && !polled.cancelled) {
      setEntries(entries =>
        entries.map(item =>
          item.requestId === requestId ? {...item, waitingNetwork: true} : item,
        ),
      );
    }
    return;
  }
  const value = polled.value;
  if (value.status === 'succeeded' && value.lesson_id) {
    await downloadComposedLesson(value.lesson_id);
  }
  setEntries(entries =>
    entries.map(item => {
      if (item.requestId !== requestId) return item;
      const progress = value.compose ?? item.progress;
      if (value.status === 'succeeded' && value.lesson_id) {
        return {
          ...item,
          status: 'succeeded',
          lessonId: value.lesson_id,
          progress,
          waitingNetwork: false,
        };
      }
      if (value.status === 'awaiting_confirmation') {
        return {...item, status: 'awaiting', waitingNetwork: false};
      }
      if (value.status === 'failed') {
        return {
          ...item,
          status: 'failed',
          error: value.error ?? {code: 'CREATION_FAILED', retryable: true},
          progress,
          waitingNetwork: false,
        };
      }
      return {...item, progress, waitingNetwork: false};
    }),
  );
}

/** Poll every running request once. */
export async function pollRunningComposes(): Promise<void> {
  const running = useComposeTracker
    .getState()
    .entries.filter(entry => entry.status === 'running');
  for (const entry of running) {
    await pollCompose(entry.requestId);
  }
}

/** Test seam: forget everything (memory only). */
export function resetComposeTrackerForTests(): void {
  useComposeTracker.setState({
    entries: [],
    hydrated: false,
    focusedRequestId: null,
    sheetLessonId: null,
  });
}
