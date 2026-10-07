/**
 * F9: Home's review badge and the Daily Review screen must report the same
 * number of due cards — both read the local SRS via `getDueFlashcards()`.
 */

import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {buildShortcutItems} from '@features/home/logic/homeScreenModel';
import {
  DailyReviewScreen,
  getDueFlashcards,
  saveFlashcard,
} from '@features/review';

import {AppThemeProvider} from '@ui/theme';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {validFullOutput} from '@core/fixtures';
import {FeatureFlagProvider} from '@core/release';

import {__resetMockDatabases} from '../../../test-utils/sqliteMock';
import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '../support';

const SOFT_CAP = 10;

function saveCard(index: number, meaningVi: string) {
  const result = saveFlashcard({
    lessonId: 'lesson-1',
    vocabulary: {
      ...validFullOutput.vocabulary[0],
      id: `word-${index}`,
      word: `word${index}`,
      meaning_vi: meaningVi,
    },
    now: '2026-08-17T00:00:00.000Z',
  });
  expect(result.ok).toBe(true);
}

function homeReviewBadgeCount(): number | null {
  const review = buildShortcutItems({
    dueFlashcardCount: getDueFlashcards().length,
  }).find(item => item.key === 'review');
  return review?.badgeCount ?? null;
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('F9: due-card count parity between Home and Daily Review', () => {
  let tree: ReactTestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
  });

  afterEach(() => {
    if (tree) {
      const mounted = tree;
      act(() => {
        mounted.unmount();
      });
      tree = null;
    }
  });

  async function renderReview() {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
        >
          <AppThemeProvider>
            <DailyReviewScreen softCap={SOFT_CAP} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
      await Promise.resolve();
    });
    return tree as unknown as ReactTestRenderer.ReactTestRenderer;
  }

  it('session size plus carry-over equals the Home badge count', async () => {
    for (let i = 0; i < 13; i += 1) {
      saveCard(i, `nghĩa ${i}`);
    }
    // Untranslated cards are excluded from the due queue on both screens.
    saveCard(99, '   ');

    expect(homeReviewBadgeCount()).toBe(13);

    const rendered = await renderReview();
    const text = textOf(rendered);
    expect(text).toContain(`1 / ${SOFT_CAP}`);
    expect(text).toContain(`còn ${13 - SOFT_CAP} thẻ để dành lần ôn sau`);
  });

  it('shows no badge and an empty review when nothing is due', async () => {
    saveCard(0, '');

    expect(homeReviewBadgeCount()).toBeNull();

    const rendered = await renderReview();
    expect(
      rendered.root.findAll(
        node => node.props.testID === 'daily-review-flip-card',
      ),
    ).toHaveLength(0);
  });
});
