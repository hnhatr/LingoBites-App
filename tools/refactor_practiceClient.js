const fs = require('fs');
let content = fs.readFileSync('src/shared/api/practiceClient.ts', 'utf8');

content = content.replace(
  /import \{getLessonToken\} from '\.\.\/security\/lessonTokenStore';\n/,
  "import { authenticatedFetch } from './authenticatedFetch';\n",
);
content = content.replace(
  /\/\*\*\n \* Unwraps the Keychain capability token[\s\S]*?async function lessonTokenFor\([\s\S]*?\}\n\n/,
  '',
);
content = content.replace(
  / {2}const token = await lessonTokenFor\(lessonId\);\n/g,
  '',
);
content = content.replace(/ {6}Authorization: `Bearer \$\{token\}`,\n/g, '');
content = content.replace(/await fetch\(/g, 'await authenticatedFetch(');

fs.writeFileSync('src/shared/api/practiceClient.ts', content);
