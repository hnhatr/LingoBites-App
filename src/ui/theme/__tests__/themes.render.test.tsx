import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {FeatureFlagProvider} from '@core/release/index';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support/index';
import {AppThemeProvider} from '../ThemeProvider';
import {themeList} from '../themeRegistry';
import {THEME_STORAGE_KEY} from '../themeStorage';

describe('every registered theme renders App* components', () => {
  themeList.forEach(theme => {
    it(`renders under "${theme.id}"`, async () => {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme.id);
      await act(async () => {
        ReactTestRenderer.create(
          <FeatureFlagProvider
            releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
          >
            <AppThemeProvider>
              <>
                <AppText variant="title">{theme.name}</AppText>
                <AppCard>
                  <AppText>body</AppText>
                </AppCard>
                <AppButton title="Primary" onPress={() => {}} />
                <AppButton
                  title="Secondary"
                  variant="secondary"
                  onPress={() => {}}
                />
              </>
            </AppThemeProvider>
          </FeatureFlagProvider>,
        );
      });
      await act(async () => {
        await Promise.resolve();
      });
    });
  });
});
