import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {SpeechNotice} from '../SpeechNotice';

function themed(ui: React.ReactElement) {
  return (
    <FeatureFlagProvider>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </FeatureFlagProvider>
  );
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root
    .findAll(node => typeof node.props.children === 'string')
    .map(node => node.props.children as string)
    .join(' ');
}

describe('SpeechNotice', () => {
  it('shows nothing while speech works', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(themed(<SpeechNotice notice={null} />));
    });
    expect(tree.root.findAllByProps({testID: 'speech-notice'})).toHaveLength(0);
  });

  it('says which problem stopped the model', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        themed(<SpeechNotice notice="VOICE_UNAVAILABLE" />),
      );
    });
    expect(
      tree.root.findAllByProps({testID: 'speech-notice'}).length,
    ).toBeGreaterThan(0);
    expect(textOf(tree)).toContain('tiếng Anh (Mỹ) nên chưa đọc được');

    await act(async () => {
      tree.update(themed(<SpeechNotice notice="UNAVAILABLE" />));
    });
    expect(textOf(tree)).toContain('chưa phát được âm thanh');
  });
});
