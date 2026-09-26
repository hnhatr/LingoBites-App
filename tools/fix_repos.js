const fs = require('fs');
const path = require('path');

const repoDir = 'src/shared/db';

const mapping = {
  'ContentLessonStateRepository.ts': {
    type: 'content_lesson_state',
    entityId: 'state.lessonId',
    mutationMethod: 'saveContentLessonState',
  },
  'ContentRuntimeRepository.ts': {
    type: 'content_review_items',
    entityId: 'state.srsItemId',
    mutationMethod: 'scheduleReviewItem',
  }, // It's more complex, I will skip ContentRuntimeRepository here and do it manually.
  'FlashcardRepository.ts': {
    type: 'flashcards',
    entityId: 'input.id || flashcard.id',
    mutationMethod: 'upsertFlashcard',
  },
  'GamificationRepository.ts': {
    type: 'gamification_events',
    entityId: 'input.sourceEventId',
    mutationMethod: 'appendGamificationEvent',
  },
  'GrammarBookmarkRepository.ts': {
    type: 'grammar_bookmarks',
    entityId: '`${input.lessonId}_${input.grammarId}`',
    mutationMethod: 'saveGrammarBookmark',
  },
  'YouTubeLessonRepository.ts': {
    type: 'youtube_lessons',
    entityId: 'lesson.id',
    mutationMethod: 'saveYouTubeLesson',
  },
  'YouTubeProgressRepository.ts': {
    type: 'youtube_progress',
    entityId: 'input.lessonId',
    mutationMethod: 'saveYouTubeProgress',
  },
};

for (const file of Object.keys(mapping)) {
  if (file === 'ContentRuntimeRepository.ts') continue;

  let content = fs.readFileSync(path.join(repoDir, file), 'utf8');

  // Update mapRow to include revision and tombstone
  content = content.replace(
    /return \{([\s\S]*?)updatedAt: row\.updated_at,\n\s*\};/g,
    'return {$1updatedAt: row.updated_at,\n    revision: row.revision || 0,\n    tombstone: Boolean(row.tombstone),\n  };',
  );
  content = content.replace(
    /return \{([\s\S]*?)createdAt: row\.created_at,\n\s*\};/g,
    'return {$1createdAt: row.created_at,\n    revision: row.revision || 0,\n    tombstone: Boolean(row.tombstone),\n  };',
  );

  fs.writeFileSync(path.join(repoDir, file), content);
}
