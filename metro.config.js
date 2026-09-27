const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const characterizationEntry = path.resolve(
  __dirname,
  'index.characterization.js',
);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      const isAppEntry =
        moduleName === './index' ||
        moduleName === 'index' ||
        moduleName.endsWith('/index') ||
        moduleName.endsWith('/index.js') ||
        moduleName === path.resolve(__dirname, 'index.js');
      if (process.env.RN_CHARACTERIZATION === '1' && isAppEntry) {
        return {type: 'sourceFile', filePath: characterizationEntry};
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
});
