import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {CanonicalLessonPlayerScreen} from '../CanonicalLessonPlayerScreen';

const LESSON_ID = '33333333-3333-4333-8333-333333333301';
const S1 = '11111111-1111-4111-8111-111111111101';

const mockSpeak = jest.fn(() => Promise.resolve({ok: true}));
jest.mock('@features/audio', () => ({
  speak: (...args: unknown[]) => mockSpeak(...(args as [])),
}));

const snapshot: LessonSnapshot = {
  id: LESSON_ID,
  slug: 'morning',
  title: 'Morning routine',
  description: '',
  origin: 'learner',
  source_type: 'learner_text',
  content_revision: 1,
  unit: null,
  youtube: null,
  sentences: [0, 1, 2, 3].map(position => ({
    id: `11111111-1111-4111-8111-11111111110${position + 1}`,
    position,
    text_en: `Sentence ${position} en.`,
    text_vi: `Câu ${position} vi.`,
    ipa: `ipa-${position}`,
    start_ms: null,
    end_ms: null,
  })),
  blocks: [],
  analyses: {
    [S1]: {
      sentence_id: S1,
      vocabulary: [
        {
          id: '55555555-5555-4555-8555-555555555501',
          word: 'wake up',
          pos: 'verb',
          ipa: 'weɪk ʌp',
          meaning: 'thức dậy',
        },
      ],
      grammar: [],
      created_at: '2026-10-01T00:00:00.000Z',
    },
  },
};

let mockState: {status: string; [key: string]: unknown} = {
  status: 'ready',
  snapshot,
  offline: false,
  hasUpdate: false,
};
const mockOpen = jest.fn();

jest.mock('../../logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => ({
    state: mockState,
    open: mockOpen,
    checkForUpdate: jest.fn(),
    requestAnalysis: jest.fn(),
  }),
}));

let mockCompletionState: 'unfinished' | 'finished' | 'error' = 'unfinished';
const mockCompleteLesson = jest.fn();

const mockMarkStarted = jest.fn();

jest.mock('../../logic/useLessonCompletion', () => ({
  useLessonCompletion: () => ({
    state: mockCompletionState,
    complete: mockCompleteLesson,
    markStarted: mockMarkStarted,
  }),
}));

function renderScreen() {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <CanonicalLessonPlayerScreen
            navigation={navigation as never}
            route={{params: {lessonId: LESSON_ID}} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, navigation};
}

function pressable(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root
    .findAll(candidate => candidate.props.testID === testID)
    .find(candidate => typeof candidate.props.onPress === 'function');
  if (!node) throw new Error(`No pressable found for ${testID}`);
  return node;
}

function has(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node => node.props.testID === testID).length > 0;
}

describe('CanonicalLessonPlayerScreen lesson hub', () => {
  beforeEach(() => {
    mockState = {status: 'ready', snapshot, offline: false, hasUpdate: false};
    mockCompletionState = 'unfinished';
    mockSpeak.mockClear();
    mockOpen.mockClear();
    mockCompleteLesson.mockClear();
  });

  it('opens a text lesson on the hub without the retry action', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
    expect(has(tree, 'canonical-hub-expand')).toBe(true);
    expect(has(tree, 'canonical-player')).toBe(false);
    expect(has(tree, 'canonical-player-retry')).toBe(false);
    // F5: opening a ready lesson records its start for Home "Học tiếp".
    expect(mockMarkStarted).toHaveBeenCalled();
  });

  it('merges original and translation in one card with expand and mode toggle', () => {
    const {tree} = renderScreen();
    const text = () => JSON.stringify(tree.toJSON());
    expect(text()).toContain('Sentence 1 en.');
    expect(text()).not.toContain('Sentence 2 en.');
    act(() => {
      pressable(tree, 'canonical-hub-expand').props.onPress();
    });
    expect(text()).toContain('Sentence 3 en.');
    act(() => {
      pressable(tree, 'canonical-hub-mode-both').props.onPress();
    });
    expect(text()).toContain('Câu 3 vi.');
    expect(text()).toContain('Sentence 3 en.');
    act(() => {
      pressable(tree, 'canonical-hub-mode-translation').props.onPress();
    });
    expect(text()).not.toContain('Sentence 3 en.');
  });

  it('"Bắt đầu học" shows the sentence study and back returns to the hub', () => {
    const {tree, navigation} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    expect(has(tree, 'canonical-player')).toBe(true);
    expect(has(tree, 'canonical-lesson-hub')).toBe(false);
    expect(navigation.addListener).toHaveBeenCalledWith(
      'beforeRemove',
      expect.any(Function),
    );

    const header = tree.root
      .findAll(node => typeof node.props.onBack === 'function')
      .at(0);
    act(() => {
      header!.props.onBack();
    });
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('speaks a sentence with the en-US voice', () => {
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    act(() => {
      pressable(tree, `canonical-speak-${S1}`).props.onPress();
    });
    expect(mockSpeak).toHaveBeenCalledWith('Sentence 0 en.');
  });

  it('lists stored analysis words in the vocabulary section', () => {
    const {tree} = renderScreen();
    const vocabularyRow = tree.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.props.title === 'Từ vựng chính');
    act(() => {
      vocabularyRow!.props.onPress();
    });
    expect(
      // The list keys a word by its item code (PR 5).
      has(tree, 'lesson-vocabulary-phrase:wake up'),
    ).toBe(true);
  });

  it('shows retry only for a load error', () => {
    mockState = {status: 'error', error: {message: 'Lesson failed to load.'}};
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-player-retry').props.onPress();
    });
    expect(mockOpen).toHaveBeenCalled();
  });

  it('shows "Hoàn thành bài" on the hub and wires the completion action', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-complete')).toBe(true);
    act(() => {
      pressable(tree, 'canonical-hub-complete').props.onPress();
    });
    expect(mockCompleteLesson).toHaveBeenCalledTimes(1);
  });

  it('shows "Đã hoàn thành" instead of the action when finished (AC-003 S3)', () => {
    mockCompletionState = 'finished';
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-completed')).toBe(true);
    expect(has(tree, 'canonical-hub-complete')).toBe(false);
  });

  it('shows the error copy and keeps the action after a failed write (AC-004 S1)', () => {
    mockCompletionState = 'error';
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-complete-error')).toBe(true);
    expect(has(tree, 'canonical-hub-complete')).toBe(true);
  });
});
