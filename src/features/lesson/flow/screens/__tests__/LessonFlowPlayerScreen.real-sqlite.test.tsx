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

  it('says when the lesson has no steps', () => {
    mockState = {
      status: 'ready',
      snapshot: {...snapshot, origin: 'learner'},
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

    act(() => {
      tree.unmount();
    });
    const again = renderScreen();
    expect(textOf(again.tree, 'lesson-flow-step-title')).toContain('Bước 5');
  });
});
