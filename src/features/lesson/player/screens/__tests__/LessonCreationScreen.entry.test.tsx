import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {LessonCreationScreen} from '../LessonCreationScreen';

const CREATED_LESSON_ID = '33333333-3333-4333-8333-333333333302';

jest.mock('../../logic/useLessonCreation', () => ({
  useLessonCreation: () => ({
    state: {
      status: 'succeeded',
      requestId: 'req-creation-1',
      lessonId: CREATED_LESSON_ID,
    },
    submit: jest.fn(),
    checkAgain: jest.fn(),
    retryWithFreshKey: jest.fn(),
  }),
}));

function renderCreation(navigation: {navigate: jest.Mock; goBack: jest.Mock}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <LessonCreationScreen
            navigation={navigation as never}
            route={
              {
                params: {
                  submissionId: 'test-submission-1',
                  initialSource: 'text',
                },
              } as never
            }
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('LessonCreationScreen entry point (LING-179 TASK-001)', () => {
  it('opens the player with the new lessonId on creation success', () => {
    const navigation = {navigate: jest.fn(), goBack: jest.fn()};
    const tree = renderCreation(navigation);

    const target = tree.root
      .findAll(node => node.props.testID === 'lesson-creation-open')
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for lesson-creation-open');
    act(() => {
      target.props.onPress();
    });

    expect(mockAppNavigation.finishCreate).toHaveBeenCalledWith(
      CREATED_LESSON_ID,
    );
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
