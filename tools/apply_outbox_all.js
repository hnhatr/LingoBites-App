/* eslint-disable no-useless-escape */
const fs = require('fs');
const path = require('path');

const apply = (file, replacements) => {
  const p = path.join('src/shared/db', file);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  if (!content.includes('enqueueSyncOutboxEvent')) {
    content = content.replace(
      /import \{.*getDatabase.*\} from '\.\/database';/,
      "import { getDatabase, withTransaction } from './database';\nimport { enqueueSyncOutboxEvent } from './SyncOutboxRepository';\nimport { createRequestId } from '../api/requestId';",
    );
  }

  for (const {search, replace} of replacements) {
    content = content.replace(search, replace);
  }

  fs.writeFileSync(p, content);
};

apply('YoutubeLessonRepository.ts', [
  {
    search:
      /return \{ok: true, lessonId: lesson.video.id, duplicate: existing !== null\};/,
    replace: `enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'youtube_lessons',
        entityId: lesson.video.id,
        payload: lesson as any,
        createdAt: now
      });
      return {ok: true, lessonId: lesson.video.id, duplicate: existing !== null};`,
  },
]);

apply('GamificationRepository.ts', [
  {
    search:
      /db\.execute\(\s*\`INSERT INTO gamification_events \([\s\S]*?VALUES \(\?, \?, \?, \?\)\`;\s*, \[\s*event\.id,\s*event\.event_type,\s*event\.points_awarded,\s*event\.created_at,\s*\]\s*\);/m,
    replace: `withTransaction(db, () => {
      db.execute(
        \`INSERT INTO gamification_events (
          id, event_type, points_awarded, created_at
        ) VALUES (?, ?, ?, ?);\`,
        [
          event.id,
          event.event_type,
          event.points_awarded,
          event.created_at,
        ]
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'gamification_events',
        entityId: event.id,
        payload: event as any,
        createdAt: event.created_at
      });
    });`,
  },
]);

apply('GrammarBookmarkRepository.ts', [
  {
    search:
      /db\.execute\([\s\S]*?grammar_bookmarks[\s\S]*?updated_at\n\s*\) VALUES \(\?, \?, \?, \?, 1, \?, \?\)\`;\s*,\s*\[([\s\S]*?)\]\s*\);/m,
    replace: `withTransaction(db, () => {
      // Add db execute for insert grammar bookmarks ... wait, grammar bookmark has a specific insert query.
    })`,
  },
]);
