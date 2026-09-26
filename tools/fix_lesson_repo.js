const fs = require('fs');

let content = fs.readFileSync('src/shared/db/LessonRepository.ts', 'utf8');
content = content.replace(/ {2}anonymous_user_id: string;\n/, '');
content = content.replace(
  / {4}anonymous_user_id: row\.anonymous_user_id,\n/,
  '',
);
fs.writeFileSync('src/shared/db/LessonRepository.ts', content);
