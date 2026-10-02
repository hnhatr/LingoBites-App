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
    mockSpeak.mockClear();
    mockOpen.mockClear();
  });

  it('opens a text lesson on the hub without the retry action', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
    expect(has(tree, 'canonical-hub-see-all')).toBe(true);
    expect(has(tree, 'canonical-player')).toBe(false);
    expect(has(tree, 'canonical-player-retry')).toBe(false);
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

  it('intercepts back/swipe from a section but not a tab pop-to-top', () => {
    const {tree, navigation} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    const listener = (
      navigation.addListener.mock.calls as unknown as [
        string,
        (event: {
          data: {action: {type: string}};
          preventDefault: () => void;
        }) => void,
      ][]
    ).find(([name]) => name === 'beforeRemove')![1];

    const popToTop = {
      data: {action: {type: 'POP_TO_TOP'}},
      preventDefault: jest.fn(),
    };
    act(() => {
      listener(popToTop);
    });
    expect(popToTop.preventDefault).not.toHaveBeenCalled();
    expect(has(tree, 'canonical-player')).toBe(true);

    const goBack = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => {
      listener(goBack);
    });
    expect(goBack.preventDefault).toHaveBeenCalled();
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
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
      has(tree, 'lesson-vocabulary-55555555-5555-4555-8555-555555555501'),
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
});
