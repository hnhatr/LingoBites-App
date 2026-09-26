const fs = require('fs');

function refactorFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/typeof fetch/g, 'typeof authenticatedFetch');
  content = content.replace(
    /deps\.fetchImpl \?\? fetch/g,
    'deps.fetchImpl ?? authenticatedFetch',
  );
  content = content.replace(
    /options\.fetchImpl \?\? fetch/g,
    'options.fetchImpl ?? authenticatedFetch',
  );
  content = content.replace(/await fetch\(/g, 'await authenticatedFetch(');

  if (!content.includes('authenticatedFetch')) {
    content = content.replace(
      /import /,
      "import { authenticatedFetch } from './authenticatedFetch';\nimport ",
    );
  }

  // Remove anonymous_user_id
  content = content.replace(/ {2}anonymousUserId\?: string;\n/, '');
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

refactorFile('src/shared/api/analysisJobClient.ts');
refactorFile('src/shared/api/ocrClient.ts');
refactorFile('src/shared/api/youtubeCapabilities.ts');
