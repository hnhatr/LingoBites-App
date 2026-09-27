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
          '@shared': './src/shared',
          '@components': './src/components',
          '@theme': './src/theme',
          '@release': './src/release',
          '@i18n': './src/i18n',
          '@test-support': './src/test-support',
        },
      },
    ],
    'react-native-worklets/plugin', // must be last
  ],
};
