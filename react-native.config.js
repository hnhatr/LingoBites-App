module.exports = {
  assets: ['./assets/fonts/'],
  dependencies: {
    // Only its glyph map and source font are used (see `yarn icons:subset`);
    // the app bundles a subset font, so skip the native module that would
    // copy the full MaterialIcons.ttf into the iOS and Android builds.
    '@react-native-vector-icons/material-icons': {
      platforms: {ios: null, android: null},
    },
  },
};
