module.exports = {
  presets: ['babel-preset-expo'],
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
