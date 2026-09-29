module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:react-native-a11y/all'],
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
  ],
};
