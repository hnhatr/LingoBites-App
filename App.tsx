import './src/i18n';
import React, {useEffect} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/app/navigation/AppNavigator';
import {trackAppOpened} from './src/modules/analytics';
import {EngagementBootstrap} from './src/modules/engagement';
import {startAppSync, stopAppSync} from './src/modules/sync';
import {installGlobalErrorHandler} from './src/shared/errors';
import {FeatureFlagProvider} from './src/release';
import {AppThemeProvider, ThemedStatusBar} from './src/ui/theme';

function App() {
  useEffect(() => {
    installGlobalErrorHandler();
    trackAppOpened();
    startAppSync();
    return () => {
      stopAppSync();
    };
  }, []);

  return (
    <FeatureFlagProvider>
      <SafeAreaProvider>
        <AppThemeProvider>
          <ThemedStatusBar />
          <AppNavigator />
          <EngagementBootstrap />
        </AppThemeProvider>
      </SafeAreaProvider>
    </FeatureFlagProvider>
  );
}

export default App;
