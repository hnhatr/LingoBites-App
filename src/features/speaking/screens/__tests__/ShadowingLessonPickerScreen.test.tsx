import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {ShadowingLessonPickerScreen} from '../ShadowingLessonPickerScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const LESSON_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LESSON_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

jest.mock('@features/lesson/player', () => ({
  hasDownloadedLessons: jest.fn(() => true),
}));

jest.mock('../../logic/shadowing/shadowingProgress', () => ({
  listShadowingLessonProgressSummaries: jest.fn(() => [
    {
      lessonId: LESSON_A,
      titleVi: 'Lesson A',
      sentenceCount: 8,
      estimatedMinutes: 3,
      practicedSentenceCount: 0,
      reviewSentenceCount: 0,
      statusChip: 'Chưa luyện',
      resumeSentenceIndex: 0,
      resumeSentenceNumber: 1,
      lastPracticedAt: null,
    },
    {
      lessonId: LESSON_B,
      titleVi: 'Lesson B',
      sentenceCount: 12,
      estimatedMinutes: 4,
      practicedSentenceCount: 4,
      reviewSentenceCount: 0,
      statusChip: 'Đang dở',
      resumeSentenceIndex: 4,
      resumeSentenceNumber: 5,
      lastPracticedAt: '2026-10-04T10:03:00.000Z',
    },
  ]),
}));

const {listShadowingLessonProgressSummaries} = jest.requireMock(
  '../../logic/shadowing/shadowingProgress',
) as {listShadowingLessonProgressSummaries: jest.Mock};

const {hasDownloadedLessons} = jest.requireMock('@features/lesson/player') as {
  hasDownloadedLessons: jest.Mock;
};

async function renderPicker() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <ShadowingLessonPickerScreen
            navigation={{navigate: mockNavigate, goBack: mockGoBack}}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root.findByProps({testID});
  act(() => {
    target.props.onPress();
  });
}

describe('ShadowingLessonPickerScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    hasDownloadedLessons.mockReturnValue(true);
    listShadowingLessonProgressSummaries.mockClear();
  });

  it('AC-003 S1: shows the in-progress count and no chip for an unpractised lesson', async () => {
    const tree = await renderPicker();
    expect(
      tree.root.findAllByProps({
        testID: `shadowing-lesson-${LESSON_A}-chip-progress`,
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({
        testID: `shadowing-lesson-${LESSON_B}-chip-progress`,
      }),
    ).toBeTruthy();
    expect(tree.root.findByProps({children: 'Đã luyện 4/12'})).toBeTruthy();
  });

  it('AC-004 S1: opens session at resume sentence for in-progress lesson', async () => {
    const tree = await renderPicker();
    press(tree, `shadowing-lesson-${LESSON_B}`);
    expect(mockNavigate).toHaveBeenCalledWith('ShadowingSession', {
      lessonId: LESSON_B,
      sentenceIndex: 4,
    });
  });

  it('AC-003 S3: shows empty-download state when no lessons on device', async () => {
    hasDownloadedLessons.mockReturnValue(false);
    listShadowingLessonProgressSummaries.mockReturnValue([]);
    const tree = await renderPicker();
    expect(
      tree.root.findByProps({testID: 'shadowing-picker-empty-downloads'}),
    ).toBeTruthy();
  });
});
