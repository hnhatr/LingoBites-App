const fs = require('fs');

let content = fs.readFileSync('src/shared/db/LessonRepository.ts', 'utf8');
content = content.replace(
  /type LessonRow = \{/,
  'type LessonRow = {\n  anonymous_user_id: string;',
);
fs.writeFileSync('src/shared/db/LessonRepository.ts', content);
