import React from 'react';
import {InteractionManager} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {
  createdAction,
  createdProgressLabel,
  createdSourceLabel,
  CreatedTab,
} from '../tabs/CreatedTab';

const mockToggle = jest.fn();

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
          mockLesson('text', 'learner', 'learner_text'),
          mockLesson('photo', 'learner', 'learner_ocr'),
          mockLesson('video', 'learner', 'youtube'),
          mockLesson('public', 'admin', 'admin_text'),
        ]
      : [],
    refresh: jest.fn(),
  }),
  useRefreshOnRefocus: jest.fn(),
}));

const mockLesson = (id: string, origin: string, sourceType: string) => ({
  id,
  title: `Lesson ${id}`,
  blurb: '',
  dateLabel: '',
  vocabularyCount: 8,
  durationMin: 5,
  origin,
  sourceType,
  practiceReady: id === 'text',
});

jest.mock('../../logic/lessonCardData', () => ({
  EMPTY_LESSON_CARD_STATE: {progress: new Map()},
  readLessonCardLocalState: () => ({
    progress: new Map([['video', {state: 'in_progress', done: 3, total: 8}]]),
  }),
  useLessonBookmarks: () => ({
    isBookmarked: (id: string) => id === 'photo',
    toggleBookmark: mockToggle,
  }),
}));

const shownIds = (tree: ReactTestRenderer.ReactTestRenderer) =>
  Array.from(
    new Set(
      tree.root
        .findAll(node =>
          /^lesson-item-[a-z]+$/.test(String(node.props.testID ?? '')),
        )
        .map(node => String(node.props.testID).slice('lesson-item-'.length)),
    ),
  );

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
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task?: any) => {
        task?.();
        return {cancel: jest.fn()} as any;
      });
  });

  it('lists only the lessons the learner made', () => {
    expect(shownIds(render())).toEqual(['text', 'photo', 'video']);
  });

  it('opens a lesson, saves it and starts its practice', () => {
    const tree = render();
    act(() => {
      tree.root.findByProps({testID: 'lesson-item-video'}).props.onPress();
    });
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('video');
    act(() => {
      tree.root
        .findByProps({testID: 'lesson-item-photo-bookmark'})
        .props.onPress();
    });
    expect(mockToggle).toHaveBeenCalledWith(
      expect.objectContaining({lessonId: 'photo'}),
    );
    expect(
      tree.root.findAllByProps({testID: 'lesson-practice-text'}),
    ).not.toHaveLength(0);
  });

  it('labels where a lesson came from and how far it got', () => {
    expect(createdSourceLabel('youtube')).toBe('Từ YouTube');
    expect(createdSourceLabel('learner_ocr')).toBe('Từ ảnh');
    expect(createdSourceLabel('learner_text')).toBe('Từ văn bản');
    expect(createdProgressLabel(undefined)).toBeNull();
    expect(
      createdProgressLabel({state: 'in_progress', done: 3, total: 8}),
    ).toBe('Đã học 3/8');
    expect(createdProgressLabel({state: 'completed'})).toBe('Đã xong');
    expect(createdAction(undefined).label).toBe('Vào học');
    expect(createdAction({state: 'in_progress'}).label).toBe('Học tiếp');
    expect(createdAction({state: 'completed'}).label).toBe('Ôn lại');
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
