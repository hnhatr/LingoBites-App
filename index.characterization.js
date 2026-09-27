/**
 * Simulator-only entry for LING-93 INV-002 production-path characterization.
 */
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {Inv002CharacterizationApp} from './src/test-support/characterization/ios/Inv002CharacterizationApp';

AppRegistry.registerComponent(appName, () => Inv002CharacterizationApp);
