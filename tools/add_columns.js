const fs = require('fs');

const tables = [
  'flashcards',
  'review_schedule',
  'review_sessions',
  'gamification_events',
  'content_review_items',
  'content_lesson_state',
  'grammar_bookmarks',
  'youtube_lessons',
  'youtube_sentences',
  'youtube_progress',
];

let content = fs.readFileSync('src/shared/db/migrations.ts', 'utf8');

const mIndex = content.indexOf('];\n\n/**\n * Reverse-order DROP');
if (mIndex === -1) throw new Error('Could not find end of MIGRATIONS array');

let newMigrations = '';
for (const t of tables) {
  newMigrations += `  \`ALTER TABLE ${t} ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;\`,\n`;
  newMigrations += `  \`ALTER TABLE ${t} ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;\`,\n`;
}

content = content.slice(0, mIndex) + newMigrations + content.slice(mIndex);
fs.writeFileSync('src/shared/db/migrations.ts', content);
