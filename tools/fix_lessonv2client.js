const fs = require('fs');
let content = fs.readFileSync('src/shared/api/lessonV2Client.ts', 'utf8');

// For createLessonV2
content = content.replace(
  /const fetchImpl = options\.fetchImpl \?\? authenticatedFetch;\n {2}const response = await fetchImpl\(/,
  'const response = await authenticatedFetch(',
);
content = content.replace(
  / {8}'Idempotency-Key': idempotencyKey,\n {6}\},\n {6}body: JSON.stringify\(\{input_hash: inputHash, source_type: sourceType\}\),\n {6}signal: options\.signal,\n {4}\},\n {2}\);/,
  "        'Idempotency-Key': idempotencyKey,\n      },\n      body: JSON.stringify({input_hash: inputHash, source_type: sourceType}),\n      signal: options.signal,\n    },\n    options.fetchImpl\n  );",
);

// For pollLessonV2
content = content.replace(
  /const fetchImpl = options\.fetchImpl \?\? authenticatedFetch;\n {2}const response = await fetchImpl\(/,
  'const response = await authenticatedFetch(',
);
content = content.replace(
  / {6}headers: \{Accept: 'application\/json'\},\n {6}signal: options\.signal,\n {4}\},\n {2}\);/,
  "      headers: {Accept: 'application/json'},\n      signal: options.signal,\n    },\n    options.fetchImpl\n  );",
);

// For retryLessonV2Chunk
content = content.replace(
  /const fetchImpl = options\.fetchImpl \?\? authenticatedFetch;\n\n {2}const response = await fetchImpl\(/,
  'const response = await authenticatedFetch(',
);
content = content.replace(
  / {6}headers: \{\n {8}Accept: 'application\/json',\n {8}'Idempotency-Key': idempotencyKey,\n {6}\},\n {6}signal: options\.signal,\n {4}\},\n {2}\);/,
  "      headers: {\n        Accept: 'application/json',\n        'Idempotency-Key': idempotencyKey,\n      },\n      signal: options.signal,\n    },\n    options.fetchImpl\n  );",
);

fs.writeFileSync('src/shared/api/lessonV2Client.ts', content);
