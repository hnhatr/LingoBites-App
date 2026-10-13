import React from 'react';
import {InteractionManager} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {CreatedTab} from '../tabs/CreatedTab';

let mockShown: Array<{id: string}> = [];

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('@features/lesson/player', () => ({
  ComposeRequestCards: () => null,
}));

jest.mock('../../logic/useLibrarySegments', () => ({
  useLibrarySegments: ({lessons}: {lessons: boolean}) => ({
    packagedLessons: lessons
      ? [
          {id: 'text', origin: 'learner', sourceType: 'learner_text'},
          {id: 'photo', origin: 'learner', sourceType: 'learner_ocr'},
          {id: 'video', origin: 'learner', sourceType: 'youtube'},
          {id: 'public', origin: 'admin', sourceType: 'admin_text'},
        ]
      : [],
    refresh: jest.fn(),
  }),
  useRefreshOnRefocus: jest.fn(),
}));

jest.mock('../LessonsTabContent', () => ({
  LessonsTabContent: ({packagedLessons}: {packagedLessons: {id: string}[]}) => {
    mockShown = packagedLessons;
    return null;
  },
}));

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CreatedTab />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('CreatedTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShown = [];
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task?: any) => {
        task?.();
        return {cancel: jest.fn()} as any;
      });
  });

  it('lists only the lessons the learner made', () => {
    render();
    expect(mockShown.map(lesson => lesson.id)).toEqual([
      'text',
      'photo',
      'video',
    ]);
  });

  it('starts a lesson from text or from YouTube', () => {
    const tree = render();
    act(() => {
      tree.root.findByProps({testID: 'library-create-text'}).props.onPress();
    });
    expect(mockAppNavigation.openCreate).toHaveBeenCalledTimes(1);
    act(() => {
      tree.root.findByProps({testID: 'library-create-youtube'}).props.onPress();
    });
    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'youtube',
    });
  });
});
