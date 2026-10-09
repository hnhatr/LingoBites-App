import React from 'react';
import {act} from 'react-test-renderer';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {LessonActivityAttemptPayloadSchema} from '@core/schemas/sync';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {LessonFlowPlayerScreen} from '../LessonFlowPlayerScreen';

jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));

const mockRequestSync = jest.fn();
jest.mock('@features/sync', () => ({requestSync: () => mockRequestSync()}));

jest.mock('@features/speaking', () => ({loadLessonRecorder: () => null}));

const snapshot = seedSnapshot();
let mockState: {status: string; [key: string]: unknown};

jest.mock('../../../player/logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => ({
    state: mockState,
    open: jest.fn(),
    checkForUpdate: jest.fn(),
    requestAnalysis: jest.fn(),
  }),
}));

function renderScreen() {
  const navigation = {goBack: jest.fn()};
  const tree = renderWithTheme(
    <LessonFlowPlayerScreen
      navigation={navigation as never}
      route={{params: {lessonId: snapshot.id}} as never}
    />,
  );
  return {tree, navigation};
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  mockState = {status: 'ready', snapshot, offline: false, hasUpdate: false};
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('LessonFlowPlayerScreen (shell)', () => {
  it('opens a new lesson on step 1 and walks the steps', () => {
    const {tree} = renderScreen();
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Bước 1: Ôn liên quan');

    press(tree, 'lesson-flow-next');
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Bước 2: Nghe hiểu');

    press(tree, 'lesson-flow-step-3');
    expect(textOf(tree, 'lesson-flow-step-title')).toContain('Bước 3');
    const activity = snapshot.blocks.find(
      block => block.type === 'activity' && block.step === 3,
    )!;
    expect(has(tree, `lesson-flow-activity-${activity.id}`)).toBe(true);

    press(tree, 'lesson-flow-step-6');
    expect(textOf(tree, 'lesson-flow-practice-status')).toBe(
      'Còn 2 hoạt động luyện',
    );
    expect(has(tree, 'lesson-flow-next')).toBe(false);
  });

  it('closes from the result step', () => {
    const {tree, navigation} = renderScreen();
    press(tree, 'lesson-flow-step-6');
    press(tree, 'lesson-flow-back-to-lesson');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('step 1 says when there is nothing to review', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-flow-review-empty')).toBe(true);
    expect(has(tree, 'lesson-flow-step-empty')).toBe(false);
  });

  it('says when the lesson has no steps', () => {
    mockState = {
      status: 'ready',
      // A plain learner lesson: no spec (S4.3 runs learner lessons that have one).
      snapshot: {...snapshot, origin: 'learner', spec: null},
      offline: false,
      hasUpdate: false,
    };
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-flow-not-curriculum')).toBe(true);
  });

  it('records one attempt per finished activity and resumes after them', () => {
    const {tree} = renderScreen();
    press(tree, 'lesson-flow-step-3');
    for (let i = 0; i < 3; i += 1) {
      press(tree, 'lesson-flow-self-pass');
      press(tree, 'lesson-flow-entry-next');
    }
    expect(textOf(tree, 'lesson-flow-activity-outcome')).toBe(
      'Đạt, tự làm được',
    );
    press(tree, 'lesson-flow-next');
    press(tree, 'lesson-flow-self-fail');
    press(tree, 'lesson-flow-entry-next');
    for (let i = 0; i < 3; i += 1) {
      press(tree, 'lesson-flow-self-pass');
      press(tree, 'lesson-flow-entry-next');
    }
    press(tree, 'lesson-flow-step-6');
    expect(textOf(tree, 'lesson-flow-practice-status')).toBe(
      'Đã hoàn thành phần luyện',
    );
    expect(mockRequestSync).toHaveBeenCalledTimes(2);

    const rows = getDatabase().execute(
      `SELECT payload_json FROM sync_outbox
        WHERE event_type = 'activity_attempts' ORDER BY created_at;`,
    ).rows!;
    const payloads = [0, 1].map(i =>
      LessonActivityAttemptPayloadSchema.parse(
        JSON.parse(
          String((rows.item(i) as {payload_json: string}).payload_json),
        ),
      ),
    );
    expect(
      payloads.map(p => [p.activity, p.step, p.outcome, p.assessed_by]),
    ).toEqual([
      ['listen_and_repeat', 3, 'pass_independent', 'self'],
      ['speaking_drill', 4, 'fail', 'self'],
    ]);
    expect(payloads[1]!.item_keys).toContain('pattern:can-i-have');
    expect(payloads[0]!.session_id).toBe(payloads[1]!.session_id);

    // G6/G7: the lesson completes once and each activity marks a streak day.
    expect(
      getDatabase()
        .execute('SELECT status FROM lesson_progress WHERE lesson_id = ?;', [
          snapshot.id,
        ])
        .rows?.item(0),
    ).toEqual({status: 'completed'});
    const events = getDatabase().execute(
      `SELECT event_type, COUNT(*) AS n FROM gamification_events
        GROUP BY event_type ORDER BY event_type;`,
    ).rows?._array;
    expect(events).toEqual([
      {event_type: 'lesson_activity_completed', n: 2},
      {event_type: 'lesson_completed', n: 1},
    ]);

    act(() => {
      tree.unmount();
    });
    const again = renderScreen();
    expect(textOf(again.tree, 'lesson-flow-step-title')).toContain('Bước 5');

    // Step 5: independent use, judged against the task's criteria (PR 11).
    expect(has(again.tree, 'lesson-flow-situation')).toBe(true);
    press(again.tree, 'lesson-flow-independent-done');
    for (const criterion of ['purpose', 'content', 'clarity', 'independence']) {
      press(again.tree, `lesson-flow-criterion-${criterion}`);
    }
    press(again.tree, 'lesson-flow-criteria-save');
    const last = getDatabase().execute(
      `SELECT payload_json FROM sync_outbox
        WHERE event_type = 'activity_attempts'
        ORDER BY created_at DESC LIMIT 1;`,
    ).rows!;
    expect(
      LessonActivityAttemptPayloadSchema.parse(
        JSON.parse(
          String((last.item(0) as {payload_json: string}).payload_json),
        ),
      ),
    ).toMatchObject({
      activity: 'role_play',
      step: 5,
      support_level: 'none',
      outcome: 'pass_independent',
      assessed_by: 'self',
    });

    // Step 6 keeps practice and independent use apart (G7).
    press(again.tree, 'lesson-flow-step-6');
    expect(has(again.tree, 'lesson-flow-result-practice')).toBe(true);
    const stepFive = snapshot.blocks.find(
      block => block.type === 'activity' && block.step === 5,
    )!;
    expect(textOf(again.tree, 'lesson-flow-result-independent')).toContain(
      'Vận dụng',
    );
    expect(textOf(again.tree, `lesson-flow-result-${stepFive.id}`)).toContain(
      'Đạt, tự làm được',
    );
  });
});
