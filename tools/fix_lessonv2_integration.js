const fs = require('fs');

const content = fs.readFileSync(
  'src/modules/lesson/__tests__/lessonV2WorkflowIntegration.test.ts',
  'utf8',
);

let newContent = content.replace(
  /import \{getLessonToken, saveLessonToken\} from '@shared\/security\/lessonTokenStore';\n/,
  "import * as AuthSession from '@shared/auth/authSession';\n",
);

// We need to mock ensureValidSession at the top level of the tests
newContent = newContent.replace(
  /beforeEach\(\(\) => \{/,
  `beforeEach(() => {
    jest.spyOn(AuthSession, 'ensureValidSession').mockResolvedValue({
      status: 'valid',
      session: {access_token: 'token-for-retry', session_id: '1', refresh_token: '2', access_expires_at: '2050', refresh_expires_at: '2050'},
      userId: 'user1'
    });`,
);

// For TC-E2E-04, we don't care about Keychain replacement anymore because capability tokens are gone.
// Let's just remove the assertion for tokenStoreMap.get(lessonId).
newContent = newContent.replace(
  /expect\(tokenStoreMap\.get\(lessonId\)\)\.toBe\('new-reissued-token'\);/,
  '// Token store no longer used.',
);

// For TC-E2E-06, we can just remove the whole test or adapt it.
newContent = newContent.replace(
  /\/\/ Token must be stored in Keychain\n\s*expect\(tokenStoreMap\.get\(baseLesson\.lesson_id\)\)\.toBe\(secretToken\);\n/,
  '// No longer uses capability tokens\n',
);

// For TC-E2E-08, we don't expect deleteLessonV2 to clear token from Keychain
newContent = newContent.replace(
  /\/\/ Token removed from Keychain\n\s*expect\(tokenStoreMap\.has\(lessonId\)\)\.toBe\(false\);\n/,
  '',
);

fs.writeFileSync(
  'src/modules/lesson/__tests__/lessonV2WorkflowIntegration.test.ts',
  newContent,
);
