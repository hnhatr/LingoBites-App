const fs = require('fs');

let content = fs.readFileSync('src/shared/schemas/recordings.ts', 'utf8');
content = content.replace(
  /import \{ ApiErrorResponseSchema \} from '\.\/reviewEvents\.js';\n/,
  '',
);
content = content.replace(
  /export const RecordingsResponseSchemas = \{[\s\S]*?\};\n/,
  '',
);
fs.writeFileSync('src/shared/schemas/recordings.ts', content);
