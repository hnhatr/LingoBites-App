const fs = require('fs');

function refactorEvents(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/typeof fetch/g, 'typeof authenticatedFetch');
  content = content.replace(
    /deps\.fetchImpl \?\? fetch/g,
    'deps.fetchImpl ?? authenticatedFetch',
  );
  content = content.replace(/ {2}anonymous_user_id: string;\n/, '');

  if (!content.includes('authenticatedFetch')) {
    content = content.replace(
      /import /,
      "import { authenticatedFetch } from './authenticatedFetch';\nimport ",
    );
  }

  // Remove `anonymous_user_id: input.anonymousUserId,` and `anonymousUserId: string;`
  content = content.replace(/ {2}anonymousUserId: string;\n/, '');
  content = content.replace(
    / {8}anonymous_user_id: input\.anonymousUserId,\n/,
    '',
  );
  content = content.replace(
    / {6}anonymous_user_id: input\.anonymousUserId,\n/,
    '',
  );

  fs.writeFileSync(file, content);
}

refactorEvents('src/modules/practice/api/practiceEventsClient.ts');
refactorEvents('src/modules/review/api/reviewEventsClient.ts');
