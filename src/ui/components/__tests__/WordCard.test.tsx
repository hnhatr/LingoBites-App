import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {formatIpa, WordCard} from '../WordCard';

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll(node => typeof node.props?.children === 'string')
    .map(node => node.props.children as string);
}

describe('WordCard', () => {
  it('normalizes IPA to a single /…/ form', () => {
    expect(formatIpa('wʌn')).toBe('/wʌn/');
    expect(formatIpa('/wʌn/')).toBe('/wʌn/');
    expect(formatIpa(' /wʌn ')).toBe('/wʌn/');
  });

  it('renders the full word anatomy', () => {
    const tree = render(
      <WordCard
        cefr="A2"
        example="One morning, Anna saw Ben."
        exampleTranslation="Vào một buổi sáng, Anna thấy Ben."
        ipa="wʌn ˈmɔːrnɪŋ"
        meaning="Một buổi sáng"
        pos="phrase"
        word="one morning"
      />,
    );
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'one morning',
        '/wʌn ˈmɔːrnɪŋ/',
        'phrase',
        'A2',
        'Một buổi sáng',
        'One morning, Anna saw Ben.',
        'Vào một buổi sáng, Anna thấy Ben.',
      ]),
    );
  });

  it('hides meaning and example as a recall cue', () => {
    const tree = render(
      <WordCard
        example="One morning, Anna saw Ben."
        hideMeaning
        meaning="Một buổi sáng"
        word="one morning"
      />,
    );
    expect(texts(tree)).toContain('one morning');
    expect(texts(tree)).not.toContain('Một buổi sáng');
    expect(texts(tree)).not.toContain('One morning, Anna saw Ben.');
  });

  it('shows the speak button only with onSpeak and renders custom slots', () => {
    const onSpeak = jest.fn();
    const tree = render(
      <WordCard
        actions={<WordCard word="action-slot" variant="inline" />}
        onSpeak={onSpeak}
        speakTestID="speak"
        word="café"
      />,
    );
    act(() => {
      tree.root.findByProps({testID: 'speak'}).props.onPress();
    });
    expect(onSpeak).toHaveBeenCalled();
    expect(texts(tree)).toContain('action-slot');

    const silent = render(<WordCard speakTestID="speak" word="café" />);
    expect(silent.root.findAllByProps({testID: 'speak'})).toHaveLength(0);
  });
});
