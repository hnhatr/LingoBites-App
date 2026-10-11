import {getDatabase} from '@core/db/database';
import {
  buildLessonPracticePlan,
  type LessonPracticeSegment,
  lessonPracticeSegments,
  practiceSeed,
} from '@core/learning';
import type {LessonSnapshot} from '@core/schemas/lesson';

/**
 * Plan "practice segments": a long learner lesson is practised one segment
 * at a time (`lessonPracticeSegments`). Which segments the learner already
 * practised is kept on the device only (K4), per lesson and content
 * revision; a new revision starts the segments over. It only steers the
 * next segment to open: completing the lesson still needs one finished run
 * of any segment (K3).
 */
const KEY_PREFIX = 'practice.segments.';

export type PracticeSegmentView = LessonPracticeSegment & {
  /** K5: the segment has enough content for a practice run. */
  available: boolean;
  /** ISO time of the last finished run of this segment, or null. */
  practicedAt: string | null;
};

type Stored = {revision: number; done: Record<string, string>};

function readStored(lessonId: string, revision: number): Stored['done'] {
  try {
    const row = getDatabase()
      .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
        KEY_PREFIX + lessonId,
      ])
      .rows?.item(0) as {value?: string} | undefined;
    const stored = JSON.parse(row?.value ?? 'null') as Stored | null;
    return stored?.revision === revision && stored.done ? stored.done : {};
  } catch {
    return {};
  }
}

/** Remembers that the learner finished a run of this segment. */
export function markPracticeSegment(
  lessonId: string,
  revision: number,
  index: number,
  now: Date = new Date(),
): void {
  const at = now.toISOString();
  const stored: Stored = {
    revision,
    done: {...readStored(lessonId, revision), [String(index)]: at},
  };
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [KEY_PREFIX + lessonId, JSON.stringify(stored), at],
  );
}

/** Every segment of the lesson with whether it can run and when it last did. */
export function practiceSegmentViews(
  snapshot: LessonSnapshot,
): PracticeSegmentView[] {
  const done = readStored(snapshot.id, snapshot.content_revision);
  const seed = practiceSeed(snapshot.id, snapshot.content_revision, 1);
  return lessonPracticeSegments(snapshot).map(segment => ({
    ...segment,
    available:
      buildLessonPracticePlan(
        snapshot,
        seed,
        snapshot.analyses,
        segment.sentenceIds,
      ) !== null,
    practicedAt: done[String(segment.index)] ?? null,
  }));
}

/**
 * K2: the first segment not practised yet, in lesson order; once all were
 * practised, the one practised longest ago. Null when none can run.
 */
export function nextPracticeSegment(
  views: readonly PracticeSegmentView[],
): number | null {
  const available = views.filter(view => view.available);
  const fresh = available.find(view => view.practicedAt === null);
  if (fresh) {
    return fresh.index;
  }
  const oldest = [...available].sort((a, b) =>
    a.practicedAt!.localeCompare(b.practicedAt!),
  )[0];
  return oldest?.index ?? null;
}
