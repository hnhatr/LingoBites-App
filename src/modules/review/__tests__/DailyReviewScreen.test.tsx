import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {saveFlashcard} from '@shared/db/FlashcardRepository';
import * as FlashcardRepository from '@shared/db/FlashcardRepository';
import {validFullOutput} from '@shared/fixtures';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DailyReviewScreen} from '../DailyReviewScreen';

const renderedTrees: ReactTestRenderer.ReactTestRenderer[] = [];

function navigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    popToTop: jest.fn(),
  };
}

async function renderScreen(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  renderedTrees.push(tree);
  return tree;
}

function revealCard(tree: ReactTestRenderer.ReactTestRenderer) {
  return act(async () => {
    const flipCard = tree.root.find(
      node =>
        node.props.testID === 'daily-review-flip-card' &&
        typeof node.props.onPress === 'function',
    );
    flipCard.props.onPress();
  });
}

function seedCards(count: number) {
  const lessonId = `review-lesson-${count}`;

  return Array.from({length: count}, (_, index) => {
    const vocab = {
      ...validFullOutput.vocabulary[0],
      id: `review-word-${count}-${index}`,
      word: `word-${index + 1}`,
      meaning_vi: `meaning-${index + 1}`,
    };
    const result = saveFlashcard({
      lessonId,
      vocabulary: vocab,
      now: '2026-08-17T00:00:00.000Z',
    });
    if (!result.ok) {
      throw new Error('Could not seed flashcard');
    }
    return result.flashcardId;
  });
}

describe('DailyReviewScreen', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
    jest.restoreAllMocks();
  });

  it('uses the session snapshot size for progress and shows carry-over at the soft cap', async () => {
    seedCards(7);
    const nav = navigation();

    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} softCap={5} />,
    );

    const progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1 / 5'}).length).toBeGreaterThan(
      0,
    );
    expect(
      progress.findAllByProps({accessibilityRole: 'progressbar'}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({children: 'còn 2 thẻ để dành lần ôn sau'})
        .length,
    ).toBeGreaterThan(0);
  });

  it('skips through the session and renders the completion summary', async () => {
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} softCap={5} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'summary-reviewed-count'}).props.children,
    ).toBe(2);
    expect(
      tree.root.findByProps({testID: 'summary-remembered-count'}).props
        .children,
    ).toBe(1);
    expect(
      tree.root.findByProps({testID: 'summary-forgot-count'}).props.children,
    ).toBe(0);
  });

  it('shows distinct empty copy when no flashcards have ever been saved', async () => {
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      tree.root.findAllByProps({
        children: 'Lưu flashcard đầu tiên để bắt đầu ôn mỗi ngày.',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('shows distinct empty copy when all cards are done for today', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();

    const secondTree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      secondTree.root.findAllByProps({
        children: 'Bạn đã ôn xong tất cả thẻ đến hạn hôm nay.',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('renders the carry-over count on the summary when the soft cap leaves cards behind', async () => {
    seedCards(3);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} softCap={2} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findAllByProps({children: 'còn 1 thẻ để dành lần ôn sau'})
        .length,
    ).toBeGreaterThan(0);
  });

  it('exits without confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(1);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    // First card, no answers given: nothing at stake, no prompt (SETE-255).
    expect(alertSpy).not.toHaveBeenCalled();
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('confirms before exiting when rated progress would be lost (SETE-255)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Thoát buổi ôn tập?',
      'Tiến độ 1/2 sẽ không được lưu.',
      expect.arrayContaining([
        expect.objectContaining({text: 'Huỷ', style: 'cancel'}),
        expect.objectContaining({text: 'Thoát', style: 'destructive'}),
      ]),
    );
    expect(nav.goBack).not.toHaveBeenCalled();

    const quitButton = (
      alertSpy.mock.calls[0][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => void;
      }>
    ).find(button => button.style === 'destructive');
    await act(async () => {
      quitButton?.onPress?.();
    });

    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it('stays in the session when the exit confirmation is cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedCards(2);
    const nav = navigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({testID: 'review-close'}).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const stayButton = (
      alertSpy.mock.calls[0][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => void;
      }>
    ).find(button => button.style === 'cancel');
    await act(async () => {
      stayButton?.onPress?.();
    });

    expect(nav.goBack).not.toHaveBeenCalled();
    // Still mid-session on the second card.
    expect(
      tree.root
        .findByProps({testID: 'review-progress'})
        .findAllByProps({children: '2 / 2'}).length,
    ).toBeGreaterThan(0);
  });

  it('keeps rating controls disabled until the card is revealed', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    expect(
      tree.root.findByProps({testID: 'rating-remembered'}).props.disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({testID: 'rating-forgot'}).props.disabled,
    ).toBe(true);

    await revealCard(tree);

    expect(
      tree.root.findByProps({testID: 'rating-remembered'}).props.disabled,
    ).toBe(false);
    expect(
      tree.root.findByProps({testID: 'rating-forgot'}).props.disabled,
    ).toBe(false);
  });

  it('shows the translated error and does not advance when rating persistence fails', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    await revealCard(tree);

    const failure: {
      ok: false;
      errorCode: 'LOCAL_DB_ERROR';
      message: string;
    } = {
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
      message: 'Không thể lưu kết quả ôn tập. Vui lòng thử lại.',
    };
    const spy = jest
      .spyOn(FlashcardRepository, 'recordFlashcardRating')
      .mockReturnValue(failure);

    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1 / 1'}).length).toBeGreaterThan(
      0,
    );
    expect(tree.root.findAllByProps({testID: 'review-summary'})).toHaveLength(
      0,
    );
    expect(
      tree.root.findAllByProps({
        children: 'Không thể lưu kết quả ôn tập. Vui lòng thử lại.',
      }).length,
    ).toBeGreaterThan(0);

    spy.mockRestore();

    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'review-summary'})).toBeTruthy();
    expect(
      tree.root.findByProps({testID: 'summary-reviewed-count'}).props.children,
    ).toBe(1);
  });

  it('shows an English-only prompt on the front and the Vietnamese answer on the back (SETE-253)', async () => {
    seedCards(1);
    const tree = await renderScreen(
      <DailyReviewScreen navigation={navigation() as never} />,
    );

    const frontTexts = tree.root
      .findByProps({testID: 'review-card-front'})
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string);
    expect(frontTexts).toContain('word-1');
    expect(frontTexts.join('\n')).not.toContain('meaning-1');
    expect(tree.root.findByProps({testID: 'review-speak-front'})).toBeTruthy();
    expect(
      tree.root.findAllByProps({children: 'Nhấn để xem nghĩa'}).length,
    ).toBeGreaterThan(0);

    await revealCard(tree);

    const backTexts = tree.root
      .findByProps({testID: 'review-card-back'})
      .findAll(node => typeof node.props?.children === 'string')
      .map(node => node.props.children as string);
    expect(backTexts).toContain('meaning-1');
    expect(backTexts).toContain('word-1');
    expect(backTexts.join('\n')).not.toBe(frontTexts.join('\n'));
    expect(tree.root.findByProps({testID: 'review-speak-back'})).toBeTruthy();
  });
});
