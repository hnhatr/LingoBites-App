const fs = require('fs');

let content = fs.readFileSync('src/shared/db/types.ts', 'utf8');
content = content.replace(
  /export type LessonRow = \{/,
  'export type LessonRow = {\n  anonymous_user_id: string;',
);
fs.writeFileSync('src/shared/db/types.ts', content);
