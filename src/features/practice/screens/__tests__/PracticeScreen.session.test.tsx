import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {runMigrations} from '@core/db/migrations';
import {resetDatabaseForTests} from '@core/db/database';
import {
  savePracticeSet,
  savePracticeSession,
} from '../../logic/data/PracticeRepository';
import type {PracticeSet} from '@core/schemas/practice';
import {FeatureFlagProvider} from '@core/release';
import {AppThemeProvider} from '@ui/theme';
import {PracticeScreen} from '../PracticeScreen';

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
};

function makeSet(): PracticeSet {
  return {
    id: 'set-ui',
    contract_version: 1,
    status: 'ready',
    lesson_id: 'lesson-1',
    lesson_revision: 1,
    source_fingerprint: 'fp',
    config_hash: 'hash',
    difficulty: 'beginner',
    requested_count: 1,
    set_revision: 1,
    generator: {
      provider: 'test',
      model: 'test',
      prompt_version: 'v1',
      generator_version: 'generator-v1',
    },
    questions: [
      {
        id: 'q1',
        variant: 'meaning_choice',
        skill: 'vocabulary',
        difficulty: 'beginner',
        prompt_vi: 'Chọn nghĩa đúng của apple',
        explanation_vi: 'Apple là quả táo.',
        source_refs: [{kind: 'vocabulary', id: 'v1'}],
        source_snapshot: {snapshot_schema_version: 'snapshot-v1'},
        provenance: {generation_attempt: 1, prompt_version: 'v1'},
        validation: {validator_version: 'v1', checks: [], passed: true},
        vocabulary_id: 'v1',
        options: [
          {id: 'opt-a', text: 'quả táo'},
          {id: 'opt-b', text: 'quả cam'},
        ],
        correct_option_id: 'opt-a',
      },
    ],
    created_at: '2026-09-10T00:00:00Z',
    ready_at: '2026-09-10T00:01:00Z',
  };
}

beforeEach(() => {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  jest.clearAllMocks();
});

function renderSessionScreen(sessionId: string) {
  const route = {
    key: 'Practice',
    name: 'Practice' as const,
    params: {
      lessonId: 'lesson-1',
      sessionId,
      title: 'Luyện tập',
    },
  };

  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <PracticeScreen
            navigation={navigation as never}
            route={route as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('PracticeScreen session mode', () => {
  it('does not reveal the correct answer before submit', () => {
    savePracticeSet(makeSet());
    savePracticeSession({
      id: 'session-ui',
      practice_set_id: 'set-ui',
      set_revision: 1,
      lesson_id: 'lesson-1',
      lesson_revision: 1,
      status: 'in_progress',
      question_order: ['q1'],
      current_index: 0,
      attempt_no: 1,
      started_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
    });

    const tree = renderSessionScreen('session-ui');
    expect(
      tree.root.findByProps({testID: 'practice-option-opt-a'}),
    ).toBeTruthy();
    expect(
      tree.root.findAll(
        node =>
          node.props.state === 'correct' ||
          node.props.accessibilityLabel === 'quả táo, đúng',
      ),
    ).toHaveLength(0);
  });

  it('grades by option id and shows feedback after submit', () => {
    savePracticeSet(makeSet());
    savePracticeSession({
      id: 'session-ui',
      practice_set_id: 'set-ui',
      set_revision: 1,
      lesson_id: 'lesson-1',
      lesson_revision: 1,
      status: 'in_progress',
      question_order: ['q1'],
      current_index: 0,
      attempt_no: 1,
      started_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
    });

    const tree = renderSessionScreen('session-ui');
    const correctOption = tree.root.findByProps({
      testID: 'practice-option-opt-a',
    });

    ReactTestRenderer.act(() => {
      correctOption.props.onPress();
    });

    expect(tree.root.findByProps({testID: 'practice-feedback'})).toBeTruthy();
    expect(
      tree.root.findByProps({
        testID: 'practice-option-opt-a',
        state: 'correct',
      }),
    ).toBeTruthy();
  });

  it('runs offline through to the result screen without network', () => {
    const fetchSpy = jest.fn();
    (global as unknown as {fetch: unknown}).fetch = fetchSpy;

    savePracticeSet(makeSet());
    savePracticeSession({
      id: 'session-offline',
      practice_set_id: 'set-ui',
      set_revision: 1,
      lesson_id: 'lesson-1',
      lesson_revision: 1,
      status: 'in_progress',
      question_order: ['q1'],
      current_index: 0,
      attempt_no: 1,
      started_at: '2026-09-10T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
    });

    const tree = renderSessionScreen('session-offline');
    const correctOption = tree.root.findByProps({
      testID: 'practice-option-opt-a',
    });

    ReactTestRenderer.act(() => {
      correctOption.props.onPress();
    });
    ReactTestRenderer.act(() => {
      tree.root.findByProps({testID: 'practice-next-button'}).props.onPress();
    });

    expect(tree.root.findByProps({testID: 'practice-result'})).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
