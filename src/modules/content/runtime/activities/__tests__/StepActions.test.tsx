import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {AppButton} from '@ui/components/AppButton';
import {StepActions} from '../StepActions';

type Props = React.ComponentProps<typeof StepActions>;

function renderActions(props: Props) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <StepActions {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function hostTestIDs(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll(
      node =>
        typeof node.type === 'string' && typeof node.props?.testID === 'string',
    )
    .map(node => node.props.testID as string);
}

describe('StepActions accessibility (SETE-265)', () => {
  it('exposes complete and skip as buttons with distinct identifiers', () => {
    const tree = renderActions({onComplete: jest.fn(), onSkip: jest.fn()});

    const complete = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'lesson-step-complete' &&
        node.props.accessibilityRole === 'button',
    );
    const skip = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'lesson-step-skip' &&
        node.props.accessibilityRole === 'button',
    );

    expect(complete).toHaveLength(1);
    expect(skip).toHaveLength(1);
  });

  it('renders no duplicate accessibility identifiers on one step', () => {
    const tree = renderActions({onComplete: jest.fn(), onSkip: jest.fn()});
    const ids = hostTestIDs(tree);

    expect(ids).toContain('lesson-step-complete');
    expect(ids).toContain('lesson-step-skip');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('honours caller-supplied identifiers', () => {
    const tree = renderActions({
      completeTestID: 'custom-complete',
      onComplete: jest.fn(),
      onSkip: jest.fn(),
      skipTestID: 'custom-skip',
    });
    const ids = hostTestIDs(tree);

    expect(ids).toContain('custom-complete');
    expect(ids).toContain('custom-skip');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders only the complete button when onSkip is absent', () => {
    const tree = renderActions({onComplete: jest.fn()});
    const ids = hostTestIDs(tree);

    expect(ids).toContain('lesson-step-complete');
    expect(ids).not.toContain('lesson-step-skip');
    expect(
      tree.root
        .findAllByType(AppButton)
        .filter(node => node.props.testID === 'lesson-step-complete'),
    ).toHaveLength(1);
  });
});
