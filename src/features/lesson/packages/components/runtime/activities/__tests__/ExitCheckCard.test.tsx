import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {AppButton} from '@ui/components/AppButton';
import {ExitCheckCard} from '../ExitCheckCard';

const items = [
  {
    id: 'q-1',
    slug: 'q-1',
    type: 'translation' as const,
    question: 'Bạn đang làm gì?',
    answer: 'What are you doing?',
  },
  {
    id: 'q-2',
    slug: 'q-2',
    type: 'translation' as const,
    question: 'Tôi đang làm việc.',
    answer: "I'm working.",
  },
];

function renderCard(onComplete: (answers: Array<{correct: boolean}>) => void) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ExitCheckCard
            data={{kind: 'exit_check', items}}
            onComplete={onComplete}
            onSkip={jest.fn()}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function buttons(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAllByType(AppButton);
}

describe('ExitCheckCard', () => {
  it('requires reveal and self-grade, then submits evaluator-ready answers', () => {
    const onComplete = jest.fn();
    const tree = renderCard(onComplete);

    expect(
      buttons(tree).find(
        button => button.props.title === 'Hoàn thành bài kiểm tra',
      )?.props.disabled,
    ).toBe(true);

    act(() => {
      buttons(tree)
        .find(button => button.props.title === 'Xem đáp án')
        ?.props.onPress();
    });
    act(() => {
      buttons(tree)
        .find(button => button.props.title === 'Tôi nhớ')
        ?.props.onPress();
    });
    act(() => {
      buttons(tree)
        .find(button => button.props.title === 'Xem đáp án')
        ?.props.onPress();
    });
    act(() => {
      const reviewButtons = buttons(tree).filter(
        button => button.props.title === 'Cần ôn lại',
      );
      reviewButtons[reviewButtons.length - 1]?.props.onPress();
    });

    act(() => {
      buttons(tree)
        .find(button => button.props.title === 'Hoàn thành bài kiểm tra')
        ?.props.onPress();
    });

    expect(onComplete).toHaveBeenCalledWith([
      {correct: true},
      {correct: false},
    ]);
  });

  it('submits an empty answer set with a deliberate empty state', () => {
    const onComplete = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <ExitCheckCard
              data={{kind: 'exit_check', items: []}}
              onComplete={onComplete}
              onSkip={jest.fn()}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    expect(tree.root.findByProps({testID: 'exit-check-empty'})).toBeTruthy();
    act(() => {
      buttons(tree)
        .find(button => button.props.title === 'Hoàn thành bài kiểm tra')
        ?.props.onPress();
    });
    expect(onComplete).toHaveBeenCalledWith([]);
  });
});
