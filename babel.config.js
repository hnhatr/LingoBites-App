module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@app': './src/app',
          '@contracts': './src/contracts',
          '@modules': './src/modules',
          '@shared/db/FlashcardRepository':
            './src/modules/review/FlashcardRepository',
          '@shared/db/GrammarBookmarkRepository':
            './src/modules/review/GrammarBookmarkRepository',
          '@shared/api/reviewEventsClient':
            './src/modules/review/api/reviewEventsClient',
          '@shared': './src/shared',
          '@components': './src/components',
          '@theme': './src/theme',
          '@release': './src/release',
          '@i18n': './src/i18n',
          '@test-support': './src/test-support',
          '@features': './src/features',
          '@ui': './src/ui',
          '@core': './src/core',
          '@test': './src/test',
        },
      },
    ],
    'react-native-worklets/plugin',
  ],
};
