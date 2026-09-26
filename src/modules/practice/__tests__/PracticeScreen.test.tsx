import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {FeatureFlagProvider} from '@/release';
import {validFullOutput} from '@shared/fixtures';
import type {HomeStackParamList} from '@/app/navigation/types';
import {AppThemeProvider} from '@theme';
import {PracticeScreen} from '../PracticeScreen';

const tabNavigate = jest.fn();

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  getParent: () => ({navigate: tabNavigate}),
} as unknown as NativeStackNavigationProp<HomeStackParamList, 'Practice'>;

function renderWith(params: HomeStackParamList['Practice']) {
  const route = {
    key: 'Practice',
    name: 'Practice',
    params,
  } as React.ComponentProps<typeof PracticeScreen>['route'];

  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <PracticeScreen navigation={navigation} route={route} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function findText(
  tree: ReactTestRenderer.ReactTestRenderer,
  text: string,
): boolean {
  return (
    tree.root.findAll(
      node =>
        typeof node.props.children === 'string' && node.props.children === text,
    ).length > 0
  );
}

describe('PracticeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows quick-practice empty state with a create CTA when there are no questions', () => {
    const tree = renderWith({questions: []});
    expect(findText(tree, 'Chưa có bài học nào để luyện nhanh.')).toBe(true);
    expect(
      findText(tree, 'Luyện nhanh lấy câu từ các bài học bạn đã tạo.'),
    ).toBe(true);
    const create = tree.root.findByProps({
      testID: 'practice-quick-empty-create',
    });
    ReactTestRenderer.act(() => {
      create.props.onPress();
    });
    expect(tabNavigate).toHaveBeenCalledWith('Create');
  });

  it('renders the first question and grades a correct answer', () => {
    const question = validFullOutput.practice[0];
    expect(question.type).toBe('multiple_choice');
    const tree = renderWith({questions: validFullOutput.practice});

    expect(findText(tree, question.question)).toBe(true);

    const correctButton = tree.root.find(
      node =>
        node.props.accessibilityLabel === question.answer &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState !== undefined,
    );

    ReactTestRenderer.act(() => {
      correctButton.props.onPress();
    });

    expect(findText(tree, 'Chính xác!')).toBe(true);
  });

  it('shows a skip fallback instead of meta-label options (SETE-210 P0)', () => {
    const tree = renderWith({
      questions: [
        {
          id: 'q-bad',
          type: 'multiple_choice',
          question: 'Chọn nghĩa đúng của từ "English"',
          options: ['từ vựng: English', 'việc học tập', 'từ vựng: easy'],
          answer: 'từ vựng: English',
        },
      ],
    });

    expect(
      tree.root.findByProps({testID: 'practice-invalid-question'}),
    ).toBeDefined();
    const skip = tree.root.findByProps({testID: 'practice-skip-button'});
    expect(skip).toBeDefined();
    ReactTestRenderer.act(() => {
      skip.props.onPress();
    });
    expect(findText(tree, 'Kết quả')).toBe(true);
  });
});
