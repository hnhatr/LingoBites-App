/**
 * E2E Integration Test: Flashcard Feature Full Flow
 *
 * Tests the complete user journey:
 * 1. Save flashcard from vocabulary
 * 2. See it in flashcard list
 * 3. Open daily review from Home
 * 4. Rate the card
 * 5. See summary screen
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
  listFlashcards,
  getDueFlashcards,
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
    setOptions: jest.fn(),
  };
}

describe('E2E: Flashcard Feature - Complete Flow', () => {
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

  it('completes full flow: save → list → review → rate → summary', async () => {
    // === STEP 1: Save flashcard from vocabulary ===
    const vocabulary = validFullOutput.vocabulary[0];
    const saveResult = saveFlashcard({
      lessonId: 'lesson-1',
      vocabulary,
      now: '2026-08-17T00:00:00.000Z', // Ensure it's due for review
    });

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      throw new Error('Failed to save flashcard');
    }

    const flashcardId = saveResult.flashcardId;

    // === STEP 2: Verify flashcard appears in list ===
    const allFlashcards = listFlashcards();
    expect(allFlashcards.length).toBe(1);
    expect(allFlashcards[0].id).toBe(flashcardId);
    expect(allFlashcards[0].word).toBe(vocabulary.word);
    expect(allFlashcards[0].meaningVi).toBe(vocabulary.meaning_vi);

    // === STEP 3: Verify flashcard is due for review ===
    const dueCards = getDueFlashcards();
    expect(dueCards.length).toBe(1);
    expect(dueCards[0].id).toBe(flashcardId);

    // === STEP 4: Open daily review session ===
    const reviewNav = createMockNavigation();
    const reviewTree = await renderScreen(
      <DailyReviewScreen navigation={reviewNav as never} />,
    );

    // Verify review session shows the card
    const flipCard = reviewTree.root.findAll(
      node => node.props.testID === 'daily-review-flip-card',
    );
    expect(flipCard.length).toBeGreaterThan(0);

    // Verify progress shows "1 / 1"
    const progress = reviewTree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1 / 1'}).length).toBeGreaterThan(
      0,
    );

    // === STEP 5: Rate the card as "remembered" ===
    const rememberedButton = reviewTree.root.findByProps({
      testID: 'rating-remembered',
    });
    await revealCard(reviewTree);
    await act(async () => {
      rememberedButton.props.onPress();
    });

    // === STEP 6: Verify summary screen appears ===
    const summary = reviewTree.root.findByProps({testID: 'review-summary'});
    expect(summary).toBeTruthy();

    // Verify summary stats
    const reviewedCount = reviewTree.root.findByProps({
      testID: 'summary-reviewed-count',
    });
    const rememberedCount = reviewTree.root.findByProps({
      testID: 'summary-remembered-count',
    });
    const forgotCount = reviewTree.root.findByProps({
      testID: 'summary-forgot-count',
    });

    expect(reviewedCount.props.children).toBe(1);
    expect(rememberedCount.props.children).toBe(1);
    expect(forgotCount.props.children).toBe(0);

    // Session completion wrote gamification events: XP is shown on the summary.
    const xpEarned = reviewTree.root.findByProps({testID: 'summary-xp-earned'});
    expect(xpEarned).toBeTruthy();

    // Verify return button is present
    const returnButtons = reviewTree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Quay về Home' &&
        typeof node.props.onPress === 'function',
    );
    expect(returnButtons.length).toBeGreaterThan(0);

    // === STEP 7: Verify card is no longer due (was marked as remembered) ===
    const dueAfterReview = getDueFlashcards();
    expect(dueAfterReview.length).toBe(0); // Card should be rescheduled for future

    // === STEP 8: Verify flashcard still exists in list ===
    const flashcardsAfterReview = listFlashcards();
    expect(flashcardsAfterReview.length).toBe(1);
    expect(flashcardsAfterReview[0].id).toBe(flashcardId);
  });

  it('handles multiple cards in review session', async () => {
    // Save 3 flashcards
    const flashcardIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const vocab = {
        ...validFullOutput.vocabulary[0],
        id: `word-${i}`,
        word: `testword${i}`,
        meaning_vi: `meaning ${i}`,
      };
      const result = saveFlashcard({
        lessonId: 'lesson-1',
        vocabulary: vocab,
        now: '2026-08-17T00:00:00.000Z',
      });

      if (result.ok) {
        flashcardIds.push(result.flashcardId);
      }
    }

    expect(flashcardIds.length).toBe(3);

    // Start review session
    const nav = createMockNavigation();
    const tree = await renderScreen(
      <DailyReviewScreen navigation={nav as never} />,
    );

    // Verify progress shows "1 / 3"
    let progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '1 / 3'}).length).toBeGreaterThan(
      0,
    );

    // Rate first card as remembered
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-remembered'}).props.onPress();
    });

    // Verify progress shows "2 / 3"
    progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '2 / 3'}).length).toBeGreaterThan(
      0,
    );

    // Rate second card as forgot
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-forgot'}).props.onPress();
    });

    // Verify progress shows "3 / 3"
    progress = tree.root.findByProps({testID: 'review-progress'});
    expect(progress.findAllByProps({children: '3 / 3'}).length).toBeGreaterThan(
      0,
    );

    // Skip third card
    await revealCard(tree);
    await act(async () => {
      tree.root.findByProps({testID: 'rating-skip'}).props.onPress();
    });

    // Verify summary appears with correct stats
    const summary = tree.root.findByProps({testID: 'review-summary'});
    expect(summary).toBeTruthy();

    const reviewedCount = tree.root.findByProps({
      testID: 'summary-reviewed-count',
    });
    const rememberedCount = tree.root.findByProps({
      testID: 'summary-remembered-count',
    });
    const forgotCount = tree.root.findByProps({testID: 'summary-forgot-count'});

    expect(reviewedCount.props.children).toBe(3);
    expect(rememberedCount.props.children).toBe(1);
    expect(forgotCount.props.children).toBe(1);
  });
});
