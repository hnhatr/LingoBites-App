module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:react-native-a11y/all'],
  plugins: ['simple-import-sort'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // SETE-122 Việc 6.3: introduced as `error` by plugin:react-native-a11y/all,
    // which surfaces ~90 pre-existing findings across the codebase. Warning
    // mode first ("cảnh báo trước, siết sau", same rollout as Việc 6.2's
    // masking scan) so this doesn't fail `npm run lint` for unrelated work;
    // promote per-rule to 'error' once its existing findings are cleaned up.
    'react-native-a11y/has-accessibility-hint': 'warn',
    'react-native-a11y/has-valid-accessibility-descriptors': 'warn',
    'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'warn',
  },
  overrides: [
    {
      files: [
        'src/ui/components/**/*.tsx',
        'src/ui/icons/**/*.tsx',
        'src/features/**/*.tsx',
      ],
      rules: {
        'react-native/no-color-literals': 'error',
      },
    },
    // TASK-001 (LING-137) FR-003: autofixable import order, src/** only.
    // Groups mirror the canonical aliases in babel.config.js / tsconfig.json /
    // jest.config.js. Aliases match by longest-prefix, so `@ui/...` lands in
    // its alias group even though it also matches the packages pattern.
    // Export sorting stays off; no import-resolver plugin (source-string
    // grouping changes no specifiers).
    {
      files: ['src/**'],
      rules: {
        'simple-import-sort/imports': [
          'error',
          {
            groups: [
              ['^\\u0000'],
              ['^node:'],
              ['^@?\\w'],
              ['^@app'],
              ['^@features'],
              ['^@ui'],
              ['^@core'],
              ['^@test'],
              ['^'],
              ['^\\.'],
            ],
          },
        ],
      },
    },
    // BR-005 protected paths: never reordered, never edited.
    {
      files: [
        'src/core/db/__tests__/adversarial/adv-ling108-r1-atomic-replacement.adversarial.test.ts',
        'src/features/practice/logic/__tests__/validator.test.ts',
        'src/features/practice/logic/validator.ts',
        'src/features/lesson/packages/logic/bootstrap/bundledPackageData.ts',
      ],
      rules: {
        'simple-import-sort/imports': 'off',
      },
    },
  ],
};
