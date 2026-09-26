const fs = require('fs');

let content = fs.readFileSync('src/shared/api/lessonV2Client.ts', 'utf8');
content = content.replace(
  /const fetchImpl = options\.fetchImpl \?\? authenticatedFetch;/,
  'const fetchImpl = options.fetchImpl;',
);
fs.writeFileSync('src/shared/api/lessonV2Client.ts', content);
