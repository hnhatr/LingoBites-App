import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {CanonicalLessonHub} from '../CanonicalLessonHub';

const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

const SENTENCES = [
  ['I wake up at six.', 'Tôi thức dậy lúc sáu giờ.'],
  ['Then I drink coffee.', 'Sau đó tôi uống cà phê.'],
  ['She reads a book.', 'Cô ấy đọc một cuốn sách.'],
];

function snapshot(sentenceCount: number): LessonSnapshot {
  return {
    id: id(500),
    slug: 'morning',
    title: 'Morning routine',
    description: '',
    origin: 'learner',
    source_type: 'learner_text',
    content_revision: 1,
    unit: null,
    youtube: null,
    sentences: SENTENCES.slice(0, sentenceCount).map(([en, vi], index) => ({
      id: id(index + 1),
      position: index,
      text_en: en,
      text_vi: vi,
      ipa: 'ə',
      start_ms: null,
      end_ms: null,
    })),
    blocks: [],
    analyses: {},
  };
}

function render(props: {sentences: number; onOpenPractice?: () => void}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CanonicalLessonHub
            analyses={{}}
            onOpenPractice={props.onOpenPractice}
            onOpenSection={jest.fn()}
            snapshot={snapshot(props.sentences)}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const row = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => node.props.testID === 'canonical-hub-practice');

describe('CanonicalLessonHub practice entry', () => {
  it('shows the quick-practice row for a lesson big enough for a quiz', () => {
    const onOpenPractice = jest.fn();
    const tree = render({sentences: 3, onOpenPractice});
    const pressable = row(tree).find(
      n => typeof n.props.accessibilityLabel === 'string',
    );
    expect(pressable).toBeDefined();
    expect(pressable!.props.accessibilityLabel).toBe('Luyện tập nhanh');
    act(() => pressable!.props.onPress());
    expect(onOpenPractice).toHaveBeenCalledTimes(1);
  });

  it('hides the row when practice is off (no handler)', () => {
    expect(row(render({sentences: 3}))).toHaveLength(0);
  });

  it('hides the row while the lesson is too small for a quiz', () => {
    expect(row(render({sentences: 2, onOpenPractice: jest.fn()}))).toHaveLength(
      0,
    );
  });
});
