import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {saveFlashcard} from '../../logic/FlashcardRepository';
import {DailyReviewScreen} from '../DailyReviewScreen';

const mockSpeak = jest.fn((_text: string) => Promise.resolve({ok: true}));
jest.mock('@features/audio', () => ({
  speak: (text: string) => mockSpeak(text),
}));

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popToTop: jest.fn(),
};

async function renderScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <DailyReviewScreen navigation={navigation as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

function texts(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root
    .findByProps({testID})
    .findAll(node => typeof node.props?.children === 'string')
    .map(node => node.props.children as string);
}

describe('DailyReviewScreen pattern cards', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    mockSpeak.mockClear();
  });

  it('asks in Vietnamese and answers with the frame and its example', async () => {
    const saved = saveFlashcard({
      lessonId: 'lesson-drinks',
      vocabulary: {
        id: 'pattern:can-i-have',
        word: 'Can I have a {size} {drink}, please?',
        meaningVi: 'Cho tôi một [đồ uống] [cỡ] được không?',
        example: 'Can I have a large coffee, please?',
        exampleTranslation: 'Cho tôi một cà phê cỡ lớn được không?',
      },
      item: {itemKey: 'pattern:can-i-have', itemId: null, kind: 'pattern'},
      now: '2026-08-17T00:00:00.000Z',
    });
    expect(saved.ok).toBe(true);
    const tree = await renderScreen();

    const front = texts(tree, 'review-card-front');
    expect(front).toContain('Cho tôi một [đồ uống] [cỡ] được không?');
    expect(front).toContain('Nói câu tiếng Anh cho ý này');
    expect(front.join('\n')).not.toContain('Can I have');
    expect(
      tree.root.findAllByProps({testID: 'review-speak-front'}),
    ).toHaveLength(0);

    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'daily-review-flip-card' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });

    const back = texts(tree, 'review-card-back');
    expect(back).toContain('Can I have a … …, please?');
    expect(back).toContain('Can I have a large coffee, please?');
    const speakBack = tree.root.find(
      node =>
        node.props.testID === 'review-speak-back' &&
        typeof node.props.onPress === 'function',
    );
    await act(async () => {
      speakBack.props.onPress();
    });
    expect(mockSpeak).toHaveBeenCalledWith(
      'Can I have a large coffee, please?',
    );
    act(() => tree.unmount());
  });
});
