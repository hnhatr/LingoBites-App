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
    'react-native-a11y/has-accessibility-hint': 'warn',
    'react-native-a11y/has-valid-accessibility-descriptors': 'warn',
    'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'warn',
  },
  overrides: [
    {
      files: [
        'src/ui/components/**/*.tsx',
        'src/ui/icons/**/*.tsx',
        'src/modules/**/*.tsx',
      ],
      rules: {
        'react-native/no-color-literals': 'error',
      },
    },
  ],
};
