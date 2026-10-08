import React from 'react';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

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

jest.mock('@features/sync', () => ({requestSync: jest.fn()}));

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
});
