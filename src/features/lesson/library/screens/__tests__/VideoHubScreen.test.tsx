import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import type {VideoInProgress} from '../../logic/videoHub';
import {VideoHubScreen} from '../VideoHubScreen';

let mockCounts: Record<string, number> = {};
let mockInProgress: VideoInProgress | null = null;
let mockCreationStatus = 'available';
const mockStart = jest.fn(() => true);

jest.mock('../../logic/useLibraryCounts', () => ({
  useLibraryCounts: () => ({counts: mockCounts, refresh: jest.fn()}),
}));

jest.mock('../../logic/videoHub', () => ({
  findVideoInProgress: () => mockInProgress,
}));

jest.mock('@features/input', () => ({
  useYouTubeLessonCreation: () => ({
    status: mockCreationStatus,
    start: mockStart,
  }),
}));

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const props = {
    navigation: {} as any,
    route: {key: 'VideoHub', name: 'VideoHub' as const, params: undefined},
  };
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <VideoHubScreen {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestID = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll(node => node.props.testID === testID);

const press = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  act(() => {
    byTestID(tree, testID)[0].props.onPress();
  });

describe('VideoHubScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCounts = {video: 0};
    mockInProgress = null;
    mockCreationStatus = 'available';
  });

  it('hides the continue card when no video is in progress', () => {
    const tree = render();
    expect(byTestID(tree, 'video-hub-continue')).toHaveLength(0);
  });

  it('continues the video in progress', () => {
    mockInProgress = {
      lessonId: 'lesson-yt',
      title: 'Coffee talk',
      sentenceCount: 12,
      youtubeDurationMs: 90_000,
    };
    const tree = render();
    expect(byTestID(tree, 'video-hub-continue').length).toBeGreaterThan(0);
    press(tree, 'video-hub-continue-card');
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('lesson-yt');
  });

  it('opens the own and public video lists', () => {
    const tree = render();
    press(tree, 'video-hub-mine');
    press(tree, 'video-hub-public');
    expect(mockAppNavigation.openLibrarySection.mock.calls).toEqual([
      ['video'],
      ['publicVideo'],
    ]);
  });

  it('shows the own video count, or the empty hint', () => {
    const empty = render();
    expect(byTestID(empty, 'video-hub-mine-count')[0].props.children).toBe(
      'Chưa có bài từ video',
    );

    mockCounts = {video: 3};
    const filled = render();
    expect(byTestID(filled, 'video-hub-mine-count')[0].props.children).toBe(
      '3 bài',
    );
  });

  it('starts a YouTube lesson through the shared creation hook', () => {
    const tree = render();
    expect(byTestID(tree, 'video-hub-create-note')).toHaveLength(0);
    press(tree, 'video-hub-create');
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('disables creation and explains why when unavailable', () => {
    mockCreationStatus = 'unavailable';
    const tree = render();
    const button = byTestID(tree, 'video-hub-create')[0];
    expect(button.props.disabled).toBe(true);
    expect(byTestID(tree, 'video-hub-create-note')[0].props.children).toBe(
      'Tính năng tạo bài từ video đang chưa khả dụng',
    );
    // Watching stays available.
    press(tree, 'video-hub-public');
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'publicVideo',
    );
  });
});
