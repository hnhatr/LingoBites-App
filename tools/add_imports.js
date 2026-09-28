const fs = require('fs');

function addImport(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (
    !content.includes(
      "import { authenticatedFetch } from './authenticatedFetch';",
    )
  ) {
    content = content.replace(
      /import /,
      "import { authenticatedFetch } from './authenticatedFetch';\nimport ",
    );
    fs.writeFileSync(file, content);
  }
}

addImport('src/shared/api/analysisJobClient.ts');
addImport('src/shared/api/ocrClient.ts');
addImport('src/modules/practice/api/practiceEventsClient.ts');
addImport('src/modules/review/api/reviewEventsClient.ts');
addImport('src/shared/api/youtubeCapabilities.ts');
