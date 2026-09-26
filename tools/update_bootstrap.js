const fs = require('fs');
let content = fs.readFileSync('src/shared/auth/accountBootstrap.ts', 'utf8');

if (!content.includes('current_account_id')) {
  content = content.replace(
    /import \{getDatabase\} from '\.\.\/db\/database';/,
    "import {getDatabase, wipeDatabase} from '../db/database';",
  );

  const enforceAccountCode = `
function enforceAccountIsolation(userId: string): void {
  const db = getDatabase();
  const current = readSetting('current_account_id');
  if (current && current !== userId) {
    wipeDatabase(db);
  }
  writeSetting('current_account_id', userId);
}
`;
  content = content.replace(
    /function getOrCreateSignupKey\(\)/,
    enforceAccountCode + '\nfunction getOrCreateSignupKey()',
  );

  content = content.replace(
    /setInstallMarker\(\);\n {4}return \{status: 'authenticated', user: me\.user\};/g,
    "setInstallMarker();\n    enforceAccountIsolation(me.user.id);\n    return {status: 'authenticated', user: me.user};",
  );
  content = content.replace(
    /setInstallMarker\(\);\n {4}return \{status: 'authenticated', user: bootstrapped\.user\};/g,
    "setInstallMarker();\n    enforceAccountIsolation(bootstrapped.user.id);\n    return {status: 'authenticated', user: bootstrapped.user};",
  );
  content = content.replace(
    /setInstallMarker\(\);\n {2}return \{status: 'authenticated', user: created\.user\};/g,
    "setInstallMarker();\n  enforceAccountIsolation(created.user.id);\n  return {status: 'authenticated', user: created.user};",
  );

  fs.writeFileSync('src/shared/auth/accountBootstrap.ts', content);
}
