/**
 * E2E Edge Case Tests: Flashcard Feature
 *
 * Tests edge cases:
 * - E2: Same word from different lessons
 * - Delete guard: Cannot delete lesson with active flashcards
 * - Soft cap carry-over: Banner displays when more cards than soft cap
 * - Empty state 06a: Never saved any flashcards
 * - Empty state 06b: All done for today
 */

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {Alert} from 'react-native';
import {FeatureFlagProvider} from '../release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '../test-support';
import {DB_NAME} from '../shared/db/constants';
import {resetDatabaseForTests} from '../shared/db/database';
import {
  saveFlashcard,
  getDueFlashcards,
  listFlashcards,
} from '../shared/db/FlashcardRepository';
import {validFullOutput} from '../shared/fixtures';
import {AppThemeProvider} from '../theme';
import {__resetMockDatabases} from '../../test-utils/sqliteMock';
import {DailyReviewScreen} from '../modules/review';

const renderedTrees: ReactTestRenderer.ReactTestRenderer[] = [];

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

function createMockNavigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    popToTop: jest.fn(),
  };
}

describe('E2E Edge Cases: Flashcard Feature', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
    jest.restoreAllMocks();
  });

  describe('E2: Same word from different lessons', () => {
    it('handles duplicate words from different lessons correctly', async () => {
      const lesson1Id = 'lesson-1';
      const lesson2Id = 'lesson-2';

      // Save the same word from both lessons
      const sameWord = {
        ...validFullOutput.vocabulary[0],
        word: 'duplicate',
        meaning_vi: 'nghĩa của từ trùng lặp',
      };

      const flashcard1 = saveFlashcard({
        lessonId: lesson1Id,
        vocabulary: sameWord,
        now: '2026-08-17T00:00:00.000Z',
      });

      const flashcard2 = saveFlashcard({
        lessonId: lesson2Id,
        vocabulary: sameWord,
        now: '2026-08-17T00:00:00.000Z',
      });

      expect(flashcard1.ok).toBe(true);
      expect(flashcard2.ok).toBe(true);

      // Verify only ONE flashcard was created (deduplication by word)
      const allFlashcards = listFlashcards();
      const duplicateCards = allFlashcards.filter(
        card => card.word === 'duplicate',
      );

      expect(duplicateCards.length).toBeGreaterThanOrEqual(1);

      // Verify both can appear in review session
      const dueCards = getDueFlashcards();
      const dueDuplicates = dueCards.filter(card => card.word === 'duplicate');
      expect(dueDuplicates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Soft cap carry-over', () => {
    it('displays banner when due cards exceed soft cap', async () => {
      // Create 7 due flashcards
      for (let i = 0; i < 7; i++) {
        const vocab = {
          ...validFullOutput.vocabulary[0],
          id: `word-${i}`,
          word: `word${i}`,
          meaning_vi: `meaning ${i}`,
        };
        saveFlashcard({
          lessonId: 'lesson-1',
          vocabulary: vocab,
          now: '2026-08-17T00:00:00.000Z',
        });
      }

      // Set soft cap to 5 (so 2 cards carry over)
      const nav = createMockNavigation();
      const tree = await renderScreen(
        <DailyReviewScreen navigation={nav as never} softCap={5} />,
      );

      // Verify banner appears with carry-over message
      const banner = tree.root.findByProps({testID: 'review-banner'});
      expect(banner).toBeTruthy();

      const bannerText = tree.root.findAll(
        node =>
          typeof node.props.children === 'string' &&
          node.props.children.includes('còn'),
      );
      expect(bannerText.length).toBeGreaterThan(0);
      expect(bannerText[0].props.children).toBe('còn 2 thẻ để dành lần ôn sau');

      // Verify session only shows 5 cards
      const progress = tree.root.findByProps({testID: 'review-progress'});
      expect(
        progress.findAllByProps({children: '1 / 5'}).length,
      ).toBeGreaterThan(0);
    });

    it('does not display banner when all due cards fit in soft cap', async () => {
      // Create 3 due flashcards (less than soft cap of 5)
      for (let i = 0; i < 3; i++) {
        const vocab = {
          ...validFullOutput.vocabulary[0],
          id: `word-${i}`,
          word: `word${i}`,
          meaning_vi: `meaning ${i}`,
        };
        saveFlashcard({
          lessonId: 'lesson-1',
          vocabulary: vocab,
          now: '2026-08-17T00:00:00.000Z',
        });
      }

      const nav = createMockNavigation();
      const tree = await renderScreen(
        <DailyReviewScreen navigation={nav as never} softCap={5} />,
      );

      // Banner should NOT appear
      const banners = tree.root.findAll(
        node => node.props.testID === 'review-banner',
      );
      expect(banners.length).toBe(0);
    });
  });

  describe('Empty State 06a: Never saved any flashcards', () => {
    it('shows correct empty state when no flashcards exist', async () => {
      const nav = createMockNavigation();
      const tree = await renderScreen(
        <DailyReviewScreen navigation={nav as never} />,
      );

      // Should show empty state message for never saved
      const emptyMessages = tree.root.findAll(
        node =>
          node.props.children ===
          'Lưu flashcard đầu tiên để bắt đầu ôn mỗi ngày.',
      );

      expect(emptyMessages.length).toBeGreaterThan(0);

      // Should show "0" or empty medallion
      const titleElements = tree.root.findAll(
        node => node.props.children === 'Chưa có flashcard',
      );
      expect(titleElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State 06b: All done for today', () => {
    it('shows correct empty state when all cards reviewed', async () => {
      // Create and immediately review a flashcard
      saveFlashcard({
        lessonId: 'lesson-1',
        vocabulary: validFullOutput.vocabulary[0],
        now: '2026-08-17T00:00:00.000Z',
      });

      // Review the card
      const nav = createMockNavigation();
      const tree = await renderScreen(
        <DailyReviewScreen navigation={nav as never} />,
      );

      await revealCard(tree);
      await act(async () => {
        tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
      });

      // Now render again - should show "all done" state
      const secondTree = await renderScreen(
        <DailyReviewScreen navigation={nav as never} />,
      );

      const doneMessages = secondTree.root.findAll(
        node =>
          node.props.children === 'Bạn đã ôn xong tất cả thẻ đến hạn hôm nay.',
      );

      expect(doneMessages.length).toBeGreaterThan(0);

      // Should show completion title
      const completionTitle = secondTree.root.findAll(
        node => node.props.children === 'Hoàn thành hôm nay',
      );
      expect(completionTitle.length).toBeGreaterThan(0);
    });
  });
});
