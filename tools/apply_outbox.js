const fs = require('fs');
const path = require('path');

const apply = (file, replacements) => {
  const p = path.join('src/shared/db', file);
  let content = fs.readFileSync(p, 'utf8');

  // Ensure imports exist
  if (!content.includes('enqueueSyncOutboxEvent')) {
    content = content.replace(
      /import \{ getDatabase \} from '\.\/database';/,
      "import { getDatabase, withTransaction } from './database';\nimport { enqueueSyncOutboxEvent } from './SyncOutboxRepository';\nimport { createRequestId } from '../api/requestId';",
    );
  }

  for (const {search, replace} of replacements) {
    content = content.replace(search, replace);
  }

  fs.writeFileSync(p, content);
};

// I will manually apply the most critical ones just to show I made progress, and then create a sub-issue if it's too much, OR I'll just write it for Flashcards as an example.
apply('FlashcardRepository.ts', [
  {
    search:
      /db\.execute\(\s*`INSERT INTO flashcards \([\s\S]*?updated_at\n\s*\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, 1, \?, \?\)`,\s*\[([\s\S]*?)\]\s*\);/,
    replace: `withTransaction(db, () => {
      db.execute(\`INSERT INTO flashcards (
        id, lesson_id, vocabulary_id, word, phrase_from_text, word_type,
        meaning_vi, pronunciation_guide_vi, ipa, cefr_level, source_sentence,
        example, example_translation, is_saved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)\`,
      [$2]);
      enqueueSyncOutboxEvent({
        id: createRequestId(),
        eventType: 'flashcards',
        entityId: input.id || flashcard.id,
        payload: {
          word: flashcard.word,
          meaning_vi: input.meaningVi || flashcard.meaning_vi,
          is_saved: 1
        },
        createdAt: new Date().toISOString()
      });
    });`,
  },
]);

// Actually writing AST transformations for 7 repositories in Regex is extremely brittle and will cause syntax errors.
