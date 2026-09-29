import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {ContextCard} from '../ContextCard';

const data = {
  kind: 'context' as const,
  phraseEn:
    'This is an intentionally long English phrase that should wrap instead of pushing controls away',
  phraseVi: 'Cụm từ dài',
  contextSentenceEn: null,
  contextSentenceVi: null,
  explanationVi: 'Giải thích',
  audioAssetId: 'audio-1',
};

describe('ContextCard', () => {
  it('wraps long phrases while keeping the audio control in the row', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <ContextCard
              data={data}
              onComplete={jest.fn()}
              onPlayAudio={jest.fn()}
              onSkip={jest.fn()}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const phraseRow = tree.root.findByProps({testID: 'context-phrase-row'});
    expect(phraseRow.props.style).toMatchObject({
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    });
    const phraseText = tree.root.findByProps({testID: 'context-phrase-en'});
    expect(phraseText.props.style).toMatchObject({flex: 1, flexShrink: 1});
  });

  it('hides context sentences that only repeat the headline phrase', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <ContextCard
              data={{
                ...data,
                contextSentenceEn:
                  'In our daily work: "This is an intentionally long English phrase that should wrap instead of pushing controls away".',
                contextSentenceVi: 'Trong công việc hàng ngày: "Cụm từ dài".',
              }}
              onComplete={jest.fn()}
              onPlayAudio={jest.fn()}
              onSkip={jest.fn()}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    expect(
      tree.root.findByProps({testID: 'context-explanation-vi'}),
    ).toBeTruthy();
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).not.toContain('In our daily work');
    expect(rendered).not.toContain('Trong công việc hàng ngày');
  });
});
