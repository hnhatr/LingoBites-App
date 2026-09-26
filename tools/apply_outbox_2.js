/* eslint-disable no-useless-escape */
const fs = require('fs');
const path = require('path');

const apply = (file, replacements) => {
  const p = path.join('src/shared/db', file);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  if (!content.includes('enqueueSyncOutboxEvent')) {
    content = content.replace(
      /import \{.*getDatabase.*\} from '\.\/database';/g,
      "import { getDatabase, withTransaction } from './database';\nimport { enqueueSyncOutboxEvent } from './SyncOutboxRepository';\nimport { createRequestId } from '../api/requestId';",
    );
  }

  for (const {search, replace} of replacements) {
    content = content.replace(search, replace);
  }

  fs.writeFileSync(p, content);
};

apply('YouTubeLessonRepository.ts', [
  {
    search:
      /return \{ok: true, lessonId: lesson\.video\.id, duplicate: existing !== null\};/g,
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

apply('GrammarBookmarkRepository.ts', [
  {
    search:
      /db\.execute\(\n\s*\`UPDATE grammar_bookmarks[\s\S]*?WHERE lesson_id = \? AND grammar_id = \?;\`,\n\s*\[now, now, now, input\.lessonId, input\.grammarId\],\n\s*\);\n\s*return \{ok: true, duplicate: true\};/g,
    replace: `withTransaction(db, () => {
        db.execute(
          \`UPDATE grammar_bookmarks
           SET reactivated_at = ?, saved_at = ?, updated_at = ?
           WHERE lesson_id = ? AND grammar_id = ?;\`,
          [now, now, now, input.lessonId, input.grammarId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'grammar_bookmarks',
          entityId: \`\${input.lessonId}:\${input.grammarId}\`,
          payload: { lessonId: input.lessonId, grammarId: input.grammarId, active: true },
          createdAt: now
        });
      });
      return {ok: true, duplicate: true};`,
  },
  {
    search:
      /db\.execute\(\n\s*\`INSERT INTO grammar_bookmarks \([\s\S]*?\) VALUES \(\?, \?, \?, \?, \?, \?, \?\);\`,\n\s*\[\n\s*input\.lessonId,\n\s*input\.grammarId,\n\s*input\.packageId,\n\s*now,\n\s*now,\n\s*now,\n\s*now,\n\s*\],\n\s*\);\n\n\s*return \{ok: true, duplicate: false\};/g,
    replace: `withTransaction(db, () => {
      db.execute(
        \`INSERT INTO grammar_bookmarks (
          lesson_id, grammar_id, package_id, saved_at, reactivated_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);\`,
        [
          input.lessonId,
          input.grammarId,
          input.packageId,
          now,
          now,
          now,
          now,
        ],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'grammar_bookmarks',
        entityId: \`\${input.lessonId}:\${input.grammarId}\`,
        payload: { lessonId: input.lessonId, grammarId: input.grammarId, active: true },
        createdAt: now
      });
    });
    return {ok: true, duplicate: false};`,
  },
  {
    search:
      /const result = db\.execute\(\n\s*\`UPDATE grammar_bookmarks[\s\S]*?WHERE lesson_id = \? AND grammar_id = \?;\`,\n\s*\[updatedAt, lessonId, grammarId\],\n\s*\);\n\s*return \(result\.rowsAffected \?\? 0\) > 0;/g,
    replace: `const result = withTransaction(db, () => {
      const res = db.execute(
        \`UPDATE grammar_bookmarks
         SET reactivated_at = NULL, updated_at = ?
         WHERE lesson_id = ? AND grammar_id = ?;\`,
        [updatedAt, lessonId, grammarId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'grammar_bookmarks',
          entityId: \`\${lessonId}:\${grammarId}\`,
          payload: { lessonId, grammarId, active: false },
          createdAt: updatedAt
        });
      }
      return res;
    });
    return (result.rowsAffected ?? 0) > 0;`,
  },
]);

apply('ContentLessonStateRepository.ts', [
  {
    search:
      /db\.execute\(\n\s*'UPDATE content_lesson_state SET is_saved = 1, updated_at = \? WHERE lesson_id = \?;',\n\s*\[now, input\.lessonId\],\n\s*\);\n\s*return \{ok: true, duplicate: true\};/g,
    replace: `withTransaction(db, () => {
        db.execute(
          'UPDATE content_lesson_state SET is_saved = 1, updated_at = ? WHERE lesson_id = ?;',
          [now, input.lessonId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: input.lessonId,
          payload: { lessonId: input.lessonId, isSaved: 1 },
          createdAt: now
        });
      });
      return {ok: true, duplicate: true};`,
  },
  {
    search:
      /db\.execute\(\n\s*\`INSERT INTO content_lesson_state \(\n\s*lesson_id, is_saved, is_started, created_at, updated_at\n\s*\) VALUES \(\?, \?, \?, \?, \?\);\`,\n\s*\[input\.lessonId, 1, 0, now, now\],\n\s*\);\n\n\s*return \{ok: true, duplicate: false\};/g,
    replace: `withTransaction(db, () => {
      db.execute(
        \`INSERT INTO content_lesson_state (
          lesson_id, is_saved, is_started, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?);\`,
        [input.lessonId, 1, 0, now, now],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'content_lesson_state',
        entityId: input.lessonId,
        payload: { lessonId: input.lessonId, isSaved: 1 },
        createdAt: now
      });
    });
    return {ok: true, duplicate: false};`,
  },
  {
    search:
      /const result = db\.execute\(\n\s*'UPDATE content_lesson_state SET is_saved = 0, updated_at = \? WHERE lesson_id = \?;',\n\s*\[updatedAt, lessonId\],\n\s*\);\n\s*return \(result\.rowsAffected \?\? 0\) > 0;/g,
    replace: `const result = withTransaction(db, () => {
      const res = db.execute(
        'UPDATE content_lesson_state SET is_saved = 0, updated_at = ? WHERE lesson_id = ?;',
        [updatedAt, lessonId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: lessonId,
          payload: { lessonId, isSaved: 0 },
          createdAt: updatedAt
        });
      }
      return res;
    });
    return (result.rowsAffected ?? 0) > 0;`,
  },
  {
    search:
      /db\.execute\(\n\s*'UPDATE content_lesson_state SET is_started = 1, updated_at = \? WHERE lesson_id = \?;',\n\s*\[now, input\.lessonId\],\n\s*\);\n\s*return \{ok: true, duplicate: true\};/g,
    replace: `withTransaction(db, () => {
        db.execute(
          'UPDATE content_lesson_state SET is_started = 1, updated_at = ? WHERE lesson_id = ?;',
          [now, input.lessonId],
        );
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: input.lessonId,
          payload: { lessonId: input.lessonId, isStarted: 1 },
          createdAt: now
        });
      });
      return {ok: true, duplicate: true};`,
  },
  {
    search:
      /db\.execute\(\n\s*\`INSERT INTO content_lesson_state \(\n\s*lesson_id, is_saved, is_started, created_at, updated_at\n\s*\) VALUES \(\?, \?, \?, \?, \?\);\`,\n\s*\[input\.lessonId, 0, 1, now, now\],\n\s*\);\n\n\s*return \{ok: true, duplicate: false\};/g,
    replace: `withTransaction(db, () => {
      db.execute(
        \`INSERT INTO content_lesson_state (
          lesson_id, is_saved, is_started, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?);\`,
        [input.lessonId, 0, 1, now, now],
      );
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'content_lesson_state',
        entityId: input.lessonId,
        payload: { lessonId: input.lessonId, isStarted: 1 },
        createdAt: now
      });
    });
    return {ok: true, duplicate: false};`,
  },
  {
    search:
      /const result = db\.execute\(\n\s*'UPDATE content_lesson_state SET is_started = 0, updated_at = \? WHERE lesson_id = \?;',\n\s*\[updatedAt, lessonId\],\n\s*\);\n\s*return \(result\.rowsAffected \?\? 0\) > 0;/g,
    replace: `const result = withTransaction(db, () => {
      const res = db.execute(
        'UPDATE content_lesson_state SET is_started = 0, updated_at = ? WHERE lesson_id = ?;',
        [updatedAt, lessonId],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_lesson_state',
          entityId: lessonId,
          payload: { lessonId, isStarted: 0 },
          createdAt: updatedAt
        });
      }
      return res;
    });
    return (result.rowsAffected ?? 0) > 0;`,
  },
]);

apply('ContentRuntimeRepository.ts', [
  {
    search:
      /const result = db\.execute\(\n\s*'UPDATE content_review_items[\s\S]*?WHERE id = \?;',\n\s*\[input\.reviewItemId\],\n\s*\);/g,
    replace: `const result = withTransaction(db, () => {
      const res = db.execute(
        'UPDATE content_review_items SET mastery_state = ?, ' +
          'current_interval_minutes = ?, consecutive_correct_answers = ?, ' +
          'next_review_at = ?, last_reviewed_at = ?, updated_at = ? ' +
          'WHERE id = ?;',
        [
          nextState,
          nextInterval,
          nextConsecutive,
          nextReviewAt,
          reviewedAt,
          reviewedAt,
          input.reviewItemId,
        ],
      );
      if ((res.rowsAffected ?? 0) > 0) {
        enqueueSyncOutboxEvent({
          id: createRequestId(),
          eventType: 'content_review_items',
          entityId: input.reviewItemId,
          payload: { 
            reviewItemId: input.reviewItemId, 
            masteryState: nextState,
            nextReviewAt: nextReviewAt
          },
          createdAt: reviewedAt
        });
      }
      return res;
    });
    // Ignore the previous execute call string replacement in the original function`,
  },
]);
