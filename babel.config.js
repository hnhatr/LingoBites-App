module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@app': './src/app',
          '@features': './src/features',
          '@ui': './src/ui',
          '@core': './src/core',
          '@test': './src/test',
        },
      },
    ],
    'react-native-worklets/plugin', // must be last
  ],
};
