import type ReactTestRenderer from 'react-test-renderer';
import {act} from 'react-test-renderer';

import type {QuizQuestion} from '@core/learning/packQuiz';
import type {CatalogItem} from '@core/schemas/lesson';

import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {learnWordPack} from '../../logic/wordPathClient';
import {PackLearnScreen} from '../PackLearnScreen';
import {QuickKnownCheckScreen} from '../QuickKnownCheckScreen';

/** Vocab path P5: the quick known check and the learn session send the right words to the Server. */

jest.mock('../../logic/wordPathClient', () => ({
  learnWordPack: jest.fn(),
}));

const mockLearn = learnWordPack as jest.MockedFunction<typeof learnWordPack>;

function word(code: string, meaning: string): CatalogItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code,
    kind: 'word',
    text: code.slice(code.indexOf(':') + 1),
    meaning_vi: meaning,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  };
}

const coffee = word('word:coffee', 'cà phê');
const tea = word('word:tea', 'trà');

/** The button whose title is this text, pressed. */
function pressTitle(tree: ReactTestRenderer.ReactTestRenderer, title: string) {
  const node = tree.root.findAll(
    instance =>
      instance.props.title === title &&
      typeof instance.props.onPress === 'function',
  )[0];
  expect(node).toBeDefined();
  act(() => {
    node!.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLearn.mockResolvedValue({
    ok: true,
    value: {
      request_id: 'r',
      status: 'success',
      enrolled: 1,
      already_scheduled: 0,
    },
  });
});

describe('QuickKnownCheckScreen', () => {
  it('sends the words answered right both times as known', async () => {
    const questions: QuizQuestion[] = [
      {
        itemCode: 'word:coffee',
        prompt: 'coffee',
        options: ['cà phê', 'trà', 'nước'],
        answerIndex: 0,
      },
      {
        itemCode: 'word:tea',
        prompt: 'tea',
        options: ['nước', 'trà', 'sữa'],
        answerIndex: 1,
      },
      {
        itemCode: 'word:coffee',
        prompt: 'coffee',
        options: ['cà phê', 'sữa', 'nước'],
        answerIndex: 0,
      },
      {
        itemCode: 'word:tea',
        prompt: 'tea',
        options: ['trà', 'sữa', 'nước'],
        answerIndex: 1,
      },
    ];
    const tree = renderWithTheme(
      <QuickKnownCheckScreen
        questions={questions}
        route={{params: {packId: 'pack-1'}}}
      />,
    );
    // coffee: right, right. tea: wrong, then right, so only coffee is known.
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');

    expect(has(tree, 'quick-check-done')).toBe(true);
    await act(async () => {
      press(tree, 'quick-check-save');
    });
    expect(mockLearn).toHaveBeenCalledWith('pack-1', {
      itemCodes: ['word:coffee'],
      mode: 'known',
    });
  });
});

describe('PackLearnScreen', () => {
  it('writes the word from its meaning, then goes back to the same card', () => {
    const tree = renderWithTheme(
      <PackLearnScreen
        items={[coffee, tea]}
        route={{params: {packId: 'pack-2'}}}
      />,
    );
    press(tree, 'pack-learn-write-word');
    expect(textOf(tree, 'pack-learn-write-meaning')).toBe('cà phê');
    expect(has(tree, 'pack-learn-next-card')).toBe(false);
    for (const key of coffee.text.split('')) {
      press(tree, `pack-learn-write-input-key-${key}`);
    }
    press(tree, 'pack-learn-write-check');
    expect(textOf(tree, 'pack-learn-write-verdict')).toBe('Chính xác!');
    press(tree, 'pack-learn-write-done');
    expect(has(tree, `pack-learn-card-${coffee.code}`)).toBe(true);
    expect(mockLearn).not.toHaveBeenCalled();
  });

  it('learns the words answered right in the recognition pass', async () => {
    const tree = renderWithTheme(
      <PackLearnScreen
        items={[coffee, tea]}
        route={{params: {packId: 'pack-2'}}}
      />,
    );
    press(tree, 'pack-learn-next-card');
    press(tree, 'pack-learn-next-card');

    // The questions come in a random order: answer each with the meaning of the word it asks.
    for (const index of [0, 1]) {
      const card = textOf(tree, `pack-learn-question-${index}`);
      const asked = card.includes(coffee.text) ? coffee : tea;
      pressTitle(tree, asked.meaning_vi);
      press(tree, 'pack-learn-next-question');
    }

    // The save resolves after the last answer; let it finish inside act.
    await act(async () => {
      await Promise.resolve();
    });
    expect(has(tree, 'pack-learn-done')).toBe(true);
    expect(mockLearn).toHaveBeenCalledTimes(1);
    const [packId, body] = mockLearn.mock.calls[0]!;
    expect(packId).toBe('pack-2');
    expect(body.mode).toBe('learn');
    expect([...body.itemCodes].sort()).toEqual(['word:coffee', 'word:tea']);
  });
});
