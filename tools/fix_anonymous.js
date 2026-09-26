const fs = require('fs');

let content = fs.readFileSync('src/shared/db/anonymousUserId.ts', 'utf8');
content = content.replace(
  / {2}const row = existing\.rows\?\.item\(0\) as \{value\?: string\} \| undefined;\n {2}if \(row\?\.value\) \{\n {4}return row\.value;\n {2}\}/,
  `
  // T8: If an authenticated account is active, use its ID instead of the legacy anonymous ID.
  const authAccount = db.execute(
    "SELECT value FROM app_settings WHERE key = 'current_account_id' LIMIT 1;"
  );
  const accountRow = authAccount.rows?.item(0) as {value?: string} | undefined;
  if (accountRow?.value) {
    return accountRow.value;
  }

  const row = existing.rows?.item(0) as {value?: string} | undefined;
  if (row?.value) {
    return row.value;
  }`,
);
fs.writeFileSync('src/shared/db/anonymousUserId.ts', content);
