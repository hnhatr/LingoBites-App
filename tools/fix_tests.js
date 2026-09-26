const fs = require('fs');

function replace(file, search, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(search, replacement);
  fs.writeFileSync(file, content);
}

replace(
  'src/modules/lesson/__tests__/fixtures/libraryTestData.ts',
  /updatedAt: '2026-01-01T00:00:00\.000Z',\n {2}\}\);/,
  "updatedAt: '2026-01-01T00:00:00.000Z',\n    revision: 0,\n    tombstone: false,\n  });",
);

replace(
  'src/modules/lesson/__tests__/fixtures/libraryTestData.ts',
  /updatedAt: '2026-01-01T00:00:00\.000Z',\n {4}title: 'Test Grammar',\n {4}content: 'Test content',\n {2}\}\);/,
  "updatedAt: '2026-01-01T00:00:00.000Z',\n    title: 'Test Grammar',\n    content: 'Test content',\n    revision: 0,\n    tombstone: false,\n  });",
);

replace(
  'src/modules/lesson/components/__tests__/GrammarRowCard.test.tsx',
  /updatedAt: '2024-01-01T00:00:00Z',\n {2}title: 'Noun Phrase',\n {2}content: 'A word or group of words containing a noun\.',\n\};/g,
  "updatedAt: '2024-01-01T00:00:00Z',\n  title: 'Noun Phrase',\n  content: 'A word or group of words containing a noun.',\n  revision: 0,\n  tombstone: false,\n};",
);

replace(
  'src/modules/lesson/components/__tests__/GrammarRowCard.test.tsx',
  /updatedAt: '2024-01-01T00:00:00Z',\n {2}title: 'Verb Phrase',\n {2}content: undefined,\n\};/,
  "updatedAt: '2024-01-01T00:00:00Z',\n  title: 'Verb Phrase',\n  content: undefined,\n  revision: 0,\n  tombstone: false,\n};",
);

replace(
  'src/modules/lesson/components/__tests__/GrammarRowCard.test.tsx',
  /updatedAt: '2024-01-02T00:00:00Z',\n {6}title: 'Adjective Phrase',\n {6}content: 'Modifies a noun',\n {4}\};/,
  "updatedAt: '2024-01-02T00:00:00Z',\n      title: 'Adjective Phrase',\n      content: 'Modifies a noun',\n      revision: 0,\n      tombstone: false,\n    };",
);

replace(
  'src/modules/lesson/components/__tests__/GrammarTabContent.test.tsx',
  /updatedAt: '2024-01-01T00:00:00Z',\n {2}title: 'Noun Phrase',\n {2}content: 'A word or group of words containing a noun\.',\n\};/,
  "updatedAt: '2024-01-01T00:00:00Z',\n  title: 'Noun Phrase',\n  content: 'A word or group of words containing a noun.',\n  revision: 0,\n  tombstone: false,\n};",
);

replace(
  'src/modules/lesson/components/__tests__/VocabularyRowCard.test.tsx',
  /updatedAt: '2024-01-01T00:00:00Z',\n\};/g,
  "updatedAt: '2024-01-01T00:00:00Z',\n  revision: 0,\n  tombstone: false,\n};",
);

replace(
  'src/modules/lesson/components/__tests__/VocabularyRowCard.test.tsx',
  /updatedAt: '2024-01-02T00:00:00Z',\n {4}\};/g,
  "updatedAt: '2024-01-02T00:00:00Z',\n      revision: 0,\n      tombstone: false,\n    };",
);

replace(
  'src/modules/lesson/components/__tests__/VocabularyTabContent.test.tsx',
  /updatedAt: '2024-01-01T00:00:00Z',\n\};/g,
  "updatedAt: '2024-01-01T00:00:00Z',\n  revision: 0,\n  tombstone: false,\n};",
);

replace(
  'src/modules/review/__tests__/reviewScheduler.test.ts',
  /updatedAt: overrides\.updatedAt \?\? '2026-08-10T00:00:00\.000Z',\n {2}\};/g,
  "updatedAt: overrides.updatedAt ?? '2026-08-10T00:00:00.000Z',\n    revision: 0,\n    tombstone: false,\n  };",
);
