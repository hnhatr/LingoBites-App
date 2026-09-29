import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release';
import {AppThemeProvider} from '@ui/theme';
import i18n from '@core/i18n';
import {PrivacyNoteScreen} from '../PrivacyNoteScreen';

describe('PrivacyNoteScreen', () => {
  it('shows canonical in-app privacy note copy', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <PrivacyNoteScreen />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain(i18n.t('settings.privacy_note_body'));
    expect(text).toContain(i18n.t('settings.privacy_title'));
  });
});
