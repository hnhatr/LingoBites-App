import './src/core/i18n';
import React, {useCallback, useEffect, useState} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/app/navigation/AppNavigator';
import {trackAppOpened} from './src/features/analytics';
import {EngagementBootstrap} from './src/features/engagement';
import {initWrittenAnswerQueue} from './src/features/lesson/flow/logic/taskEvaluation';
import {initRecordingUploadQueue} from './src/features/speaking/logic/upload/recordingUploadQueue';
import {startAppSync, stopAppSync} from './src/features/sync';
import {installGlobalErrorHandler} from './src/core/errors';
import {FeatureFlagProvider} from './src/core/release';
import {LaunchSplash} from './src/ui/components/LaunchSplash';
import {AppThemeProvider, ThemedStatusBar} from './src/ui/theme';

function App() {
  const [launchSplashDone, setLaunchSplashDone] = useState(false);
  const handleLaunchSplashFinish = useCallback(() => {
    setLaunchSplashDone(true);
  }, []);

  useEffect(() => {
    installGlobalErrorHandler();
    trackAppOpened();
    startAppSync();
    initRecordingUploadQueue();
    initWrittenAnswerQueue();
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
          {launchSplashDone ? null : (
            <LaunchSplash onFinish={handleLaunchSplashFinish} />
          )}
        </AppThemeProvider>
      </SafeAreaProvider>
    </FeatureFlagProvider>
  );
}

export default App;
