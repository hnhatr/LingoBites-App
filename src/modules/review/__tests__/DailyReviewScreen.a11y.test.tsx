import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {saveFlashcard} from '@shared/db/FlashcardRepository';
import {validFullOutput} from '@shared/fixtures';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DailyReviewScreen} from '../DailyReviewScreen';
import {getAnnouncedText} from '../../../../test-utils/a11yTestUtils';

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

describe('DailyReviewScreen - Accessibility', () => {
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

  describe('Review Session Screen', () => {
    it('has accessible close button', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const closeButton = tree.root.findByProps({testID: 'review-close'});
      expect(getAnnouncedText(closeButton)).toBe('Đóng phiên ôn tập');
      expect(closeButton.props.accessibilityRole).toBe('button');
    });

    it('has accessible FlipCard', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      // FlipCard's testID is on the inner Pressable which has the accessibility props.
      // It intentionally has no static accessibilityLabel so descendant card text
      // remains announced.
      const flipCardPressables = tree.root.findAll(
        node =>
          node.props.testID === 'daily-review-flip-card' &&
          node.props.accessibilityRole === 'button',
      );
      expect(flipCardPressables.length).toBeGreaterThan(0);

      const flipCard = flipCardPressables[0];
      expect(flipCard.props.accessibilityLabel).toBeUndefined();
      expect(flipCard.props.accessibilityRole).toBe('button');
      expect(flipCard.props.accessibilityHint).toBe('Chạm để lật thẻ');
      expect(flipCard.props.accessibilityState).toEqual({expanded: false});
      expect(flipCard.props.accessibilityValue).toEqual({text: 'Mặt trước'});
    });

    it('announces flashcard word/meaning on the FlipCard', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const flipCard = tree.root.findAll(
        node =>
          node.props.testID === 'daily-review-flip-card' &&
          node.props.accessibilityRole === 'button',
      )[0];

      expect(getAnnouncedText(flipCard)).toContain('word-1');
    });

    it('has accessible RatingControl buttons', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const ratingButtons = ['rating-forgot', 'rating-remembered'];
      const skipButton = tree.root.findByProps({testID: 'rating-skip'});

      expect(typeof skipButton.props.accessibilityLabel).toBe('string');
      expect(skipButton.props.accessibilityRole).toBe('button');

      for (const testID of ratingButtons) {
        const button = tree.root.findByProps({testID});
        expect(typeof button.props.accessibilityLabel).toBe('string');
        expect(button.props.accessibilityRole).toBe('button');
      }
    });

    it('gates rating buttons behind a reveal for accessibility', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const ratingButtons = [
        'rating-forgot',
        'rating-remembered',
        'rating-skip',
      ];
      for (const testID of ratingButtons) {
        const button = tree.root.findByProps({testID});
        expect(button.props.disabled).toBe(true);
        // SETE-254: the announced state must match the real disabled prop —
        // a greyed-but-live control is the false affordance this gates.
        expect(button.props.accessibilityState).toEqual({disabled: true});
      }

      await revealCard(tree);

      for (const testID of ratingButtons) {
        const button = tree.root.findByProps({testID});
        expect(button.props.disabled).toBe(false);
        expect(button.props.accessibilityState).toEqual({disabled: false});
      }
    });

    it('ignores a pre-flip rating so it cannot corrupt the schedule (SETE-254)', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      // A tap on a disabled control never fires on device; invoking the
      // handler directly proves the screen-level flip gate holds regardless.
      await act(async () => {
        tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
      });
      await act(async () => {
        tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
      });

      const progress = tree.root.findByProps({testID: 'review-progress'});
      expect(
        progress.findAllByProps({children: '1 / 1'}).length,
      ).toBeGreaterThan(0);
      expect(tree.root.findAllByProps({testID: 'review-summary'}).length).toBe(
        0,
      );
    });

    it('has accessible progress indicator', async () => {
      seedCards(3);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const progress = tree.root.findByProps({testID: 'review-progress'});
      expect(progress).toBeTruthy();
      expect(
        progress.findAllByProps({children: '1 / 3'}).length,
      ).toBeGreaterThan(0);
      // The counter is a real progressbar, not plain text (SETE-255).
      expect(
        progress.findAllByProps({accessibilityRole: 'progressbar'}).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('Summary Screen', () => {
    it('has accessible summary content with testIDs', async () => {
      seedCards(2);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      await revealCard(tree);
      await act(async () => {
        tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
      });
      await revealCard(tree);
      await act(async () => {
        tree.root.findByProps({testID: 'rating-forgot'}).props.onPress();
      });

      const summary = tree.root.findByProps({testID: 'review-summary'});
      expect(summary).toBeTruthy();

      const reviewedCount = tree.root.findByProps({
        testID: 'summary-reviewed-count',
      });
      const rememberedCount = tree.root.findByProps({
        testID: 'summary-remembered-count',
      });
      const forgotCount = tree.root.findByProps({
        testID: 'summary-forgot-count',
      });

      expect(reviewedCount).toBeTruthy();
      expect(rememberedCount).toBeTruthy();
      expect(forgotCount).toBeTruthy();

      expect(reviewedCount.props.children).toBe(2);
      expect(rememberedCount.props.children).toBe(1);
      expect(forgotCount.props.children).toBe(1);
    });

    it('has accessible return button on summary', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      await revealCard(tree);
      await act(async () => {
        tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
      });

      // Find the "Quay về Home" button
      const buttons = tree.root.findAll(
        node =>
          node.props.accessibilityLabel === 'Quay về Home' &&
          typeof node.props.onPress === 'function',
      );

      expect(buttons.length).toBeGreaterThan(0);
      const returnButton = buttons[0];
      expect(getAnnouncedText(returnButton)).toBe('Quay về Home');
    });
  });

  describe('Empty States', () => {
    it('has meaningful content for empty state 06a (never saved)', async () => {
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const emptyMessages = tree.root.findAll(
        node =>
          node.props.children ===
          'Lưu flashcard đầu tiên để bắt đầu ôn mỗi ngày.',
      );

      expect(emptyMessages.length).toBeGreaterThan(0);
    });

    it('has meaningful content for empty state 06b (all done today)', async () => {
      seedCards(1);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      await revealCard(tree);
      await act(async () => {
        tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
      });

      const secondTree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} />,
      );

      const doneMessages = secondTree.root.findAll(
        node =>
          node.props.children === 'Bạn đã ôn xong tất cả thẻ đến hạn hôm nay.',
      );

      expect(doneMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Banner Accessibility', () => {
    it('has testID for banner when carry-over exists', async () => {
      seedCards(7);
      const tree = await renderScreen(
        <DailyReviewScreen navigation={navigation() as never} softCap={5} />,
      );

      const banner = tree.root.findByProps({testID: 'review-banner'});
      expect(banner).toBeTruthy();
    });
  });
});
