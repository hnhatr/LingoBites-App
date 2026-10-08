import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import type {
  LessonListeningEntry,
  LessonPronunciationEntry,
} from '../../logic/lessonHubContent';
import {LessonListeningSection} from '../LessonListeningSection';
import {LessonPronunciationSection} from '../LessonPronunciationSection';

const PRONUNCIATION: LessonPronunciationEntry = {
  key: 'pronunciation:final-t',
  text: 'Final /t/',
  meaningVi: 'Âm /t/ ở cuối từ',
  focus: '/t/ cuối từ',
  focusIpa: '/t/',
  tipVi: 'Bật nhẹ âm /t/.',
  minimalPairs: [['eight', 'ate']],
  examples: [{en: 'I want a hot tea.', vi: 'Tôi muốn một trà nóng.'}],
};

const LISTENING: LessonListeningEntry = {
  key: 'listening:what-size-would-you-like',
  text: 'What size would you like?',
  meaningVi: 'Bạn muốn cỡ nào?',
  questionEn: 'What does the seller ask about?',
  questionVi: 'Người bán hỏi về điều gì?',
  answer: 'The size',
};

function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const pressable = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, id).find(node => typeof node.props.onPress === 'function')!;

describe('LessonPronunciationSection', () => {
  it('plays each word of a minimal pair and the examples', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <LessonPronunciationSection
        entries={[PRONUNCIATION]}
        onSpeakText={onSpeakText}
      />,
    );
    const id = `lesson-pronunciation-${PRONUNCIATION.key}`;
    act(() => pressable(tree, `${id}-pair-0-a`).props.onPress());
    act(() => pressable(tree, `${id}-pair-0-b`).props.onPress());
    act(() => pressable(tree, `${id}-example-0`).props.onPress());
    expect(onSpeakText.mock.calls).toEqual([
      ['eight'],
      ['ate'],
      ['I want a hot tea.'],
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain('Bật nhẹ âm /t/.');
  });

  it('shows an empty state', () => {
    const tree = render(<LessonPronunciationSection entries={[]} />);
    expect(byTestId(tree, 'lesson-pronunciation-empty').length).toBeGreaterThan(
      0,
    );
  });
});

describe('LessonListeningSection', () => {
  it('plays the text and reveals the answer with the transcript', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <LessonListeningSection
        entries={[LISTENING]}
        onSpeakText={onSpeakText}
      />,
    );
    const id = `lesson-listening-${LISTENING.key}`;
    act(() => pressable(tree, `${id}-play`).props.onPress());
    expect(onSpeakText).toHaveBeenCalledWith('What size would you like?');
    expect(byTestId(tree, `${id}-answer`)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).not.toContain('The size');

    act(() => pressable(tree, `${id}-reveal`).props.onPress());
    expect(byTestId(tree, `${id}-answer`).length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('The size');
  });

  it('shows an empty state', () => {
    const tree = render(<LessonListeningSection entries={[]} />);
    expect(byTestId(tree, 'lesson-listening-empty').length).toBeGreaterThan(0);
  });
});
