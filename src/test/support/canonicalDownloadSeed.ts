import fs from 'node:fs';
import path from 'node:path';

import {
  getLessonDownload,
  saveLessonSnapshotBody,
} from '@features/lesson/player/logic/canonicalDownloadRepository';

const SNAPSHOT_FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'core',
  'schemas',
  '__tests__',
  'fixtures',
  'valid-lesson-snapshot-response.json',
);

export const DEFAULT_CANONICAL_LESSON_ID =
  '33333333-3333-4333-8333-333333333301';
const DEFAULT_LESSON_ID = DEFAULT_CANONICAL_LESSON_ID;

export function seedCanonicalLessonDownload(
  lessonId: string = DEFAULT_LESSON_ID,
): void {
  const body = JSON.parse(
    fs.readFileSync(SNAPSHOT_FIXTURE_PATH, 'utf8'),
  ) as Record<string, unknown>;
  const lesson = body.lesson as {id?: string};
  if (lesson && lessonId !== lesson.id) {
    lesson.id = lessonId;
  }
  saveLessonSnapshotBody({body});
}

export function readSeededLessonDownload(lessonId: string = DEFAULT_LESSON_ID) {
  return getLessonDownload(lessonId);
}
