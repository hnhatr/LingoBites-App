import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import * as AuthSession from '@core/auth/authSession';
import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';
import {seedCanonicalLessonDownload} from '@test/support/canonicalDownloadSeed';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {startReviewSession} from '../../../engagement/logic/reviewSession';
import {HomeScreen} from '../HomeScreen';

const EXPLORE_IDS = [
  'home-explore-video',
  'home-explore-news',
  'home-explore-offline',
  'home-explore-practice',
];

const CONTINUE_NULL = {
  request_id: 'req-continue-null',
  status: 'success',
  progress: null,
};

const validSession = {
  status: 'valid' as const,
  session: {
    access_token: 'test-token',
    session_id: '1',
    refresh_token: '2',
    access_expires_at: '2050',
    refresh_expires_at: '2050',
  },
  userId: 'user1',
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function navigation() {
  return {
    navigate: jest.fn(),
    getParent: () => ({
      navigate: jest.fn(),
      getParent: () => ({navigate: jest.fn()}),
    }),
  };
}

let activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    for (const tree of activeRenderers) {
      tree.unmount();
    }
    activeRenderers = [];
  });
});

async function renderHomeWithContinue() {
  seedCanonicalLessonDownload();
  mockFetch.mockImplementation(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      request_id: 'req-continue-1',
      status: 'success',
      progress: {
        id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        lesson_id: '33333333-3333-4333-8333-333333333301',
        status: 'in_progress',
        started_at: '2026-09-25T07:00:00.000Z',
        completed_at: null,
        created_at: '2026-09-25T07:00:00.000Z',
        updated_at: '2026-09-25T07:15:00.000Z',
      },
    }),
  }));
  jest.spyOn(AuthSession, 'ensureValidSession').mockResolvedValue(validSession);

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <HomeScreen navigation={navigation() as never} route={{} as never} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  activeRenderers.push(tree);
  return tree;
}

function seedOneSessionToday() {
  const now = new Date().toISOString();
  const session = startReviewSession();
  session.record({
    flashcardId: 'streak-pill-seed-card',
    rating: 'remembered',
    dueAt: now,
    reviewedAt: now,
  });
  const outcome = session.finish(now);
  if (!outcome?.ok) throw new Error('Could not seed review session');
}

describe('HomeScreen hero streak + explore slots (LING-221)', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    jest.restoreAllMocks();
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => CONTINUE_NULL,
    }));
  });

  it('does not show a header streak pill', async () => {
    seedOneSessionToday();
    const tree = await renderHomeWithContinue();
    expect(
      tree.root.findAll(node => node.props.testID === 'home-streak-pill')
        .length,
    ).toBe(0);
  });

  it('shows the streak badge on the studying hero when streak > 0', async () => {
    seedOneSessionToday();
    const tree = await renderHomeWithContinue();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Chuỗi 1 ngày');
  });

  it('renders no badge or tag slots on explore cells', async () => {
    const tree = await renderHomeWithContinue();
    for (const id of EXPLORE_IDS) {
      expect(
        tree.root.findAll(node => node.props.testID === `${id}-badge`).length,
      ).toBe(0);
      expect(
        tree.root.findAll(node => node.props.testID === `${id}-tag`).length,
      ).toBe(0);
      expect(
        tree.root.findAll(node => node.props.testID === `${id}-arrow`).length,
      ).toBe(0);
    }
  });

  it('exposes exactly one button per explore cell', async () => {
    const tree = await renderHomeWithContinue();
    for (const id of EXPLORE_IDS) {
      const buttons = tree.root
        .findAll(node => node.props.testID === id)
        .filter(
          node =>
            typeof node.props.onPress === 'function' &&
            node.props.accessibilityRole === 'button',
        );
      expect(buttons.length).toBe(1);
    }
  });
});
