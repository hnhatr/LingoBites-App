const fs = require('fs');

function refactorLessonV2Client() {
  let content = fs.readFileSync('src/shared/api/lessonV2Client.ts', 'utf8');

  // Replace imports
  content = content.replace(
    /import \{\n {2}deleteLessonToken,\n {2}getLessonToken,\n {2}saveLessonToken,\n\} from '\.\.\/security\/lessonTokenStore';\n/,
    "import { authenticatedFetch } from './authenticatedFetch';\n",
  );

  // Remove anonymousUserId from LessonV2CreateInput
  content = content.replace(/ {2}anonymousUserId\?: string;\n/, '');

  // Remove anonymous_user_id from payload
  content = content.replace(/, anonymous_user_id: input\.anonymousUserId/, '');

  // Remove tokenFor function
  content = content.replace(/async function tokenFor\([\s\S]*?\}\n\n/g, '');

  // In createLessonV2Skeleton
  content = content.replace(
    /options\.fetchImpl \?\? fetch/g,
    'options.fetchImpl ?? authenticatedFetch',
  );

  content = content.replace(
    / {2}const tokenResult = await saveLessonToken\([\s\S]*?\n {4}};\n/g,
    '',
  );

  // In pollLessonV2
  content = content.replace(
    / {2}const token = await tokenFor\(lessonId\);\n {2}if \(token\.error\) return token\.error;\n/,
    '',
  );
  content = content.replace(
    / {6}Authorization: `Bearer \$\{token\.token\}`,\n/,
    '',
  );

  // In mutateLessonV2
  content = content.replace(
    / {2}const token = await tokenFor\(lessonId\);\n {2}if \(token\.error\) return token\.error;\n/,
    '',
  );
  content = content.replace(
    / {8}Authorization: `Bearer \$\{token\.token\}`,\n/,
    '',
  );

  // In deleteLessonV2
  content = content.replace(
    / {2}const token = await tokenFor\(lessonId\);\n {2}if \(token\.error\) return token\.error;\n/,
    '',
  );
  content = content.replace(
    / {8}Authorization: `Bearer \$\{token\.token\}`,\n/,
    '',
  );
  content = content.replace(
    / {2}const keychainResult = await deleteLessonToken\(lessonId\);\n/g,
    '',
  );
  content = content.replace(
    / {2}if \(!keychainResult\.ok\)[\s\S]*?\n {4}};\n/g,
    '',
  );

  fs.writeFileSync('src/shared/api/lessonV2Client.ts', content);
}

refactorLessonV2Client();
