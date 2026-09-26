const fs = require('fs');
let content = fs.readFileSync(
  'src/modules/lesson/__tests__/lessonV2WorkflowIntegration.test.ts',
  'utf8',
);
content = content.replace(
  /import \* as TokenStore from '@shared\/security\/lessonTokenStore';/,
  "import * as TokenStore from '@shared/security/lessonTokenStore';\nimport * as AuthSession from '@shared/auth/authSession';",
);
fs.writeFileSync(
  'src/modules/lesson/__tests__/lessonV2WorkflowIntegration.test.ts',
  content,
);
