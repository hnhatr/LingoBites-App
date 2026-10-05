import React from 'react';
import {ActivityIndicator, Text} from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import en from '@core/i18n/en.json';
import vi from '@core/i18n/vi.json';
import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import type {LessonCreationState} from '../../logic/useLessonCreation';
import {LessonCreationScreen} from '../LessonCreationScreen';

const CREATED_LESSON_ID = '33333333-3333-4333-8333-333333333302';

let mockState: LessonCreationState = {status: 'idle'};
const mockSubmit = jest.fn();
const mockCheckAgain = jest.fn();
const mockRetryWithFreshKey = jest.fn(async () => {});
const mockReadClipboard = jest.fn(async () => null as string | null);

jest.mock('../../logic/useLessonCreation', () => ({
  useLessonCreation: () => ({
    state: mockState,
    submit: mockSubmit,
    checkAgain: mockCheckAgain,
    retryWithFreshKey: mockRetryWithFreshKey,
  }),
}));

jest.mock('../../logic/clipboardText', () => ({
  readClipboardText: () => mockReadClipboard(),
}));

function renderScreen(
  initialSource: 'youtube' | 'text',
  navigation: {navigate: jest.Mock; goBack: jest.Mock},
) {
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
                  submissionId: 'test-submission-yt',
                  initialSource,
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

function pressByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const target = root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) {
    throw new Error(`No pressable for ${testID}`);
  }
  act(() => {
    target.props.onPress();
  });
}

function setUrlInput(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const inputs = root.findAll(
    node =>
      node.props.testID === 'lesson-creation-url-input' &&
      typeof node.props.onChangeText === 'function',
  );
  if (inputs.length === 0) {
    throw new Error('No lesson-creation-url-input with onChangeText');
  }
  act(() => {
    inputs[0].props.onChangeText(value);
  });
}

describe('LessonCreation YouTube path (LING-190 TASK-001)', () => {
  beforeEach(() => {
    mockState = {status: 'idle'};
    mockSubmit.mockClear();
    mockCheckAgain.mockClear();
    mockRetryWithFreshKey.mockClear();
    mockReadClipboard.mockReset();
    mockReadClipboard.mockResolvedValue(null);
  });

  describe('AC-001', () => {
    it('S1 hides source tabs and shows the URL field for youtube entry', () => {
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      expect(
        tree.root.findAllByProps({testID: 'lesson-creation-source-tabs'}),
      ).toHaveLength(0);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-url-input'}),
      ).toBeTruthy();
    });

    it('S2 keeps source tabs on the text entry path', () => {
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('text', navigation);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-source-tabs'}),
      ).toBeTruthy();
    });

    it('S3 disables submit when the link field is empty', () => {
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      const submit = tree.root.findByProps({testID: 'lesson-creation-submit'});
      expect(submit.props.disabled).toBe(true);
      setUrlInput(tree.root, 'https://youtu.be/x');
      expect(
        tree.root.findByProps({testID: 'lesson-creation-submit'}).props
          .disabled,
      ).toBe(false);
    });

    it('S4 pastes clipboard text or shows a notice when empty', async () => {
      mockReadClipboard.mockResolvedValueOnce('https://youtu.be/x');
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      await act(async () => {
        pressByTestId(tree.root, 'lesson-creation-paste');
      });
      const input = tree.root.findByProps({
        testID: 'lesson-creation-url-input',
      });
      expect(input.props.value).toBe('https://youtu.be/x');

      mockReadClipboard.mockResolvedValueOnce(null);
      await act(async () => {
        pressByTestId(tree.root, 'lesson-creation-paste');
      });
      const notice = tree.root
        .findAllByType(Text)
        .some(node => node.props.children === vi.youtube.create.paste_empty);
      expect(notice).toBe(true);
    });

    it('S5 clears the field and disables submit', () => {
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      setUrlInput(tree.root, 'https://youtu.be/x');
      pressByTestId(tree.root, 'lesson-creation-clear');
      const input = tree.root.findByProps({
        testID: 'lesson-creation-url-input',
      });
      expect(input.props.value).toBe('');
      expect(
        tree.root.findByProps({testID: 'lesson-creation-submit'}).props
          .disabled,
      ).toBe(true);
    });

    it('S6 shows both info lines without saved-lesson control', () => {
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      const texts = tree.root
        .findAllByType(Text)
        .map(node => node.props.children);
      expect(texts).toContain(vi.youtube.create.info_subtitles);
      expect(texts).toContain(vi.youtube.create.info_privacy);
      expect(
        tree.root.findAll(
          node => node.props.children === vi.youtube.open_history_short,
        ).length,
      ).toBe(0);
    });
  });

  describe('AC-002', () => {
    it('S1 marks step 1 active while submitting', () => {
      mockState = {status: 'submitting'};
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-step-1'}),
      ).toBeTruthy();
      expect(tree.root.findAllByType(ActivityIndicator).length).toBe(0);
    });

    it('S2 marks step 2 active while processing', () => {
      mockState = {status: 'processing', requestId: 'r1'};
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-processing-text'}),
      ).toBeTruthy();
      expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(
        0,
      );
    });

    it('S3 opens the lesson only when the learner taps open', () => {
      mockState = {
        status: 'succeeded',
        requestId: 'r1',
        lessonId: CREATED_LESSON_ID,
      };
      mockAppNavigation.finishCreate.mockClear();
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      expect(mockAppNavigation.finishCreate).not.toHaveBeenCalled();
      pressByTestId(tree.root, 'lesson-creation-open');
      // Replaces the creation flow with the lesson (no push on top of it).
      expect(mockAppNavigation.finishCreate).toHaveBeenCalledWith(
        CREATED_LESSON_ID,
      );
      expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('S4 does not start a looping animation when reduce motion is on', () => {
      const reduceSpy = jest
        .spyOn(Reanimated, 'useReducedMotion')
        .mockReturnValue(true);
      mockState = {status: 'processing', requestId: 'r1'};
      try {
        const tree = renderScreen('youtube', {
          navigate: jest.fn(),
          goBack: jest.fn(),
        });
        expect(
          tree.root.findByProps({testID: 'lesson-creation-processing'}),
        ).toBeTruthy();
      } finally {
        reduceSpy.mockRestore();
      }
    });

    it('S5 goes back from processing via Quay lại', () => {
      mockState = {status: 'processing', requestId: 'r1'};
      mockAppNavigation.goBack.mockClear();
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      pressByTestId(tree.root, 'lesson-creation-back-processing');
      expect(mockAppNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-003', () => {
    it('S1 calls checkAgain without submit on timeout check', () => {
      mockState = {status: 'timedOut', requestId: 'r1'};
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      pressByTestId(tree.root, 'lesson-creation-check-again');
      expect(mockCheckAgain).toHaveBeenCalledTimes(1);
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('S2 goes back from timeout via Quay lại sau', () => {
      mockState = {status: 'timedOut', requestId: 'r1'};
      mockAppNavigation.goBack.mockClear();
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      pressByTestId(tree.root, 'lesson-creation-back-later');
      expect(mockAppNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-004', () => {
    it('S1 shows retryable failed state with retry action', async () => {
      mockState = {
        status: 'failed',
        requestId: 'r1',
        code: 'X_UNKNOWN',
        retryable: true,
      };
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('youtube', navigation);
      const codeNode = tree.root.findByProps({
        testID: 'lesson-creation-error-code',
      });
      expect(codeNode.props.children).toContain('X_UNKNOWN');
      pressByTestId(tree.root, 'lesson-creation-retry');
      expect(mockRetryWithFreshKey).toHaveBeenCalledTimes(1);
    });

    it('S2 hides retry when failed is not retryable', () => {
      mockState = {
        status: 'failed',
        requestId: 'r1',
        code: 'NO_SUBS',
        retryable: false,
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      expect(
        tree.root.findAll(node => node.props.testID === 'lesson-creation-retry')
          .length,
      ).toBe(0);
    });

    it('S3 shows network error message and code', () => {
      mockState = {
        status: 'error',
        error: {
          ok: false,
          kind: 'network-error',
          errorCode: 'NET_OFFLINE',
          message: 'offline',
          retryable: true,
        },
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      const texts = tree.root
        .findAllByType(Text)
        .map(node => node.props.children);
      expect(texts).toContain(vi.youtube.create.error_network);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-error-code'}).props
          .children,
      ).toContain('NET_OFFLINE');
    });

    it('S4 shows default error without client message text', () => {
      mockState = {
        status: 'error',
        error: {
          ok: false,
          kind: 'server-error',
          errorCode: 'SERVER_500',
          message: 'Internal detail',
          retryable: false,
        },
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      const texts = tree.root
        .findAllByType(Text)
        .map(node => node.props.children);
      expect(texts).toContain(vi.youtube.create.error_default);
      expect(texts).not.toContain('Internal detail');
    });

    it('S5 submits edited youtube url from failed state', () => {
      mockState = {
        status: 'failed',
        requestId: 'r1',
        code: 'X',
        retryable: false,
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      setUrlInput(tree.root, '  https://youtu.be/new  ');
      pressByTestId(tree.root, 'lesson-creation-submit');
      expect(mockSubmit).toHaveBeenCalledWith({
        source: 'youtube',
        url: 'https://youtu.be/new',
      });
    });
  });

  describe('AC-012 creation i18n', () => {
    it('keeps vi/en key parity for youtube.create', () => {
      expect(Object.keys(vi.youtube.create).sort()).toEqual(
        Object.keys(en.youtube.create).sort(),
      );
    });
  });

  describe('LING-191 disclosure copy', () => {
    it('keeps vi/en key parity for youtube.disclosure_*', () => {
      const disclosureKeys = [
        'disclosure_title',
        'disclosure_body',
        'disclosure_confirm',
        'disclosure_cancel',
      ];
      for (const key of disclosureKeys) {
        expect(vi.youtube[key as keyof typeof vi.youtube]).toBeTruthy();
        expect(en.youtube[key as keyof typeof en.youtube]).toBeTruthy();
      }
    });

    it('S2 retries network errors through submit (shared screen path)', () => {
      mockState = {
        status: 'error',
        error: {
          ok: false,
          kind: 'network-error',
          errorCode: 'NET_OFFLINE',
          message: 'offline',
          retryable: true,
        },
      };
      const navigation = {navigate: jest.fn(), goBack: jest.fn()};
      const tree = renderScreen('text', navigation);
      pressByTestId(tree.root, 'lesson-creation-source-youtube');
      setUrlInput(tree.root, 'https://youtu.be/retry');
      pressByTestId(tree.root, 'lesson-creation-retry');
      expect(mockSubmit).toHaveBeenCalledWith({
        source: 'youtube',
        url: 'https://youtu.be/retry',
      });
    });
  });

  describe('AC-020 waiting_transcript (LING-200)', () => {
    it('S1 shows a distinct waiting message while polling', () => {
      mockState = {
        status: 'waiting_transcript',
        requestId: 'r-wait',
        polling: true,
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      const texts = tree.root
        .findAllByType(Text)
        .map(node => node.props.children);
      expect(texts).toContain(vi.youtube.create.waiting_transcript_title);
      expect(
        tree.root.findByProps({testID: 'lesson-creation-waiting-text'}),
      ).toBeTruthy();
      expect(
        tree.root.findAllByProps({testID: 'lesson-creation-error'}),
      ).toHaveLength(0);
    });

    it('S2 offers check again without retry when polling paused', () => {
      mockState = {
        status: 'waiting_transcript',
        requestId: 'r-wait',
        polling: false,
      };
      const tree = renderScreen('youtube', {
        navigate: jest.fn(),
        goBack: jest.fn(),
      });
      pressByTestId(tree.root, 'lesson-creation-check-again');
      expect(mockCheckAgain).toHaveBeenCalledTimes(1);
      expect(
        tree.root.findAll(node => node.props.testID === 'lesson-creation-retry')
          .length,
      ).toBe(0);
    });
  });
});
