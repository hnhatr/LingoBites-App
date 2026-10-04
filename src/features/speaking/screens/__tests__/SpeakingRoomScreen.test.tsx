import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {SpeakingRoomScreen} from '../SpeakingRoomScreen';

const mockNavigate = jest.fn();

const LESSON_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

jest.mock('@features/lesson/player', () => ({
  hasDownloadedLessons: jest.fn(() => true),
}));

jest.mock('../../logic/speakingModes', () => ({
  listSpeakingRoomModes: jest.fn(() => [
    {
      mode: 'shadowing',
      titleVi: 'Lặp lại theo mẫu (Shadowing)',
      descriptionVi: 'Nghe và ghi âm',
      available: true,
      durationMin: 2,
      level: 'A2',
      icon: 'repeat',
      recommended: true,
    },
  ]),
}));

jest.mock('../../logic/shadowing/shadowingProgress', () => ({
  findMostRecentInProgressShadowingLesson: jest.fn(() => ({
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
  })),
}));

const {findMostRecentInProgressShadowingLesson} = jest.requireMock(
  '../../logic/shadowing/shadowingProgress',
) as {findMostRecentInProgressShadowingLesson: jest.Mock};

async function renderSpeakingRoom() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <SpeakingRoomScreen
            navigation={{navigate: mockNavigate, goBack: jest.fn()}}
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

describe('SpeakingRoomScreen shadowing entry', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('AC-001: opens the lesson picker from the Shadowing card', async () => {
    const tree = await renderSpeakingRoom();
    press(tree, 'speaking-mode-shadowing');
    expect(mockNavigate).toHaveBeenCalledWith('ShadowingLessonPicker');
  });

  it('AC-014 S1: Tiếp tục opens session at resume sentence', async () => {
    const tree = await renderSpeakingRoom();
    expect(
      tree.root.findByProps({testID: 'shadowing-continue-detail'}).props
        .children,
    ).toEqual(expect.arrayContaining([5, 12]));
    press(tree, 'shadowing-continue-row');
    expect(mockNavigate).toHaveBeenCalledWith('ShadowingSession', {
      lessonId: LESSON_B,
      sentenceIndex: 4,
    });
  });

  it('AC-014 S2: hides Tiếp tục when no in-progress lesson', async () => {
    findMostRecentInProgressShadowingLesson.mockReturnValue(null);
    const tree = await renderSpeakingRoom();
    expect(() =>
      tree.root.findByProps({testID: 'shadowing-continue-row'}),
    ).toThrow();
  });
});
