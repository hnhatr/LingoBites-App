/**
 * expo-updates fingerprint (runtimeVersion policy "fingerprint").
 *
 * package.json scripts are skipped so editing a yarn script does not change
 * the runtime version and orphan already-installed builds from EAS updates.
 * Native code, autolinked modules and patches still change it.
 */
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ['PackageJsonScriptsAll'],
};

module.exports = config;
